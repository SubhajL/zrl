import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../database/database.constants';
import {
  DEFAULT_AUDIT_PAGE_SIZE,
  MAX_AUDIT_PAGE_SIZE,
} from './audit.constants';
import type {
  AuditEntryFilters,
  AuditEntryRecord,
  AuditEntityType,
  AuditStore,
  CreateAuditEntryRecord,
} from './audit.types';
import { AuditEntityType as AuditEntityTypes } from './audit.types';

interface AuditEntryRow extends QueryResultRow {
  id: string;
  timestamp: Date | string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload_hash: string;
  payload_snapshot: Record<string, unknown> | null;
  prev_hash: string;
  entry_hash: string;
}

type QueryExecutor = Pool | PoolClient;
const GLOBAL_RULES_STREAM_ID = 'GLOBAL_RULES_STREAM';

@Injectable()
export class PrismaAuditStore implements AuditStore {
  private pool?: Pool;
  private executor?: QueryExecutor;

  constructor(@Inject(DATABASE_POOL) pool: Pool | undefined) {
    this.pool = pool;
    this.executor = pool;
  }

  async runInTransaction<T>(
    operation: (store: AuditStore) => Promise<T>,
  ): Promise<T> {
    const executor = this.requireExecutor();

    if (executor instanceof Pool) {
      const client = await executor.connect();

      try {
        await client.query('BEGIN');
        const transactionalStore = PrismaAuditStore.withExecutor(
          this.pool,
          client,
        );
        const result = await operation(transactionalStore);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return await operation(this);
  }

  static withExecutor(
    pool: Pool | undefined,
    executor: QueryExecutor,
  ): PrismaAuditStore {
    const store = new PrismaAuditStore(pool);
    store.executor = executor;
    return store;
  }

  async resolveStreamId(
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<string | null> {
    const executor = this.requireExecutor();

    switch (entityType) {
      case AuditEntityTypes.LANE:
        return await this.findSingleValue(
          executor,
          'SELECT id FROM lanes WHERE id = $1 OR lane_id = $1 LIMIT 1',
          [entityId],
          'id',
        );
      case AuditEntityTypes.CHECKPOINT:
        return await this.findSingleValue(
          executor,
          'SELECT lane_id FROM checkpoints WHERE id = $1 LIMIT 1',
          [entityId],
          'lane_id',
        );
      case AuditEntityTypes.ARTIFACT:
        return await this.findSingleValue(
          executor,
          'SELECT lane_id FROM evidence_artifacts WHERE id = $1 LIMIT 1',
          [entityId],
          'lane_id',
        );
      case AuditEntityTypes.PROOF_PACK:
        return await this.findSingleValue(
          executor,
          'SELECT lane_id FROM proof_packs WHERE id = $1 LIMIT 1',
          [entityId],
          'lane_id',
        );
      case AuditEntityTypes.RULE_SET: {
        const ruleSetId = await this.findSingleValue(
          executor,
          'SELECT id FROM rule_sets WHERE id = $1 LIMIT 1',
          [entityId],
          'id',
        );
        return ruleSetId === null ? null : GLOBAL_RULES_STREAM_ID;
      }
      case AuditEntityTypes.SUBSTANCE: {
        const substanceId = await this.findSingleValue(
          executor,
          'SELECT id FROM substances WHERE id = $1 LIMIT 1',
          [entityId],
          'id',
        );
        return substanceId === null ? null : GLOBAL_RULES_STREAM_ID;
      }
      default:
        return null;
    }
  }

  async lockStream(streamId: string): Promise<void> {
    const executor = this.requireExecutor();

    if (!(executor instanceof Pool)) {
      await executor.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [streamId],
      );
    }
  }

  async findLatestForStream(
    streamId: string,
  ): Promise<AuditEntryRecord | null> {
    const executor = this.requireExecutor();

    if (streamId === GLOBAL_RULES_STREAM_ID) {
      const rows = await executor.query<AuditEntryRow>(
        `
          SELECT
            id,
            timestamp,
            actor,
            action,
            entity_type,
            entity_id,
            payload_hash,
            audit_entry_snapshots.payload AS payload_snapshot,
            prev_hash,
            entry_hash
          FROM audit_entries
          LEFT JOIN audit_entry_snapshots
            ON audit_entry_snapshots.audit_entry_id = audit_entries.id
          WHERE entity_type IN ('RULE_SET', 'SUBSTANCE')
          ORDER BY timestamp DESC, id DESC
          LIMIT 1
        `,
      );

      return rows.rowCount === 0 ? null : this.mapEntry(rows.rows[0]);
    }

    const { clause, values } = this.buildLaneWhereClause(streamId);
    const rows = await executor.query<AuditEntryRow>(
      `
        SELECT
          id,
          timestamp,
          actor,
          action,
          entity_type,
          entity_id,
          payload_hash,
          audit_entry_snapshots.payload AS payload_snapshot,
          prev_hash,
          entry_hash
        FROM audit_entries
        LEFT JOIN audit_entry_snapshots
          ON audit_entry_snapshots.audit_entry_id = audit_entries.id
        WHERE ${clause}
        ORDER BY timestamp DESC, id DESC
        LIMIT 1
      `,
      values,
    );

    return rows.rowCount === 0 ? null : this.mapEntry(rows.rows[0]);
  }

  async createEntry(entry: CreateAuditEntryRecord): Promise<AuditEntryRecord> {
    const executor = this.requireExecutor();
    const entryId = randomUUID();
    const result = await executor.query<AuditEntryRow>(
      `
        INSERT INTO audit_entries (
          id,
          timestamp,
          actor,
          action,
          entity_type,
          entity_id,
          payload_hash,
          prev_hash,
          entry_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          timestamp,
          actor,
          action,
          entity_type,
          entity_id,
          payload_hash,
          prev_hash,
          entry_hash
      `,
      [
        entryId,
        entry.timestamp,
        entry.actor,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.payloadHash,
        entry.prevHash,
        entry.entryHash,
      ],
    );
    if (entry.payloadSnapshot !== undefined) {
      await executor.query(
        `
          INSERT INTO audit_entry_snapshots (
            audit_entry_id,
            payload
          )
          VALUES ($1, $2::jsonb)
        `,
        [result.rows[0].id, JSON.stringify(entry.payloadSnapshot)],
      );
    }

    const hydrated = await executor.query<AuditEntryRow>(
      `
        SELECT
          audit_entries.id,
          audit_entries.timestamp,
          audit_entries.actor,
          audit_entries.action,
          audit_entries.entity_type,
          audit_entries.entity_id,
          audit_entries.payload_hash,
          audit_entry_snapshots.payload AS payload_snapshot,
          audit_entries.prev_hash,
          audit_entries.entry_hash
        FROM audit_entries
        LEFT JOIN audit_entry_snapshots
          ON audit_entry_snapshots.audit_entry_id = audit_entries.id
        WHERE audit_entries.id = $1
        LIMIT 1
      `,
      [result.rows[0].id],
    );

    return this.mapEntry(hydrated.rows[0]);
  }

  async findEntriesForLane(
    laneId: string,
    filters?: AuditEntryFilters,
  ): Promise<AuditEntryRecord[]> {
    const executor = this.requireExecutor();
    const { clause, values } = this.buildLaneWhereClause(laneId, filters);
    const pagination = this.buildPagination(filters, values.length + 1);

    const result = await executor.query<AuditEntryRow>(
      `
        SELECT
          id,
          timestamp,
          actor,
          action,
          entity_type,
          entity_id,
          payload_hash,
          audit_entry_snapshots.payload AS payload_snapshot,
          prev_hash,
          entry_hash
        FROM audit_entries
        LEFT JOIN audit_entry_snapshots
          ON audit_entry_snapshots.audit_entry_id = audit_entries.id
        WHERE ${clause}
        ORDER BY timestamp ASC, id ASC
        ${pagination.clause}
      `,
      [...values, ...pagination.values],
    );

    return result.rows.map((row) => this.mapEntry(row));
  }

  async findEntriesForEntity(
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<AuditEntryRecord[]> {
    const executor = this.requireExecutor();
    const result = await executor.query<AuditEntryRow>(
      `
        SELECT
          id,
          timestamp,
          actor,
          action,
          entity_type,
          entity_id,
          payload_hash,
          audit_entry_snapshots.payload AS payload_snapshot,
          prev_hash,
          entry_hash
        FROM audit_entries
        LEFT JOIN audit_entry_snapshots
          ON audit_entry_snapshots.audit_entry_id = audit_entries.id
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY timestamp ASC, id ASC
      `,
      [entityType, entityId],
    );

    return result.rows.map((row) => this.mapEntry(row));
  }

  private requireExecutor(): QueryExecutor {
    if (this.executor === undefined) {
      throw new Error('Audit store is not configured.');
    }

    return this.executor;
  }

  private buildLaneWhereClause(
    laneId: string,
    filters?: AuditEntryFilters,
  ): { clause: string; values: unknown[] } {
    const values: unknown[] = [laneId];
    const resolvedLaneId =
      '(SELECT id FROM lanes WHERE id = $1 OR lane_id = $1 LIMIT 1)';
    const conditions = [
      `(
        (
          entity_type = 'LANE'
          AND (entity_id = $1 OR entity_id = ${resolvedLaneId})
        )
        OR (
          entity_type = 'CHECKPOINT'
          AND EXISTS (
            SELECT 1 FROM checkpoints
            WHERE checkpoints.id = audit_entries.entity_id
              AND checkpoints.lane_id = ${resolvedLaneId}
          )
        )
        OR (
          entity_type = 'ARTIFACT'
          AND EXISTS (
            SELECT 1 FROM evidence_artifacts
            WHERE evidence_artifacts.id = audit_entries.entity_id
              AND evidence_artifacts.lane_id = ${resolvedLaneId}
          )
        )
        OR (
          entity_type = 'PROOF_PACK'
          AND EXISTS (
            SELECT 1 FROM proof_packs
            WHERE proof_packs.id = audit_entries.entity_id
              AND proof_packs.lane_id = ${resolvedLaneId}
          )
        )
      )`,
    ];

    if (filters?.action !== undefined) {
      values.push(filters.action);
      conditions.push(`action = $${values.length}`);
    }

    if (filters?.actor !== undefined) {
      values.push(filters.actor);
      conditions.push(`actor = $${values.length}`);
    }

    if (filters?.from !== undefined) {
      values.push(filters.from);
      conditions.push(`timestamp >= $${values.length}`);
    }

    if (filters?.to !== undefined) {
      values.push(filters.to);
      conditions.push(`timestamp <= $${values.length}`);
    }

    return {
      clause: conditions.join(' AND '),
      values,
    };
  }

  private buildPagination(
    filters: AuditEntryFilters | undefined,
    startingIndex: number,
  ): { clause: string; values: number[] } {
    if (filters?.page === undefined && filters?.pageSize === undefined) {
      return { clause: '', values: [] };
    }

    const limit = Math.min(
      filters?.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE,
      MAX_AUDIT_PAGE_SIZE,
    );
    const offset = Math.max((filters?.page ?? 1) - 1, 0) * limit;

    return {
      clause: `LIMIT $${startingIndex} OFFSET $${startingIndex + 1}`,
      values: [limit, offset],
    };
  }

  private async findSingleValue(
    executor: QueryExecutor,
    query: string,
    values: unknown[],
    key: string,
  ): Promise<string | null> {
    const result = await executor.query<Record<string, unknown>>(query, values);
    const value = result.rows[0]?.[key];

    return typeof value === 'string' ? value : null;
  }

  private mapEntry(entry: AuditEntryRow): AuditEntryRecord {
    return {
      id: entry.id,
      timestamp:
        entry.timestamp instanceof Date
          ? entry.timestamp
          : new Date(entry.timestamp),
      actor: entry.actor,
      action: entry.action as AuditEntryRecord['action'],
      entityType: entry.entity_type as AuditEntryRecord['entityType'],
      entityId: entry.entity_id,
      payloadHash: entry.payload_hash,
      payloadSnapshot: entry.payload_snapshot,
      prevHash: entry.prev_hash,
      entryHash: entry.entry_hash,
    };
  }
}

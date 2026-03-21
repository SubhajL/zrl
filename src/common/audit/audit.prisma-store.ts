import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
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
  prev_hash: string;
  entry_hash: string;
}

type QueryExecutor = Pool | PoolClient;

@Injectable()
export class PrismaAuditStore implements AuditStore, OnModuleDestroy {
  private pool?: Pool;
  private executor?: QueryExecutor;

  constructor() {
    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    if (databaseUrl.length === 0) {
      return;
    }

    this.pool = new Pool({ connectionString: databaseUrl });
    this.executor = this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool === undefined) {
      return;
    }

    await this.pool.end();
  }

  async runInTransaction<T>(
    operation: (store: AuditStore) => Promise<T>,
  ): Promise<T> {
    const executor = this.requireExecutor();

    if (executor instanceof Pool) {
      const client = await executor.connect();

      try {
        await client.query('BEGIN');
        const transactionalStore = PrismaAuditStore.withExecutor(client);
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

  private static withExecutor(executor: QueryExecutor): PrismaAuditStore {
    const store = new PrismaAuditStore();
    store.pool = undefined;
    store.executor = executor;
    return store;
  }

  async resolveLaneId(
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<string | null> {
    const executor = this.requireExecutor();

    switch (entityType) {
      case AuditEntityTypes.LANE:
        return await this.findSingleValue(
          executor,
          'SELECT id FROM lanes WHERE id = $1 LIMIT 1',
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
      default:
        return null;
    }
  }

  async lockLane(laneId: string): Promise<void> {
    const executor = this.requireExecutor();

    if (!(executor instanceof Pool)) {
      await executor.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [laneId],
      );
    }
  }

  async findLatestForLane(laneId: string): Promise<AuditEntryRecord | null> {
    const executor = this.requireExecutor();
    const { clause, values } = this.buildLaneWhereClause(laneId);
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
          prev_hash,
          entry_hash
        FROM audit_entries
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
    const result = await executor.query<AuditEntryRow>(
      `
        INSERT INTO audit_entries (
          timestamp,
          actor,
          action,
          entity_type,
          entity_id,
          payload_hash,
          prev_hash,
          entry_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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

    return this.mapEntry(result.rows[0]);
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
          prev_hash,
          entry_hash
        FROM audit_entries
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
          prev_hash,
          entry_hash
        FROM audit_entries
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
    const conditions = [
      `(
        (entity_type = 'LANE' AND entity_id = $1)
        OR (
          entity_type = 'CHECKPOINT'
          AND EXISTS (
            SELECT 1 FROM checkpoints
            WHERE checkpoints.id = audit_entries.entity_id
              AND checkpoints.lane_id = $1
          )
        )
        OR (
          entity_type = 'ARTIFACT'
          AND EXISTS (
            SELECT 1 FROM evidence_artifacts
            WHERE evidence_artifacts.id = audit_entries.entity_id
              AND evidence_artifacts.lane_id = $1
          )
        )
        OR (
          entity_type = 'PROOF_PACK'
          AND EXISTS (
            SELECT 1 FROM proof_packs
            WHERE proof_packs.id = audit_entries.entity_id
              AND proof_packs.lane_id = $1
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
      prevHash: entry.prev_hash,
      entryHash: entry.entry_hash,
    };
  }
}

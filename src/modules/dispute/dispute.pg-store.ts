import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';
import type {
  CreateDisputeInput,
  DisputeRecord,
  DisputeStatus,
  DisputeStore,
  DisputeType,
  UpdateDisputeInput,
} from './dispute.types';

type QueryExecutor = Pool | PoolClient;

interface DisputeRow extends QueryResultRow {
  id: string;
  lane_id: string;
  type: DisputeType;
  description: string;
  claimant: string;
  status: DisputeStatus;
  financial_impact: string | null;
  resolution_notes: string | null;
  defense_pack_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  resolved_at: Date | string | null;
}

@Injectable()
export class PrismaDisputeStore implements DisputeStore {
  private executor?: QueryExecutor;

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | undefined) {}

  private requireExecutor(): QueryExecutor {
    if (this.executor !== undefined) {
      return this.executor;
    }

    if (this.pool === undefined) {
      throw new Error('Dispute store is not configured.');
    }

    return this.pool;
  }

  async runInTransaction<T>(
    operation: (store: DisputeStore) => Promise<T>,
  ): Promise<T> {
    const executor = this.requireExecutor();

    if (executor instanceof Pool) {
      const client = await executor.connect();

      try {
        await client.query('BEGIN');
        const transactionalStore = PrismaDisputeStore.withExecutor(
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

  private static withExecutor(
    pool: Pool | undefined,
    executor: QueryExecutor,
  ): PrismaDisputeStore {
    const store = new PrismaDisputeStore(pool);
    store.executor = executor;
    return store;
  }

  async createDispute(
    laneId: string,
    input: CreateDisputeInput,
  ): Promise<DisputeRecord> {
    const id = randomUUID();
    const result = await this.requireExecutor().query<DisputeRow>(
      `
        INSERT INTO disputes (
          id,
          lane_id,
          type,
          description,
          claimant,
          status,
          financial_impact,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, NOW(), NOW())
        RETURNING
          id, lane_id, type, description, claimant, status,
          financial_impact, resolution_notes, defense_pack_id,
          created_at, updated_at, resolved_at
      `,
      [
        id,
        laneId,
        input.type,
        input.description,
        input.claimant,
        input.financialImpact ?? null,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async findDisputeById(id: string): Promise<DisputeRecord | null> {
    const result = await this.requireExecutor().query<DisputeRow>(
      `
        SELECT
          id, lane_id, type, description, claimant, status,
          financial_impact, resolution_notes, defense_pack_id,
          created_at, updated_at, resolved_at
        FROM disputes
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rowCount === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findDisputesForLane(laneId: string): Promise<DisputeRecord[]> {
    const result = await this.requireExecutor().query<DisputeRow>(
      `
        SELECT
          id, lane_id, type, description, claimant, status,
          financial_impact, resolution_notes, defense_pack_id,
          created_at, updated_at, resolved_at
        FROM disputes
        WHERE lane_id = $1
        ORDER BY created_at DESC
      `,
      [laneId],
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async updateDispute(
    id: string,
    input: UpdateDisputeInput,
  ): Promise<DisputeRecord | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [id];
    let paramIndex = 2;

    if (input.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(input.status);
      paramIndex++;

      if (input.status === 'RESOLVED') {
        setClauses.push(`resolved_at = NOW()`);
      }
    }

    if (input.resolutionNotes !== undefined) {
      setClauses.push(`resolution_notes = $${paramIndex}`);
      values.push(input.resolutionNotes);
      paramIndex++;
    }

    const result = await this.requireExecutor().query<DisputeRow>(
      `
        UPDATE disputes
        SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING
          id, lane_id, type, description, claimant, status,
          financial_impact, resolution_notes, defense_pack_id,
          created_at, updated_at, resolved_at
      `,
      values,
    );

    return result.rowCount === 0 ? null : this.mapRow(result.rows[0]);
  }

  async linkDefensePack(
    disputeId: string,
    defensePackId: string,
  ): Promise<DisputeRecord | null> {
    const result = await this.requireExecutor().query<DisputeRow>(
      `
        UPDATE disputes
        SET
          defense_pack_id = $2,
          status = 'DEFENSE_SUBMITTED',
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id, lane_id, type, description, claimant, status,
          financial_impact, resolution_notes, defense_pack_id,
          created_at, updated_at, resolved_at
      `,
      [disputeId, defensePackId],
    );

    return result.rowCount === 0 ? null : this.mapRow(result.rows[0]);
  }

  async countDisputesForLane(laneId: string): Promise<number> {
    const result = await this.requireExecutor().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM disputes WHERE lane_id = $1`,
      [laneId],
    );
    return result.rows[0]?.count ?? 0;
  }

  async countExcursionsForLane(laneId: string): Promise<number> {
    const result = await this.requireExecutor().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM excursions WHERE lane_id = $1`,
      [laneId],
    );
    return result.rows[0]?.count ?? 0;
  }

  private mapRow(row: DisputeRow): DisputeRecord {
    return {
      id: row.id,
      laneId: row.lane_id,
      type: row.type,
      description: row.description,
      claimant: row.claimant,
      status: row.status,
      financialImpact:
        row.financial_impact === null ? null : Number(row.financial_impact),
      resolutionNotes: row.resolution_notes,
      defensePackId: row.defense_pack_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      resolvedAt: row.resolved_at === null ? null : new Date(row.resolved_at),
    };
  }
}

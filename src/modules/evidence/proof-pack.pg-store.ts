import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool, type QueryResultRow } from 'pg';
import type {
  ProofPackRecord,
  ProofPackStore,
  ProofPackType,
} from './proof-pack.types';

interface ProofPackRow extends QueryResultRow {
  id: string;
  lane_id: string;
  pack_type: string;
  version: number;
  content_hash: string;
  file_path: string;
  generated_at: Date | string;
  generated_by: string;
  recipient: string | null;
}

@Injectable()
export class PrismaProofPackStore implements ProofPackStore, OnModuleDestroy {
  private pool?: Pool;

  constructor() {
    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    if (databaseUrl.length === 0) {
      return;
    }

    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool !== undefined) {
      await this.pool.end();
    }
  }

  async createPack(
    record: Omit<ProofPackRecord, 'id'>,
  ): Promise<ProofPackRecord> {
    const executor = this.requirePool();
    const id = randomUUID();

    await executor.query(
      `
        INSERT INTO proof_packs (
          id,
          lane_id,
          pack_type,
          version,
          content_hash,
          file_path,
          generated_at,
          generated_by,
          recipient
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        id,
        record.laneId,
        record.packType,
        record.version,
        record.contentHash,
        record.filePath,
        record.generatedAt,
        record.generatedBy,
        record.recipient,
      ],
    );

    return {
      id,
      laneId: record.laneId,
      packType: record.packType,
      version: record.version,
      contentHash: record.contentHash,
      filePath: record.filePath,
      generatedAt: record.generatedAt,
      generatedBy: record.generatedBy,
      recipient: record.recipient,
    };
  }

  async findPacksForLane(laneId: string): Promise<ProofPackRecord[]> {
    const executor = this.requirePool();

    const result = await executor.query<ProofPackRow>(
      `
        SELECT
          id,
          lane_id,
          pack_type,
          version,
          content_hash,
          file_path,
          generated_at,
          generated_by,
          recipient
        FROM proof_packs
        WHERE lane_id = $1
        ORDER BY generated_at DESC
      `,
      [laneId],
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async getLatestVersion(
    laneId: string,
    packType: ProofPackType,
  ): Promise<number> {
    const executor = this.requirePool();

    const result = await executor.query<{ max_version: string }>(
      `
        SELECT COALESCE(MAX(version), 0)::text AS max_version
        FROM proof_packs
        WHERE lane_id = $1
          AND pack_type = $2
      `,
      [laneId, packType],
    );

    return Number(result.rows[0]?.max_version ?? '0');
  }

  private mapRow(row: ProofPackRow): ProofPackRecord {
    return {
      id: row.id,
      laneId: row.lane_id,
      packType: row.pack_type as ProofPackType,
      version: row.version,
      contentHash: row.content_hash,
      filePath: row.file_path,
      generatedAt:
        row.generated_at instanceof Date
          ? row.generated_at
          : new Date(row.generated_at),
      generatedBy: row.generated_by,
      recipient: row.recipient,
    };
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('Proof pack store is not configured.');
    }

    return this.pool;
  }
}

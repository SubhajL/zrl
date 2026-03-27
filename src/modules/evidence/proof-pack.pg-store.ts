import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool, type QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';
import type {
  ClaimedProofPackJob,
  ProofPackJobRecord,
  ProofPackJobStatus,
  ProofPackRecord,
  ProofPackStore,
  ProofPackTemplateData,
  ProofPackType,
  ProofPackStatus,
} from './proof-pack.types';

interface ProofPackRow extends QueryResultRow {
  id: string;
  lane_id: string;
  pack_type: string;
  version: number;
  status: ProofPackStatus;
  content_hash: string | null;
  file_path: string | null;
  error_message: string | null;
  generated_at: Date | string;
  generated_by: string;
  recipient: string | null;
}

interface ProofPackJobRow extends QueryResultRow {
  id: string;
  proof_pack_id: string;
  status: ProofPackJobStatus;
  payload: ProofPackTemplateData | string;
  attempt_count: number;
  last_error: string | null;
  available_at: Date | string;
  leased_at: Date | string | null;
  lease_expires_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ClaimedProofPackJobRow extends ProofPackJobRow {
  pack_id: string;
  pack_lane_id: string;
  pack_type: string;
  pack_version: number;
  pack_status: ProofPackStatus;
  pack_content_hash: string | null;
  pack_file_path: string | null;
  pack_error_message: string | null;
  pack_generated_at: Date | string;
  pack_generated_by: string;
  pack_recipient: string | null;
}

interface ProofPackMetricsRow extends QueryResultRow {
  queued: string;
  processing: string;
  stuck_processing: string;
  retry_exhausted: string;
  completed_in_window: string;
  failed_in_window: string;
}

@Injectable()
export class PrismaProofPackStore implements ProofPackStore {
  private pool?: Pool;

  constructor(@Inject(DATABASE_POOL) pool: Pool | undefined) {
    this.pool = pool;
  }

  async enqueuePack(
    record: Omit<ProofPackRecord, 'id'>,
    payload: ProofPackTemplateData,
    queuedAt: Date,
  ): Promise<ProofPackRecord> {
    const executor = this.requirePool();
    const client = await executor.connect();
    const packId = randomUUID();
    const jobId = randomUUID();

    try {
      await client.query('BEGIN');
      await client.query(
        `
          INSERT INTO proof_packs (
            id,
            lane_id,
            pack_type,
            version,
            status,
            content_hash,
            file_path,
            error_message,
            generated_at,
            generated_by,
            recipient
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          packId,
          record.laneId,
          record.packType,
          record.version,
          record.status,
          record.contentHash,
          record.filePath,
          record.errorMessage,
          record.generatedAt,
          record.generatedBy,
          record.recipient,
        ],
      );
      await client.query(
        `
          INSERT INTO proof_pack_jobs (
            id,
            proof_pack_id,
            status,
            payload,
            attempt_count,
            last_error,
            available_at,
            leased_at,
            lease_expires_at,
            completed_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'QUEUED', $3::jsonb, 0, NULL, $4, NULL, NULL, NULL, $4, $4)
        `,
        [jobId, packId, JSON.stringify(payload), queuedAt],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return {
      id: packId,
      laneId: record.laneId,
      packType: record.packType,
      version: record.version,
      status: record.status,
      contentHash: record.contentHash,
      filePath: record.filePath,
      errorMessage: record.errorMessage,
      generatedAt: record.generatedAt,
      generatedBy: record.generatedBy,
      recipient: record.recipient,
    };
  }

  async updatePack(
    id: string,
    input: Pick<
      ProofPackRecord,
      'status' | 'contentHash' | 'filePath' | 'errorMessage'
    >,
  ): Promise<ProofPackRecord | null> {
    const result = await this.requirePool().query<ProofPackRow>(
      `
        UPDATE proof_packs
        SET
          status = $2,
          content_hash = $3,
          file_path = $4,
          error_message = $5
        WHERE id = $1
        RETURNING
          id,
          lane_id,
          pack_type,
          version,
          status,
          content_hash,
          file_path,
          error_message,
          generated_at,
          generated_by,
          recipient
      `,
      [id, input.status, input.contentHash, input.filePath, input.errorMessage],
    );

    return result.rowCount === 0 ? null : this.mapPackRow(result.rows[0]);
  }

  async findPacksForLane(laneId: string): Promise<ProofPackRecord[]> {
    const result = await this.requirePool().query<ProofPackRow>(
      `
        SELECT
          id,
          lane_id,
          pack_type,
          version,
          status,
          content_hash,
          file_path,
          error_message,
          generated_at,
          generated_by,
          recipient
        FROM proof_packs
        WHERE lane_id = $1
        ORDER BY generated_at DESC
      `,
      [laneId],
    );

    return result.rows.map((row) => this.mapPackRow(row));
  }

  async findPackById(id: string): Promise<ProofPackRecord | null> {
    const result = await this.requirePool().query<ProofPackRow>(
      `
        SELECT
          id,
          lane_id,
          pack_type,
          version,
          status,
          content_hash,
          file_path,
          error_message,
          generated_at,
          generated_by,
          recipient
        FROM proof_packs
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rowCount === 0 ? null : this.mapPackRow(result.rows[0]);
  }

  async findJobByPackId(
    proofPackId: string,
  ): Promise<ProofPackJobRecord | null> {
    const result = await this.requirePool().query<ProofPackJobRow>(
      `
        SELECT
          id,
          proof_pack_id,
          status,
          payload,
          attempt_count,
          last_error,
          available_at,
          leased_at,
          lease_expires_at,
          completed_at,
          created_at,
          updated_at
        FROM proof_pack_jobs
        WHERE proof_pack_id = $1
        LIMIT 1
      `,
      [proofPackId],
    );

    return result.rowCount === 0 ? null : this.mapJobRow(result.rows[0]);
  }

  async leaseNextJob(
    now: Date,
    leaseExpiresAt: Date,
  ): Promise<ClaimedProofPackJob | null> {
    const result = await this.requirePool().query<ClaimedProofPackJobRow>(
      `
        WITH next_job AS (
          SELECT id
          FROM proof_pack_jobs
          WHERE (
            status = 'QUEUED'
            AND available_at <= $1
          ) OR (
            status = 'PROCESSING'
            AND lease_expires_at IS NOT NULL
            AND lease_expires_at <= $1
          )
          ORDER BY available_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        ),
        leased_job AS (
          UPDATE proof_pack_jobs jobs
          SET
            status = 'PROCESSING',
            leased_at = $1,
            lease_expires_at = $2,
            attempt_count = jobs.attempt_count + 1,
            updated_at = $1
          FROM next_job
          WHERE jobs.id = next_job.id
          RETURNING
            jobs.id,
            jobs.proof_pack_id,
            jobs.status,
            jobs.payload,
            jobs.attempt_count,
            jobs.last_error,
            jobs.available_at,
            jobs.leased_at,
            jobs.lease_expires_at,
            jobs.completed_at,
            jobs.created_at,
            jobs.updated_at
        )
        SELECT
          leased_job.id,
          leased_job.proof_pack_id,
          leased_job.status,
          leased_job.payload,
          leased_job.attempt_count,
          leased_job.last_error,
          leased_job.available_at,
          leased_job.leased_at,
          leased_job.lease_expires_at,
          leased_job.completed_at,
          leased_job.created_at,
          leased_job.updated_at,
          packs.id AS pack_id,
          packs.lane_id AS pack_lane_id,
          packs.pack_type AS pack_type,
          packs.version AS pack_version,
          packs.status AS pack_status,
          packs.content_hash AS pack_content_hash,
          packs.file_path AS pack_file_path,
          packs.error_message AS pack_error_message,
          packs.generated_at AS pack_generated_at,
          packs.generated_by AS pack_generated_by,
          packs.recipient AS pack_recipient
        FROM leased_job
        JOIN proof_packs packs
          ON packs.id = leased_job.proof_pack_id
      `,
      [now, leaseExpiresAt],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return this.mapClaimedJobRow(result.rows[0]);
  }

  async renewJobLease(
    jobId: string,
    expectedLeaseExpiresAt: Date,
    leasedAt: Date,
    leaseExpiresAt: Date,
  ): Promise<boolean> {
    const result = await this.requirePool().query(
      `
        UPDATE proof_pack_jobs
        SET
          leased_at = $2,
          lease_expires_at = $3,
          updated_at = $2
        WHERE id = $1
          AND status = 'PROCESSING'
          AND lease_expires_at = $4
      `,
      [jobId, leasedAt, leaseExpiresAt, expectedLeaseExpiresAt],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async completePackJob(
    jobId: string,
    expectedLeaseExpiresAt: Date,
    completedAt: Date,
    input: Pick<ProofPackRecord, 'contentHash' | 'filePath'>,
  ): Promise<ProofPackRecord | null> {
    const result = await this.requirePool().query<ProofPackRow>(
      `
        WITH completed_job AS (
          UPDATE proof_pack_jobs
          SET
            status = 'COMPLETED',
            last_error = NULL,
            leased_at = NULL,
            lease_expires_at = NULL,
            completed_at = $2,
            updated_at = $2
          WHERE id = $1
            AND status = 'PROCESSING'
            AND lease_expires_at = $3
          RETURNING proof_pack_id
        )
        UPDATE proof_packs
        SET
          status = 'READY',
          content_hash = $4,
          file_path = $5,
          error_message = NULL
        FROM completed_job
        WHERE proof_packs.id = completed_job.proof_pack_id
        RETURNING
          proof_packs.id,
          proof_packs.lane_id,
          proof_packs.pack_type,
          proof_packs.version,
          proof_packs.status,
          proof_packs.content_hash,
          proof_packs.file_path,
          proof_packs.error_message,
          proof_packs.generated_at,
          proof_packs.generated_by,
          proof_packs.recipient
      `,
      [
        jobId,
        completedAt,
        expectedLeaseExpiresAt,
        input.contentHash,
        input.filePath,
      ],
    );

    return result.rowCount === 0 ? null : this.mapPackRow(result.rows[0]);
  }

  async requeueJob(
    jobId: string,
    expectedLeaseExpiresAt: Date,
    availableAt: Date,
    lastError: string,
  ): Promise<ProofPackJobRecord | null> {
    const result = await this.requirePool().query<ProofPackJobRow>(
      `
        UPDATE proof_pack_jobs
        SET
          status = 'QUEUED',
          available_at = $2,
          last_error = $3,
          leased_at = NULL,
          lease_expires_at = NULL,
          updated_at = $2
        WHERE id = $1
          AND status = 'PROCESSING'
          AND lease_expires_at = $4
        RETURNING
          id,
          proof_pack_id,
          status,
          payload,
          attempt_count,
          last_error,
          available_at,
          leased_at,
          lease_expires_at,
          completed_at,
          created_at,
          updated_at
      `,
      [jobId, availableAt, lastError, expectedLeaseExpiresAt],
    );

    return result.rowCount === 0 ? null : this.mapJobRow(result.rows[0]);
  }

  async failPackJob(
    jobId: string,
    expectedLeaseExpiresAt: Date,
    failedAt: Date,
    packError: string,
    lastError: string,
  ): Promise<ProofPackRecord | null> {
    const result = await this.requirePool().query<ProofPackRow>(
      `
        WITH failed_job AS (
          UPDATE proof_pack_jobs
          SET
            status = 'FAILED',
            last_error = $4,
            leased_at = NULL,
            lease_expires_at = NULL,
            completed_at = $2,
            updated_at = $2
          WHERE id = $1
            AND status = 'PROCESSING'
            AND lease_expires_at = $5
          RETURNING proof_pack_id
        )
        UPDATE proof_packs
        SET
          status = 'FAILED',
          content_hash = NULL,
          file_path = NULL,
          error_message = $3
        FROM failed_job
        WHERE proof_packs.id = failed_job.proof_pack_id
        RETURNING
          proof_packs.id,
          proof_packs.lane_id,
          proof_packs.pack_type,
          proof_packs.version,
          proof_packs.status,
          proof_packs.content_hash,
          proof_packs.file_path,
          proof_packs.error_message,
          proof_packs.generated_at,
          proof_packs.generated_by,
          proof_packs.recipient
      `,
      [jobId, failedAt, packError, lastError, expectedLeaseExpiresAt],
    );

    return result.rowCount === 0 ? null : this.mapPackRow(result.rows[0]);
  }

  async getJobMetrics(
    windowStart: Date,
    stuckBefore: Date,
    maxAttempts: number,
  ): Promise<{
    queued: number;
    processing: number;
    stuckProcessing: number;
    retryExhausted: number;
    completedInWindow: number;
    failedInWindow: number;
  }> {
    const result = await this.requirePool().query<ProofPackMetricsRow>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'QUEUED')::text AS queued,
          COUNT(*) FILTER (WHERE status = 'PROCESSING')::text AS processing,
          COUNT(*) FILTER (
            WHERE status = 'PROCESSING'
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at <= $2
          )::text AS stuck_processing,
          COUNT(*) FILTER (
            WHERE status = 'FAILED'
              AND attempt_count >= $3
          )::text AS retry_exhausted,
          COUNT(*) FILTER (
            WHERE status = 'COMPLETED'
              AND completed_at IS NOT NULL
              AND completed_at >= $1
          )::text AS completed_in_window,
          COUNT(*) FILTER (
            WHERE status = 'FAILED'
              AND completed_at IS NOT NULL
              AND completed_at >= $1
          )::text AS failed_in_window
        FROM proof_pack_jobs
      `,
      [windowStart, stuckBefore, maxAttempts],
    );

    const row = result.rows[0];
    return {
      queued: Number(row?.queued ?? '0'),
      processing: Number(row?.processing ?? '0'),
      stuckProcessing: Number(row?.stuck_processing ?? '0'),
      retryExhausted: Number(row?.retry_exhausted ?? '0'),
      completedInWindow: Number(row?.completed_in_window ?? '0'),
      failedInWindow: Number(row?.failed_in_window ?? '0'),
    };
  }

  async getLatestVersion(
    laneId: string,
    packType: ProofPackType,
  ): Promise<number> {
    const result = await this.requirePool().query<{ max_version: string }>(
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

  private mapClaimedJobRow(row: ClaimedProofPackJobRow): ClaimedProofPackJob {
    return {
      job: this.mapJobRow(row),
      pack: {
        id: row.pack_id,
        laneId: row.pack_lane_id,
        packType: row.pack_type as ProofPackType,
        version: row.pack_version,
        status: row.pack_status,
        contentHash: row.pack_content_hash,
        filePath: row.pack_file_path,
        errorMessage: row.pack_error_message,
        generatedAt: this.mapDate(row.pack_generated_at),
        generatedBy: row.pack_generated_by,
        recipient: row.pack_recipient,
      },
    };
  }

  private mapPackRow(row: ProofPackRow): ProofPackRecord {
    return {
      id: row.id,
      laneId: row.lane_id,
      packType: row.pack_type as ProofPackType,
      version: row.version,
      status: row.status,
      contentHash: row.content_hash,
      filePath: row.file_path,
      errorMessage: row.error_message,
      generatedAt: this.mapDate(row.generated_at),
      generatedBy: row.generated_by,
      recipient: row.recipient,
    };
  }

  private mapJobRow(row: ProofPackJobRow): ProofPackJobRecord {
    return {
      id: row.id,
      proofPackId: row.proof_pack_id,
      status: row.status,
      payload: this.parsePayload(row.payload),
      attemptCount: row.attempt_count,
      lastError: row.last_error,
      availableAt: this.mapDate(row.available_at),
      leasedAt: this.mapOptionalDate(row.leased_at),
      leaseExpiresAt: this.mapOptionalDate(row.lease_expires_at),
      completedAt: this.mapOptionalDate(row.completed_at),
      createdAt: this.mapDate(row.created_at),
      updatedAt: this.mapDate(row.updated_at),
    };
  }

  private parsePayload(
    payload: ProofPackTemplateData | string,
  ): ProofPackTemplateData {
    if (typeof payload === 'string') {
      return JSON.parse(payload) as ProofPackTemplateData;
    }

    return payload;
  }

  private mapOptionalDate(value: Date | string | null): Date | null {
    if (value === null) {
      return null;
    }

    return this.mapDate(value);
  }

  private mapDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('Proof pack store is not configured.');
    }

    return this.pool;
  }
}

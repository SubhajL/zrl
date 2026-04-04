import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { PrismaAuditStore } from '../../common/audit/audit.prisma-store';
import { DATABASE_POOL } from '../../common/database/database.constants';
import {
  DEFAULT_EVIDENCE_LIMIT,
  DEFAULT_EVIDENCE_PAGE,
  MAX_EVIDENCE_LIMIT,
} from './evidence.constants';
import type {
  CreateArtifactRecordInput,
  EvidenceArtifactGraph,
  EvidenceArtifactRecord,
  EvidenceArtifactStore,
  EvidenceLaneRecord,
  EvidenceListFilters,
  EvidenceVerificationStatus,
} from './evidence.types';
import type { RuleSnapshotPayload } from '../rules-engine/rules-engine.types';

type QueryExecutor = Pool | PoolClient;

interface LaneRow extends QueryResultRow {
  id: string;
  lane_id: string;
  exporter_id: string;
  completeness_score: string | number;
}

interface RuleSnapshotRow extends QueryResultRow {
  market: string;
  product: string;
  version: number;
  effective_date: Date | string;
  rules: {
    sourcePath?: string;
    requiredDocuments?: string[];
    completenessWeights?: RuleSnapshotPayload['completenessWeights'];
    metadata?: RuleSnapshotPayload['metadata'];
    labPolicy?: RuleSnapshotPayload['labPolicy'];
    substances?: RuleSnapshotPayload['substances'];
  };
}

interface ArtifactRow extends QueryResultRow {
  id: string;
  lane_id: string;
  lane_public_id: string;
  exporter_id: string;
  artifact_type: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  file_path: string;
  content_hash: string;
  source: string;
  checkpoint_id: string | null;
  verification_status: string;
  metadata: Record<string, unknown> | null;
  uploaded_by: string;
  uploaded_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface ArtifactLinkRow extends QueryResultRow {
  id: string;
  source_artifact_id: string;
  target_artifact_id: string;
  relationship_type: string;
}

@Injectable()
export class PrismaEvidenceStore implements EvidenceArtifactStore {
  private pool?: Pool;
  private executor?: QueryExecutor;

  constructor(@Inject(DATABASE_POOL) pool: Pool | undefined) {
    this.pool = pool;
    this.executor = pool;
  }

  async runInTransaction<T>(
    operation: (transactionalStore: EvidenceArtifactStore) => Promise<T>,
  ): Promise<T> {
    const executor = this.requireExecutor();

    if (executor instanceof Pool) {
      const client = await executor.connect();

      try {
        await client.query('BEGIN');
        const transactionalStore = PrismaEvidenceStore.withExecutor(
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
  ): PrismaEvidenceStore {
    const store = new PrismaEvidenceStore(pool);
    store.executor = executor;
    return store;
  }

  asAuditStore() {
    return PrismaAuditStore.withExecutor(this.pool, this.requireExecutor());
  }

  async findLaneById(id: string): Promise<EvidenceLaneRecord | null> {
    const [laneResult, ruleSnapshotResult] = await Promise.all([
      this.requireExecutor().query<LaneRow>(
        `
          SELECT
            id,
            lane_id,
            exporter_id,
            completeness_score
          FROM lanes
          WHERE id = $1
          LIMIT 1
        `,
        [id],
      ),
      this.requireExecutor().query<RuleSnapshotRow>(
        `
          SELECT
            market,
            product,
            version,
            effective_date,
            rules
          FROM rule_snapshots
          WHERE lane_id = $1
          LIMIT 1
        `,
        [id],
      ),
    ]);

    return laneResult.rowCount === 0
      ? null
      : {
          id: laneResult.rows[0].id,
          laneId: laneResult.rows[0].lane_id,
          exporterId: laneResult.rows[0].exporter_id,
          completenessScore: Number(laneResult.rows[0].completeness_score),
          ruleSnapshot:
            ruleSnapshotResult.rowCount === 0
              ? null
              : {
                  market: ruleSnapshotResult.rows[0]
                    .market as RuleSnapshotPayload['market'],
                  product: ruleSnapshotResult.rows[0]
                    .product as RuleSnapshotPayload['product'],
                  version: ruleSnapshotResult.rows[0].version,
                  effectiveDate:
                    ruleSnapshotResult.rows[0].effective_date instanceof Date
                      ? ruleSnapshotResult.rows[0].effective_date
                      : new Date(ruleSnapshotResult.rows[0].effective_date),
                  sourcePath: ruleSnapshotResult.rows[0].rules.sourcePath ?? '',
                  requiredDocuments:
                    ruleSnapshotResult.rows[0].rules.requiredDocuments ?? [],
                  completenessWeights: ruleSnapshotResult.rows[0].rules
                    .completenessWeights ?? {
                    regulatory: 0.4,
                    quality: 0.25,
                    coldChain: 0.2,
                    chainOfCustody: 0.15,
                  },
                  metadata: ruleSnapshotResult.rows[0].rules.metadata ?? {
                    coverageState: 'CURATED_HIGH_RISK',
                    sourceQuality: 'SECONDARY_ONLY',
                    retrievedAt:
                      ruleSnapshotResult.rows[0].effective_date instanceof Date
                        ? ruleSnapshotResult.rows[0].effective_date
                        : new Date(ruleSnapshotResult.rows[0].effective_date),
                    commodityCode: null,
                    nonPesticideChecks: [],
                  },
                  labPolicy: ruleSnapshotResult.rows[0].rules.labPolicy,
                  substances: ruleSnapshotResult.rows[0].rules.substances ?? [],
                },
        };
  }

  async createArtifact(
    input: CreateArtifactRecordInput,
  ): Promise<EvidenceArtifactRecord> {
    const id = randomUUID();
    await this.requireExecutor().query(
      `
        INSERT INTO evidence_artifacts (
          id,
          lane_id,
          artifact_type,
          file_name,
          mime_type,
          file_size_bytes,
          file_path,
          content_hash,
          source,
          checkpoint_id,
          uploaded_by,
          verification_status,
          metadata,
          uploaded_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW(), NOW()
        )
      `,
      [
        id,
        input.laneId,
        input.artifactType,
        input.fileName,
        input.mimeType,
        input.fileSizeBytes,
        input.filePath,
        input.contentHash,
        input.source,
        input.checkpointId,
        input.uploadedBy,
        input.verificationStatus,
        input.metadata === null ? null : JSON.stringify(input.metadata),
      ],
    );

    return await this.requireArtifactRow(id);
  }

  async createArtifactLinks(
    sourceArtifactId: string,
    links: Array<{ targetArtifactId: string; relationshipType: string }>,
  ): Promise<void> {
    for (const link of links) {
      await this.requireExecutor().query(
        `
          INSERT INTO artifact_links (
            id,
            source_artifact_id,
            target_artifact_id,
            relationship_type
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (source_artifact_id, target_artifact_id) DO NOTHING
        `,
        [
          randomUUID(),
          sourceArtifactId,
          link.targetArtifactId,
          link.relationshipType,
        ],
      );
    }
  }

  async findLatestArtifactForLane(
    laneId: string,
  ): Promise<EvidenceArtifactRecord | null> {
    const result = await this.requireExecutor().query<ArtifactRow>(
      `
        SELECT
          ea.id,
          ea.lane_id,
          lanes.lane_id AS lane_public_id,
          lanes.exporter_id,
          ea.artifact_type,
          ea.file_name,
          ea.mime_type,
          ea.file_size_bytes,
          ea.file_path,
          ea.content_hash,
          ea.source,
          ea.checkpoint_id,
          ea.verification_status,
          ea.metadata,
          ea.uploaded_by,
          ea.uploaded_at,
          ea.updated_at,
          ea.deleted_at
        FROM evidence_artifacts ea
        INNER JOIN lanes ON lanes.id = ea.lane_id
        WHERE ea.lane_id = $1
          AND ea.deleted_at IS NULL
        ORDER BY ea.uploaded_at DESC, ea.id DESC
        LIMIT 1
      `,
      [laneId],
    );

    return result.rowCount === 0 ? null : this.mapArtifact(result.rows[0]);
  }

  async findLatestArtifactForCheckpoint(
    checkpointId: string,
  ): Promise<EvidenceArtifactRecord | null> {
    const result = await this.requireExecutor().query<ArtifactRow>(
      `
        SELECT
          ea.id,
          ea.lane_id,
          lanes.lane_id AS lane_public_id,
          lanes.exporter_id,
          ea.artifact_type,
          ea.file_name,
          ea.mime_type,
          ea.file_size_bytes,
          ea.file_path,
          ea.content_hash,
          ea.source,
          ea.checkpoint_id,
          ea.verification_status,
          ea.metadata,
          ea.uploaded_by,
          ea.uploaded_at,
          ea.updated_at,
          ea.deleted_at
        FROM evidence_artifacts ea
        INNER JOIN lanes ON lanes.id = ea.lane_id
        WHERE ea.checkpoint_id = $1
          AND ea.deleted_at IS NULL
        ORDER BY ea.uploaded_at DESC, ea.id DESC
        LIMIT 1
      `,
      [checkpointId],
    );

    return result.rowCount === 0 ? null : this.mapArtifact(result.rows[0]);
  }

  async linkCreatesCycle(
    sourceArtifactId: string,
    targetArtifactId: string,
  ): Promise<boolean> {
    const result = await this.requireExecutor().query<{
      creates_cycle: boolean;
    }>(
      `
        WITH RECURSIVE reachable(artifact_id) AS (
          SELECT target_ea.id
          FROM evidence_artifacts target_ea
          WHERE target_ea.id = $1
            AND target_ea.deleted_at IS NULL
          UNION
          SELECT al.target_artifact_id
          FROM artifact_links al
          INNER JOIN evidence_artifacts source_ea ON source_ea.id = al.source_artifact_id
          INNER JOIN evidence_artifacts target_ea ON target_ea.id = al.target_artifact_id
          INNER JOIN reachable r ON r.artifact_id = al.source_artifact_id
          WHERE source_ea.deleted_at IS NULL
            AND target_ea.deleted_at IS NULL
        )
        SELECT EXISTS(
          SELECT 1
          FROM reachable
          WHERE artifact_id = $2
        ) AS creates_cycle
      `,
      [targetArtifactId, sourceArtifactId],
    );

    return result.rows[0]?.creates_cycle === true;
  }

  async listArtifactsForLane(
    laneId: string,
    filters: EvidenceListFilters,
  ): Promise<{ items: EvidenceArtifactRecord[]; total: number }> {
    const values: unknown[] = [laneId];
    const conditions = ['ea.lane_id = $1', 'ea.deleted_at IS NULL'];

    if (filters.type !== undefined) {
      values.push(filters.type);
      conditions.push(`ea.artifact_type = $${values.length}`);
    }

    if (filters.status !== undefined) {
      values.push(filters.status);
      conditions.push(`ea.verification_status = $${values.length}`);
    }

    const page = filters.page ?? DEFAULT_EVIDENCE_PAGE;
    const limit = Math.min(
      filters.limit ?? DEFAULT_EVIDENCE_LIMIT,
      MAX_EVIDENCE_LIMIT,
    );
    const offset = Math.max(page - 1, 0) * limit;

    const whereClause = conditions.join(' AND ');
    const totalResult = await this.requireExecutor().query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM evidence_artifacts ea
        WHERE ${whereClause}
      `,
      values,
    );
    const rows = await this.requireExecutor().query<ArtifactRow>(
      `
        SELECT
          ea.id,
          ea.lane_id,
          lanes.lane_id AS lane_public_id,
          lanes.exporter_id,
          ea.artifact_type,
          ea.file_name,
          ea.mime_type,
          ea.file_size_bytes,
          ea.file_path,
          ea.content_hash,
          ea.source,
          ea.checkpoint_id,
          ea.verification_status,
          ea.metadata,
          ea.uploaded_by,
          ea.uploaded_at,
          ea.updated_at,
          ea.deleted_at
        FROM evidence_artifacts ea
        INNER JOIN lanes ON lanes.id = ea.lane_id
        WHERE ${whereClause}
        ORDER BY ea.uploaded_at DESC, ea.id DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, offset],
    );

    return {
      items: rows.rows.map((row) => this.mapArtifact(row)),
      total: Number(totalResult.rows[0]?.total ?? '0'),
    };
  }

  async listArtifactsForEvaluation(laneId: string) {
    const result = await this.requireExecutor().query<ArtifactRow>(
      `
        SELECT
          ea.id,
          ea.lane_id,
          lanes.lane_id AS lane_public_id,
          lanes.exporter_id,
          ea.artifact_type,
          ea.file_name,
          ea.mime_type,
          ea.file_size_bytes,
          ea.file_path,
          ea.content_hash,
          ea.source,
          ea.checkpoint_id,
          ea.verification_status,
          ea.metadata,
          ea.uploaded_by,
          ea.uploaded_at,
          ea.updated_at,
          ea.deleted_at
        FROM evidence_artifacts ea
        INNER JOIN lanes ON lanes.id = ea.lane_id
        WHERE ea.lane_id = $1
          AND ea.deleted_at IS NULL
        ORDER BY ea.uploaded_at ASC, ea.id ASC
      `,
      [laneId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      artifactType: row.artifact_type,
      fileName: row.file_name,
      metadata: row.metadata,
    }));
  }

  async listArtifactsForIntegrityCheck(
    laneId: string,
  ): Promise<EvidenceArtifactRecord[]> {
    const result = await this.requireExecutor().query<ArtifactRow>(
      `
        SELECT
          ea.id,
          ea.lane_id,
          lanes.lane_id AS lane_public_id,
          lanes.exporter_id,
          ea.artifact_type,
          ea.file_name,
          ea.mime_type,
          ea.file_size_bytes,
          ea.file_path,
          ea.content_hash,
          ea.source,
          ea.checkpoint_id,
          ea.verification_status,
          ea.metadata,
          ea.uploaded_by,
          ea.uploaded_at,
          ea.updated_at,
          ea.deleted_at
        FROM evidence_artifacts ea
        INNER JOIN lanes ON lanes.id = ea.lane_id
        WHERE ea.lane_id = $1
          AND ea.deleted_at IS NULL
        ORDER BY ea.uploaded_at ASC, ea.id ASC
      `,
      [laneId],
    );

    return result.rows.map((row) => this.mapArtifact(row));
  }

  async findArtifactById(id: string): Promise<EvidenceArtifactRecord | null> {
    return await this.findArtifactByIdInternal(id, false);
  }

  async updateArtifactVerificationStatus(
    id: string,
    status: EvidenceVerificationStatus,
  ): Promise<EvidenceArtifactRecord> {
    await this.requireExecutor().query(
      `
        UPDATE evidence_artifacts
        SET verification_status = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [id, status],
    );

    return await this.requireArtifactRow(id);
  }

  async findArtifactGraphForLane(
    laneId: string,
  ): Promise<EvidenceArtifactGraph> {
    const nodes = await this.listArtifactsForLane(laneId, {});
    const edges = await this.requireExecutor().query<ArtifactLinkRow>(
      `
        SELECT
          al.id,
          al.source_artifact_id,
          al.target_artifact_id,
          al.relationship_type
        FROM artifact_links al
        INNER JOIN evidence_artifacts source_ea ON source_ea.id = al.source_artifact_id
        INNER JOIN evidence_artifacts target_ea ON target_ea.id = al.target_artifact_id
        WHERE source_ea.lane_id = $1
          AND target_ea.lane_id = $1
          AND source_ea.deleted_at IS NULL
          AND target_ea.deleted_at IS NULL
      `,
      [laneId],
    );

    return {
      nodes: nodes.items.map((artifact) => ({
        id: artifact.id,
        artifactId: artifact.id,
        artifactType: artifact.artifactType,
        label: this.buildArtifactLabel(
          artifact.artifactType,
          artifact.fileName,
        ),
        status: artifact.verificationStatus,
        hashPreview: artifact.contentHash.slice(0, 8),
      })),
      edges: edges.rows.map((edge) => ({
        id: edge.id,
        sourceArtifactId: edge.source_artifact_id,
        targetArtifactId: edge.target_artifact_id,
        relationshipType: edge.relationship_type,
      })),
    };
  }

  async updateLaneCompletenessScore(
    laneId: string,
    score: number,
  ): Promise<void> {
    await this.requireExecutor().query(
      `
        UPDATE lanes
        SET completeness_score = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [laneId, score],
    );
  }

  async softDeleteArtifact(id: string): Promise<EvidenceArtifactRecord | null> {
    await this.requireExecutor().query(
      `
        UPDATE evidence_artifacts
        SET deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [id],
    );

    return await this.findArtifactByIdInternal(id, true);
  }

  private async findArtifactByIdInternal(
    id: string,
    includeDeleted: boolean,
  ): Promise<EvidenceArtifactRecord | null> {
    const result = await this.requireExecutor().query<ArtifactRow>(
      `
        SELECT
          ea.id,
          ea.lane_id,
          lanes.lane_id AS lane_public_id,
          lanes.exporter_id,
          ea.artifact_type,
          ea.file_name,
          ea.mime_type,
          ea.file_size_bytes,
          ea.file_path,
          ea.content_hash,
          ea.source,
          ea.checkpoint_id,
          ea.verification_status,
          ea.metadata,
          ea.uploaded_by,
          ea.uploaded_at,
          ea.updated_at,
          ea.deleted_at
        FROM evidence_artifacts ea
        INNER JOIN lanes ON lanes.id = ea.lane_id
        WHERE ea.id = $1
          ${includeDeleted ? '' : 'AND ea.deleted_at IS NULL'}
        LIMIT 1
      `,
      [id],
    );

    return result.rowCount === 0 ? null : this.mapArtifact(result.rows[0]);
  }

  private requireExecutor(): QueryExecutor {
    if (this.executor === undefined) {
      throw new Error('Evidence store is not configured.');
    }

    return this.executor;
  }

  private async requireArtifactRow(
    id: string,
  ): Promise<EvidenceArtifactRecord> {
    const artifact = await this.findArtifactById(id);
    if (artifact === null) {
      throw new Error('Evidence artifact not found after write.');
    }

    return artifact;
  }

  private mapArtifact(row: ArtifactRow): EvidenceArtifactRecord {
    return {
      id: row.id,
      laneId: row.lane_id,
      lanePublicId: row.lane_public_id,
      exporterId: row.exporter_id,
      artifactType: row.artifact_type as EvidenceArtifactRecord['artifactType'],
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      filePath: row.file_path,
      contentHash: row.content_hash,
      source: row.source as EvidenceArtifactRecord['source'],
      checkpointId: row.checkpoint_id,
      verificationStatus:
        row.verification_status as EvidenceArtifactRecord['verificationStatus'],
      metadata: row.metadata,
      uploadedBy: row.uploaded_by,
      uploadedAt:
        row.uploaded_at instanceof Date
          ? row.uploaded_at
          : new Date(row.uploaded_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at
          : new Date(row.updated_at),
      deletedAt:
        row.deleted_at === null
          ? null
          : row.deleted_at instanceof Date
            ? row.deleted_at
            : new Date(row.deleted_at),
    };
  }

  private buildArtifactLabel(type: string, fileName: string): string {
    switch (type) {
      case 'MRL_TEST':
        return 'MRL Test';
      case 'VHT_CERT':
        return 'VHT Certificate';
      case 'PHYTO_CERT':
        return 'Phyto Certificate';
      case 'CHECKPOINT_PHOTO':
        return 'Checkpoint Photo';
      case 'TEMP_DATA':
        return 'Temperature Data';
      case 'HANDOFF_SIGNATURE':
        return 'Handoff Signature';
      case 'INVOICE':
        return 'Invoice';
      case 'GAP_CERT':
        return 'GAP Certificate';
      default:
        return fileName;
    }
  }
}

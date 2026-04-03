import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { AuditEntityType } from '../../common/audit/audit.types';
import { PrismaAuditStore } from '../../common/audit/audit.prisma-store';
import { AuditService } from '../../common/audit/audit.service';
import { DATABASE_POOL } from '../../common/database/database.constants';
import {
  classifyRiskLevel,
  computeStringencyRatio,
  normalizeRuleMarket,
  normalizeRuleProduct,
} from './rules-engine.utils';
import type {
  RuleCertificationAlertDeliveryClaimInput,
  RuleCertificationAlertDeliveryClaimRecord,
  RuleCertificationAlertDeliveryCompletionInput,
  RuleCertificationScanArtifact,
  RuleMarket,
  RuleProduct,
  RuleSetDefinition,
  RuleSetRecord,
  RuleStore,
  RuleSubstanceDefinition,
  RuleSubstanceInput,
  RuleSubstanceRecord,
  RuleVersionFilter,
  RuleVersionRecord,
} from './rules-engine.types';

type QueryExecutor = Pool | PoolClient;

interface RuleSetRow extends QueryResultRow {
  id: string;
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  effective_date: Date | string;
  source_path: string | null;
  rules: RuleSetDefinition;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RuleVersionRow extends QueryResultRow {
  id: string;
  rule_set_id: string;
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  changes_summary: string;
  rules: RuleSetDefinition;
  changed_at: Date | string;
}

interface SubstanceRow extends QueryResultRow {
  id: string;
  market: RuleMarket;
  name: string;
  cas: string | null;
  thai_mrl: string | number | null;
  destination_mrl: string | number;
  stringency_ratio: string | number | null;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CertificationScanArtifactRow extends QueryResultRow {
  lane_id: string;
  lane_public_id: string;
  artifact_id: string;
  artifact_type: 'PHYTO_CERT' | 'VHT_CERT' | 'GAP_CERT';
  file_name: string;
  metadata: Record<string, unknown> | string | null;
  uploaded_at: Date | string;
}

interface CertificationAlertDeliveryRow extends QueryResultRow {
  id: string;
}

@Injectable()
export class PrismaRulesEngineStore implements RuleStore {
  private pool?: Pool;
  private executor?: QueryExecutor;

  constructor(
    @Inject(DATABASE_POOL) pool: Pool | undefined,
    private readonly auditService: AuditService,
  ) {
    this.pool = pool;
    this.executor = pool;
  }

  async runInTransaction<T>(
    operation: (store: RuleStore) => Promise<T>,
  ): Promise<T> {
    const executor = this.requireExecutor();

    if (executor instanceof Pool) {
      const client = await executor.connect();

      try {
        await client.query('BEGIN');
        const transactionalStore = this.withExecutor(client);
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

  private withExecutor(executor: QueryExecutor): PrismaRulesEngineStore {
    const store = new PrismaRulesEngineStore(this.pool, this.auditService);
    store.executor = executor;
    return store;
  }

  async syncRuleDefinition(
    definition: RuleSetDefinition,
  ): Promise<RuleSetRecord> {
    const executor = this.requireExecutor();
    const current = await this.findLatestRuleSet(
      definition.market,
      definition.product,
    );
    const ruleSetId = current?.id ?? randomUUID();
    const changesSummary =
      current === null
        ? 'Initial rules import'
        : current.version === definition.version
          ? 'Rule definition synchronized'
          : `Version ${current.version} -> ${definition.version}`;

    const result = await executor.query<RuleSetRow>(
      `
        INSERT INTO rule_sets (
          id,
          market,
          product,
          version,
          effective_date,
          source_path,
          rules,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
        ON CONFLICT (market, product)
        DO UPDATE SET
          version = EXCLUDED.version,
          effective_date = EXCLUDED.effective_date,
          source_path = EXCLUDED.source_path,
          rules = EXCLUDED.rules,
          updated_at = NOW()
        RETURNING
          id,
          market,
          product,
          version,
          effective_date,
          source_path,
          rules,
          created_at,
          updated_at
      `,
      [
        ruleSetId,
        definition.market,
        definition.product,
        definition.version,
        definition.effectiveDate,
        definition.sourcePath,
        JSON.stringify(definition),
      ],
    );

    await this.recordRuleVersion(result.rows[0].id, definition, changesSummary);
    await this.syncSubstances(definition.market, definition.substances);

    return this.mapRuleSet(result.rows[0]);
  }

  async findLatestRuleSet(
    market: RuleMarket,
    product: RuleProduct,
  ): Promise<RuleSetRecord | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<RuleSetRow>(
      `
        SELECT
          id,
          market,
          product,
          version,
          effective_date,
          source_path,
          rules,
          created_at,
          updated_at
        FROM rule_sets
        WHERE market = $1 AND product = $2
        LIMIT 1
      `,
      [market, product],
    );

    return result.rowCount === 0 ? null : this.mapRuleSet(result.rows[0]);
  }

  async listMarkets(): Promise<RuleMarket[]> {
    const executor = this.requireExecutor();
    const result = await executor.query<{ market: RuleMarket }>(
      `
        SELECT DISTINCT market
        FROM rule_sets
        ORDER BY market ASC
      `,
    );

    return result.rows.map((row) => row.market);
  }

  async listSubstances(market?: RuleMarket): Promise<RuleSubstanceRecord[]> {
    const executor = this.requireExecutor();
    const values: unknown[] = [];
    const whereClause = market === undefined ? '' : 'WHERE market = $1';

    if (market !== undefined) {
      values.push(market);
    }

    const result = await executor.query<SubstanceRow>(
      `
        SELECT
          id,
          market,
          name,
          cas,
          thai_mrl,
          destination_mrl,
          stringency_ratio,
          risk_level,
          created_at,
          updated_at
        FROM substances
        ${whereClause}
        ORDER BY market ASC, name ASC
      `,
      values,
    );

    return result.rows.map((row) => this.mapSubstance(row));
  }

  async createSubstance(
    market: RuleMarket,
    input: RuleSubstanceInput,
  ): Promise<RuleSubstanceRecord> {
    const normalizedMarket = normalizeRuleMarket(market);
    const stringencyRatio = computeStringencyRatio(
      input.thaiMrl,
      input.destinationMrl,
    );
    const riskLevel = classifyRiskLevel(stringencyRatio);
    const result = await this.requireExecutor().query<SubstanceRow>(
      `
        INSERT INTO substances (
          id,
          market,
          name,
          cas,
          thai_mrl,
          destination_mrl,
          stringency_ratio,
          risk_level,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING
          id,
          market,
          name,
          cas,
          thai_mrl,
          destination_mrl,
          stringency_ratio,
          risk_level,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        normalizedMarket,
        input.name.trim(),
        input.cas.trim(),
        input.thaiMrl,
        input.destinationMrl,
        stringencyRatio,
        riskLevel,
      ],
    );

    return this.mapSubstance(result.rows[0]);
  }

  async bumpRuleVersionsForMarket(
    market: RuleMarket,
    changesSummary: string,
  ): Promise<RuleSetRecord[]> {
    const executor = this.requireExecutor();
    const ruleSetsResult = await executor.query<RuleSetRow>(
      `
        SELECT
          id,
          market,
          product,
          version,
          effective_date,
          source_path,
          rules,
          created_at,
          updated_at
        FROM rule_sets
        WHERE market = $1
        ORDER BY product ASC
      `,
      [market],
    );

    if (ruleSetsResult.rowCount === 0) {
      return [];
    }

    const substances = await this.listSubstances(market);
    const effectiveDate = new Date();
    const nextRuleSets: RuleSetRecord[] = [];

    for (const row of ruleSetsResult.rows) {
      const current = this.mapRuleSet(row);
      const nextDefinition: RuleSetDefinition = {
        ...current.payload,
        market: current.market,
        product: current.product,
        version: current.version + 1,
        effectiveDate,
        sourcePath: current.sourcePath ?? current.payload.sourcePath ?? '',
        substances: substances.map((substance) => ({
          name: substance.name,
          aliases: [],
          cas: substance.cas,
          thaiMrl: substance.thaiMrl,
          destinationMrl: substance.destinationMrl,
          stringencyRatio: substance.stringencyRatio,
          riskLevel: substance.riskLevel,
          sourceRef: null,
          note: null,
        })),
      };

      const updateResult = await executor.query<RuleSetRow>(
        `
          UPDATE rule_sets
          SET
            version = $2,
            effective_date = $3,
            source_path = $4,
            rules = $5::jsonb,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            market,
            product,
            version,
            effective_date,
            source_path,
            rules,
            created_at,
            updated_at
        `,
        [
          current.id,
          nextDefinition.version,
          effectiveDate,
          nextDefinition.sourcePath,
          JSON.stringify(nextDefinition),
        ],
      );

      await this.recordRuleVersion(current.id, nextDefinition, changesSummary);
      nextRuleSets.push(this.mapRuleSet(updateResult.rows[0]));
    }

    return nextRuleSets;
  }

  async updateSubstance(
    substanceId: string,
    input: Partial<RuleSubstanceInput>,
  ): Promise<RuleSubstanceRecord> {
    const executor = this.requireExecutor();
    const existingResult = await executor.query<SubstanceRow>(
      `
        SELECT
          id,
          market,
          name,
          cas,
          thai_mrl,
          destination_mrl,
          stringency_ratio,
          risk_level,
          created_at,
          updated_at
        FROM substances
        WHERE id = $1
        LIMIT 1
      `,
      [substanceId],
    );

    if (existingResult.rowCount === 0) {
      throw new Error('Substance not found.');
    }

    const existing = this.mapSubstance(existingResult.rows[0]);
    const nextThaiMrl = input.thaiMrl ?? existing.thaiMrl;
    const nextDestinationMrl = input.destinationMrl ?? existing.destinationMrl;
    const stringencyRatio =
      nextThaiMrl === null
        ? null
        : computeStringencyRatio(nextThaiMrl, nextDestinationMrl);
    const riskLevel =
      stringencyRatio === null ? null : classifyRiskLevel(stringencyRatio);

    const result = await executor.query<SubstanceRow>(
      `
        UPDATE substances
        SET
          name = $2,
          cas = $3,
          thai_mrl = $4,
          destination_mrl = $5,
          stringency_ratio = $6,
          risk_level = $7,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          market,
          name,
          cas,
          thai_mrl,
          destination_mrl,
          stringency_ratio,
          risk_level,
          created_at,
          updated_at
      `,
      [
        substanceId,
        input.name?.trim() ?? existing.name,
        input.cas?.trim() ?? existing.cas,
        nextThaiMrl,
        nextDestinationMrl,
        stringencyRatio,
        riskLevel,
      ],
    );

    return this.mapSubstance(result.rows[0]);
  }

  async listRuleVersions(
    filter?: RuleVersionFilter,
  ): Promise<RuleVersionRecord[]> {
    const executor = this.requireExecutor();
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (filter?.market !== undefined) {
      values.push(filter.market);
      conditions.push(`market = $${values.length}`);
    }

    if (filter?.product !== undefined) {
      values.push(filter.product);
      conditions.push(`product = $${values.length}`);
    }

    const whereClause =
      conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
    const result = await executor.query<RuleVersionRow>(
      `
        SELECT
          id,
          rule_set_id,
          market,
          product,
          version,
          changes_summary,
          rules,
          changed_at
        FROM rule_versions
        ${whereClause}
        ORDER BY changed_at DESC, version DESC
      `,
      values,
    );

    return result.rows.map((row) => this.mapRuleVersion(row));
  }

  async appendSubstanceAuditEntry(input: {
    actor: string;
    action: 'CREATE' | 'UPDATE';
    substanceId: string;
    payloadHash: string;
  }): Promise<void> {
    const auditStore = PrismaAuditStore.withExecutor(
      this.pool,
      this.requireExecutor(),
    );
    await this.auditService.createEntryWithStore(auditStore, {
      actor: input.actor,
      action: input.action,
      entityType: AuditEntityType.SUBSTANCE,
      entityId: input.substanceId,
      payloadHash: input.payloadHash,
    });
  }

  async listLatestActiveCertificationArtifacts(): Promise<
    RuleCertificationScanArtifact[]
  > {
    const executor = this.requireExecutor();
    const result = await executor.query<CertificationScanArtifactRow>(
      `
        SELECT DISTINCT ON (artifacts.lane_id, artifacts.artifact_type)
          lanes.id AS lane_id,
          lanes.lane_id AS lane_public_id,
          artifacts.id AS artifact_id,
          artifacts.artifact_type,
          artifacts.file_name,
          artifacts.metadata,
          artifacts.uploaded_at
        FROM evidence_artifacts AS artifacts
        INNER JOIN lanes
          ON lanes.id = artifacts.lane_id
        WHERE artifacts.deleted_at IS NULL
          AND artifacts.artifact_type IN ('PHYTO_CERT', 'VHT_CERT', 'GAP_CERT')
          AND lanes.status IN (
            'CREATED',
            'EVIDENCE_COLLECTING',
            'VALIDATED',
            'PACKED',
            'INCOMPLETE'
          )
        ORDER BY
          artifacts.lane_id ASC,
          artifacts.artifact_type ASC,
          artifacts.uploaded_at DESC,
          artifacts.id DESC
      `,
    );

    return result.rows.map((row) => ({
      laneId: row.lane_id,
      lanePublicId: row.lane_public_id,
      artifactId: row.artifact_id,
      artifactType: row.artifact_type,
      fileName: row.file_name,
      metadata:
        typeof row.metadata === 'string'
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : row.metadata,
      uploadedAt: new Date(row.uploaded_at),
    }));
  }

  async claimCertificationAlertDelivery(
    input: RuleCertificationAlertDeliveryClaimInput,
  ): Promise<RuleCertificationAlertDeliveryClaimRecord | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<CertificationAlertDeliveryRow>(
      `
        INSERT INTO certification_alert_deliveries (
          id,
          lane_id,
          artifact_id,
          artifact_type,
          alert_code,
          warning_days,
          expires_at,
          notification_id,
          delivery_status,
          claimed_at,
          delivered_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          NULL,
          'CLAIMED',
          $8,
          NULL,
          $8,
          $8
        )
        ON CONFLICT (lane_id, artifact_id, alert_code)
        DO NOTHING
        RETURNING id
      `,
      [
        randomUUID(),
        input.laneId,
        input.artifactId,
        input.artifactType,
        input.alertCode,
        input.warningDays,
        input.expiresAt,
        input.claimedAt,
      ],
    );

    return result.rowCount === 0 ? null : { id: result.rows[0].id };
  }

  async completeCertificationAlertDelivery(
    deliveryId: string,
    input: RuleCertificationAlertDeliveryCompletionInput,
  ): Promise<void> {
    await this.requireExecutor().query(
      `
        UPDATE certification_alert_deliveries
        SET
          notification_id = $2,
          delivery_status = $3,
          delivered_at = $4,
          updated_at = $4
        WHERE id = $1
      `,
      [
        deliveryId,
        input.notificationId,
        input.deliveryStatus,
        input.deliveredAt,
      ],
    );
  }

  async releaseCertificationAlertDelivery(deliveryId: string): Promise<void> {
    await this.requireExecutor().query(
      `
        DELETE FROM certification_alert_deliveries
        WHERE id = $1
      `,
      [deliveryId],
    );
  }

  private async recordRuleVersion(
    ruleSetId: string,
    definition: RuleSetDefinition,
    changesSummary: string,
  ): Promise<void> {
    const executor = this.requireExecutor();
    await executor.query(
      `
        INSERT INTO rule_versions (
          id,
          rule_set_id,
          market,
          product,
          version,
          changes_summary,
          rules,
          changed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
        ON CONFLICT (rule_set_id, version)
        DO UPDATE SET
          changes_summary = EXCLUDED.changes_summary,
          rules = EXCLUDED.rules,
          changed_at = NOW()
      `,
      [
        randomUUID(),
        ruleSetId,
        definition.market,
        definition.product,
        definition.version,
        changesSummary,
        JSON.stringify(definition),
      ],
    );
  }

  private async syncSubstances(
    market: RuleMarket,
    substances: RuleSubstanceDefinition[],
  ): Promise<void> {
    const executor = this.requireExecutor();

    for (const substance of substances) {
      await executor.query(
        `
          INSERT INTO substances (
            id,
            market,
            name,
            cas,
            thai_mrl,
            destination_mrl,
            stringency_ratio,
            risk_level,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (market, name)
          DO UPDATE SET
            cas = EXCLUDED.cas,
            thai_mrl = EXCLUDED.thai_mrl,
            destination_mrl = EXCLUDED.destination_mrl,
            stringency_ratio = EXCLUDED.stringency_ratio,
            risk_level = EXCLUDED.risk_level,
            updated_at = NOW()
        `,
        [
          randomUUID(),
          market,
          substance.name,
          substance.cas,
          substance.thaiMrl,
          substance.destinationMrl,
          substance.stringencyRatio,
          substance.riskLevel,
        ],
      );
    }
  }

  private requireExecutor(): QueryExecutor {
    if (this.executor === undefined) {
      throw new Error('Rules store is not configured.');
    }

    return this.executor;
  }

  private mapRuleSet(row: RuleSetRow): RuleSetRecord {
    return {
      id: row.id,
      market: normalizeRuleMarket(row.market),
      product: normalizeRuleProduct(row.product),
      version: row.version,
      effectiveDate: new Date(row.effective_date),
      sourcePath: row.source_path,
      payload: row.rules,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRuleVersion(row: RuleVersionRow): RuleVersionRecord {
    return {
      id: row.id,
      ruleSetId: row.rule_set_id,
      market: normalizeRuleMarket(row.market),
      product: normalizeRuleProduct(row.product),
      version: row.version,
      changesSummary: row.changes_summary,
      payload: row.rules,
      changedAt: new Date(row.changed_at),
    };
  }

  private mapSubstance(row: SubstanceRow): RuleSubstanceRecord {
    return {
      id: row.id,
      market: normalizeRuleMarket(row.market),
      name: row.name,
      cas: row.cas,
      thaiMrl: row.thai_mrl === null ? null : Number(row.thai_mrl),
      destinationMrl: Number(row.destination_mrl),
      stringencyRatio:
        row.stringency_ratio === null ? null : Number(row.stringency_ratio),
      riskLevel: row.risk_level,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

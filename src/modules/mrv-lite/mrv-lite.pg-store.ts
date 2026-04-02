import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';
import type {
  EmissionFactor,
  LaneCarbonRow,
  MrvLiteStore,
} from './mrv-lite.types';

interface LaneEsgRow extends QueryResultRow {
  product_type: string;
  destination_market: string;
  transport_mode: string | null;
  quantity_kg: number;
  completeness_score: number;
  status: string;
  origin_province: string;
  evidence_count: number;
  audit_entry_count: number;
  dispute_count: number;
  resolved_dispute_count: number;
  downgraded_dispute_count: number;
  damaged_dispute_count: number;
}

interface LaneCarbonDbRow extends QueryResultRow {
  status: string;
  product_type: string;
  destination_market: string;
  transport_mode: string | null;
  quantity_kg: number;
  completeness_score: number;
  origin_province: string;
  evidence_count: number;
  audit_entry_count: number;
  dispute_count: number;
  resolved_dispute_count: number;
  downgraded_dispute_count: number;
  damaged_dispute_count: number;
  exporter_id?: string;
}

interface EmissionFactorDbRow extends QueryResultRow {
  product: string;
  market: string;
  transport_mode: string;
  co2e_per_kg: number;
  source: string;
  last_updated: Date;
}

@Injectable()
export class PrismaMrvLiteStore implements MrvLiteStore {
  private readonly pool?: Pool;

  constructor(@Inject(DATABASE_POOL) pool: Pool | undefined) {
    this.pool = pool;
  }

  async listEmissionFactors(): Promise<EmissionFactor[]> {
    const pool = this.requirePool();
    const result = await pool.query<EmissionFactorDbRow>(
      `
        SELECT
          product::text AS product,
          market::text AS market,
          transport_mode::text AS transport_mode,
          co2e_per_kg::numeric AS co2e_per_kg,
          source,
          last_updated
        FROM emission_factors
        ORDER BY product, market, transport_mode
      `,
    );

    return result.rows.map((row) => ({
      product: row.product,
      market: row.market,
      transportMode: row.transport_mode,
      co2ePerKg: Number(row.co2e_per_kg),
      source: row.source,
      lastUpdated: row.last_updated.toISOString().slice(0, 10),
    }));
  }

  async getLaneEsgData(laneId: string): Promise<{
    productType: string;
    destinationMarket: string;
    transportMode: string | null;
    quantityKg: number;
    completenessScore: number;
    status: string;
    originProvince: string;
    evidenceCount: number;
    auditEntryCount: number;
    disputeCount: number;
    resolvedDisputeCount: number;
    downgradedDisputeCount: number;
    damagedDisputeCount: number;
  } | null> {
    const pool = this.requirePool();

    const result = await pool.query<LaneEsgRow>(
      `
        SELECT
          l.product_type,
          l.destination_market,
          r.transport_mode,
          COALESCE(b.quantity_kg, 0)::numeric AS quantity_kg,
          COALESCE(l.completeness_score, 0)::int AS completeness_score,
          l.status,
          COALESCE(b.origin_province, '') AS origin_province,
          (SELECT COUNT(*)::int FROM evidence_artifacts WHERE lane_id = l.id) AS evidence_count,
          (SELECT COUNT(*)::int FROM audit_entries WHERE lane_id = l.id) AS audit_entry_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id) AS dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND status = 'RESOLVED') AS resolved_dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND type = 'GRADE_DISPUTE') AS downgraded_dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND type = 'CARGO_DAMAGE') AS damaged_dispute_count
        FROM lanes l
        LEFT JOIN batches b ON b.lane_id = l.id
        LEFT JOIN routes r ON r.lane_id = l.id
        WHERE l.id = $1 OR l.lane_id = $1
        LIMIT 1
      `,
      [laneId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      productType: row.product_type,
      destinationMarket: row.destination_market,
      transportMode: row.transport_mode,
      quantityKg: Number(row.quantity_kg),
      completenessScore: Number(row.completeness_score),
      status: row.status,
      originProvince: row.origin_province,
      evidenceCount: Number(row.evidence_count),
      auditEntryCount: Number(row.audit_entry_count),
      disputeCount: Number(row.dispute_count),
      resolvedDisputeCount: Number(row.resolved_dispute_count),
      downgradedDisputeCount: Number(row.downgraded_dispute_count),
      damagedDisputeCount: Number(row.damaged_dispute_count),
    };
  }

  async getExporterLaneCarbonRows(
    exporterId: string,
    quarter: number,
    year: number,
  ): Promise<LaneCarbonRow[]> {
    const pool = this.requirePool();

    const result = await pool.query<LaneCarbonDbRow>(
      `
        SELECT
          l.status,
          l.product_type,
          l.destination_market,
          r.transport_mode,
          COALESCE(b.quantity_kg, 0)::numeric AS quantity_kg,
          COALESCE(l.completeness_score, 0)::int AS completeness_score,
          COALESCE(b.origin_province, '') AS origin_province,
          (SELECT COUNT(*)::int FROM evidence_artifacts WHERE lane_id = l.id) AS evidence_count,
          (SELECT COUNT(*)::int FROM audit_entries WHERE lane_id = l.id) AS audit_entry_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id) AS dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND status = 'RESOLVED') AS resolved_dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND type = 'GRADE_DISPUTE') AS downgraded_dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND type = 'CARGO_DAMAGE') AS damaged_dispute_count
        FROM lanes l
        LEFT JOIN batches b ON b.lane_id = l.id
        LEFT JOIN routes r ON r.lane_id = l.id
        WHERE l.exporter_id = $1
          AND date_part('quarter', l.created_at) = $2
          AND date_part('year', l.created_at) = $3
      `,
      [exporterId, quarter, year],
    );

    return result.rows.map((row) => this.mapCarbonRow(row));
  }

  async getPlatformLaneCarbonRows(year: number): Promise<LaneCarbonRow[]> {
    const pool = this.requirePool();

    const result = await pool.query<LaneCarbonDbRow & { exporter_id: string }>(
      `
        SELECT
          l.status,
          l.product_type,
          l.destination_market,
          r.transport_mode,
          COALESCE(b.quantity_kg, 0)::numeric AS quantity_kg,
          COALESCE(l.completeness_score, 0)::int AS completeness_score,
          COALESCE(b.origin_province, '') AS origin_province,
          l.exporter_id,
          (SELECT COUNT(*)::int FROM evidence_artifacts WHERE lane_id = l.id) AS evidence_count,
          (SELECT COUNT(*)::int FROM audit_entries WHERE lane_id = l.id) AS audit_entry_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id) AS dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND status = 'RESOLVED') AS resolved_dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND type = 'GRADE_DISPUTE') AS downgraded_dispute_count,
          (SELECT COUNT(*)::int FROM disputes WHERE lane_id = l.id AND type = 'CARGO_DAMAGE') AS damaged_dispute_count
        FROM lanes l
        LEFT JOIN batches b ON b.lane_id = l.id
        LEFT JOIN routes r ON r.lane_id = l.id
        WHERE date_part('year', l.created_at) = $1
      `,
      [year],
    );

    return result.rows.map((row) => ({
      ...this.mapCarbonRow(row),
      exporterId: row.exporter_id,
    }));
  }

  private mapCarbonRow(row: LaneCarbonDbRow): LaneCarbonRow {
    return {
      status: row.status,
      productType: row.product_type,
      destinationMarket: row.destination_market,
      transportMode: row.transport_mode,
      quantityKg: Number(row.quantity_kg),
      completenessScore: Number(row.completeness_score),
      originProvince: row.origin_province,
      evidenceCount: Number(row.evidence_count),
      auditEntryCount: Number(row.audit_entry_count),
      disputeCount: Number(row.dispute_count),
      resolvedDisputeCount: Number(row.resolved_dispute_count),
      downgradedDisputeCount: Number(row.downgraded_dispute_count),
      damagedDisputeCount: Number(row.damaged_dispute_count),
    };
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('MRV-Lite store is not configured — no database pool.');
    }

    return this.pool;
  }
}

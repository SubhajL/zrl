import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';
import type { MrvLiteStore } from './mrv-lite.types';

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
}

interface ExporterEsgRow extends QueryResultRow {
  total_co2e_kg: number;
  avg_co2e_per_kg: number;
  lane_count: number;
  avg_completeness: number;
  total_evidence_count: number;
  distinct_provinces: number;
  distinct_products: number;
}

interface PlatformEsgRow extends QueryResultRow {
  total_co2e_kg: number;
  avg_co2e_per_kg: number;
  lane_count: number;
  avg_completeness: number;
  total_evidence_count: number;
  total_audit_entries: number;
  distinct_exporters: number;
  distinct_provinces: number;
  distinct_products: number;
}

@Injectable()
export class PrismaMrvLiteStore implements MrvLiteStore {
  private readonly pool?: Pool;

  constructor(@Inject(DATABASE_POOL) pool: Pool | undefined) {
    this.pool = pool;
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
          COALESCE(l.origin_province, '') AS origin_province,
          (SELECT COUNT(*)::int FROM evidence_artifacts WHERE lane_id = l.id) AS evidence_count,
          (SELECT COUNT(*)::int FROM audit_entries WHERE lane_id = l.id) AS audit_entry_count
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
    };
  }

  async getExporterEsgData(
    exporterId: string,
    quarter: number,
    year: number,
  ): Promise<{
    totalCo2eKg: number;
    avgCo2ePerKg: number;
    laneCount: number;
    avgCompleteness: number;
    totalEvidenceCount: number;
    distinctProvinces: number;
    distinctProducts: number;
  }> {
    const pool = this.requirePool();

    const result = await pool.query<ExporterEsgRow>(
      `
        SELECT
          COALESCE(SUM(COALESCE(b.quantity_kg, 0) * 1.5), 0)::numeric AS total_co2e_kg,
          CASE WHEN SUM(COALESCE(b.quantity_kg, 0)) > 0
            THEN (SUM(COALESCE(b.quantity_kg, 0) * 1.5) / SUM(COALESCE(b.quantity_kg, 0)))::numeric
            ELSE 0
          END AS avg_co2e_per_kg,
          COUNT(*)::int AS lane_count,
          COALESCE(AVG(l.completeness_score), 0)::int AS avg_completeness,
          COALESCE(SUM((SELECT COUNT(*) FROM evidence_artifacts WHERE lane_id = l.id)), 0)::int AS total_evidence_count,
          COUNT(DISTINCT l.origin_province)::int AS distinct_provinces,
          COUNT(DISTINCT l.product_type)::int AS distinct_products
        FROM lanes l
        LEFT JOIN batches b ON b.lane_id = l.id
        WHERE l.exporter_id = $1
          AND date_part('quarter', l.created_at) = $2
          AND date_part('year', l.created_at) = $3
      `,
      [exporterId, quarter, year],
    );

    const row = result.rows[0];
    return {
      totalCo2eKg: Number(row.total_co2e_kg),
      avgCo2ePerKg: Number(row.avg_co2e_per_kg),
      laneCount: Number(row.lane_count),
      avgCompleteness: Number(row.avg_completeness),
      totalEvidenceCount: Number(row.total_evidence_count),
      distinctProvinces: Number(row.distinct_provinces),
      distinctProducts: Number(row.distinct_products),
    };
  }

  async getPlatformEsgData(year: number): Promise<{
    totalCo2eKg: number;
    avgCo2ePerKg: number;
    laneCount: number;
    avgCompleteness: number;
    totalEvidenceCount: number;
    totalAuditEntries: number;
    distinctExporters: number;
    distinctProvinces: number;
    distinctProducts: number;
  }> {
    const pool = this.requirePool();

    const result = await pool.query<PlatformEsgRow>(
      `
        SELECT
          COALESCE(SUM(COALESCE(b.quantity_kg, 0) * 1.5), 0)::numeric AS total_co2e_kg,
          CASE WHEN SUM(COALESCE(b.quantity_kg, 0)) > 0
            THEN (SUM(COALESCE(b.quantity_kg, 0) * 1.5) / SUM(COALESCE(b.quantity_kg, 0)))::numeric
            ELSE 0
          END AS avg_co2e_per_kg,
          COUNT(*)::int AS lane_count,
          COALESCE(AVG(l.completeness_score), 0)::int AS avg_completeness,
          COALESCE(SUM((SELECT COUNT(*) FROM evidence_artifacts WHERE lane_id = l.id)), 0)::int AS total_evidence_count,
          COALESCE(SUM((SELECT COUNT(*) FROM audit_entries WHERE lane_id = l.id)), 0)::int AS total_audit_entries,
          COUNT(DISTINCT l.exporter_id)::int AS distinct_exporters,
          COUNT(DISTINCT l.origin_province)::int AS distinct_provinces,
          COUNT(DISTINCT l.product_type)::int AS distinct_products
        FROM lanes l
        LEFT JOIN batches b ON b.lane_id = l.id
        WHERE date_part('year', l.created_at) = $1
      `,
      [year],
    );

    const row = result.rows[0];
    return {
      totalCo2eKg: Number(row.total_co2e_kg),
      avgCo2ePerKg: Number(row.avg_co2e_per_kg),
      laneCount: Number(row.lane_count),
      avgCompleteness: Number(row.avg_completeness),
      totalEvidenceCount: Number(row.total_evidence_count),
      totalAuditEntries: Number(row.total_audit_entries),
      distinctExporters: Number(row.distinct_exporters),
      distinctProvinces: Number(row.distinct_provinces),
      distinctProducts: Number(row.distinct_products),
    };
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('MRV-Lite store is not configured — no database pool.');
    }

    return this.pool;
  }
}

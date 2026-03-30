import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';
import type { LaneCarbonRow, MrvLiteStore } from './mrv-lite.types';

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

interface LaneCarbonDbRow extends QueryResultRow {
  product_type: string;
  destination_market: string;
  transport_mode: string | null;
  quantity_kg: number;
  completeness_score: number;
  origin_province: string;
  evidence_count: number;
  audit_entry_count: number;
  exporter_id?: string;
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

  async getExporterLaneCarbonRows(
    exporterId: string,
    quarter: number,
    year: number,
  ): Promise<LaneCarbonRow[]> {
    const pool = this.requirePool();

    const result = await pool.query<LaneCarbonDbRow>(
      `
        SELECT
          l.product_type,
          l.destination_market,
          r.transport_mode,
          COALESCE(b.quantity_kg, 0)::numeric AS quantity_kg,
          COALESCE(l.completeness_score, 0)::int AS completeness_score,
          COALESCE(l.origin_province, '') AS origin_province,
          (SELECT COUNT(*)::int FROM evidence_artifacts WHERE lane_id = l.id) AS evidence_count,
          (SELECT COUNT(*)::int FROM audit_entries WHERE lane_id = l.id) AS audit_entry_count
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
          l.product_type,
          l.destination_market,
          r.transport_mode,
          COALESCE(b.quantity_kg, 0)::numeric AS quantity_kg,
          COALESCE(l.completeness_score, 0)::int AS completeness_score,
          COALESCE(l.origin_province, '') AS origin_province,
          l.exporter_id,
          (SELECT COUNT(*)::int FROM evidence_artifacts WHERE lane_id = l.id) AS evidence_count,
          (SELECT COUNT(*)::int FROM audit_entries WHERE lane_id = l.id) AS audit_entry_count
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
      productType: row.product_type,
      destinationMarket: row.destination_market,
      transportMode: row.transport_mode,
      quantityKg: Number(row.quantity_kg),
      completenessScore: Number(row.completeness_score),
      originProvince: row.origin_province,
      evidenceCount: Number(row.evidence_count),
      auditEntryCount: Number(row.audit_entry_count),
    };
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('MRV-Lite store is not configured — no database pool.');
    }

    return this.pool;
  }
}

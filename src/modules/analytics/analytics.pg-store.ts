import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';
import type {
  AnalyticsOverview,
  AnalyticsStore,
  CompletenessBracket,
  CompletenessDistributionFilters,
  ExcursionHeatmapCell,
  ExcursionHeatmapFilters,
  ExporterLeaderboardEntry,
  LeaderboardFilters,
  LeaderboardSortField,
  OverviewFilters,
  RejectionTrendFilters,
  RejectionTrendPoint,
} from './analytics.types';

interface OverviewRow extends QueryResultRow {
  total_lanes: number;
  avg_completeness: number;
  ready_to_ship: number;
  cold_chain_count: number;
  markets_served: number;
  products_covered: number;
}

interface RejectionTrendRow extends QueryResultRow {
  period: string;
  rejection_count: number;
  total_count: number;
}

interface CompletenessBracketRow extends QueryResultRow {
  label: string;
  count: number;
}

interface ExcursionHeatmapRow extends QueryResultRow {
  segment: string;
  severity: string;
  count: number;
}

interface LeaderboardRow extends QueryResultRow {
  exporter_id: string;
  company_name: string | null;
  lane_count: number;
  avg_completeness: number;
  ready_to_ship_count: number;
}

// SAFETY: Only these hardcoded column names may appear in ORDER BY.
// Never interpolate user input directly — always go through this map.
const SORT_FIELD_MAP: Record<LeaderboardSortField, string> = {
  avgCompleteness: 'avg_completeness',
  laneCount: 'lane_count',
  readyToShip: 'ready_to_ship_count',
};

@Injectable()
export class PrismaAnalyticsStore implements AnalyticsStore {
  private readonly pool?: Pool;

  constructor(@Inject(DATABASE_POOL) pool: Pool | undefined) {
    this.pool = pool;
  }

  async getOverview(filters: OverviewFilters): Promise<AnalyticsOverview> {
    const pool = this.requirePool();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.exporterId !== undefined) {
      values.push(filters.exporterId);
      conditions.push(`exporter_id = $${values.length}`);
    }

    if (filters.from !== undefined) {
      values.push(filters.from);
      conditions.push(`created_at >= $${values.length}`);
    }

    if (filters.to !== undefined) {
      values.push(filters.to);
      conditions.push(`created_at <= $${values.length}`);
    }

    const whereClause =
      conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query<OverviewRow>(
      `
        SELECT
          COUNT(*)::int AS total_lanes,
          COALESCE(AVG(completeness_score), 0)::int AS avg_completeness,
          COUNT(*) FILTER (WHERE status IN ('VALIDATED', 'PACKED', 'CLOSED'))::int AS ready_to_ship,
          COUNT(*) FILTER (WHERE cold_chain_mode IS NOT NULL)::int AS cold_chain_count,
          COUNT(DISTINCT destination_market)::int AS markets_served,
          COUNT(DISTINCT product_type)::int AS products_covered
        FROM lanes
        ${whereClause}
      `,
      values,
    );

    const row = result.rows[0];
    return {
      totalLanes: Number(row.total_lanes),
      avgCompleteness: Number(row.avg_completeness),
      readyToShip: Number(row.ready_to_ship),
      coldChainCount: Number(row.cold_chain_count),
      marketsServed: Number(row.markets_served),
      productsCovered: Number(row.products_covered),
    };
  }

  async getRejectionTrend(
    filters: RejectionTrendFilters,
  ): Promise<RejectionTrendPoint[]> {
    const pool = this.requirePool();
    const conditions: string[] = [];
    const values: unknown[] = [];

    const granularity = filters.granularity ?? 'month';
    values.push(granularity);
    const granularityParam = `$${values.length}`;

    if (filters.exporterId !== undefined) {
      values.push(filters.exporterId);
      conditions.push(`exporter_id = $${values.length}`);
    }

    if (filters.product !== undefined) {
      values.push(filters.product);
      conditions.push(`product_type = $${values.length}`);
    }

    if (filters.market !== undefined) {
      values.push(filters.market);
      conditions.push(`destination_market = $${values.length}`);
    }

    const whereClause =
      conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query<RejectionTrendRow>(
      `
        SELECT
          date_trunc(${granularityParam}, created_at)::text AS period,
          COUNT(*) FILTER (WHERE status = 'INCOMPLETE')::int AS rejection_count,
          COUNT(*)::int AS total_count
        FROM lanes
        ${whereClause}
        GROUP BY period
        ORDER BY period ASC
      `,
      values,
    );

    return result.rows.map((row) => {
      const rejectionCount = Number(row.rejection_count);
      const totalCount = Number(row.total_count);
      const rejectionRate =
        totalCount === 0 ? 0 : Math.round((rejectionCount / totalCount) * 100);
      return {
        period: row.period,
        rejectionCount,
        totalCount,
        rejectionRate,
      };
    });
  }

  async getCompletenessDistribution(
    filters: CompletenessDistributionFilters,
  ): Promise<CompletenessBracket[]> {
    const pool = this.requirePool();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.exporterId !== undefined) {
      values.push(filters.exporterId);
      conditions.push(`exporter_id = $${values.length}`);
    }

    const whereClause =
      conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query<CompletenessBracketRow>(
      `
        SELECT
          CASE
            WHEN completeness_score < 25 THEN '0-25%'
            WHEN completeness_score < 50 THEN '25-50%'
            WHEN completeness_score < 75 THEN '50-75%'
            ELSE '75-100%'
          END AS label,
          COUNT(*)::int AS count
        FROM lanes
        ${whereClause}
        GROUP BY label
        ORDER BY label ASC
      `,
      values,
    );

    const total = result.rows.reduce((sum, row) => sum + Number(row.count), 0);

    return result.rows.map((row) => {
      const count = Number(row.count);
      return {
        label: row.label,
        count,
        percentage: total === 0 ? 0 : Math.round((count / total) * 100),
      };
    });
  }

  async getExcursionHeatmap(
    filters: ExcursionHeatmapFilters,
  ): Promise<ExcursionHeatmapCell[]> {
    const pool = this.requirePool();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.exporterId !== undefined) {
      values.push(filters.exporterId);
      conditions.push(`lanes.exporter_id = $${values.length}`);
    }

    const whereClause =
      conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query<ExcursionHeatmapRow>(
      `
        SELECT
          lanes.product_type AS segment,
          excursions.severity,
          COUNT(*)::int AS count
        FROM excursions
        INNER JOIN lanes ON lanes.id = excursions.lane_id
        ${whereClause}
        GROUP BY lanes.product_type, excursions.severity
        ORDER BY lanes.product_type ASC, excursions.severity ASC
      `,
      values,
    );

    return result.rows.map((row) => ({
      segment: row.segment,
      severity: row.severity,
      count: Number(row.count),
    }));
  }

  async getExporterLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<ExporterLeaderboardEntry[]> {
    const pool = this.requirePool();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.exporterId !== undefined) {
      values.push(filters.exporterId);
      conditions.push(`lanes.exporter_id = $${values.length}`);
    }

    const whereClause =
      conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;

    const sortColumn =
      SORT_FIELD_MAP[filters.sort ?? 'avgCompleteness'] ?? 'avg_completeness';

    const limit = filters.limit ?? 10;
    values.push(limit);
    const limitParam = `$${values.length}`;

    const result = await pool.query<LeaderboardRow>(
      `
        SELECT
          lanes.exporter_id,
          users.company_name,
          COUNT(*)::int AS lane_count,
          COALESCE(AVG(lanes.completeness_score), 0)::int AS avg_completeness,
          COUNT(*) FILTER (WHERE lanes.status IN ('VALIDATED', 'PACKED', 'CLOSED'))::int AS ready_to_ship_count
        FROM lanes
        INNER JOIN users ON users.id = lanes.exporter_id
        ${whereClause}
        GROUP BY lanes.exporter_id, users.company_name
        ORDER BY ${sortColumn} DESC
        LIMIT ${limitParam}
      `,
      values,
    );

    return result.rows.map((row) => ({
      exporterId: row.exporter_id,
      companyName: row.company_name,
      laneCount: Number(row.lane_count),
      avgCompleteness: Number(row.avg_completeness),
      readyToShipCount: Number(row.ready_to_ship_count),
    }));
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('Analytics store is not configured — no database pool.');
    }

    return this.pool;
  }
}

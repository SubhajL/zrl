import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  AnalyticsStore,
  CompletenessDistributionFilters,
  ExcursionHeatmapFilters,
  LeaderboardFilters,
  LeaderboardSortField,
  OverviewFilters,
  RejectionTrendFilters,
  RejectionTrendGranularity,
} from './analytics.types';

const ANALYTICS_STORE = Symbol('ANALYTICS_STORE');
export { ANALYTICS_STORE };

const MAX_LEADERBOARD_LIMIT = 100;

const VALID_GRANULARITIES: ReadonlySet<string> = new Set([
  'day',
  'week',
  'month',
]);

const SCOPED_ROLES: ReadonlySet<string> = new Set(['EXPORTER', 'PARTNER']);

const VALID_SORT_FIELDS: ReadonlySet<string> = new Set([
  'avgCompleteness',
  'laneCount',
  'readyToShip',
]);

function isValidGranularity(value: string): value is RejectionTrendGranularity {
  return VALID_GRANULARITIES.has(value);
}

function isValidSortField(value: string): value is LeaderboardSortField {
  return VALID_SORT_FIELDS.has(value);
}

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${label} date: ${value}`);
  }
  return date;
}

interface AnalyticsActor {
  id: string;
  role: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_STORE) private readonly store: AnalyticsStore,
  ) {}

  async getOverview(
    query: { from?: string; to?: string },
    actor: AnalyticsActor,
  ) {
    const filters: OverviewFilters = {};

    if (SCOPED_ROLES.has(actor.role)) {
      filters.exporterId = actor.id;
    }

    if (query.from !== undefined) {
      filters.from = parseDate(query.from, 'from');
    }

    if (query.to !== undefined) {
      filters.to = parseDate(query.to, 'to');
    }

    return { kpis: await this.store.getOverview(filters) };
  }

  async getRejectionTrend(
    query: { product?: string; market?: string; granularity?: string },
    actor: AnalyticsActor,
  ) {
    const filters: RejectionTrendFilters = {};

    if (SCOPED_ROLES.has(actor.role)) {
      filters.exporterId = actor.id;
    }

    if (query.product !== undefined) {
      filters.product = query.product;
    }

    if (query.market !== undefined) {
      filters.market = query.market;
    }

    if (
      query.granularity !== undefined &&
      isValidGranularity(query.granularity)
    ) {
      filters.granularity = query.granularity;
    }

    return { datapoints: await this.store.getRejectionTrend(filters) };
  }

  async getCompletenessDistribution(actor: AnalyticsActor) {
    const filters: CompletenessDistributionFilters = {};

    if (SCOPED_ROLES.has(actor.role)) {
      filters.exporterId = actor.id;
    }

    return { brackets: await this.store.getCompletenessDistribution(filters) };
  }

  async getExcursionHeatmap(actor: AnalyticsActor) {
    const filters: ExcursionHeatmapFilters = {};

    if (SCOPED_ROLES.has(actor.role)) {
      filters.exporterId = actor.id;
    }

    return { matrix: await this.store.getExcursionHeatmap(filters) };
  }

  async getExporterLeaderboard(
    query: { sort?: string; limit?: string },
    actor: AnalyticsActor,
  ) {
    const filters: LeaderboardFilters = {};

    if (SCOPED_ROLES.has(actor.role)) {
      filters.exporterId = actor.id;
    }

    if (query.sort !== undefined && isValidSortField(query.sort)) {
      filters.sort = query.sort;
    }

    if (query.limit !== undefined) {
      const parsed = Number(query.limit);
      if (Number.isFinite(parsed) && parsed > 0) {
        filters.limit = Math.min(parsed, MAX_LEADERBOARD_LIMIT);
      }
    }

    return { exporters: await this.store.getExporterLeaderboard(filters) };
  }
}

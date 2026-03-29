// Response types matching PRD spec
export interface AnalyticsOverview {
  totalLanes: number;
  avgCompleteness: number;
  readyToShip: number;
  coldChainCount: number;
  marketsServed: number;
  productsCovered: number;
}

export interface RejectionTrendPoint {
  period: string;
  rejectionCount: number;
  totalCount: number;
  rejectionRate: number;
}

export type RejectionTrendGranularity = 'day' | 'week' | 'month';

export interface CompletenessBracket {
  label: string;
  count: number;
  percentage: number;
}

export interface ExcursionHeatmapCell {
  segment: string; // product type
  severity: string; // excursion severity
  count: number;
}

export interface ExporterLeaderboardEntry {
  exporterId: string;
  companyName: string | null;
  laneCount: number;
  avgCompleteness: number;
  readyToShipCount: number;
}

export type LeaderboardSortField =
  | 'avgCompleteness'
  | 'laneCount'
  | 'readyToShip';

// Query filter types
export interface OverviewFilters {
  exporterId?: string;
  from?: Date;
  to?: Date;
}

export interface RejectionTrendFilters {
  exporterId?: string;
  product?: string;
  market?: string;
  granularity?: RejectionTrendGranularity;
}

export interface ExcursionHeatmapFilters {
  exporterId?: string;
}

export interface CompletenessDistributionFilters {
  exporterId?: string;
}

export interface LeaderboardFilters {
  exporterId?: string;
  sort?: LeaderboardSortField;
  limit?: number;
}

// Store interface
export interface AnalyticsStore {
  getOverview(filters: OverviewFilters): Promise<AnalyticsOverview>;
  getRejectionTrend(
    filters: RejectionTrendFilters,
  ): Promise<RejectionTrendPoint[]>;
  getCompletenessDistribution(
    filters: CompletenessDistributionFilters,
  ): Promise<CompletenessBracket[]>;
  getExcursionHeatmap(
    filters: ExcursionHeatmapFilters,
  ): Promise<ExcursionHeatmapCell[]>;
  getExporterLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<ExporterLeaderboardEntry[]>;
}

import { loadAllLanes } from './lanes-data';
import type { Lane } from './types';

export interface AnalyticsMetric {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface AnalyticsBreakdownRow {
  readonly label: string;
  readonly count: number;
  readonly sharePct: number;
}

export interface AnalyticsPageData {
  readonly metrics: AnalyticsMetric[];
  readonly statusBreakdown: AnalyticsBreakdownRow[];
  readonly marketBreakdown: AnalyticsBreakdownRow[];
  readonly productBreakdown: AnalyticsBreakdownRow[];
}

function buildBreakdown(
  lanes: readonly Lane[],
  selectKey: (lane: Lane) => string,
): AnalyticsBreakdownRow[] {
  const counts = new Map<string, number>();
  for (const lane of lanes) {
    const key = selectKey(lane);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = lanes.length || 1;

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      sharePct: Math.round((count / total) * 100),
    }))
    .sort((left, right) => right.count - left.count);
}

export async function loadAnalyticsPageData(): Promise<AnalyticsPageData> {
  const lanes = await loadAllLanes();
  const totalLanes = lanes.length;
  const avgCompleteness =
    totalLanes === 0
      ? 0
      : Math.round(
          lanes.reduce((sum, lane) => sum + lane.completenessScore, 0) /
            totalLanes,
        );
  const validatedOrPacked = lanes.filter((lane) =>
    ['VALIDATED', 'PACKED', 'CLOSED'].includes(lane.status),
  ).length;
  const coldChainCoverage = lanes.filter((lane) => lane.coldChainMode !== null)
    .length;
  const distinctMarkets = new Set(lanes.map((lane) => lane.destinationMarket))
    .size;
  const distinctProducts = new Set(lanes.map((lane) => lane.productType)).size;

  return {
    metrics: [
      {
        label: 'Total Lanes',
        value: `${totalLanes}`,
        hint: 'Authenticated exporter scope',
      },
      {
        label: 'Avg Completeness',
        value: `${avgCompleteness}%`,
        hint: 'Across all visible lanes',
      },
      {
        label: 'Ready to Ship',
        value: `${validatedOrPacked}`,
        hint: 'Validated, packed, or closed',
      },
      {
        label: 'Cold-Chain Coverage',
        value:
          totalLanes === 0
            ? '0%'
            : `${Math.round((coldChainCoverage / totalLanes) * 100)}%`,
        hint: 'Logger or telemetry enabled',
      },
      {
        label: 'Markets Served',
        value: `${distinctMarkets}`,
        hint: 'Distinct destination markets',
      },
      {
        label: 'Products Covered',
        value: `${distinctProducts}`,
        hint: 'Distinct product types',
      },
    ],
    statusBreakdown: buildBreakdown(lanes, (lane) => lane.status),
    marketBreakdown: buildBreakdown(lanes, (lane) => lane.destinationMarket),
    productBreakdown: buildBreakdown(lanes, (lane) => lane.productType),
  };
}

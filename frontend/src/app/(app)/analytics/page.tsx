'use client';

import { Calendar, Download, Filter, TrendingUp } from 'lucide-react';

import { BentoGrid, BentoGridItem } from '@/components/zrl/bento-grid';
import { KpiTile } from '@/components/zrl/kpi-tile';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { ProgressBar } from '@/components/zrl/progress-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_ANALYTICS_KPIS } from '@/lib/mock-data';

// ── Leaderboard Types & Data ──

interface ExporterRow {
  readonly rank: number;
  readonly name: string;
  readonly id: string;
  readonly totalLanes: number;
  readonly avgCompleteness: number;
  readonly rejectionRate: number;
  readonly slaCompliance: string;
  readonly trend: 'up' | 'flat' | 'down';
}

const MOCK_LEADERBOARD: readonly ExporterRow[] = [
  {
    rank: 1,
    name: 'Siam Premium Fruit Co.',
    id: 'TH-89210',
    totalLanes: 42,
    avgCompleteness: 94,
    rejectionRate: 0.8,
    slaCompliance: 'Perfect',
    trend: 'up',
  },
  {
    rank: 2,
    name: 'Bangkok Tropicals Ltd.',
    id: 'TH-77341',
    totalLanes: 38,
    avgCompleteness: 81,
    rejectionRate: 2.1,
    slaCompliance: 'At Risk',
    trend: 'flat',
  },
  {
    rank: 3,
    name: 'Chanthaburi Exports',
    id: 'TH-11209',
    totalLanes: 29,
    avgCompleteness: 88,
    rejectionRate: 1.4,
    slaCompliance: 'Perfect',
    trend: 'up',
  },
  {
    rank: 4,
    name: 'Eastern Fruit Alliance',
    id: 'TH-55023',
    totalLanes: 24,
    avgCompleteness: 76,
    rejectionRate: 3.2,
    slaCompliance: 'Warning',
    trend: 'down',
  },
  {
    rank: 5,
    name: 'Rayong Tropical Group',
    id: 'TH-43187',
    totalLanes: 23,
    avgCompleteness: 91,
    rejectionRate: 1.0,
    slaCompliance: 'Perfect',
    trend: 'up',
  },
] as const;

// ── Leaderboard Columns ──

const LEADERBOARD_COLUMNS: readonly Column<ExporterRow>[] = [
  {
    key: 'name',
    header: 'Exporter',
    sortable: true,
    render: (_value, row) => (
      <div>
        <p className="text-sm font-semibold">{row.name}</p>
        <p className="text-xs text-muted-foreground">ID: {row.id}</p>
      </div>
    ),
  },
  {
    key: 'totalLanes',
    header: 'Total Lanes',
    sortable: true,
    className: 'font-mono',
  },
  {
    key: 'avgCompleteness',
    header: 'Avg Completeness',
    sortable: true,
    render: (_value, row) => (
      <ProgressBar
        value={row.avgCompleteness}
        showPercentage
        tint={
          row.avgCompleteness >= 85
            ? 'success'
            : row.avgCompleteness >= 70
              ? 'warning'
              : 'error'
        }
      />
    ),
  },
  {
    key: 'rejectionRate',
    header: 'Rejection Rate',
    sortable: true,
    render: (_value, row) => (
      <Badge
        variant={
          row.rejectionRate <= 1.5
            ? 'success'
            : row.rejectionRate <= 2.5
              ? 'warning'
              : 'destructive'
        }
      >
        {row.rejectionRate}%
      </Badge>
    ),
  },
  {
    key: 'slaCompliance',
    header: 'SLA Compliance',
    sortable: true,
    render: (_value, row) => (
      <Badge
        variant={
          row.slaCompliance === 'Perfect'
            ? 'success'
            : row.slaCompliance === 'At Risk'
              ? 'warning'
              : 'destructive'
        }
      >
        {row.slaCompliance}
      </Badge>
    ),
  },
  {
    key: 'trend',
    header: 'Trend',
    render: (_value, row) => (
      <span
        className={
          row.trend === 'up'
            ? 'text-emerald-600'
            : row.trend === 'down'
              ? 'text-red-600'
              : 'text-muted-foreground'
        }
      >
        {row.trend === 'up' ? (
          <TrendingUp className="size-4" />
        ) : row.trend === 'down' ? (
          <TrendingUp className="size-4 rotate-180" />
        ) : (
          <span className="text-xs">--</span>
        )}
      </span>
    ),
  },
] as const;

// ── Page Component ──

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Platform-wide insights and trend analysis
        </p>
      </div>

      {/* Filter Bar */}
      <div
        className="flex flex-wrap items-center gap-3"
        role="toolbar"
        aria-label="Analytics filters"
      >
        <Button variant="outline" size="sm">
          <Calendar className="size-4" />
          Last 30 Days
        </Button>
        <Button variant="outline" size="sm">
          <Filter className="size-4" />
          All Products
        </Button>
        <Button variant="outline" size="sm">
          <Filter className="size-4" />
          All Markets
        </Button>
        <Button variant="outline" size="sm">
          <Download className="size-4" />
          Export Report
        </Button>
      </div>

      {/* Row 1 — 6 KPI Tiles */}
      <BentoGrid>
        <BentoGridItem colSpan={2}>
          <KpiTile
            title="Total Lanes"
            value={String(MOCK_ANALYTICS_KPIS.totalLanes)}
            tint="blue"
            delta={{ value: '\u2191 12%', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={2}>
          <KpiTile
            title="Rejection Rate"
            value={`${MOCK_ANALYTICS_KPIS.rejectionRate}%`}
            tint="emerald"
            delta={{ value: '\u2193 0.5%', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={2}>
          <KpiTile
            title="Avg Completeness"
            value={`${MOCK_ANALYTICS_KPIS.avgCompleteness}%`}
            tint="purple"
            delta={{ value: '\u2191 3%', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={2}>
          <KpiTile
            title="Avg Readiness"
            value={`${MOCK_ANALYTICS_KPIS.avgReadinessTime} days`}
            tint="emerald"
            delta={{ value: '\u2193 0.8d', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={2}>
          <KpiTile
            title="Buyer Queries"
            value={`${MOCK_ANALYTICS_KPIS.buyerQueryRate}%`}
            tint="amber"
            delta={{ value: '\u2193 2%', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={2}>
          <KpiTile
            title="SLA Pass Rate"
            value={`${MOCK_ANALYTICS_KPIS.coldChainSlaPass}%`}
            tint="emerald"
            delta={{ value: '\u2191 1%', trend: 'up' }}
          />
        </BentoGridItem>
      </BentoGrid>

      {/* Row 2 — Chart Placeholders */}
      <BentoGrid>
        <BentoGridItem colSpan={8}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rejection Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Line chart coming soon &mdash; requires Recharts
                </p>
              </div>
            </CardContent>
          </Card>
        </BentoGridItem>
        <BentoGridItem colSpan={4}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Completeness Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Donut chart coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </BentoGridItem>
      </BentoGrid>

      {/* Row 3 — Chart Placeholders */}
      <BentoGrid>
        <BentoGridItem colSpan={6}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lanes by Destination</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Bar chart coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </BentoGridItem>
        <BentoGridItem colSpan={6}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Excursion Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Heatmap coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </BentoGridItem>
      </BentoGrid>

      {/* Row 4 — Exporter Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exporter Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<ExporterRow>
            columns={LEADERBOARD_COLUMNS}
            data={MOCK_LEADERBOARD}
          />
        </CardContent>
      </Card>
    </div>
  );
}

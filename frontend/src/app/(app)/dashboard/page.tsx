'use client';

import {
  Truck,
  CheckCircle,
  PackageCheck,
  AlertTriangle,
  Plus,
} from 'lucide-react';

import { BentoGrid, BentoGridItem } from '@/components/zrl/bento-grid';
import { KpiTile } from '@/components/zrl/kpi-tile';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { ProgressBar } from '@/components/zrl/progress-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_LANES, MOCK_DASHBOARD_KPIS } from '@/lib/mock-data';
import {
  type Lane,
  PRODUCT_LABELS,
  MARKET_FLAGS,
  MARKET_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
} from '@/lib/types';

// ── Helpers ──

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Lane Table Columns ──

const LANE_COLUMNS: readonly Column<Lane>[] = [
  {
    key: 'laneId',
    header: 'Lane ID',
    sortable: true,
    className: 'font-mono text-xs',
  },
  {
    key: 'productType',
    header: 'Product',
    sortable: true,
    render: (_value, row) => PRODUCT_LABELS[row.productType],
  },
  {
    key: 'destinationMarket',
    header: 'Destination',
    sortable: true,
    render: (_value, row) =>
      `${MARKET_FLAGS[row.destinationMarket]} ${MARKET_LABELS[row.destinationMarket]}`,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (_value, row) => (
      <Badge variant={STATUS_VARIANT[row.status]}>
        {STATUS_LABELS[row.status]}
      </Badge>
    ),
  },
  {
    key: 'completenessScore',
    header: 'Completeness',
    sortable: true,
    render: (_value, row) => (
      <ProgressBar
        value={row.completenessScore}
        showPercentage
        tint={
          row.completenessScore >= 80
            ? 'success'
            : row.completenessScore >= 50
              ? 'warning'
              : 'error'
        }
      />
    ),
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    sortable: true,
    render: (_value, row) => (
      <span className="text-xs text-muted-foreground">
        {relativeTime(row.updatedAt)}
      </span>
    ),
  },
] as const;

// ── Recent Activity (static) ──

const RECENT_ACTIVITY = [
  { text: 'MRL test uploaded for LN-2026-001', time: '10 min ago' },
  { text: 'LN-2026-004 packed and sealed', time: '1h ago' },
  { text: 'Temperature alert on LN-2026-003', time: '2h ago' },
  { text: 'Phyto cert verified for LN-2026-002', time: '3h ago' },
] as const;

// ── Fruit Season Data ──

const FRUIT_SEASONS = [
  { name: 'Mango', period: 'Feb \u2013 May', color: 'bg-blue-500' },
  { name: 'Durian', period: 'May \u2013 Aug', color: 'bg-amber-500' },
  { name: 'Mangosteen', period: 'May \u2013 Sep', color: 'bg-purple-500' },
  { name: 'Longan', period: 'Jun \u2013 Aug', color: 'bg-emerald-500' },
] as const;

// ── Page Component ──

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          At-a-glance operational status
        </p>
      </div>

      {/* Row 1 — KPI Tiles */}
      <BentoGrid>
        <BentoGridItem colSpan={3}>
          <KpiTile
            title="Active Lanes"
            value={String(MOCK_DASHBOARD_KPIS.activeLanes)}
            icon={<Truck className="size-5" />}
            tint="blue"
            delta={{ value: '+2 this week', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={3}>
          <KpiTile
            title="Avg Completeness"
            value={`${MOCK_DASHBOARD_KPIS.avgCompleteness}%`}
            icon={<CheckCircle className="size-5" />}
            tint="emerald"
            delta={{ value: '+5%', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={3}>
          <KpiTile
            title="Ready to Ship"
            value={String(MOCK_DASHBOARD_KPIS.readyToShip)}
            icon={<PackageCheck className="size-5" />}
            tint="emerald"
            delta={{ value: '2 packed today', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={3}>
          <KpiTile
            title="Alerts"
            value={String(MOCK_DASHBOARD_KPIS.alerts)}
            icon={<AlertTriangle className="size-5" />}
            tint="amber"
            delta={{ value: '2 excursions', trend: 'down' }}
          />
        </BentoGridItem>
      </BentoGrid>

      {/* Row 2 — Active Lanes Table + Quick Actions */}
      <BentoGrid>
        <BentoGridItem colSpan={8}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Export Lanes</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable<Lane> columns={LANE_COLUMNS} data={MOCK_LANES} />
            </CardContent>
          </Card>
        </BentoGridItem>

        <BentoGridItem colSpan={4}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" size="lg">
                  <a href="/lanes/new">
                    <Plus className="size-4" />
                    Create New Lane
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {RECENT_ACTIVITY.map((item) => (
                    <li key={item.text} className="flex items-start gap-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-medium">{item.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.time}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </BentoGridItem>
      </BentoGrid>

      {/* Row 3 — Temperature Overview + Seasonal Calendar */}
      <BentoGrid>
        <BentoGridItem colSpan={6}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cold-Chain Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Temperature sparklines coming soon
              </p>
            </CardContent>
          </Card>
        </BentoGridItem>

        <BentoGridItem colSpan={6}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Thai Fruit Harvest Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {FRUIT_SEASONS.map((season) => (
                  <div key={season.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{season.name}</span>
                      <span className="text-muted-foreground">
                        {season.period}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${season.color}`}
                        style={{
                          width:
                            season.name === 'Mango'
                              ? '33%'
                              : season.name === 'Durian'
                                ? '25%'
                                : season.name === 'Mangosteen'
                                  ? '42%'
                                  : '25%',
                          marginLeft:
                            season.name === 'Mango'
                              ? '8%'
                              : season.name === 'Durian'
                                ? '33%'
                                : season.name === 'Mangosteen'
                                  ? '33%'
                                  : '42%',
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">
                  Months shown as approximate percentage of year
                </p>
              </div>
            </CardContent>
          </Card>
        </BentoGridItem>
      </BentoGrid>
    </div>
  );
}

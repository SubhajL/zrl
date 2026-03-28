'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  PackageCheck,
  Plus,
  Truck,
} from 'lucide-react';
import { BentoGrid, BentoGridItem } from '@/components/zrl/bento-grid';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { KpiTile } from '@/components/zrl/kpi-tile';
import { ProgressBar } from '@/components/zrl/progress-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadDashboardPageData, type DashboardPageData } from '@/lib/dashboard-data';
import { getErrorMessage } from '@/lib/app-api';
import {
  type Lane,
  MARKET_FLAGS,
  MARKET_LABELS,
  PRODUCT_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
} from '@/lib/types';

const LANE_COLUMNS: Column<Lane>[] = [
  {
    key: 'laneId',
    header: 'Lane ID',
    sortable: true,
    render: (_value, row) => (
      <Link
        href={`/lanes/${row.id}`}
        className="font-mono text-sm font-semibold text-primary"
      >
        {row.laneId}
      </Link>
    ),
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
    render: (_value, row) => (
      <span>
        {MARKET_FLAGS[row.destinationMarket]} {MARKET_LABELS[row.destinationMarket]}
      </span>
    ),
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
];

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardPageData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    void loadDashboardPageData()
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError, 'Unable to load dashboard.'));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Live exporter operations for {data?.userLabel ?? 'your account'}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <BentoGrid>
        <BentoGridItem colSpan={3}>
          <KpiTile
            title="Active Lanes"
            value={data ? `${data.kpis.totalLanes}` : '--'}
            icon={<Truck className="size-5" />}
            tint="blue"
            delta={{ value: 'Real backend data', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={3}>
          <KpiTile
            title="Avg Completeness"
            value={data ? `${data.kpis.avgCompleteness}%` : '--'}
            icon={<CheckCircle className="size-5" />}
            tint="emerald"
            delta={{ value: 'Across visible lanes', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={3}>
          <KpiTile
            title="Ready to Ship"
            value={data ? `${data.kpis.readyToShip}` : '--'}
            icon={<PackageCheck className="size-5" />}
            tint="emerald"
            delta={{ value: 'Validated or packed', trend: 'up' }}
          />
        </BentoGridItem>
        <BentoGridItem colSpan={3}>
          <KpiTile
            title="Unread Alerts"
            value={data ? `${data.kpis.unreadAlerts}` : '--'}
            icon={<AlertTriangle className="size-5" />}
            tint="amber"
            delta={{ value: 'Notification inbox', trend: 'down' }}
          />
        </BentoGridItem>
      </BentoGrid>

      <BentoGrid>
        <BentoGridItem colSpan={8}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Export Lanes</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable<Lane>
                columns={LANE_COLUMNS}
                data={data?.lanes ?? []}
                emptyMessage="No lanes yet. Create your first export lane."
              />
            </CardContent>
          </Card>
        </BentoGridItem>
        <BentoGridItem colSpan={4}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-start">
                <Link href="/lanes/new">
                  <Plus className="size-4" />
                  Create New Lane
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/settings">Review Privacy & Notifications</Link>
              </Button>
            </CardContent>
          </Card>
        </BentoGridItem>
      </BentoGrid>

      <BentoGrid>
        <BentoGridItem colSpan={6}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.recentNotifications ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                data?.recentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <p className="text-sm font-semibold">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </BentoGridItem>
        <BentoGridItem colSpan={6}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cold-Chain Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Live cold-chain telemetry appears inside each lane detail tab.
              </p>
            </CardContent>
          </Card>
        </BentoGridItem>
      </BentoGrid>
    </div>
  );
}

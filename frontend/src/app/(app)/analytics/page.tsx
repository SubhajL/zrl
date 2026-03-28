'use client';

import * as React from 'react';
import { BentoGrid, BentoGridItem } from '@/components/zrl/bento-grid';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { KpiTile } from '@/components/zrl/kpi-tile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  loadAnalyticsPageData,
  type AnalyticsBreakdownRow,
  type AnalyticsPageData,
} from '@/lib/analytics-data';
import { getErrorMessage } from '@/lib/app-api';

const BREAKDOWN_COLUMNS: Column<AnalyticsBreakdownRow>[] = [
  {
    key: 'label',
    header: 'Category',
    sortable: true,
  },
  {
    key: 'count',
    header: 'Count',
    sortable: true,
  },
  {
    key: 'sharePct',
    header: 'Share',
    sortable: true,
    render: (_value, row) => `${row.sharePct}%`,
  },
];

export default function AnalyticsPage() {
  const [data, setData] = React.useState<AnalyticsPageData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    void loadAnalyticsPageData()
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError, 'Unable to load analytics.'));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Live exporter metrics derived from your authenticated lane data
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
        {(data?.metrics ?? []).map((metric) => (
          <BentoGridItem key={metric.label} colSpan={2}>
            <KpiTile
              title={metric.label}
              value={metric.value}
              tint="blue"
              delta={{ value: metric.hint, trend: 'neutral' }}
            />
          </BentoGridItem>
        ))}
      </BentoGrid>

      <BentoGrid>
        <BentoGridItem colSpan={4}>
          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={BREAKDOWN_COLUMNS}
                data={data?.statusBreakdown ?? []}
                emptyMessage="No status data available."
              />
            </CardContent>
          </Card>
        </BentoGridItem>
        <BentoGridItem colSpan={4}>
          <Card>
            <CardHeader>
              <CardTitle>Destination Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={BREAKDOWN_COLUMNS}
                data={data?.marketBreakdown ?? []}
                emptyMessage="No destination data available."
              />
            </CardContent>
          </Card>
        </BentoGridItem>
        <BentoGridItem colSpan={4}>
          <Card>
            <CardHeader>
              <CardTitle>Product Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={BREAKDOWN_COLUMNS}
                data={data?.productBreakdown ?? []}
                emptyMessage="No product data available."
              />
            </CardContent>
          </Card>
        </BentoGridItem>
      </BentoGrid>
    </div>
  );
}

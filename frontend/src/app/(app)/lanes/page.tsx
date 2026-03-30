'use client';

import Link from 'next/link';
import { Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { DataTableSkeleton } from '@/components/zrl/skeletons';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/zrl/progress-bar';
import { getErrorMessage } from '@/lib/app-api';
import { useLanesQuery } from '@/hooks/use-lanes-query';
import {
  type Lane,
  MARKET_FLAGS,
  MARKET_LABELS,
  PRODUCT_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
} from '@/lib/types';

const columns: Column<Lane>[] = [
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

const DEFAULT_LANES_OPTIONS = { page: 1, limit: 50 } as const;

export default function LanesListPage() {
  const { data: lanesData, error: queryError, isLoading } = useLanesQuery(DEFAULT_LANES_OPTIONS);
  const lanes = lanesData?.data ?? [];
  const error = queryError
    ? getErrorMessage(queryError, 'Unable to load lanes.')
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lanes</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your export lanes
          </p>
        </div>
        <Button asChild>
          <Link href="/lanes/new">
            <Plus className="size-4" />
            Create New Lane
          </Link>
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            All Lanes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !error ? (
            <div aria-busy="true" role="status" aria-label="Loading lanes">
              <DataTableSkeleton rows={5} columns={5} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={lanes}
              emptyMessage="No lanes yet. Create your first lane to get started."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

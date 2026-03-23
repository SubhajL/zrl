'use client';

import { Package, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/zrl/progress-bar';
import { MOCK_LANES } from '@/lib/mock-data';
import {
  type Lane,
  PRODUCT_LABELS,
  MARKET_FLAGS,
  MARKET_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
} from '@/lib/types';

const columns: Column<Lane>[] = [
  {
    key: 'laneId',
    header: 'Lane ID',
    sortable: true,
    render: (_v, row) => (
      <span className="font-mono text-sm">{row.laneId}</span>
    ),
  },
  {
    key: 'productType',
    header: 'Product',
    sortable: true,
    render: (_v, row) => PRODUCT_LABELS[row.productType],
  },
  {
    key: 'destinationMarket',
    header: 'Destination',
    sortable: true,
    render: (_v, row) => (
      <span>
        {MARKET_FLAGS[row.destinationMarket]}{' '}
        {MARKET_LABELS[row.destinationMarket]}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (_v, row) => (
      <Badge variant={STATUS_VARIANT[row.status] as 'default'}>
        {STATUS_LABELS[row.status]}
      </Badge>
    ),
  },
  {
    key: 'completenessScore',
    header: 'Completeness',
    sortable: true,
    render: (_v, row) => (
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

export default function LanesListPage() {
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
          <a href="/lanes/new">
            <Plus className="size-4" />
            Create New Lane
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            All Lanes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={MOCK_LANES as unknown as Lane[]}
            emptyMessage="No lanes yet. Create your first lane to get started."
          />
        </CardContent>
      </Card>
    </div>
  );
}

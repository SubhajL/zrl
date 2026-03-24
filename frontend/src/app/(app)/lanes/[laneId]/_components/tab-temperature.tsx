'use client';

import { Thermometer, AlertTriangle, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/zrl/data-table';
import type {
  TemperatureReading,
  Excursion,
  TemperatureSlaResult,
  TemperatureProfile,
  SlaStatus,
} from '@/lib/types';

/* ── Helpers ── */

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SLA_BADGE_VARIANT: Record<
  SlaStatus,
  'success' | 'warning' | 'destructive'
> = {
  PASS: 'success',
  CONDITIONAL: 'warning',
  FAIL: 'destructive',
};

const SEVERITY_VARIANT: Record<
  string,
  'default' | 'warning' | 'destructive' | 'info'
> = {
  MINOR: 'info',
  MODERATE: 'warning',
  SEVERE: 'destructive',
  CRITICAL: 'destructive',
};

/* ── Component ── */

export interface TabTemperatureProps {
  readonly readings: TemperatureReading[];
  readonly excursions: Excursion[];
  readonly sla: TemperatureSlaResult;
  readonly profile: TemperatureProfile;
}

const excursionColumns: readonly Column<Excursion>[] = [
  {
    key: 'type',
    header: 'Type',
    sortable: true,
    render: (value: unknown) => {
      const label =
        value === 'CHILLING_INJURY' ? 'Chilling Injury' : 'Heat Damage';
      return <span className="text-sm">{label}</span>;
    },
  },
  {
    key: 'severity',
    header: 'Severity',
    sortable: true,
    render: (value: unknown) => {
      const severity = String(value);
      return (
        <Badge variant={SEVERITY_VARIANT[severity] ?? 'default'}>
          {severity}
        </Badge>
      );
    },
  },
  {
    key: 'startAt',
    header: 'Start',
    sortable: true,
    render: (value: unknown) => (
      <span className="text-sm">{formatTimestamp(String(value))}</span>
    ),
  },
  {
    key: 'endAt',
    header: 'End',
    sortable: true,
    render: (value: unknown) => (
      <span className="text-sm">
        {value ? formatTimestamp(String(value)) : 'Ongoing'}
      </span>
    ),
  },
  {
    key: 'durationMinutes',
    header: 'Duration',
    sortable: true,
    render: (value: unknown) => (
      <span className="font-mono text-sm">{String(value)} min</span>
    ),
  },
  {
    key: 'maxDeviationC',
    header: 'Max Deviation',
    sortable: true,
    render: (value: unknown) => (
      <span className="font-mono text-sm">{String(value)}°C</span>
    ),
  },
  {
    key: 'shelfLifeImpactPct',
    header: 'Impact',
    sortable: true,
    render: (value: unknown) => (
      <span className="font-mono text-sm">{String(value)}%</span>
    ),
  },
] as const;

export function TabTemperature({
  readings,
  excursions,
  sla,
  profile,
}: TabTemperatureProps) {
  return (
    <div className="space-y-6">
      {/* Section 1 — Chart Placeholder */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center rounded-lg bg-muted/30 aspect-video">
            <Thermometer className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Temperature curve chart coming soon — requires Recharts
              integration
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Optimal range: {profile.optimalMinC}&ndash;{profile.optimalMaxC}°C
            for {profile.fruit}
          </p>
        </CardContent>
      </Card>

      {/* Section 2 — SLA Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">SLA Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                SLA Status
              </p>
              <Badge variant={SLA_BADGE_VARIANT[sla.status]}>
                {sla.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Excursion Count
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {sla.excursionCount}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Excursion Time
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {sla.totalExcursionMinutes} min
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Remaining Shelf Life
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {sla.remainingShelfLifeDays} days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 — Excursion Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <CardTitle className="text-sm font-bold">Excursion Log</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<Excursion>
            columns={excursionColumns}
            data={excursions}
            emptyMessage="No excursions recorded — temperature stayed within SLA."
          />
        </CardContent>
      </Card>
    </div>
  );
}

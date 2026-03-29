'use client';

import { AlertTriangle, Thermometer } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { formatTimestamp } from '@/lib/format';
import type {
  TemperatureReading,
  Excursion,
  TemperatureSlaResult,
  TemperatureProfile,
  SlaStatus,
} from '@/lib/types';

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
      <span className="font-mono tabular-nums text-sm">{String(value)} min</span>
    ),
  },
  {
    key: 'maxDeviationC',
    header: 'Max Deviation',
    sortable: true,
    render: (value: unknown) => (
      <span className="font-mono tabular-nums text-sm">{String(value)}°C</span>
    ),
  },
  {
    key: 'shelfLifeImpactPct',
    header: 'Impact',
    sortable: true,
    render: (value: unknown) => (
      <span className="font-mono tabular-nums text-sm">{String(value)}%</span>
    ),
  },
] as const;

const readingColumns: readonly Column<TemperatureReading>[] = [
  {
    key: 'timestamp',
    header: 'Timestamp',
    sortable: true,
    render: (value: unknown) => (
      <span className="text-sm">{formatTimestamp(String(value))}</span>
    ),
  },
  {
    key: 'valueC',
    header: 'Reading',
    sortable: true,
    render: (value: unknown) => (
      <span className="font-mono tabular-nums text-sm">{String(value)}°C</span>
    ),
  },
  {
    key: 'source',
    header: 'Source',
    sortable: true,
  },
  {
    key: 'deviceId',
    header: 'Device',
    sortable: true,
    render: (value: unknown) => (
      <span className="text-sm text-muted-foreground">
        {typeof value === 'string' && value.length > 0 ? value : 'Manual'}
      </span>
    ),
  },
] as const;

interface ChartDataPoint {
  readonly time: string;
  readonly temp: number;
  readonly timestamp: string;
}

export function TabTemperature({
  readings,
  excursions,
  sla,
  profile,
}: TabTemperatureProps) {
  const latestReading = readings.at(-1) ?? null;
  const values = readings.map((reading) => reading.valueC);
  const minObserved = values.length > 0 ? Math.min(...values) : null;
  const maxObserved = values.length > 0 ? Math.max(...values) : null;
  const outOfRangeCount = readings.filter(
    (reading) =>
      reading.valueC < profile.optimalMinC || reading.valueC > profile.optimalMaxC,
  ).length;
  const windowStart = readings[0]?.timestamp ?? null;
  const windowEnd = latestReading?.timestamp ?? null;

  const chartData: ChartDataPoint[] = [...readings]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((r) => ({
      time: formatTimestamp(r.timestamp),
      temp: r.valueC,
      timestamp: r.timestamp,
    }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="rounded-full bg-info/10 p-2">
              <Thermometer className="size-5 text-info" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Telemetry Window</p>
              <p className="text-sm text-muted-foreground">
                {windowStart && windowEnd
                  ? `${formatTimestamp(windowStart)} to ${formatTimestamp(windowEnd)}`
                  : 'No readings have been ingested for this lane yet.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Temperature Curve</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No temperature readings available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  fontSize={11}
                  tick={chartData.length > 20 ? false : undefined}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  fontSize={11}
                  unit="°C"
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}°C`, 'Temperature']}
                  labelFormatter={(label) => `at ${String(label)}`}
                />
                <ReferenceArea
                  y1={profile.optimalMinC}
                  y2={profile.optimalMaxC}
                  fill="#22C55E"
                  fillOpacity={0.1}
                  label="Optimal"
                />
                <ReferenceLine
                  y={profile.heatThresholdC}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label="Heat"
                />
                {profile.chillingThresholdC !== null && (
                  <ReferenceLine
                    y={profile.chillingThresholdC}
                    stroke="#3B82F6"
                    strokeDasharray="4 4"
                    label="Chill"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#6C5CE7"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Target Range
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {profile.optimalMinC}-{profile.optimalMaxC}°C
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Latest
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {latestReading === null ? '--' : `${latestReading.valueC}°C`}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Observed Range
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {minObserved === null || maxObserved === null
                  ? '--'
                  : `${minObserved}-${maxObserved}°C`}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Samples Loaded
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {readings.length}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Out of Range
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {outOfRangeCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Recent Readings</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<TemperatureReading>
            columns={readingColumns}
            data={[...readings].reverse().slice(0, 10)}
            emptyMessage="No temperature readings recorded yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
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

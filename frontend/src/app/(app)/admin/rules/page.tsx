'use client';

import * as React from 'react';
import { Download, Plus, Search, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DestinationMarket, MrlSubstance, RiskLevel } from '@/lib/types';
import { MARKET_FLAGS, MARKET_LABELS } from '@/lib/types';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/lib/app-api';
import { loadRulesAdminData, type RulesAdminData } from '@/lib/rules-data';

type RiskFilter = 'All' | RiskLevel;

const RISK_BADGE_VARIANT: Record<
  RiskLevel,
  'destructive' | 'warning' | 'info' | 'secondary'
> = {
  CRITICAL: 'destructive',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'secondary',
};

const RISK_FILTERS: readonly RiskFilter[] = [
  'All',
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
];

const RISK_FILTER_LABELS: Record<RiskFilter, string> = {
  All: 'All',
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

const SUBSTANCE_COLUMNS: readonly Column<MrlSubstance>[] = [
  {
    key: 'name',
    header: 'Substance Name',
    sortable: true,
  },
  {
    key: 'casNumber',
    header: 'CAS Number',
    render: (value) => (value == null ? '-' : String(value)),
  },
  {
    key: 'thaiMrl',
    header: 'Thai MRL',
    sortable: true,
    className: 'text-right font-mono tabular-nums',
    render: (value) => String(value),
  },
  {
    key: 'destinationMrl',
    header: 'Destination MRL',
    sortable: true,
    className: 'text-right font-mono tabular-nums',
    render: (value) => String(value),
  },
  {
    key: 'stringencyRatio',
    header: 'Ratio',
    sortable: true,
    className: 'text-right font-bold tabular-nums',
    render: (value) => `${value}x`,
  },
  {
    key: 'riskLevel',
    header: 'Risk Level',
    sortable: true,
    render: (_value, row) => (
      <Badge variant={RISK_BADGE_VARIANT[row.riskLevel]}>{row.riskLevel}</Badge>
    ),
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    sortable: true,
    render: (value) => new Date(String(value)).toISOString().slice(0, 10),
  },
];

export default function RulesAdminPage() {
  const [data, setData] = React.useState<RulesAdminData | null>(null);
  const [selectedMarket, setSelectedMarket] =
    React.useState<DestinationMarket>('JAPAN');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<RiskFilter>('All');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    void loadRulesAdminData()
      .then((result) => {
        if (active) {
          setData(result);
          if (result.markets.length > 0) {
            setSelectedMarket(result.markets[0]);
          }
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            getErrorMessage(loadError, 'Unable to load rules administration data.'),
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedVersions = (data?.versions ?? []).filter(
    (version) => version.market === selectedMarket,
  );
  const latestVersion = selectedVersions[0]?.version ?? '--';

  const filteredSubstances = React.useMemo(() => {
    let result = data?.substancesByMarket[selectedMarket] ?? [];

    if (activeFilter !== 'All') {
      result = result.filter((substance) => substance.riskLevel === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (substance) =>
          substance.name.toLowerCase().includes(query) ||
          (substance.casNumber?.toLowerCase().includes(query) ?? false),
      );
    }

    return result;
  }, [activeFilter, data, searchQuery, selectedMarket]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] gap-0 -m-6">
      <aside className="w-72 shrink-0 border-r bg-muted/30 p-6">
        <h2 className="mb-4 text-lg font-semibold">Markets</h2>
        <div className="space-y-2">
          {(data?.markets ?? ['JAPAN', 'CHINA', 'KOREA', 'EU']).map((market) => {
            const isSelected = market === selectedMarket;
            const marketVersion =
              data?.versions.find((entry) => entry.market === market)?.version ??
              '--';

            return (
              <button
                key={market}
                type="button"
                aria-label={`Select ${MARKET_LABELS[market]} market`}
                className={cn(
                  'w-full cursor-pointer rounded-xl p-4 text-left transition-all',
                  isSelected
                    ? 'border-l-4 border-primary bg-primary/10 shadow-sm'
                    : 'border-l-4 border-transparent hover:bg-muted/50',
                )}
                onClick={() => setSelectedMarket(market)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {MARKET_FLAGS[market]} {MARKET_LABELS[market]}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    v{marketVersion}
                  </span>
                </div>
                <p className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                  {(data?.substancesByMarket[market]?.length ?? 0).toString()} substances
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 space-y-8 overflow-y-auto p-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            {MARKET_FLAGS[selectedMarket]} {MARKET_LABELS[selectedMarket]} MRL Rules v
            {latestVersion}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live rule inventory from the backend rule store
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <section className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search substances..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button disabled variant="outline">
                <Plus className="size-4" />
                Add Substance
              </Button>
              <Button disabled variant="outline">
                <Upload className="size-4" />
                Import CSV
              </Button>
              <Button variant="outline">
                <Download className="size-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {RISK_FILTERS.map((filter) => (
              <Button
                key={filter}
                type="button"
                variant={activeFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter(filter)}
              >
                {RISK_FILTER_LABELS[filter]}
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Substances</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[...SUBSTANCE_COLUMNS]}
                data={filteredSubstances}
                emptyMessage="No rule substances found for the selected market."
              />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedVersions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No version history available yet.
                </p>
              ) : (
                selectedVersions.map((version, index) => (
                  <div
                    key={`${version.market}-${version.version}-${version.changedAt}`}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">v{version.version}</p>
                      {index === 0 && <Badge>Current</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {version.changesSummary}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

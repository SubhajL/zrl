'use client';

import * as React from 'react';
import { Search, Plus, Upload, Download } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { MrlSubstance, RiskLevel, DestinationMarket } from '@/lib/types';
import { MARKET_FLAGS, MARKET_LABELS } from '@/lib/types';
import { MOCK_SUBSTANCES } from '@/lib/mock-data';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ── Market metadata ──

interface MarketInfo {
  readonly key: DestinationMarket;
  readonly substanceCount: string;
  readonly version: string;
}

const MARKETS: readonly MarketInfo[] = [
  { key: 'JAPAN', substanceCount: '423 substances', version: 'v3.2' },
  { key: 'CHINA', substanceCount: '312 substances', version: 'v2.8' },
  { key: 'KOREA', substanceCount: '387 substances', version: 'v2.5' },
  { key: 'EU', substanceCount: '298 substances', version: 'v4.1' },
];

// ── Risk badge variant mapping ──

const RISK_BADGE_VARIANT: Record<
  RiskLevel,
  'destructive' | 'warning' | 'info' | 'secondary'
> = {
  CRITICAL: 'destructive',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'secondary',
};

// ── Ratio color mapping ──

function ratioColorClass(risk: RiskLevel): string {
  switch (risk) {
    case 'CRITICAL':
      return 'text-destructive';
    case 'HIGH':
      return 'text-amber-600';
    case 'MEDIUM':
      return 'text-blue-600';
    case 'LOW':
      return 'text-muted-foreground';
  }
}

// ── Filter types ──

type RiskFilter = 'All' | RiskLevel;

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

// ── Version history data ──

interface VersionEntry {
  readonly version: string;
  readonly current: boolean;
  readonly date: string;
  readonly description: string;
}

const VERSION_HISTORY: readonly VersionEntry[] = [
  {
    version: 'v3.2',
    current: true,
    date: '2026-03-15',
    description: 'Added 15 new substances',
  },
  {
    version: 'v3.1',
    current: false,
    date: '2026-02-01',
    description: 'Updated Chlorpyrifos limit',
  },
  {
    version: 'v3.0',
    current: false,
    date: '2025-12-15',
    description: 'Major revision: 50 substances',
  },
];

// ── Table columns ──

const SUBSTANCE_COLUMNS: readonly Column<MrlSubstance>[] = [
  {
    key: 'name',
    header: 'Substance Name',
    sortable: true,
  },
  {
    key: 'casNumber',
    header: 'CAS Number',
    sortable: false,
    className: 'font-mono text-xs',
    render: (value) => (value != null ? String(value) : '-'),
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
    header: 'Japan MRL',
    sortable: true,
    className: 'text-right font-mono tabular-nums',
    render: (value) => String(value),
  },
  {
    key: 'stringencyRatio',
    header: 'Ratio',
    sortable: true,
    className: 'text-right font-bold tabular-nums',
    render: (_value, row) => (
      <span className={ratioColorClass(row.riskLevel)}>
        {row.stringencyRatio}x
      </span>
    ),
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
    className: 'text-right font-mono text-xs text-muted-foreground',
    render: (value) => {
      if (value == null) return '-';
      const date = new Date(String(value));
      return date.toISOString().slice(0, 10);
    },
  },
];

// ── Page Component ──

export default function RulesAdminPage() {
  const [selectedMarket, setSelectedMarket] =
    React.useState<DestinationMarket>('JAPAN');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<RiskFilter>('All');

  const selectedMarketInfo = MARKETS.find((m) => m.key === selectedMarket)!;

  // Filter substances by search and risk level
  const filteredSubstances = React.useMemo(() => {
    let result = MOCK_SUBSTANCES;

    if (activeFilter !== 'All') {
      result = result.filter((s) => s.riskLevel === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.casNumber && s.casNumber.toLowerCase().includes(query)),
      );
    }

    return result;
  }, [activeFilter, searchQuery]);

  return (
    <div className="flex gap-0 -m-6 min-h-[calc(100vh-4rem)]">
      {/* Market Selector Sidebar */}
      <aside className="w-72 shrink-0 border-r bg-muted/30 p-6">
        <h2 className="mb-4 text-lg font-semibold">Markets</h2>
        <div className="space-y-2">
          {MARKETS.map((market) => {
            const isSelected = market.key === selectedMarket;
            return (
              <button
                key={market.key}
                type="button"
                aria-label={`Select ${MARKET_LABELS[market.key]} market`}
                className={cn(
                  'w-full rounded-xl p-4 text-left transition-all cursor-pointer',
                  isSelected
                    ? 'bg-primary/10 border-l-4 border-primary shadow-sm'
                    : 'border-l-4 border-transparent hover:bg-muted/50',
                )}
                onClick={() => setSelectedMarket(market.key)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {MARKET_FLAGS[market.key]} {MARKET_LABELS[market.key]}
                  </span>
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {market.version}
                  </span>
                </div>
                <p className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                  {market.substanceCount}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            {MARKET_FLAGS[selectedMarket]} {MARKET_LABELS[selectedMarket]} — MRL
            Rules {selectedMarketInfo.version}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated: 2026-03-20
          </p>
        </header>

        {/* Section 1: MRL Table */}
        <section className="space-y-6">
          {/* Controls Row */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Search */}
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search substances..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  aria-label="Search substances"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1">
                {RISK_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={cn(
                      'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all',
                      activeFilter === filter
                        ? 'bg-background text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-background/50',
                    )}
                    aria-pressed={activeFilter === filter}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {RISK_FILTER_LABELS[filter]}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm">
                <Download />
                Export
              </Button>
              <Button variant="secondary" size="sm">
                <Upload />
                Import CSV
              </Button>
              <Button size="sm">
                <Plus />
                Add Substance
              </Button>
            </div>
          </div>

          {/* Substance Table */}
          <DataTable
            columns={SUBSTANCE_COLUMNS}
            data={filteredSubstances}
            emptyMessage="No substances match your filters."
          />
        </section>

        {/* Section 2: Version History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-8 pl-6">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />

              {VERSION_HISTORY.map((entry) => (
                <div key={entry.version} className="relative">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'absolute -left-[17px] top-1.5 size-3.5 rounded-full',
                      entry.current
                        ? 'bg-primary shadow-[0_0_8px_rgba(108,92,231,0.4)]'
                        : 'bg-muted-foreground/30',
                    )}
                  />
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      {entry.version}
                      {entry.current && (
                        <Badge variant="info" className="text-[10px]">
                          Current
                        </Badge>
                      )}
                    </h3>
                    <span className="text-xs font-mono text-muted-foreground">
                      {entry.date}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

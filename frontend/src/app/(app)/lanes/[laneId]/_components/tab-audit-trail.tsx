'use client';

import { ShieldCheck, Download } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/zrl/data-table';
import { formatTimestamp } from '@/lib/format';
import type { AuditEntry } from '@/lib/types';

/* ── Column definitions ── */

const auditColumns: readonly Column<AuditEntry>[] = [
  {
    key: 'timestamp',
    header: 'Timestamp',
    sortable: true,
    render: (value: unknown) => (
      <span className="text-sm whitespace-nowrap">
        {formatTimestamp(String(value))}
      </span>
    ),
  },
  {
    key: 'actor',
    header: 'Actor',
    sortable: true,
    render: (value: unknown) => (
      <span className="text-sm">{String(value)}</span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    sortable: true,
    render: (value: unknown) => (
      <Badge variant="default">{String(value)}</Badge>
    ),
  },
  {
    key: 'entityType',
    header: 'Entity Type',
    sortable: true,
    render: (value: unknown) => (
      <span className="text-sm">{String(value)}</span>
    ),
  },
  {
    key: 'entityId',
    header: 'Entity ID',
    sortable: false,
    render: (value: unknown) => (
      <span className="font-mono text-xs">{String(value)}</span>
    ),
  },
  {
    key: 'entryHash',
    header: 'Entry Hash',
    sortable: false,
    render: (value: unknown) => (
      <span className="font-mono text-xs text-muted-foreground">
        {String(value).slice(0, 8)}
      </span>
    ),
  },
] as const;

/* ── Component ── */

export interface TabAuditTrailProps {
  readonly entries: AuditEntry[];
  readonly laneId: string;
}

export function TabAuditTrail({ entries, laneId }: TabAuditTrailProps) {
  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center gap-3">
        <Button variant="default">
          <ShieldCheck className="size-4" />
          Verify Chain Integrity
        </Button>
        <Button variant="ghost">
          <Download className="size-4" />
          Export Audit Trail (JSON)
        </Button>
      </div>

      {/* Audit entries table */}
      <Card>
        <CardContent className="p-0">
          <DataTable<AuditEntry>
            columns={auditColumns}
            data={entries}
            emptyMessage="No audit entries recorded for this lane."
          />
        </CardContent>
      </Card>
    </div>
  );
}

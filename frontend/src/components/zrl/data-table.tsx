'use client';

import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly sortable?: boolean;
  readonly render?: (value: unknown, row: T) => React.ReactNode;
  readonly className?: string;
}

export interface DataTableProps<T> {
  readonly columns: readonly Column<T>[];
  readonly data: readonly T[];
  readonly emptyMessage?: string;
  readonly onRowClick?: (row: T) => void;
  readonly className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  readonly key: string;
  readonly direction: SortDirection;
}

function getNestedValue(obj: unknown, key: string): unknown {
  const keys = key.split('.');
  let current: unknown = obj;
  for (const k of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[k];
  }
  return current;
}

function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  if (a == null && b == null) return 0;
  if (a == null) return direction === 'asc' ? -1 : 1;
  if (b == null) return direction === 'asc' ? 1 : -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();
  const result = strA.localeCompare(strB);
  return direction === 'asc' ? result : -result;
}

function getAriaSortValue(
  columnKey: string,
  sortState: SortState,
): 'ascending' | 'descending' | 'none' | undefined {
  if (sortState.key !== columnKey || sortState.direction === null) return 'none';
  return sortState.direction === 'asc' ? 'ascending' : 'descending';
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = 'No data available.',
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [sortState, setSortState] = React.useState<SortState>({
    key: '',
    direction: null,
  });

  const handleSort = React.useCallback((key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      if (prev.direction === 'desc') {
        return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const sortedData = React.useMemo(() => {
    if (!sortState.key || sortState.direction === null) {
      return data;
    }

    return [...data].sort((a, b) =>
      compareValues(
        getNestedValue(a, sortState.key),
        getNestedValue(b, sortState.key),
        sortState.direction!,
      ),
    );
  }, [data, sortState]);

  const SortIcon = React.useCallback(
    ({ columnKey }: { columnKey: string }) => {
      if (sortState.key !== columnKey || sortState.direction === null) {
        return <ArrowUpDown className="ml-1 inline size-3.5 text-muted-foreground/50" />;
      }
      if (sortState.direction === 'asc') {
        return <ArrowUp className="ml-1 inline size-3.5" />;
      }
      return <ArrowDown className="ml-1 inline size-3.5" />;
    },
    [sortState],
  );

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow className="bg-muted/50">
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={cn(
                'text-xs uppercase tracking-wider',
                column.sortable && 'cursor-pointer select-none',
                column.className,
              )}
              aria-sort={
                column.sortable
                  ? getAriaSortValue(column.key, sortState)
                  : undefined
              }
              onClick={
                column.sortable
                  ? () => handleSort(column.key)
                  : undefined
              }
              onKeyDown={
                column.sortable
                  ? (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSort(column.key);
                      }
                    }
                  : undefined
              }
              tabIndex={column.sortable ? 0 : undefined}
              role={column.sortable ? 'columnheader' : undefined}
            >
              <span className="inline-flex items-center">
                {column.header}
                {column.sortable && <SortIcon columnKey={column.key} />}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-muted-foreground"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          sortedData.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              className={cn(
                onRowClick && 'cursor-pointer',
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
            >
              {columns.map((column) => {
                const cellValue = getNestedValue(row, column.key);
                return (
                  <TableCell key={column.key} className={column.className}>
                    {column.render
                      ? column.render(cellValue, row)
                      : (cellValue != null ? String(cellValue) : '')}
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

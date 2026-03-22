import * as React from 'react';

import { cn } from '@/lib/utils';

export interface BentoGridProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly columns?: number;
}

export function BentoGrid({ children, className, columns }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-12 gap-6',
        className,
      )}
      style={
        columns
          ? ({ '--bento-columns': columns } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}

export type BentoColSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface BentoGridItemProps {
  readonly colSpan?: BentoColSpan;
  readonly rowSpan?: 1 | 2;
  readonly className?: string;
  readonly children: React.ReactNode;
}

const colSpanMap: Record<BentoColSpan, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
};

const rowSpanMap: Record<1 | 2, string> = {
  1: 'row-span-1',
  2: 'row-span-2',
};

export function BentoGridItem({
  colSpan = 6,
  rowSpan = 1,
  className,
  children,
}: BentoGridItemProps) {
  return (
    <div
      className={cn(
        colSpanMap[colSpan],
        rowSpanMap[rowSpan],
        className,
      )}
    >
      {children}
    </div>
  );
}

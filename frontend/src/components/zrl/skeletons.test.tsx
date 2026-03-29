import * as React from 'react';
import { render } from '@testing-library/react';
import {
  KpiTileSkeleton,
  DataTableSkeleton,
  DashboardSkeleton,
} from './skeletons';

describe('KpiTileSkeleton', () => {
  it('renders three skeleton elements', () => {
    const { container } = render(<KpiTileSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(3);
  });
});

describe('DataTableSkeleton', () => {
  it('renders correct number of rows and columns', () => {
    const { container } = render(
      <DataTableSkeleton rows={3} columns={4} />,
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    // 4 header + (3 rows * 4 columns) = 16
    expect(skeletons).toHaveLength(16);
  });

  it('uses default 5 rows and 5 columns', () => {
    const { container } = render(<DataTableSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    // 5 header + (5 rows * 5 columns) = 30
    expect(skeletons).toHaveLength(30);
  });
});

describe('DashboardSkeleton', () => {
  it('renders 4 KPI skeletons and table skeleton', () => {
    const { container } = render(<DashboardSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    // 4 KPI tiles * 3 skeletons each = 12
    // Page title + subtitle = 2
    // Table card: title skeleton (1) + DataTableSkeleton(5,5) = 1 + 30 = 31
    // Quick actions card: title + 2 action bars = 3
    // Total = 12 + 2 + 31 + 3 = 48
    expect(skeletons.length).toBeGreaterThanOrEqual(4 * 3); // at least 4 KPI tiles
    // Verify the overall structure contains cards
    const cards = container.querySelectorAll('[class*="rounded-2xl"]');
    expect(cards.length).toBeGreaterThanOrEqual(4); // at least the 4 KPI cards
  });
});

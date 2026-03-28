import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from './page';
import { loadAnalyticsPageData } from '@/lib/analytics-data';

jest.mock('@/lib/analytics-data', () => ({
  loadAnalyticsPageData: jest.fn(),
}));

describe('AnalyticsPage', () => {
  it('renders live analytics metrics and breakdown tables', async () => {
    (loadAnalyticsPageData as jest.Mock).mockResolvedValue({
      metrics: [
        { label: 'Total Lanes', value: '3', hint: 'Authenticated exporter scope' },
        { label: 'Avg Completeness', value: '86%', hint: 'Across all visible lanes' },
      ],
      statusBreakdown: [{ label: 'VALIDATED', count: 2, sharePct: 67 }],
      marketBreakdown: [{ label: 'JAPAN', count: 2, sharePct: 67 }],
      productBreakdown: [{ label: 'MANGO', count: 3, sharePct: 100 }],
    });

    render(<AnalyticsPage />);

    expect(screen.getByText('Analytics')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total Lanes')).toBeInTheDocument();
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Status Breakdown')).toBeInTheDocument();
      expect(screen.getByText('VALIDATED')).toBeInTheDocument();
      expect(screen.getByText('JAPAN')).toBeInTheDocument();
      expect(screen.getByText('MANGO')).toBeInTheDocument();
    });
  });
});

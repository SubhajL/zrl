import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from './page';
import { useAnalyticsQuery } from '@/hooks/use-analytics-query';

jest.mock('@/hooks/use-analytics-query', () => ({
  useAnalyticsQuery: jest.fn(),
  ANALYTICS_QUERY_KEY: ['analytics'],
}));

const mockUseAnalyticsQuery = jest.mocked(useAnalyticsQuery);

describe('AnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders live analytics metrics and breakdown tables', async () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: {
        metrics: [
          {
            label: 'Total Lanes',
            value: '3',
            hint: 'Authenticated exporter scope',
          },
          {
            label: 'Avg Completeness',
            value: '86%',
            hint: 'Across all visible lanes',
          },
        ],
        statusBreakdown: [{ label: 'VALIDATED', count: 2, sharePct: 67 }],
        marketBreakdown: [{ label: 'JAPAN', count: 2, sharePct: 67 }],
        productBreakdown: [{ label: 'MANGO', count: 3, sharePct: 100 }],
      },
      error: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as unknown as ReturnType<typeof useAnalyticsQuery>);

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

  it('shows skeleton when loading', () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isSuccess: false,
      isError: false,
    } as unknown as ReturnType<typeof useAnalyticsQuery>);

    render(<AnalyticsPage />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows error alert when query fails', () => {
    mockUseAnalyticsQuery.mockReturnValue({
      data: undefined,
      error: new Error('Unable to load analytics.'),
      isLoading: false,
      isSuccess: false,
      isError: true,
    } as unknown as ReturnType<typeof useAnalyticsQuery>);

    render(<AnalyticsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to load analytics.',
    );
  });
});

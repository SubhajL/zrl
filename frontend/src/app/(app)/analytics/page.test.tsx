import * as React from 'react';
import { render, screen } from '@testing-library/react';
import AnalyticsPage from './page';

describe('AnalyticsPage', () => {
  it('renders the page title and subtitle', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(
      screen.getByText('Platform-wide insights and trend analysis'),
    ).toBeInTheDocument();
  });

  it('renders all 6 KPI tiles', () => {
    render(<AnalyticsPage />);
    // "Total Lanes" and "Rejection Rate" appear in both KPI tiles and leaderboard table headers
    expect(screen.getAllByText('Total Lanes').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Rejection Rate').length).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      screen.getAllByText('Avg Completeness').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Avg Readiness')).toBeInTheDocument();
    expect(screen.getByText('Buyer Queries')).toBeInTheDocument();
    expect(screen.getByText('SLA Pass Rate')).toBeInTheDocument();
  });

  it('renders KPI values from mock data', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('156')).toBeInTheDocument();
    // "2.3%" appears in both KPI and leaderboard, so use getAllByText
    expect(screen.getAllByText('2.3%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByText('4.2 days')).toBeInTheDocument();
    // "8%" and "94%" may appear in both KPI tiles and leaderboard
    expect(screen.getAllByText('8%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('94%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the filter bar with all buttons', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('All Products')).toBeInTheDocument();
    expect(screen.getByText('All Markets')).toBeInTheDocument();
    expect(screen.getByText('Export Report')).toBeInTheDocument();
  });

  it('renders filter bar with toolbar role', () => {
    render(<AnalyticsPage />);
    expect(
      screen.getByRole('toolbar', { name: 'Analytics filters' }),
    ).toBeInTheDocument();
  });

  it('renders chart placeholder cards', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('Rejection Rate Trend')).toBeInTheDocument();
    expect(screen.getByText('Completeness Distribution')).toBeInTheDocument();
    expect(screen.getByText('Lanes by Destination')).toBeInTheDocument();
    expect(screen.getByText('Excursion Frequency')).toBeInTheDocument();
  });

  it('renders chart placeholder text', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText(/Line chart coming soon/)).toBeInTheDocument();
    expect(screen.getByText('Donut chart coming soon')).toBeInTheDocument();
  });

  it('renders the exporter leaderboard table', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('Exporter Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Siam Premium Fruit Co.')).toBeInTheDocument();
    expect(screen.getByText('Bangkok Tropicals Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Chanthaburi Exports')).toBeInTheDocument();
  });
});

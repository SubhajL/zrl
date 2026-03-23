import * as React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from './page';

// DataTable is a 'use client' component that uses React.useState
// so we need to ensure it works in test environment
describe('DashboardPage', () => {
  it('renders the page title and subtitle', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText('At-a-glance operational status'),
    ).toBeInTheDocument();
  });

  it('renders all 4 KPI tiles', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Active Lanes')).toBeInTheDocument();
    expect(screen.getByText('Avg Completeness')).toBeInTheDocument();
    expect(screen.getByText('Ready to Ship')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('renders KPI values from mock data', () => {
    render(<DashboardPage />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the active lanes table', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Active Export Lanes')).toBeInTheDocument();
    // Check for lane IDs in the table
    expect(screen.getByText('LN-2026-001')).toBeInTheDocument();
    expect(screen.getByText('LN-2026-002')).toBeInTheDocument();
  });

  it('renders quick actions with create button', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Create New Lane')).toBeInTheDocument();
  });

  it('renders recent activity section', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(
      screen.getByText('MRL test uploaded for LN-2026-001'),
    ).toBeInTheDocument();
  });

  it('renders cold-chain status placeholder', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Cold-Chain Status')).toBeInTheDocument();
    expect(
      screen.getByText('Temperature sparklines coming soon'),
    ).toBeInTheDocument();
  });

  it('renders seasonal calendar with fruit seasons', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Thai Fruit Harvest Calendar')).toBeInTheDocument();
    // Seasons are shown with period text — these are unique to the calendar
    expect(screen.getByText('Feb \u2013 May')).toBeInTheDocument();
    expect(screen.getByText('May \u2013 Aug')).toBeInTheDocument();
    expect(screen.getByText('May \u2013 Sep')).toBeInTheDocument();
    expect(screen.getByText('Jun \u2013 Aug')).toBeInTheDocument();
  });
});

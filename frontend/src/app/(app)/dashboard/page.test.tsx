import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './page';
import { loadDashboardPageData } from '@/lib/dashboard-data';

jest.mock('@/lib/dashboard-data', () => ({
  loadDashboardPageData: jest.fn(),
}));

describe('DashboardPage', () => {
  it('renders live KPI and lane data from the loader', async () => {
    (loadDashboardPageData as jest.Mock).mockResolvedValue({
      userLabel: 'Chachoengsao Mango Export Co.',
      lanes: [
        {
          id: 'lane-1',
          laneId: 'LN-2026-001',
          exporterId: 'user-1',
          status: 'EVIDENCE_COLLECTING',
          productType: 'MANGO',
          destinationMarket: 'JAPAN',
          completenessScore: 80,
          coldChainMode: 'LOGGER',
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z',
        },
      ],
      recentNotifications: [
        {
          id: 'notif-1',
          title: 'MRL test uploaded',
          message: 'MRL test uploaded for LN-2026-001',
          createdAt: '2026-03-28T00:00:00.000Z',
        },
      ],
      kpis: {
        totalLanes: 1,
        avgCompleteness: 80,
        readyToShip: 0,
        unreadAlerts: 2,
      },
    });

    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getAllByText('80%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('LN-2026-001')).toBeInTheDocument();
      expect(screen.getByText('MRL test uploaded')).toBeInTheDocument();
    });
  });

  it('shows the loader error in an alert', async () => {
    (loadDashboardPageData as jest.Mock).mockRejectedValue(
      new Error('backend down'),
    );

    render(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'backend down',
    );
  });
});

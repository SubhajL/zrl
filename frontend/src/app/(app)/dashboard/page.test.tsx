import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './page';
import { useDashboardQuery } from '@/hooks/use-dashboard-query';

jest.mock('@/hooks/use-dashboard-query', () => ({
  useDashboardQuery: jest.fn(),
  DASHBOARD_QUERY_KEY: ['dashboard'],
}));

jest.mock('@/components/zrl/socket-provider', () => ({
  useSocketContext: () => ({ socket: null, connected: false }),
}));

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ setQueryData: jest.fn() }),
}));

const mockUseDashboardQuery = jest.mocked(useDashboardQuery);

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders live KPI and lane data from the query hook', async () => {
    mockUseDashboardQuery.mockReturnValue({
      data: {
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
      },
      error: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as unknown as ReturnType<typeof useDashboardQuery>);

    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getAllByText('80%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('LN-2026-001')).toBeInTheDocument();
      expect(screen.getByText('MRL test uploaded')).toBeInTheDocument();
    });
  });

  it('shows the error in an alert when query fails', async () => {
    mockUseDashboardQuery.mockReturnValue({
      data: undefined,
      error: new Error('backend down'),
      isLoading: false,
      isSuccess: false,
      isError: true,
    } as unknown as ReturnType<typeof useDashboardQuery>);

    render(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('backend down');
  });

  it('shows skeleton when loading', () => {
    mockUseDashboardQuery.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isSuccess: false,
      isError: false,
    } as unknown as ReturnType<typeof useDashboardQuery>);

    render(<DashboardPage />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});

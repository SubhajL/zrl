import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardQuery, DASHBOARD_QUERY_KEY } from './use-dashboard-query';
import { loadDashboardPageData } from '@/lib/dashboard-data';

jest.mock('@/lib/dashboard-data', () => ({
  loadDashboardPageData: jest.fn(),
}));

const mockLoad = jest.mocked(loadDashboardPageData);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDashboardQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading state initially', () => {
    mockLoad.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useDashboardQuery(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns data after successful fetch', async () => {
    const mockData = {
      userLabel: 'Test',
      lanes: [],
      recentNotifications: [],
      kpis: {
        totalLanes: 5,
        avgCompleteness: 80,
        readyToShip: 3,
        unreadAlerts: 1,
      },
    };
    mockLoad.mockResolvedValue(mockData);
    const { result } = renderHook(() => useDashboardQuery(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('returns error on fetch failure', async () => {
    mockLoad.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useDashboardQuery(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('exports correct query key', () => {
    expect(DASHBOARD_QUERY_KEY).toEqual(['dashboard']);
  });
});

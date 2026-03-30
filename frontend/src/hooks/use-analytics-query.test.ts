import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAnalyticsQuery,
  ANALYTICS_QUERY_KEY,
} from './use-analytics-query';
import { loadAnalyticsPageData } from '@/lib/analytics-data';

jest.mock('@/lib/analytics-data', () => ({
  loadAnalyticsPageData: jest.fn(),
}));

const mockLoad = jest.mocked(loadAnalyticsPageData);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAnalyticsQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading state initially', () => {
    mockLoad.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAnalyticsQuery(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns data after successful fetch', async () => {
    const mockData = {
      metrics: [
        { label: 'Total Lanes', value: '3', hint: 'Scope' },
      ],
      statusBreakdown: [{ label: 'VALIDATED', count: 2, sharePct: 67 }],
      marketBreakdown: [{ label: 'JAPAN', count: 2, sharePct: 67 }],
      productBreakdown: [{ label: 'MANGO', count: 3, sharePct: 100 }],
    };
    mockLoad.mockResolvedValue(mockData);

    const { result } = renderHook(() => useAnalyticsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('returns error on fetch failure', async () => {
    mockLoad.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAnalyticsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('exports correct query key', () => {
    expect(ANALYTICS_QUERY_KEY).toEqual(['analytics']);
  });
});

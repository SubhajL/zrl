import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLanesQuery } from './use-lanes-query';
import { loadLanesPage } from '@/lib/lanes-data';

jest.mock('@/lib/lanes-data', () => ({
  loadLanesPage: jest.fn(),
}));

const mockLoad = jest.mocked(loadLanesPage);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useLanesQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches lanes with default options', async () => {
    const mockData = {
      data: [
        {
          id: 'lane-1',
          laneId: 'LN-2026-001',
          exporterId: 'user-1',
          status: 'EVIDENCE_COLLECTING' as const,
          productType: 'MANGO' as const,
          destinationMarket: 'JAPAN' as const,
          completenessScore: 80,
          coldChainMode: 'LOGGER' as const,
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    };
    mockLoad.mockResolvedValue(mockData);

    const { result } = renderHook(() => useLanesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(mockLoad).toHaveBeenCalledWith({});
  });

  it('includes options in query key for refetch isolation', async () => {
    mockLoad.mockResolvedValue({
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
    });

    const { result } = renderHook(
      () => useLanesQuery({ page: 2, limit: 10 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockLoad).toHaveBeenCalledWith({ page: 2, limit: 10 });
  });

  it('returns error on failure', async () => {
    mockLoad.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useLanesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LanesListPage from './page';
import { useLanesQuery } from '@/hooks/use-lanes-query';

jest.mock('@/hooks/use-lanes-query', () => ({
  useLanesQuery: jest.fn(),
}));

const mockUseLanesQuery = jest.mocked(useLanesQuery);

describe('LanesListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders live lanes from the query hook', async () => {
    mockUseLanesQuery.mockReturnValue({
      data: {
        data: [
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
        meta: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      },
      error: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as unknown as ReturnType<typeof useLanesQuery>);

    render(<LanesListPage />);

    await waitFor(() => {
      expect(screen.getByText('LN-2026-001')).toBeInTheDocument();
      expect(screen.getByText('Mango')).toBeInTheDocument();
    });
  });

  it('shows skeleton when loading', () => {
    mockUseLanesQuery.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isSuccess: false,
      isError: false,
    } as unknown as ReturnType<typeof useLanesQuery>);

    render(<LanesListPage />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows error alert when query fails', () => {
    mockUseLanesQuery.mockReturnValue({
      data: undefined,
      error: new Error('Unable to load lanes.'),
      isLoading: false,
      isSuccess: false,
      isError: true,
    } as unknown as ReturnType<typeof useLanesQuery>);

    render(<LanesListPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to load lanes.',
    );
  });
});

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LanesListPage from './page';
import { loadLanesPage } from '@/lib/lanes-data';

jest.mock('@/lib/lanes-data', () => ({
  loadLanesPage: jest.fn(),
}));

describe('LanesListPage', () => {
  it('renders live lanes from the loader', async () => {
    (loadLanesPage as jest.Mock).mockResolvedValue({
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
    });

    render(<LanesListPage />);

    await waitFor(() => {
      expect(screen.getByText('LN-2026-001')).toBeInTheDocument();
      expect(screen.getByText('Mango')).toBeInTheDocument();
    });
  });
});

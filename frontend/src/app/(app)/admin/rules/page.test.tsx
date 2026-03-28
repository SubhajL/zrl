import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesAdminPage from './page';
import { loadRulesAdminData } from '@/lib/rules-data';

jest.mock('@/lib/rules-data', () => ({
  loadRulesAdminData: jest.fn(),
}));

describe('RulesAdminPage', () => {
  it('renders markets and live substances from the loader', async () => {
    (loadRulesAdminData as jest.Mock).mockResolvedValue({
      markets: ['JAPAN', 'CHINA'],
      versions: [
        {
          market: 'JAPAN',
          version: 3,
          changesSummary: 'Updated Chlorpyrifos limit',
          changedAt: '2026-03-28T00:00:00.000Z',
        },
      ],
      substancesByMarket: {
        JAPAN: [
          {
            id: 'sub-1',
            name: 'Chlorpyrifos',
            casNumber: '2921-88-2',
            thaiMrl: 0.5,
            destinationMrl: 0.01,
            stringencyRatio: 50,
            riskLevel: 'CRITICAL',
            updatedAt: '2026-03-28T00:00:00.000Z',
          },
        ],
        CHINA: [],
      },
    });

    render(<RulesAdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Markets')).toBeInTheDocument();
      expect(screen.getByText('Chlorpyrifos')).toBeInTheDocument();
      expect(screen.getByText('Version History')).toBeInTheDocument();
    });
  });

  it('filters substances by search query', async () => {
    (loadRulesAdminData as jest.Mock).mockResolvedValue({
      markets: ['JAPAN'],
      versions: [],
      substancesByMarket: {
        JAPAN: [
          {
            id: 'sub-1',
            name: 'Chlorpyrifos',
            casNumber: '2921-88-2',
            thaiMrl: 0.5,
            destinationMrl: 0.01,
            stringencyRatio: 50,
            riskLevel: 'CRITICAL',
            updatedAt: '2026-03-28T00:00:00.000Z',
          },
          {
            id: 'sub-2',
            name: 'Metalaxyl',
            casNumber: '57837-19-1',
            thaiMrl: 1,
            destinationMrl: 0.5,
            stringencyRatio: 2,
            riskLevel: 'LOW',
            updatedAt: '2026-03-28T00:00:00.000Z',
          },
        ],
      },
    });
    const user = userEvent.setup();
    render(<RulesAdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Chlorpyrifos')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search substances...'), 'Metal');

    expect(screen.getByText('Metalaxyl')).toBeInTheDocument();
    expect(screen.queryByText('Chlorpyrifos')).not.toBeInTheDocument();
  });
});

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
      rulesetsByMarket: {
        JAPAN: [
          {
            market: 'JAPAN',
            product: 'MANGO',
            version: 3,
            effectiveDate: '2026-03-01T00:00:00.000Z',
            requiredDocuments: ['Phytosanitary Certificate', 'VHT Certificate'],
            completenessWeights: {
              regulatory: 0.4,
              quality: 0.25,
              coldChain: 0.2,
              chainOfCustody: 0.15,
            },
            metadata: {
              coverageState: 'CURATED_HIGH_RISK',
              sourceQuality: 'PRIMARY_ONLY',
              retrievedAt: '2026-04-03T00:00:00.000Z',
              commodityCode: null,
              nonPesticideChecks: [
                {
                  type: 'VHT',
                  status: 'REQUIRED',
                  parameters: { requiredCertificate: true },
                  sourceRef: 'MAFF quarantine path',
                  note: null,
                },
              ],
            },
            substances: [],
          },
        ],
        CHINA: [],
      },
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
      expect(screen.getByText('Rule Pack Metadata')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: /mango pack/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('CURATED_HIGH_RISK')).toBeInTheDocument();
      expect(screen.getByText('PRIMARY_ONLY')).toBeInTheDocument();
    });
  });

  it('filters substances by search query', async () => {
    (loadRulesAdminData as jest.Mock).mockResolvedValue({
      markets: ['JAPAN'],
      versions: [],
      rulesetsByMarket: {
        JAPAN: [],
      },
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

    await user.type(
      screen.getByPlaceholderText('Search substances...'),
      'Metal',
    );

    expect(screen.getByText('Metalaxyl')).toBeInTheDocument();
    expect(screen.queryByText('Chlorpyrifos')).not.toBeInTheDocument();
  });

  it('renders placeholders for substances without thai comparator metadata', async () => {
    (loadRulesAdminData as jest.Mock).mockResolvedValue({
      markets: ['KOREA'],
      versions: [],
      rulesetsByMarket: {
        KOREA: [
          {
            market: 'KOREA',
            product: 'MANGO',
            version: 1,
            effectiveDate: '2026-04-03T00:00:00.000Z',
            requiredDocuments: [
              'Phytosanitary Certificate',
              'MRL Test Results',
            ],
            completenessWeights: {
              regulatory: 0.4,
              quality: 0.25,
              coldChain: 0.2,
              chainOfCustody: 0.15,
            },
            metadata: {
              coverageState: 'PRIMARY_PARTIAL',
              sourceQuality: 'PRIMARY_ONLY',
              retrievedAt: '2026-04-03T00:00:00.000Z',
              commodityCode: 'ap105050006',
              nonPesticideChecks: [
                {
                  type: 'VHT',
                  status: 'REQUIRED',
                  parameters: {
                    minCoreTemperatureC: 47,
                    minHoldMinutes: 20,
                  },
                  sourceRef: 'QIA fruit import conditions',
                  note: null,
                },
              ],
            },
            substances: [],
          },
        ],
      },
      substancesByMarket: {
        KOREA: [
          {
            id: 'sub-1',
            name: 'Acetamiprid',
            casNumber: '135410-20-7',
            thaiMrl: null,
            destinationMrl: 0.2,
            stringencyRatio: null,
            riskLevel: null,
            updatedAt: '2026-04-03T00:00:00.000Z',
          },
        ],
      },
    });

    render(<RulesAdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Acetamiprid')).toBeInTheDocument();
    });

    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('renders shared metadata for supported rule packs', async () => {
    (loadRulesAdminData as jest.Mock).mockResolvedValue({
      markets: ['KOREA'],
      versions: [],
      rulesetsByMarket: {
        KOREA: [
          {
            market: 'KOREA',
            product: 'MANGO',
            version: 1,
            effectiveDate: '2026-04-03T00:00:00.000Z',
            requiredDocuments: [
              'Phytosanitary Certificate',
              'MRL Test Results',
            ],
            completenessWeights: {
              regulatory: 0.4,
              quality: 0.25,
              coldChain: 0.2,
              chainOfCustody: 0.15,
            },
            metadata: {
              coverageState: 'PRIMARY_PARTIAL',
              sourceQuality: 'PRIMARY_ONLY',
              retrievedAt: '2026-04-03T00:00:00.000Z',
              commodityCode: 'ap105050006',
              nonPesticideChecks: [
                {
                  type: 'VHT',
                  status: 'REQUIRED',
                  parameters: {
                    minCoreTemperatureC: 47,
                    minHoldMinutes: 20,
                  },
                  sourceRef: 'QIA fruit import conditions',
                  note: 'Structured from coding log',
                },
              ],
            },
            substances: [],
          },
        ],
      },
      substancesByMarket: {
        KOREA: [],
      },
    });

    render(<RulesAdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Rule Pack Metadata')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: /mango pack/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('PRIMARY_PARTIAL')).toBeInTheDocument();
      expect(screen.getByText('PRIMARY_ONLY')).toBeInTheDocument();
      expect(screen.getByText('Commodity code')).toBeInTheDocument();
      expect(screen.getByText('ap105050006')).toBeInTheDocument();
      expect(screen.getByText('VHT')).toBeInTheDocument();
      expect(screen.getByText(/minCoreTemperatureC: 47/i)).toBeInTheDocument();
      expect(screen.getByText(/minHoldMinutes: 20/i)).toBeInTheDocument();
    });
  });
});

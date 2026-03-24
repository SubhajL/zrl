import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LaneDetailPage from './page';
import { headers } from 'next/headers';
import {
  loadLaneDetailPageData,
  type LaneDetailPageData,
} from '@/lib/lane-detail-data';

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

jest.mock('@/lib/lane-detail-data', () => ({
  loadLaneDetailPageData: jest.fn(),
}));

const headersMock = jest.mocked(headers);
const loadLaneDetailPageDataMock = jest.mocked(loadLaneDetailPageData);

function buildPageData(): LaneDetailPageData {
  return {
    lane: {
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'usr-001',
      status: 'EVIDENCE_COLLECTING',
      productType: 'MANGO',
      destinationMarket: 'JAPAN',
      completenessScore: 80,
      coldChainMode: 'TELEMETRY',
      createdAt: '2026-03-18T08:00:00Z',
      updatedAt: '2026-03-22T10:30:00Z',
      batch: {
        id: 'b-001',
        laneId: 'lane-db-1',
        batchId: 'MNG-JPN-20260318-001',
        product: 'MANGO',
        variety: 'Nam Doc Mai',
        quantityKg: 5000,
        originProvince: 'Chachoengsao',
        harvestDate: '2026-03-15',
        grade: 'PREMIUM',
      },
      route: null,
      checkpoints: [],
      ruleSnapshot: null,
      temperatureProfile: {
        fruit: 'MANGO',
        optimalMinC: 10,
        optimalMaxC: 13,
        chillingThresholdC: 10,
        heatThresholdC: 15,
        baseShelfLifeDays: 21,
        minShelfLifeDays: 14,
      },
    },
    completeness: {
      score: 80,
      required: 4,
      present: 3,
      missing: ['VHT Certificate'],
    },
    evidence: [
      {
        id: 'artifact-1',
        laneId: 'lane-db-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        contentHash: 'abcdef1234567890',
        contentHashPreview: 'abcdef12',
        storagePath: 's3://bucket/phyto.pdf',
        verificationStatus: 'VERIFIED',
        source: 'UPLOAD',
        checkpointId: null,
        createdAt: '2026-03-20T10:00:00Z',
        updatedAt: '2026-03-20T10:05:00Z',
      },
    ],
    evidenceGraph: {
      nodes: [
        {
          id: 'node-1',
          artifactId: 'artifact-1',
          artifactType: 'PHYTO_CERT',
          label: 'Phytosanitary Certificate',
          status: 'COMPLETE',
          hashPreview: 'abcdef12',
        },
      ],
      edges: [],
    },
    temperature: {
      readings: [
        {
          id: 'reading-1',
          timestamp: '2026-03-20T10:00:00Z',
          valueC: 11.3,
          deviceId: 'telemetry-1',
          source: 'TELEMETRY',
          checkpointId: null,
        },
      ],
      excursions: [],
      sla: {
        laneId: 'lane-db-1',
        status: 'PASS',
        totalExcursionMinutes: 0,
        excursionCount: 0,
        maxDeviationC: 0,
        remainingShelfLifeDays: 14,
        shelfLifeImpactPct: 0,
      },
    },
    auditEntries: [
      {
        id: 'audit-1',
        timestamp: '2026-03-20T10:05:00Z',
        actor: 'system',
        action: 'VERIFY',
        entityType: 'ARTIFACT',
        entityId: 'artifact-1',
        payloadHash: 'payload-1',
        prevHash: 'prev-1',
        entryHash: 'entry-1',
      },
    ],
    proofPacks: {
      backendAvailable: false,
    },
    auditExportUrl: 'http://backend.test/audit/export/lane-db-1',
  };
}

async function renderPage() {
  render(
    await LaneDetailPage({
      params: Promise.resolve({
        laneId: 'lane-db-1',
      }),
    }),
  );
}

describe('LaneDetailPage', () => {
  beforeEach(() => {
    headersMock.mockResolvedValue(new Headers());
    loadLaneDetailPageDataMock.mockResolvedValue(buildPageData());
  });

  it('renders lane header with lane ID', async () => {
    await renderPage();
    expect(screen.getByText('LN-2026-001')).toBeInTheDocument();
  });

  it('renders tab navigation with 6 tabs', async () => {
    await renderPage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);

    expect(screen.getByRole('tab', { name: 'Evidence' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Checkpoints' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Temperature' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Proof Packs' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Audit Trail' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Dispute' })).toBeInTheDocument();
  });

  it('loads live data for the requested lane id', async () => {
    await renderPage();
    expect(loadLaneDetailPageDataMock).toHaveBeenCalledWith('lane-db-1', {
      requestHeaders: expect.any(Headers),
    });
  });

  it('defaults to Evidence tab', async () => {
    await renderPage();
    const evidenceTab = screen.getByRole('tab', { name: 'Evidence' });
    expect(evidenceTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches tabs when clicked', async () => {
    const user = userEvent.setup();
    await renderPage();

    const checkpointsTab = screen.getByRole('tab', { name: 'Checkpoints' });
    await user.click(checkpointsTab);

    expect(checkpointsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('renders lane status badge', async () => {
    await renderPage();
    expect(screen.getByText('Collecting')).toBeInTheDocument();
  });

  it('renders completeness progress bar', async () => {
    await renderPage();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('renders product and destination info', async () => {
    await renderPage();
    expect(screen.getByText(/Mango/)).toBeInTheDocument();
    expect(screen.getByText(/Japan/)).toBeInTheDocument();
  });

  it('shows proof packs as unavailable on current backend', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('tab', { name: 'Proof Packs' }));

    expect(screen.getAllByText(/Unavailable on main/)).toHaveLength(3);
    expect(screen.getAllByText(/GET \/lanes\/:id\/packs/)).toHaveLength(3);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LaneDetailPage from './page';
import { cookies, headers } from 'next/headers';
import { useRouter } from 'next/navigation';
import {
  loadLaneDetailPageData,
  type LaneDetailPageData,
} from '@/lib/lane-detail-data';
import { requestAppJson } from '@/lib/app-api';

jest.mock('next/headers', () => ({
  headers: jest.fn(),
  cookies: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/lane-detail-data', () => ({
  loadLaneDetailPageData: jest.fn(),
}));

jest.mock('@/lib/app-api', () => ({
  requestAppJson: jest.fn(),
  getErrorMessage: jest.requireActual('@/lib/app-api').getErrorMessage,
}));

const headersMock = jest.mocked(headers);
const cookiesMock = jest.mocked(cookies);
const useRouterMock = jest.mocked(useRouter);
const loadLaneDetailPageDataMock = jest.mocked(loadLaneDetailPageData);
const requestAppJsonMock = jest.mocked(requestAppJson);
const routerRefreshMock = jest.fn();

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
      checklist: [
        {
          key: 'phyto-certificate',
          label: 'Phytosanitary Certificate',
          category: 'REGULATORY',
          weight: 0.4,
          required: true,
          present: true,
          status: 'PRESENT',
          artifactIds: ['artifact-1'],
        },
        {
          key: 'vht-certificate',
          label: 'VHT Certificate',
          category: 'REGULATORY',
          weight: 0.4,
          required: true,
          present: false,
          status: 'MISSING',
          artifactIds: [],
        },
      ],
      categories: [
        {
          category: 'REGULATORY',
          weight: 0.4,
          required: 2,
          present: 1,
          score: 0.5,
        },
      ],
      labValidation: {
        status: 'BLOCKED',
        valid: false,
        hasUnknowns: false,
        blockingReasons: ['MRL_TEST_REQUIRED'],
        results: [],
      },
      certificationAlerts: [
        {
          artifactType: 'PHYTO_CERT',
          status: 'VALID',
          expiresAt: '2026-12-31T00:00:00.000Z',
          artifactId: 'artifact-1',
          message: 'PHYTO_CERT is valid.',
        },
      ],
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
        latestAnalysis: {
          id: 'analysis-1',
          artifactId: 'artifact-1',
          analyzerVersion: 'tesseract',
          analysisStatus: 'COMPLETED',
          documentLabel: 'Phytosanitary Certificate',
          documentRole: 'THAILAND_NPPO_EXPORT_CERTIFICATE',
          confidence: 'HIGH',
          summaryText: 'Matched phytosanitary certificate.',
          extractedFields: {
            certificateNumber: 'PC-2026-0001',
          },
          missingFieldKeys: ['declaredPointOfEntry'],
          lowConfidenceFieldKeys: ['officialSealOrSignature'],
          fieldCompleteness: null,
          completedAt: '2026-04-07T07:00:00.000Z',
          createdAt: '2026-04-07T07:00:00.000Z',
          updatedAt: '2026-04-07T07:00:00.000Z',
        },
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
        {
          id: 'reading-2',
          timestamp: '2026-03-20T11:00:00Z',
          valueC: 12.1,
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
      packs: [
        {
          id: 'pack-2',
          laneId: 'lane-db-1',
          packType: 'REGULATOR',
          version: 2,
          status: 'READY',
          contentHash: 'abcdef1234567890fedcba',
          filePath: 's3://bucket/pack-2.pdf',
          errorMessage: null,
          generatedAt: '2026-03-22T09:00:00Z',
          generatedBy: 'user-1',
          recipient: 'Tokyo Customs',
        },
        {
          id: 'pack-3',
          laneId: 'lane-db-1',
          packType: 'BUYER',
          version: 1,
          status: 'GENERATING',
          contentHash: null,
          filePath: null,
          errorMessage: null,
          generatedAt: '2026-03-22T09:15:00Z',
          generatedBy: 'user-1',
          recipient: 'Buyer',
        },
      ],
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
    cookiesMock.mockResolvedValue({
      get: jest.fn().mockReturnValue(undefined),
    } as never);
    loadLaneDetailPageDataMock.mockResolvedValue(buildPageData());
    requestAppJsonMock.mockImplementation(async (path: string) => {
      if (path === '/api/zrl/lanes/LN-2026-001/completeness') {
        return buildPageData().completeness;
      }

      return {};
    });
    routerRefreshMock.mockReset();
    useRouterMock.mockReturnValue({
      refresh: routerRefreshMock,
    } as never);
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
      accessToken: null,
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

  it('renders compliance check details from live completeness data', async () => {
    await renderPage();

    expect(screen.getByText('Compliance Check')).toBeInTheDocument();
    expect(screen.getByText('Required Documents')).toBeInTheDocument();
    expect(
      screen.getAllByText('Phytosanitary Certificate').length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('VHT Certificate')).toBeInTheDocument();
    expect(screen.getByText('MRL BLOCKED')).toBeInTheDocument();
  });

  it('renders product and destination info', async () => {
    await renderPage();
    expect(screen.getByText(/Mango/)).toBeInTheDocument();
    expect(screen.getByText(/Japan/)).toBeInTheDocument();
  });

  it('renders live proof-pack actions and history', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('tab', { name: 'Proof Packs' }));

    expect(screen.getByText('Version 2')).toBeInTheDocument();
    expect(screen.getByText('Generating')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/api/zrl/packs/pack-2/download',
    );
    expect(screen.getByRole('link', { name: 'Verify' })).toHaveAttribute(
      'href',
      '/api/zrl/packs/pack-2/verify',
    );
  });

  it('renders live temperature summaries instead of a placeholder chart', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('tab', { name: 'Temperature' }));

    expect(screen.getByText('Telemetry Window')).toBeInTheDocument();
    expect(screen.getByText('Observed Range')).toBeInTheDocument();
    expect(screen.getByText('Recent Readings')).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('uploads evidence artifacts from the evidence tab and refreshes the page', async () => {
    const user = userEvent.setup();
    await renderPage();

    const fileInput = document.querySelector(
      'input[data-artifact-type="MRL_TEST"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const testFile = new File(['lab'], 'lab-report.pdf', {
      type: 'application/pdf',
    });

    await user.upload(fileInput!, testFile);

    expect(requestAppJsonMock).toHaveBeenNthCalledWith(
      1,
      '/api/zrl/lanes/LN-2026-001/evidence',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    const formData = requestAppJsonMock.mock.calls[0]?.[1]?.body as FormData;
    expect(formData.get('artifactType')).toBe('MRL_TEST');
    expect(formData.get('source')).toBe('UPLOAD');
    expect(formData.get('file')).toBe(testFile);
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it('verifies the evidence graph on demand from the evidence tab', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Verify Evidence Graph' }),
    );

    expect(requestAppJsonMock).toHaveBeenCalledWith(
      '/api/zrl/lanes/LN-2026-001/evidence/graph/verify',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it('verifies a single evidence artifact on demand from the evidence tab', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getAllByRole('button', { name: 'Verify' })[0]!);

    expect(requestAppJsonMock).toHaveBeenCalledWith(
      '/api/zrl/evidence/artifact-1/verify',
    );
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it('reanalyses a single evidence artifact on demand from the evidence tab', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: 'Reanalyze' }));

    expect(requestAppJsonMock).toHaveBeenCalledWith(
      '/api/zrl/evidence/artifact-1/reanalyze',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it('backfills missing analysis on demand from the evidence tab', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Backfill Missing Analysis' }),
    );

    expect(requestAppJsonMock).toHaveBeenCalledWith(
      '/api/zrl/evidence/artifact-1/reanalyze',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it('runs compliance check on demand from the lane header', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Run Compliance Check' }),
    );

    expect(requestAppJsonMock).toHaveBeenCalledWith(
      '/api/zrl/lanes/LN-2026-001/completeness',
    );
  });

  it('collapses the compliance panel on demand', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: 'Collapse' }));

    expect(screen.queryByText('Required Documents')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
  });
});

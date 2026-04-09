import { UnprocessableEntityException } from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import { HashingService } from '../../common/hashing/hashing.service';
import { AuditService } from '../../common/audit/audit.service';
import { ColdChainService } from '../cold-chain/cold-chain.service';
import { RealtimeEventsService } from '../notifications/realtime-events.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { LaneService } from './lane.service';
import type {
  CreateLaneInput,
  LaneColdChainConfigInput,
  LaneDetail,
  LaneListQuery,
  LaneRuleSnapshotResolver,
  LaneStore,
  LaneSummary,
  UpdateLaneInput,
} from './lane.types';

function buildLaneDetail(overrides: Partial<LaneDetail> = {}): LaneDetail {
  return {
    id: 'lane-db-1',
    laneId: 'LN-2026-002',
    exporterId: 'user-1',
    status: 'EVIDENCE_COLLECTING',
    productType: 'MANGO',
    destinationMarket: 'JAPAN',
    completenessScore: 0,
    coldChainMode: null,
    coldChainDeviceId: null,
    coldChainDataFrequencySeconds: null,
    statusChangedAt: new Date('2026-03-22T05:00:00.000Z'),
    createdAt: new Date('2026-03-22T05:00:00.000Z'),
    updatedAt: new Date('2026-03-22T05:00:00.000Z'),
    batch: {
      id: 'batch-db-1',
      laneId: 'lane-db-1',
      batchId: 'MNG-JPN-20260315-002',
      product: 'MANGO',
      variety: 'Nam Doc Mai',
      quantityKg: 5000,
      originProvince: 'Chachoengsao',
      harvestDate: new Date('2026-03-15T00:00:00.000Z'),
      grade: 'A',
    },
    route: {
      id: 'route-db-1',
      laneId: 'lane-db-1',
      transportMode: 'AIR',
      carrier: 'Thai Airways Cargo',
      originGps: { lat: 13.6904, lng: 101.0779 },
      destinationGps: { lat: 35.772, lng: 140.3929 },
      estimatedTransitHours: 8,
    },
    checkpoints: [],
    ruleSnapshot: {
      id: 'rule-snapshot-db-1',
      laneId: 'lane-db-1',
      market: 'JAPAN',
      product: 'MANGO',
      version: 4,
      rules: { requiredDocuments: ['phyto'] },
      effectiveDate: new Date('2026-03-01T00:00:00.000Z'),
      createdAt: new Date('2026-03-22T05:00:00.000Z'),
    },
    ...overrides,
  };
}

function buildLaneSummary(overrides: Partial<LaneSummary> = {}): LaneSummary {
  return {
    id: 'lane-db-1',
    laneId: 'LN-2026-002',
    exporterId: 'user-1',
    status: 'EVIDENCE_COLLECTING',
    productType: 'MANGO',
    destinationMarket: 'JAPAN',
    completenessScore: 0,
    coldChainMode: null,
    coldChainDeviceId: null,
    coldChainDataFrequencySeconds: null,
    statusChangedAt: new Date('2026-03-22T05:00:00.000Z'),
    createdAt: new Date('2026-03-22T05:00:00.000Z'),
    updatedAt: new Date('2026-03-22T05:00:00.000Z'),
    ...overrides,
  };
}

describe('LaneService', () => {
  const runInTransactionMock = jest.fn(
    async <T>(operation: (store: LaneStore) => Promise<T>) =>
      await operation(laneStore),
  );
  const findLatestLaneIdByYearMock = jest.fn();
  const findLatestBatchIdByPrefixMock = jest.fn();
  const createLaneBundleMock = jest.fn();
  const findLanesMock = jest.fn();
  const findLaneByIdMock = jest.fn();
  const listEvidenceArtifactsForLaneMock = jest.fn();
  const updateLaneBundleMock = jest.fn();
  const transitionLaneStatusMock = jest.fn();
  const countProofPacksForLaneMock = jest.fn();
  const findCheckpointsForLaneMock = jest.fn();
  const findCheckpointByIdMock = jest.fn();
  const createCheckpointMock = jest.fn();
  const updateCheckpointMock = jest.fn();
  const findProofPackSummaryByIdMock = jest.fn();
  const laneStore: LaneStore = {
    runInTransaction: runInTransactionMock as LaneStore['runInTransaction'],
    findLatestLaneIdByYear:
      findLatestLaneIdByYearMock as LaneStore['findLatestLaneIdByYear'],
    findLatestBatchIdByPrefix:
      findLatestBatchIdByPrefixMock as LaneStore['findLatestBatchIdByPrefix'],
    createLaneBundle: createLaneBundleMock as LaneStore['createLaneBundle'],
    findLanes: findLanesMock as LaneStore['findLanes'],
    findLaneById: findLaneByIdMock as LaneStore['findLaneById'],
    listEvidenceArtifactsForLane:
      listEvidenceArtifactsForLaneMock as LaneStore['listEvidenceArtifactsForLane'],
    updateLaneBundle: updateLaneBundleMock as LaneStore['updateLaneBundle'],
    transitionLaneStatus:
      transitionLaneStatusMock as LaneStore['transitionLaneStatus'],
    countProofPacksForLane:
      countProofPacksForLaneMock as LaneStore['countProofPacksForLane'],
    findCheckpointsForLane:
      findCheckpointsForLaneMock as LaneStore['findCheckpointsForLane'],
    findCheckpointById:
      findCheckpointByIdMock as LaneStore['findCheckpointById'],
    createCheckpoint: createCheckpointMock as LaneStore['createCheckpoint'],
    updateCheckpoint: updateCheckpointMock as LaneStore['updateCheckpoint'],
    findProofPackSummaryById:
      findProofPackSummaryByIdMock as LaneStore['findProofPackSummaryById'],
  };
  const createAuditEntryMock = jest.fn().mockResolvedValue({
    id: 'audit-db-1',
    timestamp: new Date('2026-03-22T05:00:01.000Z'),
    actor: 'user-1',
    action: AuditAction.CREATE,
    entityType: AuditEntityType.LANE,
    entityId: 'lane-db-1',
    payloadHash: 'payload-hash',
    prevHash: 'genesis',
    entryHash: 'entry-hash',
  });
  const hashStringMock = jest.fn().mockResolvedValue('payload-hash');
  const hashingService = {
    hashString: hashStringMock,
  } as unknown as HashingService;
  const auditService = {
    createEntry: createAuditEntryMock,
  } as unknown as AuditService;
  const resolveRuleSnapshotMock = jest.fn();
  const ruleSnapshotResolver = {
    resolve: resolveRuleSnapshotMock,
  } as unknown as LaneRuleSnapshotResolver;
  const validateLaneConfigurationMock = jest.fn();
  const coldChainService = {
    validateLaneConfiguration: validateLaneConfigurationMock,
  } as unknown as ColdChainService;
  const evaluateLaneMock = jest.fn();
  const rulesEngineService = {
    evaluateLane: evaluateLaneMock,
  } as unknown as RulesEngineService;
  const publishLaneStatusChangedMock = jest.fn().mockResolvedValue(undefined);
  const publishCheckpointRecordedMock = jest.fn().mockResolvedValue(undefined);
  const realtimeEvents = {
    publishLaneStatusChanged: publishLaneStatusChangedMock,
    publishCheckpointRecorded: publishCheckpointRecordedMock,
  } as unknown as Pick<
    RealtimeEventsService,
    'publishLaneStatusChanged' | 'publishCheckpointRecorded'
  >;

  function createService() {
    return new LaneService(
      laneStore,
      hashingService,
      auditService,
      ruleSnapshotResolver,
      coldChainService,
      rulesEngineService,
      realtimeEvents as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-22T05:00:00.000Z'));
    validateLaneConfigurationMock.mockImplementation(
      (config: LaneColdChainConfigInput) => ({
        mode: config.mode,
        deviceId: config.deviceId ?? null,
        dataFrequencySeconds: config.dataFrequencySeconds ?? null,
      }),
    );
    listEvidenceArtifactsForLaneMock.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a lane with generated lane and batch ids', async () => {
    const service = createService();
    const createInput: CreateLaneInput = {
      product: 'MANGO',
      batch: {
        variety: 'Nam Doc Mai',
        quantityKg: 5000,
        originProvince: 'Chachoengsao',
        harvestDate: new Date('2026-03-15T00:00:00.000Z'),
        grade: 'A',
      },
      destination: {
        market: 'JAPAN',
      },
      route: {
        transportMode: 'AIR',
        carrier: 'Thai Airways Cargo',
        originGps: { lat: 13.6904, lng: 101.0779 },
        destinationGps: { lat: 35.772, lng: 140.3929 },
        estimatedTransitHours: 8,
      },
      checkpoints: [
        {
          sequence: 1,
          locationName: 'Packing House',
        },
      ],
      coldChainConfig: {
        mode: 'LOGGER',
        deviceId: 'logger-1',
        dataFrequencySeconds: 300,
      },
    };
    const lane = buildLaneDetail();
    const snapshot = lane.ruleSnapshot;

    findLatestLaneIdByYearMock.mockResolvedValue('LN-2026-001');
    findLatestBatchIdByPrefixMock.mockResolvedValue('MNG-JPN-20260315-001');
    resolveRuleSnapshotMock.mockResolvedValue(snapshot);
    createLaneBundleMock.mockResolvedValue(lane);

    await expect(
      service.create(createInput, {
        id: 'user-1',
        role: 'EXPORTER',
        email: 'exporter@example.com',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      }),
    ).resolves.toEqual({ lane });

    expect(runInTransactionMock).toHaveBeenCalledTimes(1);
    expect(findLatestLaneIdByYearMock).toHaveBeenCalledWith(2026);
    expect(findLatestBatchIdByPrefixMock).toHaveBeenCalledWith(
      'MNG-JPN-20260315',
    );
    expect(createLaneBundleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: 'LN-2026-002',
        batchId: 'MNG-JPN-20260315-002',
        exporterId: 'user-1',
        coldChainMode: 'LOGGER',
        coldChainDeviceId: 'logger-1',
        coldChainDataFrequencySeconds: 300,
      }),
    );
    expect(createAuditEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.CREATE,
        entityType: AuditEntityType.LANE,
        entityId: 'lane-db-1',
        payloadHash: 'payload-hash',
      }),
    );
  });

  it('filters lanes for exporter viewers and paginates results', async () => {
    const service = createService();
    const summary = buildLaneSummary();

    findLanesMock.mockResolvedValue({
      items: [summary],
      total: 1,
    });

    const result = await service.findAll(
      {
        page: 2,
        limit: 5,
        status: 'EVIDENCE_COLLECTING',
        product: 'MANGO',
        market: 'JAPAN',
      } satisfies LaneListQuery,
      {
        id: 'user-1',
        role: 'EXPORTER',
        email: 'exporter@example.com',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(findLanesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        exporterId: 'user-1',
        page: 2,
        limit: 5,
        status: 'EVIDENCE_COLLECTING',
        product: 'MANGO',
        market: 'JAPAN',
      }),
    );
    expect(result).toEqual({
      data: [summary],
      meta: {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('fails with a domain error when no rule snapshot exists for the market/product', async () => {
    const service = createService();
    const createInput: CreateLaneInput = {
      product: 'DURIAN',
      batch: {
        variety: 'Monthong',
        quantityKg: 2400,
        originProvince: 'Chanthaburi',
        harvestDate: new Date('2026-03-15T00:00:00.000Z'),
        grade: 'A',
      },
      destination: {
        market: 'JAPAN',
      },
      route: {
        transportMode: 'SEA',
        carrier: 'Evergreen Reefer',
      },
      coldChainConfig: {
        mode: 'TELEMETRY',
        deviceId: 'telemetry-1',
        dataFrequencySeconds: 30,
      },
    };

    resolveRuleSnapshotMock.mockResolvedValue(null);

    await expect(
      service.create(createInput, {
        id: 'user-1',
        role: 'EXPORTER',
        email: 'exporter@example.com',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      }),
    ).rejects.toThrow(
      new UnprocessableEntityException(
        'No rules are available for the selected market/product.',
      ),
    );

    expect(createLaneBundleMock).not.toHaveBeenCalled();
    expect(createAuditEntryMock).not.toHaveBeenCalled();
  });

  it('getCompleteness returns rules-engine evaluation output', async () => {
    const service = createService();
    const lane = buildLaneDetail();
    const evaluation = {
      score: 73,
      required: 4,
      present: 3,
      missing: ['VHT Certificate'],
      checklist: [
        {
          key: 'phytosanitary-certificate',
          label: 'Phytosanitary Certificate',
          category: 'REGULATORY',
          weight: 0.4,
          required: true,
          present: true,
          status: 'PRESENT',
          artifactIds: ['artifact-1'],
          provenance: {
            source: 'ARTIFACT_TYPE',
            artifactId: 'artifact-1',
          },
        },
      ],
      categories: [],
      labValidation: null,
      certificationAlerts: [],
    };

    findLaneByIdMock.mockResolvedValue(lane);
    listEvidenceArtifactsForLaneMock.mockResolvedValue([
      {
        id: 'artifact-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        metadata: { expiresAt: '2026-04-01T00:00:00.000Z' },
      },
    ]);
    evaluateLaneMock.mockReturnValue(evaluation);

    await expect(service.getCompleteness('lane-db-1')).resolves.toEqual(
      evaluation,
    );
    expect(listEvidenceArtifactsForLaneMock).toHaveBeenCalledWith('lane-db-1');
    expect(evaluateLaneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        market: 'JAPAN',
        product: 'MANGO',
        version: 4,
      }),
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'PHYTO_CERT',
        }),
      ]),
    );
  });

  it('getCompleteness passes OCR document labels for invoice-family artifacts into rules evaluation', async () => {
    const service = createService();
    const lane = buildLaneDetail();

    findLaneByIdMock.mockResolvedValue(lane);
    listEvidenceArtifactsForLaneMock.mockResolvedValue([
      {
        id: 'artifact-trade-1',
        artifactType: 'INVOICE',
        fileName: 'trade-doc.pdf',
        metadata: null,
        latestAnalysisDocumentLabel: 'Packing List',
      },
    ]);
    evaluateLaneMock.mockReturnValue({
      score: 25,
      required: 1,
      present: 1,
      missing: [],
      checklist: [],
      categories: [],
      labValidation: null,
      certificationAlerts: [],
    });

    await service.getCompleteness('lane-db-1');

    expect(evaluateLaneMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'INVOICE',
          latestAnalysisDocumentLabel: 'Packing List',
        }),
      ]),
    );
  });

  it('getCompleteness preserves OCR field completeness for backend lab validation parity', async () => {
    const service = createService();
    const lane = buildLaneDetail();

    findLaneByIdMock.mockResolvedValue(lane);
    listEvidenceArtifactsForLaneMock.mockResolvedValue([
      {
        id: 'artifact-lab-1',
        artifactType: 'MRL_TEST',
        fileName: 'mrl-report.pdf',
        metadata: null,
        latestAnalysisDocumentLabel: 'MRL Test Results',
        latestAnalysisExtractedFields: {
          reportNumber: 'MRL-2026-0007',
        },
        latestAnalysisFieldCompleteness: {
          supported: false,
          documentMatrixVersion: 1,
          expectedFieldKeys: [],
          presentFieldKeys: [],
          missingFieldKeys: [],
          lowConfidenceFieldKeys: [],
          unsupportedFieldKeys: ['reportNumber'],
        },
      },
    ]);
    evaluateLaneMock.mockReturnValue({
      score: 0,
      required: 0,
      present: 0,
      missing: [],
      checklist: [],
      categories: [],
      labValidation: null,
      certificationAlerts: [],
    });

    await service.getCompleteness('lane-db-1');

    expect(evaluateLaneMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          latestAnalysisFieldCompleteness: expect.objectContaining({
            supported: false,
          }),
        }),
      ]),
    );
  });

  it('returns lane detail from the store', async () => {
    const service = createService();
    const lane = buildLaneDetail();
    findLaneByIdMock.mockResolvedValue(lane);

    await expect(service.findById('lane-db-1')).resolves.toEqual({ lane });
  });

  it('returns checkpoint detail by id', async () => {
    const service = createService();
    const checkpoint = {
      id: 'cp-1',
      laneId: 'lane-db-1',
      sequence: 1,
      locationName: 'Packing House',
      gpsLat: 13.69,
      gpsLng: 101.07,
      timestamp: new Date('2026-03-22T06:00:00.000Z'),
      temperature: 12.5,
      signatureHash:
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      signerName: 'Somchai',
      conditionNotes: 'All good',
      status: 'COMPLETED' as const,
    };
    findCheckpointByIdMock.mockResolvedValue(checkpoint);

    await expect(service.getCheckpointById('cp-1')).resolves.toEqual(
      checkpoint,
    );
  });

  it('updates a lane bundle and appends an audit entry', async () => {
    const service = createService();
    const updateInput: UpdateLaneInput = {
      coldChainConfig: {
        mode: 'TELEMETRY',
        deviceId: 'telemetry-1',
        dataFrequencySeconds: 60,
      },
      batch: {
        variety: 'Mahachanok',
        quantityKg: 6000,
      },
      route: {
        carrier: 'Kerry Air',
      },
    };
    const lane = buildLaneDetail({
      batch: {
        id: 'batch-db-1',
        laneId: 'lane-db-1',
        batchId: 'MNG-JPN-20260315-002',
        product: 'MANGO',
        variety: 'Mahachanok',
        quantityKg: 6000,
        originProvince: 'Chachoengsao',
        harvestDate: new Date('2026-03-15T00:00:00.000Z'),
        grade: 'A',
      },
    });

    findLaneByIdMock.mockResolvedValue(lane);
    updateLaneBundleMock.mockResolvedValue(lane);

    await expect(
      service.update('lane-db-1', updateInput, {
        id: 'user-1',
        role: 'EXPORTER',
        email: 'exporter@example.com',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      }),
    ).resolves.toEqual({ lane });

    const updateCalls = updateLaneBundleMock.mock.calls as Array<
      [string, UpdateLaneInput]
    >;
    const updateCall = updateCalls[0][1];

    expect(updateLaneBundleMock).toHaveBeenCalledWith(
      'lane-db-1',
      expect.any(Object),
    );
    expect(updateCall.batch?.variety).toBe('Mahachanok');
    expect(updateCall.batch?.quantityKg).toBe(6000);
    expect(updateCall.route?.carrier).toBe('Kerry Air');
    expect(updateCall.coldChainConfig).toEqual({
      mode: 'TELEMETRY',
      deviceId: 'telemetry-1',
      dataFrequencySeconds: 60,
    });
    expect(createAuditEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.LANE,
        entityId: 'lane-db-1',
        payloadHash: 'payload-hash',
      }),
    );
  });

  it('rejects exporter updates before persisting another exporter lane', async () => {
    const service = createService();
    const lane = buildLaneDetail({
      exporterId: 'user-2',
    });

    findLaneByIdMock.mockResolvedValue(lane);

    await expect(
      service.update(
        'lane-db-1',
        {
          route: {
            carrier: 'Unauthorized Carrier',
          },
        },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toThrow('Lane ownership required.');

    expect(updateLaneBundleMock).not.toHaveBeenCalled();
    expect(createAuditEntryMock).not.toHaveBeenCalled();
  });

  it('transitions validated lanes when completeness threshold is met', async () => {
    const service = createService();
    const existingLane = buildLaneDetail({
      status: 'EVIDENCE_COLLECTING',
      completenessScore: 95,
    });
    const transitionedLane = buildLaneDetail({
      status: 'VALIDATED',
      completenessScore: 95,
      updatedAt: new Date('2026-03-22T05:10:00.000Z'),
    });

    findLaneByIdMock.mockResolvedValue(existingLane);
    transitionLaneStatusMock.mockResolvedValue(transitionedLane);

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus: 'VALIDATED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).resolves.toEqual({ lane: transitionedLane });

    expect(transitionLaneStatusMock).toHaveBeenCalledWith(
      'lane-db-1',
      'VALIDATED',
      expect.any(Date),
    );
    expect(createAuditEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.LANE,
        entityId: 'lane-db-1',
        payloadHash: 'payload-hash',
      }),
    );
    const [firstHashPayload] = hashStringMock.mock.calls[0] as [string];
    expect(firstHashPayload).toContain('"nextStatus":"VALIDATED"');
  });

  it.each([
    {
      name: 'transitions validated lanes to incomplete',
      currentStatus: 'VALIDATED' as const,
      targetStatus: 'INCOMPLETE' as const,
    },
    {
      name: 'transitions incomplete lanes back to evidence collecting',
      currentStatus: 'INCOMPLETE' as const,
      targetStatus: 'EVIDENCE_COLLECTING' as const,
    },
    {
      name: 'transitions packed lanes to closed',
      currentStatus: 'PACKED' as const,
      targetStatus: 'CLOSED' as const,
    },
    {
      name: 'transitions closed lanes to claim defense',
      currentStatus: 'CLOSED' as const,
      targetStatus: 'CLAIM_DEFENSE' as const,
    },
    {
      name: 'transitions claim defense lanes to dispute resolved',
      currentStatus: 'CLAIM_DEFENSE' as const,
      targetStatus: 'DISPUTE_RESOLVED' as const,
    },
  ])('$name', async ({ currentStatus, targetStatus }) => {
    const service = createService();
    const existingLane = buildLaneDetail({
      status: currentStatus,
      completenessScore: 100,
    });
    const transitionedLane = buildLaneDetail({
      status: targetStatus,
      completenessScore: 100,
      updatedAt: new Date('2026-03-22T05:20:00.000Z'),
    });

    findLaneByIdMock.mockResolvedValue(existingLane);
    transitionLaneStatusMock.mockResolvedValue(transitionedLane);

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).resolves.toEqual({ lane: transitionedLane });

    expect(transitionLaneStatusMock).toHaveBeenCalledWith(
      'lane-db-1',
      targetStatus,
      expect.any(Date),
    );
  });

  it('transitions validated lanes to packed when proof packs exist', async () => {
    const service = createService();
    const existingLane = buildLaneDetail({
      status: 'VALIDATED',
      completenessScore: 100,
    });
    const transitionedLane = buildLaneDetail({
      status: 'PACKED',
      completenessScore: 100,
      updatedAt: new Date('2026-03-22T05:25:00.000Z'),
    });

    findLaneByIdMock.mockResolvedValue(existingLane);
    countProofPacksForLaneMock.mockResolvedValue(2);
    transitionLaneStatusMock.mockResolvedValue(transitionedLane);

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus: 'PACKED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).resolves.toEqual({ lane: transitionedLane });

    expect(countProofPacksForLaneMock).toHaveBeenCalledWith('lane-db-1');
  });

  it('transitions closed lanes to archived after retention window passes', async () => {
    const service = createService();
    const existingLane = buildLaneDetail({
      status: 'CLOSED',
      completenessScore: 100,
      statusChangedAt: new Date('2018-03-22T05:00:00.000Z'),
    });
    const transitionedLane = buildLaneDetail({
      status: 'ARCHIVED',
      completenessScore: 100,
      statusChangedAt: new Date('2026-03-22T05:30:00.000Z'),
      updatedAt: new Date('2026-03-22T05:30:00.000Z'),
    });

    findLaneByIdMock.mockResolvedValue(existingLane);
    transitionLaneStatusMock.mockResolvedValue(transitionedLane);

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus: 'ARCHIVED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).resolves.toEqual({ lane: transitionedLane });
  });

  it('rejects validated transition below completeness threshold', async () => {
    const service = createService();

    findLaneByIdMock.mockResolvedValue(
      buildLaneDetail({
        status: 'EVIDENCE_COLLECTING',
        completenessScore: 94,
      }),
    );

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus: 'VALIDATED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toThrow(
      'Lane completeness must be at least 95% before validation.',
    );

    expect(transitionLaneStatusMock).not.toHaveBeenCalled();
    expect(createAuditEntryMock).not.toHaveBeenCalled();
  });

  it('rejects illegal lifecycle jump with conflict exception', async () => {
    const service = createService();

    findLaneByIdMock.mockResolvedValue(
      buildLaneDetail({
        status: 'EVIDENCE_COLLECTING',
        completenessScore: 100,
      }),
    );

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus: 'PACKED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toThrow(
      'Invalid lane transition from EVIDENCE_COLLECTING to PACKED.',
    );

    expect(transitionLaneStatusMock).not.toHaveBeenCalled();
    expect(createAuditEntryMock).not.toHaveBeenCalled();
  });

  it('requires proof packs before packing a lane', async () => {
    const service = createService();

    findLaneByIdMock.mockResolvedValue(
      buildLaneDetail({
        status: 'VALIDATED',
        completenessScore: 100,
      }),
    );
    countProofPacksForLaneMock.mockResolvedValue(0);

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus: 'PACKED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toThrow('At least one proof pack is required before packing.');

    expect(countProofPacksForLaneMock).toHaveBeenCalledWith('lane-db-1');
    expect(transitionLaneStatusMock).not.toHaveBeenCalled();
  });

  it('requires retention window before archiving a closed lane', async () => {
    const service = createService();
    const closedLane = buildLaneDetail({
      status: 'CLOSED',
      completenessScore: 100,
    }) as LaneDetail & {
      statusChangedAt: Date;
    };
    closedLane.statusChangedAt = new Date('2021-03-23T05:00:00.000Z');
    findLaneByIdMock.mockResolvedValue(closedLane);

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus: 'ARCHIVED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toThrow(
      'Lane cannot be archived before the retention period ends.',
    );

    expect(transitionLaneStatusMock).not.toHaveBeenCalled();
  });

  it('rejects exporter transitions for lanes they do not own', async () => {
    const service = createService();

    findLaneByIdMock.mockResolvedValue(
      buildLaneDetail({
        exporterId: 'user-2',
        status: 'EVIDENCE_COLLECTING',
        completenessScore: 100,
      }),
    );

    await expect(
      service.transition(
        'lane-db-1',
        { targetStatus: 'VALIDATED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toThrow('Lane ownership required.');

    expect(transitionLaneStatusMock).not.toHaveBeenCalled();
    expect(createAuditEntryMock).not.toHaveBeenCalled();
  });

  it('reconcileAutomaticTransitions validates evidence-collecting lanes once completeness reaches threshold', async () => {
    const service = createService();
    findLaneByIdMock.mockReset();
    transitionLaneStatusMock.mockReset();
    const collectingLane = buildLaneDetail({
      status: 'EVIDENCE_COLLECTING',
      completenessScore: 97,
    });
    const validatedLane = buildLaneDetail({
      status: 'VALIDATED',
      completenessScore: 97,
      updatedAt: new Date('2026-03-22T05:35:00.000Z'),
    });

    findLaneByIdMock
      .mockResolvedValueOnce(collectingLane)
      .mockResolvedValueOnce(validatedLane);
    transitionLaneStatusMock.mockResolvedValue(validatedLane);

    await expect(
      service.reconcileAutomaticTransitions('lane-db-1', 'user-1'),
    ).resolves.toEqual({ lane: validatedLane, transitions: ['VALIDATED'] });

    expect(transitionLaneStatusMock).toHaveBeenCalledWith(
      'lane-db-1',
      'VALIDATED',
      expect.any(Date),
    );
    expect(createAuditEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.LANE,
        entityId: 'lane-db-1',
      }),
    );
    expect(publishLaneStatusChangedMock).toHaveBeenCalledWith({
      laneId: 'lane-db-1',
      oldStatus: 'EVIDENCE_COLLECTING',
      newStatus: 'VALIDATED',
    });
  });

  it('reconcileAutomaticTransitions moves incomplete lanes back into collecting before validation', async () => {
    const service = createService();
    findLaneByIdMock.mockReset();
    transitionLaneStatusMock.mockReset();
    const incompleteLane = buildLaneDetail({
      status: 'INCOMPLETE',
      completenessScore: 98,
    });
    const collectingLane = buildLaneDetail({
      status: 'EVIDENCE_COLLECTING',
      completenessScore: 98,
      updatedAt: new Date('2026-03-22T05:40:00.000Z'),
    });
    const validatedLane = buildLaneDetail({
      status: 'VALIDATED',
      completenessScore: 98,
      updatedAt: new Date('2026-03-22T05:41:00.000Z'),
    });

    findLaneByIdMock
      .mockResolvedValueOnce(incompleteLane)
      .mockResolvedValueOnce(collectingLane)
      .mockResolvedValueOnce(validatedLane);
    transitionLaneStatusMock
      .mockResolvedValueOnce(collectingLane)
      .mockResolvedValueOnce(validatedLane);

    await expect(
      service.reconcileAutomaticTransitions('lane-db-1', 'user-1'),
    ).resolves.toEqual({
      lane: validatedLane,
      transitions: ['EVIDENCE_COLLECTING', 'VALIDATED'],
    });

    expect(transitionLaneStatusMock).toHaveBeenNthCalledWith(
      1,
      'lane-db-1',
      'EVIDENCE_COLLECTING',
      expect.any(Date),
    );
    expect(transitionLaneStatusMock).toHaveBeenNthCalledWith(
      2,
      'lane-db-1',
      'VALIDATED',
      expect.any(Date),
    );
    expect(createAuditEntryMock).toHaveBeenCalledTimes(2);
    expect(publishLaneStatusChangedMock).toHaveBeenNthCalledWith(1, {
      laneId: 'lane-db-1',
      oldStatus: 'INCOMPLETE',
      newStatus: 'EVIDENCE_COLLECTING',
    });
    expect(publishLaneStatusChangedMock).toHaveBeenNthCalledWith(2, {
      laneId: 'lane-db-1',
      oldStatus: 'EVIDENCE_COLLECTING',
      newStatus: 'VALIDATED',
    });
  });

  it('reconcileAutomaticTransitions is a no-op when no automatic transition applies', async () => {
    const service = createService();
    findLaneByIdMock.mockReset();
    const packedLane = buildLaneDetail({
      status: 'PACKED',
      completenessScore: 100,
    });

    findLaneByIdMock.mockResolvedValue(packedLane);

    await expect(
      service.reconcileAutomaticTransitions('lane-db-1', 'user-1'),
    ).resolves.toEqual({ lane: packedLane, transitions: [] });

    expect(transitionLaneStatusMock).not.toHaveBeenCalled();
    expect(createAuditEntryMock).not.toHaveBeenCalled();
  });

  it('getCheckpoints returns checkpoints for a lane', async () => {
    const service = createService();
    const lane = buildLaneDetail();
    const checkpoints = [
      {
        id: 'cp-1',
        laneId: 'lane-db-1',
        sequence: 1,
        locationName: 'Packing House',
        gpsLat: 13.69,
        gpsLng: 101.08,
        timestamp: null,
        temperature: null,
        signatureHash: null,
        signerName: null,
        conditionNotes: null,
        status: 'PENDING' as const,
      },
    ];

    findLaneByIdMock.mockResolvedValue(lane);
    findCheckpointsForLaneMock.mockResolvedValue(checkpoints);

    await expect(service.getCheckpoints('lane-db-1')).resolves.toEqual(
      checkpoints,
    );

    expect(findLaneByIdMock).toHaveBeenCalledWith('lane-db-1');
    expect(findCheckpointsForLaneMock).toHaveBeenCalledWith('lane-db-1');
  });

  it('getCheckpoints throws NotFoundException for unknown lane', async () => {
    const service = createService();
    findLaneByIdMock.mockResolvedValue(null);

    await expect(service.getCheckpoints('unknown-lane')).rejects.toThrow(
      'Lane not found.',
    );

    expect(findCheckpointsForLaneMock).not.toHaveBeenCalled();
  });

  it('createCheckpoint creates a checkpoint and appends an audit entry', async () => {
    const service = createService();
    const lane = buildLaneDetail();
    const createdCheckpoint = {
      id: 'cp-2',
      laneId: 'lane-db-1',
      sequence: 2,
      locationName: 'Airport Handoff',
      gpsLat: null,
      gpsLng: null,
      timestamp: null,
      temperature: null,
      signatureHash: null,
      signerName: null,
      conditionNotes: null,
      status: 'PENDING' as const,
    };

    findLaneByIdMock.mockResolvedValue(lane);
    createCheckpointMock.mockResolvedValue(createdCheckpoint);

    await expect(
      service.createCheckpoint(
        'lane-db-1',
        {
          sequence: 2,
          locationName: 'Airport Handoff',
        },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).resolves.toEqual(createdCheckpoint);

    expect(createCheckpointMock).toHaveBeenCalledWith('lane-db-1', {
      sequence: 2,
      locationName: 'Airport Handoff',
    });
    expect(createAuditEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.CREATE,
        entityType: AuditEntityType.CHECKPOINT,
        entityId: 'cp-2',
        payloadHash: 'payload-hash',
      }),
    );
    expect(publishCheckpointRecordedMock).toHaveBeenCalledWith({
      laneId: 'lane-db-1',
      checkpointId: 'cp-2',
      sequence: 2,
    });
  });

  it('updateCheckpoint updates and returns checkpoint', async () => {
    const service = createService();
    const lane = buildLaneDetail();
    const updatedCheckpoint = {
      id: 'cp-1',
      laneId: 'lane-db-1',
      sequence: 1,
      locationName: 'Packing House',
      gpsLat: 13.69,
      gpsLng: 101.08,
      timestamp: new Date('2026-03-22T06:00:00.000Z'),
      temperature: 12.5,
      signatureHash: null,
      signerName: null,
      conditionNotes: 'Good condition',
      status: 'COMPLETED' as const,
    };

    findLaneByIdMock.mockResolvedValue(lane);
    updateCheckpointMock.mockResolvedValue(updatedCheckpoint);

    await expect(
      service.updateCheckpoint(
        'lane-db-1',
        'cp-1',
        {
          status: 'COMPLETED',
          temperature: 12.5,
          conditionNotes: 'Good condition',
        },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).resolves.toEqual(updatedCheckpoint);

    expect(updateCheckpointMock).toHaveBeenCalledWith('lane-db-1', 'cp-1', {
      status: 'COMPLETED',
      temperature: 12.5,
      conditionNotes: 'Good condition',
    });
    expect(publishCheckpointRecordedMock).toHaveBeenCalledWith({
      laneId: 'lane-db-1',
      checkpointId: 'cp-1',
      sequence: 1,
    });
  });

  it('updateCheckpoint throws NotFoundException for unknown lane', async () => {
    const service = createService();
    findLaneByIdMock.mockResolvedValue(null);

    await expect(
      service.updateCheckpoint(
        'unknown-lane',
        'cp-1',
        { status: 'COMPLETED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toThrow('Lane not found.');

    expect(updateCheckpointMock).not.toHaveBeenCalled();
  });

  it('updateCheckpoint throws NotFoundException for unknown checkpoint', async () => {
    const service = createService();
    const lane = buildLaneDetail();

    findLaneByIdMock.mockResolvedValue(lane);
    updateCheckpointMock.mockResolvedValue(null);

    await expect(
      service.updateCheckpoint(
        'lane-db-1',
        'unknown-cp',
        { status: 'COMPLETED' },
        {
          id: 'user-1',
          role: 'EXPORTER',
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toThrow('Checkpoint not found.');
  });

  it('updateCheckpoint creates audit entry', async () => {
    const service = createService();
    const lane = buildLaneDetail();
    const updatedCheckpoint = {
      id: 'cp-1',
      laneId: 'lane-db-1',
      sequence: 1,
      locationName: 'Packing House',
      gpsLat: null,
      gpsLng: null,
      timestamp: null,
      temperature: 11.0,
      signatureHash: null,
      signerName: null,
      conditionNotes: null,
      status: 'COMPLETED' as const,
    };

    findLaneByIdMock.mockResolvedValue(lane);
    updateCheckpointMock.mockResolvedValue(updatedCheckpoint);

    await service.updateCheckpoint(
      'lane-db-1',
      'cp-1',
      { status: 'COMPLETED', temperature: 11.0 },
      {
        id: 'user-1',
        role: 'EXPORTER',
        email: 'exporter@example.com',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(createAuditEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.CHECKPOINT,
        entityId: 'cp-1',
        payloadHash: 'payload-hash',
      }),
    );
  });

  it('updateCheckpoint hashes the full checkpoint snapshot', async () => {
    const service = createService();
    const lane = buildLaneDetail();
    const updatedCheckpoint = {
      id: 'cp-1',
      laneId: 'lane-db-1',
      sequence: 1,
      locationName: 'Packing House',
      gpsLat: 13.6904,
      gpsLng: 101.0779,
      timestamp: new Date('2026-03-22T06:00:00.000Z'),
      temperature: 3.2,
      signatureHash:
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      signerName: 'Somchai',
      conditionNotes: 'Seal intact',
      status: 'COMPLETED' as const,
    };

    findLaneByIdMock.mockResolvedValue(lane);
    updateCheckpointMock.mockResolvedValue(updatedCheckpoint);

    await service.updateCheckpoint(
      'lane-db-1',
      'cp-1',
      {
        status: 'COMPLETED',
        temperature: 3.2,
        gpsLat: 13.6904,
        gpsLng: 101.0779,
        signatureHash:
          'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        signerName: 'Somchai',
        conditionNotes: 'Seal intact',
      },
      {
        id: 'user-1',
        role: 'EXPORTER',
        email: 'exporter@example.com',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(hashStringMock).toHaveBeenCalledWith(
      JSON.stringify({
        laneId: 'LN-2026-002',
        checkpoint: updatedCheckpoint,
      }),
    );
  });
});

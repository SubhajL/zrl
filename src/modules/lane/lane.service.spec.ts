import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import { HashingService } from '../../common/hashing/hashing.service';
import { AuditService } from '../../common/audit/audit.service';
import { LaneService } from './lane.service';
import type {
  CreateLaneInput,
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
  const updateLaneBundleMock = jest.fn();
  const laneStore: LaneStore = {
    runInTransaction: runInTransactionMock as LaneStore['runInTransaction'],
    findLatestLaneIdByYear:
      findLatestLaneIdByYearMock as LaneStore['findLatestLaneIdByYear'],
    findLatestBatchIdByPrefix:
      findLatestBatchIdByPrefixMock as LaneStore['findLatestBatchIdByPrefix'],
    createLaneBundle: createLaneBundleMock as LaneStore['createLaneBundle'],
    findLanes: findLanesMock as LaneStore['findLanes'],
    findLaneById: findLaneByIdMock as LaneStore['findLaneById'],
    updateLaneBundle: updateLaneBundleMock as LaneStore['updateLaneBundle'],
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
  const hashingService = {
    hashString: jest.fn().mockResolvedValue('payload-hash'),
  } as unknown as HashingService;
  const auditService = {
    createEntry: createAuditEntryMock,
  } as unknown as AuditService;
  const resolveRuleSnapshotMock = jest.fn();
  const ruleSnapshotResolver = {
    resolve: resolveRuleSnapshotMock,
  } as unknown as LaneRuleSnapshotResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-22T05:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a lane with generated lane and batch ids', async () => {
    const service = new LaneService(
      laneStore,
      hashingService,
      auditService,
      ruleSnapshotResolver,
    );
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
    const service = new LaneService(
      laneStore,
      hashingService,
      auditService,
      ruleSnapshotResolver,
    );
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

  it('returns lane detail from the store', async () => {
    const service = new LaneService(
      laneStore,
      hashingService,
      auditService,
      ruleSnapshotResolver,
    );
    const lane = buildLaneDetail();
    findLaneByIdMock.mockResolvedValue(lane);

    await expect(service.findById('lane-db-1')).resolves.toEqual({ lane });
  });

  it('updates a lane bundle and appends an audit entry', async () => {
    const service = new LaneService(
      laneStore,
      hashingService,
      auditService,
      ruleSnapshotResolver,
    );
    const updateInput: UpdateLaneInput = {
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
    const service = new LaneService(
      laneStore,
      hashingService,
      auditService,
      ruleSnapshotResolver,
    );
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
});

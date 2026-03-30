/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import type { DisputeStore, DisputeRecord } from './dispute.types';

describe('DisputeService', () => {
  const baseDispute: DisputeRecord = {
    id: 'dispute-1',
    laneId: 'lane-db-1',
    type: 'QUALITY_CLAIM',
    description: 'Fruit arrived damaged',
    claimant: 'Importer Co',
    status: 'OPEN',
    financialImpact: 50000,
    resolutionNotes: null,
    defensePackId: null,
    createdAt: new Date('2026-03-29T10:00:00.000Z'),
    updatedAt: new Date('2026-03-29T10:00:00.000Z'),
    resolvedAt: null,
  };

  const baseLane = {
    id: 'lane-db-1',
    laneId: 'LN-2026-001',
    exporterId: 'user-1',
    status: 'CLOSED' as const,
    productType: 'MANGO' as const,
    destinationMarket: 'JAPAN' as const,
    completenessScore: 100,
    coldChainMode: null,
    coldChainDeviceId: null,
    coldChainDataFrequencySeconds: null,
    statusChangedAt: new Date('2026-03-29T10:00:00.000Z'),
    createdAt: new Date('2026-03-29T10:00:00.000Z'),
    updatedAt: new Date('2026-03-29T10:00:00.000Z'),
    batch: {
      id: 'batch-1',
      laneId: 'lane-db-1',
      batchId: 'MNG-JPN-20260315-001',
      product: 'MANGO' as const,
      variety: 'Nam Dok Mai',
      quantityKg: 1000,
      originProvince: 'Chachoengsao',
      harvestDate: new Date('2026-03-15'),
      grade: 'PREMIUM' as const,
    },
    route: {
      id: 'route-1',
      laneId: 'lane-db-1',
      transportMode: 'AIR' as const,
      carrier: 'Thai Airways',
      originGps: null,
      destinationGps: null,
      estimatedTransitHours: 6,
    },
    checkpoints: [
      {
        id: 'cp-1',
        laneId: 'lane-db-1',
        sequence: 1,
        locationName: 'Farm Pickup',
        gpsLat: null,
        gpsLng: null,
        timestamp: new Date('2026-03-29T08:00:00.000Z'),
        temperature: 12,
        signatureHash: null,
        signerName: 'Farmer A',
        conditionNotes: null,
        status: 'COMPLETED' as const,
      },
    ],
    ruleSnapshot: null,
  };

  function createStoreMock(): jest.Mocked<DisputeStore> {
    return {
      createDispute: jest.fn().mockResolvedValue(baseDispute),
      findDisputeById: jest.fn().mockResolvedValue(baseDispute),
      findDisputesForLane: jest.fn().mockResolvedValue([baseDispute]),
      updateDispute: jest.fn().mockResolvedValue(baseDispute),
      linkDefensePack: jest.fn().mockResolvedValue(baseDispute),
      countDisputesForLane: jest.fn().mockResolvedValue(1),
      countExcursionsForLane: jest.fn().mockResolvedValue(0),
    };
  }

  function createLaneServiceMock() {
    return {
      findById: jest.fn().mockResolvedValue({ lane: baseLane }),
      transition: jest
        .fn()
        .mockResolvedValue({ lane: { ...baseLane, status: 'CLAIM_DEFENSE' } }),
      getCheckpoints: jest.fn().mockResolvedValue(baseLane.checkpoints),
      getCompleteness: jest.fn().mockResolvedValue({
        score: 100,
        checklist: [],
        labValidation: null,
      }),
    };
  }

  function createProofPackServiceMock() {
    return {
      generatePack: jest.fn().mockResolvedValue({
        id: 'pack-1',
        laneId: 'lane-db-1',
        packType: 'DEFENSE',
        version: 1,
        status: 'GENERATING',
        contentHash: null,
        filePath: null,
        errorMessage: null,
        generatedAt: new Date(),
        generatedBy: 'user-1',
        recipient: null,
      }),
    };
  }

  function createAuditServiceMock() {
    return {
      createEntry: jest.fn().mockResolvedValue({
        id: 'audit-1',
        timestamp: new Date(),
        actor: 'user-1',
        action: 'CREATE',
        entityType: 'LANE',
        entityId: 'lane-db-1',
        payloadHash: 'abc',
        prevHash: 'def',
        entryHash: 'ghi',
      }),
      getEntriesForLane: jest.fn().mockResolvedValue([
        {
          id: 'audit-1',
          timestamp: new Date('2026-03-29T10:00:00.000Z'),
          actor: 'user-1',
          action: 'CREATE',
          entityType: 'LANE',
          entityId: 'lane-db-1',
          payloadHash: 'abc',
          prevHash: 'def',
          entryHash: 'ghi',
        },
      ]),
    };
  }

  function createHashingServiceMock() {
    return {
      hashString: jest.fn().mockResolvedValue('hash-abc'),
    };
  }

  function buildService(overrides?: {
    store?: jest.Mocked<DisputeStore>;
    laneService?: ReturnType<typeof createLaneServiceMock>;
    proofPackService?: ReturnType<typeof createProofPackServiceMock>;
    auditService?: ReturnType<typeof createAuditServiceMock>;
    hashingService?: ReturnType<typeof createHashingServiceMock>;
  }) {
    const store = overrides?.store ?? createStoreMock();
    const laneService = overrides?.laneService ?? createLaneServiceMock();
    const proofPackService =
      overrides?.proofPackService ?? createProofPackServiceMock();
    const auditService = overrides?.auditService ?? createAuditServiceMock();
    const hashingService =
      overrides?.hashingService ?? createHashingServiceMock();

    return new DisputeService(
      store as never,
      laneService as never,
      proofPackService as never,
      auditService as never,
      hashingService as never,
    );
  }

  const actor = { id: 'user-1', role: 'EXPORTER' };

  it('creates dispute and transitions lane to CLAIM_DEFENSE', async () => {
    const store = createStoreMock();
    const laneService = createLaneServiceMock();
    const auditService = createAuditServiceMock();
    const service = buildService({ store, laneService, auditService });

    const result = await service.createDispute(
      'lane-db-1',
      {
        type: 'QUALITY_CLAIM',
        description: 'Fruit arrived damaged',
        claimant: 'Importer Co',
        financialImpact: 50000,
      },
      actor,
    );

    expect(result.id).toBe('dispute-1');
    expect(store.createDispute).toHaveBeenCalledWith('lane-db-1', {
      type: 'QUALITY_CLAIM',
      description: 'Fruit arrived damaged',
      claimant: 'Importer Co',
      financialImpact: 50000,
    });
    expect(laneService.transition).toHaveBeenCalledWith(
      'lane-db-1',
      { targetStatus: 'CLAIM_DEFENSE' },
      { id: 'user-1', role: 'EXPORTER' },
    );
    expect(auditService.createEntry).toHaveBeenCalled();
  });

  it('rejects dispute creation for non-existing lane', async () => {
    const laneService = createLaneServiceMock();
    laneService.findById.mockRejectedValue(
      new NotFoundException('Lane not found.'),
    );
    const service = buildService({ laneService });

    await expect(
      service.createDispute(
        'non-existent',
        {
          type: 'QUALITY_CLAIM',
          description: 'Test',
          claimant: 'Test Co',
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('generates defense pack with template data', async () => {
    const store = createStoreMock();
    const laneService = createLaneServiceMock();
    const proofPackService = createProofPackServiceMock();
    const auditService = createAuditServiceMock();
    const service = buildService({
      store,
      laneService,
      proofPackService,
      auditService,
    });

    const result = await service.generateDefensePack('dispute-1', actor);

    expect(result).toBeDefined();
    expect(proofPackService.generatePack).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: 'lane-db-1',
        packType: 'DEFENSE',
        generatedBy: 'user-1',
      }),
      expect.objectContaining({
        laneId: 'LN-2026-001',
        packType: 'DEFENSE',
        product: 'MANGO',
        market: 'JAPAN',
      }),
    );
    expect(store.linkDefensePack).toHaveBeenCalledWith('dispute-1', 'pack-1');
  });

  it('updates dispute status with audit entry', async () => {
    const store = createStoreMock();
    const auditService = createAuditServiceMock();
    const updatedDispute = { ...baseDispute, status: 'INVESTIGATING' as const };
    store.updateDispute.mockResolvedValue(updatedDispute);
    const service = buildService({ store, auditService });

    const result = await service.updateDispute(
      'dispute-1',
      { status: 'INVESTIGATING' },
      actor,
    );

    expect(result.status).toBe('INVESTIGATING');
    expect(auditService.createEntry).toHaveBeenCalled();
    expect(store.updateDispute).toHaveBeenCalledWith('dispute-1', {
      status: 'INVESTIGATING',
    });
  });

  it('throws NotFoundException when updating non-existent dispute', async () => {
    const store = createStoreMock();
    store.updateDispute.mockResolvedValue(null);
    const service = buildService({ store });

    await expect(
      service.updateDispute('non-existent', { status: 'INVESTIGATING' }),
    ).rejects.toThrow(NotFoundException);
  });
});

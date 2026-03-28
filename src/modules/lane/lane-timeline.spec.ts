import { NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import type { AuditService } from '../../common/audit/audit.service';
import type { HashingService } from '../../common/hashing/hashing.service';
import type { ColdChainService } from '../cold-chain/cold-chain.service';
import type { ProofPackService } from '../evidence/proof-pack.service';
import type { RealtimeEventsService } from '../notifications/realtime-events.service';
import type { RulesEngineService } from '../rules-engine/rules-engine.service';
import { LaneService } from './lane.service';
import type { LaneRuleSnapshotResolver, LaneStore } from './lane.types';

describe('LaneService.getTimeline', () => {
  const findLaneByIdMock = jest.fn();
  const getEntriesForLaneMock = jest.fn();

  const laneStore = {
    findLaneById: findLaneByIdMock,
    runInTransaction: jest.fn(),
    findLatestLaneIdByYear: jest.fn(),
    findLatestBatchIdByPrefix: jest.fn(),
    createLaneBundle: jest.fn(),
    findLanes: jest.fn(),
    updateLaneBundle: jest.fn(),
    transitionLaneStatus: jest.fn(),
    countProofPacksForLane: jest.fn(),
    listEvidenceArtifactsForLane: jest.fn(),
    findCheckpointsForLane: jest.fn(),
    findCheckpointById: jest.fn(),
    createCheckpoint: jest.fn(),
    updateCheckpoint: jest.fn(),
  } as unknown as LaneStore;

  const auditService = {
    createEntry: jest.fn().mockResolvedValue({
      id: 'ae-1',
      timestamp: new Date(),
      actor: 'system',
      action: AuditAction.CREATE,
      entityType: AuditEntityType.LANE,
      entityId: 'lane-1',
      payloadHash: 'ph',
      prevHash: 'prev',
      entryHash: 'eh',
    }),
    getEntriesForLane: getEntriesForLaneMock,
  } as unknown as AuditService;

  const hashingService = {
    hashString: jest.fn().mockResolvedValue('hash'),
  } as unknown as HashingService;
  const getPackByIdMock = jest.fn();
  const proofPackService = {
    getPackById: getPackByIdMock,
  } as unknown as ProofPackService;
  const realtimeEvents = {
    publishLaneStatusChanged: jest.fn(),
    publishCheckpointRecorded: jest.fn(),
  } as unknown as Pick<
    RealtimeEventsService,
    'publishLaneStatusChanged' | 'publishCheckpointRecorded'
  >;

  const service = new LaneService(
    laneStore,
    hashingService,
    auditService,
    { resolve: jest.fn() } as unknown as LaneRuleSnapshotResolver,
    {
      validateLaneConfiguration: jest.fn(),
    } as unknown as ColdChainService,
    { evaluateLane: jest.fn() } as unknown as RulesEngineService,
    proofPackService,
    realtimeEvents as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns mapped timeline events', async () => {
    findLaneByIdMock.mockResolvedValueOnce({
      id: 'lane-1',
      laneId: 'LN-2026-001',
      status: 'PACKED',
      completenessScore: 100,
      productType: 'DURIAN',
      destinationMarket: 'CHINA',
      statusChangedAt: new Date('2026-03-20T07:00:00Z'),
      checkpoints: [
        {
          id: 'cp-1',
          sequence: 1,
          locationName: 'Packing House',
          status: 'OVERDUE',
          timestamp: new Date('2026-03-20T09:30:00Z'),
          temperature: 20,
          signerName: 'Changed Signer',
          conditionNotes: 'Current state should not leak',
        },
      ],
    });
    (laneStore.listEvidenceArtifactsForLane as jest.Mock).mockResolvedValueOnce(
      [
        {
          id: 'art-1',
          artifactType: 'CHECKPOINT_PHOTO',
          fileName: 'checkpoint.jpg',
          metadata: { gpsLat: 13.6904 },
        },
      ],
    );
    getEntriesForLaneMock.mockResolvedValueOnce([
      {
        id: 'audit-1',
        timestamp: new Date('2026-03-18T08:00:00Z'),
        actor: 'user-1',
        action: AuditAction.CREATE,
        entityType: AuditEntityType.LANE,
        entityId: 'lane-1',
        payloadHash: 'ph1',
        payloadSnapshot: {
          kind: 'lane',
          status: 'EVIDENCE_COLLECTING',
          completenessScore: 88,
          productType: 'MANGO',
          destinationMarket: 'JAPAN',
          statusChangedAt: '2026-03-18T07:00:00.000Z',
        },
        prevHash: 'genesis',
        entryHash: 'eh1',
      },
      {
        id: 'audit-2',
        timestamp: new Date('2026-03-19T09:35:00Z'),
        actor: 'user-1',
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.CHECKPOINT,
        entityId: 'cp-1',
        payloadHash: 'ph-cp',
        payloadSnapshot: {
          kind: 'checkpoint',
          sequence: 1,
          locationName: 'Packing House',
          status: 'COMPLETED',
          timestamp: '2026-03-19T09:30:00.000Z',
          temperature: 12.5,
          signerName: 'Somchai',
          conditionNotes: 'Seal intact',
        },
        prevHash: 'eh1',
        entryHash: 'eh-cp',
      },
      {
        id: 'audit-3',
        timestamp: new Date('2026-03-19T10:00:00Z'),
        actor: 'user-1',
        action: AuditAction.UPLOAD,
        entityType: AuditEntityType.ARTIFACT,
        entityId: 'art-1',
        payloadHash: 'ph2',
        payloadSnapshot: {
          kind: 'artifact',
          artifactType: 'CHECKPOINT_PHOTO',
          fileName: 'checkpoint.jpg',
          metadata: { gpsLat: 13.6904 },
        },
        prevHash: 'eh-cp',
        entryHash: 'eh2',
      },
      {
        id: 'audit-4',
        timestamp: new Date('2026-03-19T11:00:00Z'),
        actor: 'user-1',
        action: AuditAction.GENERATE,
        entityType: AuditEntityType.PROOF_PACK,
        entityId: 'pack-1',
        payloadHash: 'ph-pack',
        payloadSnapshot: {
          kind: 'proofPack',
          packType: 'REGULATOR',
          version: 2,
          status: 'READY',
          contentHash:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          generatedAt: '2026-03-19T11:00:00.000Z',
          errorMessage: null,
        },
        prevHash: 'eh2',
        entryHash: 'eh-pack',
      },
    ]);

    const events = await service.getTimeline('lane-1');

    expect(events).toHaveLength(4);
    expect(events[0].action).toBe(AuditAction.CREATE);
    expect(events[0].description).toContain('Created');
    expect(events[0].description).toContain('lane');
    expect(events[0].metadata).toEqual({
      kind: 'lane',
      status: 'EVIDENCE_COLLECTING',
      completenessScore: 88,
      productType: 'MANGO',
      destinationMarket: 'JAPAN',
      statusChangedAt: new Date('2026-03-18T07:00:00Z'),
    });
    expect(events[1].metadata).toEqual({
      kind: 'checkpoint',
      sequence: 1,
      locationName: 'Packing House',
      status: 'COMPLETED',
      timestamp: new Date('2026-03-19T09:30:00Z'),
      temperature: 12.5,
      signerName: 'Somchai',
      conditionNotes: 'Seal intact',
    });
    expect(events[2].action).toBe(AuditAction.UPLOAD);
    expect(events[2].description).toContain('Uploaded');
    expect(events[2].description).toContain('evidence artifact');
    expect(events[2].metadata).toEqual({
      kind: 'artifact',
      artifactType: 'CHECKPOINT_PHOTO',
      fileName: 'checkpoint.jpg',
      metadata: { gpsLat: 13.6904 },
    });
    expect(events[3].metadata).toEqual({
      kind: 'proofPack',
      packType: 'REGULATOR',
      version: 2,
      status: 'READY',
      contentHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      generatedAt: new Date('2026-03-19T11:00:00Z'),
      errorMessage: null,
    });
    expect(getPackByIdMock).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for unknown lane', async () => {
    findLaneByIdMock.mockResolvedValueOnce(null);

    await expect(service.getTimeline('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns empty array when no audit entries exist', async () => {
    findLaneByIdMock.mockResolvedValueOnce({
      id: 'lane-1',
      laneId: 'LN-2026-001',
    });
    getEntriesForLaneMock.mockResolvedValueOnce([]);

    const events = await service.getTimeline('lane-1');

    expect(events).toHaveLength(0);
  });
});

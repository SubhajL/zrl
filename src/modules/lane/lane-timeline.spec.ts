import { NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import type { AuditService } from '../../common/audit/audit.service';
import type { HashingService } from '../../common/hashing/hashing.service';
import type { ColdChainService } from '../cold-chain/cold-chain.service';
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

  const service = new LaneService(
    laneStore,
    hashingService,
    auditService,
    { resolve: jest.fn() } as unknown as LaneRuleSnapshotResolver,
    {
      validateLaneConfiguration: jest.fn(),
    } as unknown as ColdChainService,
    { evaluateLane: jest.fn() } as unknown as RulesEngineService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns mapped timeline events sorted by timestamp', async () => {
    findLaneByIdMock.mockResolvedValueOnce({
      id: 'lane-1',
      laneId: 'LN-2026-001',
      status: 'EVIDENCE_COLLECTING',
    });
    getEntriesForLaneMock.mockResolvedValueOnce([
      {
        id: 'audit-1',
        timestamp: new Date('2026-03-18T08:00:00Z'),
        actor: 'user-1',
        action: AuditAction.CREATE,
        entityType: AuditEntityType.LANE,
        entityId: 'lane-1',
        payloadHash: 'ph1',
        prevHash: 'genesis',
        entryHash: 'eh1',
      },
      {
        id: 'audit-2',
        timestamp: new Date('2026-03-19T10:00:00Z'),
        actor: 'user-1',
        action: AuditAction.UPLOAD,
        entityType: AuditEntityType.ARTIFACT,
        entityId: 'art-1',
        payloadHash: 'ph2',
        prevHash: 'eh1',
        entryHash: 'eh2',
      },
    ]);

    const events = await service.getTimeline('lane-1');

    expect(events).toHaveLength(2);
    expect(events[0].action).toBe(AuditAction.CREATE);
    expect(events[0].description).toContain('Created');
    expect(events[0].description).toContain('lane');
    expect(events[1].action).toBe(AuditAction.UPLOAD);
    expect(events[1].description).toContain('Uploaded');
    expect(events[1].description).toContain('evidence artifact');
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

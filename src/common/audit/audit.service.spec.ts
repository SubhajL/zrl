import { HashingService } from '../hashing/hashing.service';
import { getGenesisHash } from '../hashing/hashing.utils';
import { AuditService } from './audit.service';
import type {
  AuditEntryFilters,
  AuditEntryRecord,
  AuditStore,
  CreateAuditEntryInput,
} from './audit.types';
import { AuditAction, AuditEntityType } from './audit.types';

function buildEntry(
  overrides: Partial<AuditEntryRecord> = {},
): AuditEntryRecord {
  return {
    id: overrides.id ?? 'audit-1',
    timestamp: overrides.timestamp ?? new Date('2026-03-16T07:00:00.000Z'),
    actor: overrides.actor ?? 'actor-1',
    action: overrides.action ?? AuditAction.CREATE,
    entityType: overrides.entityType ?? AuditEntityType.LANE,
    entityId: overrides.entityId ?? 'lane-1',
    payloadHash:
      overrides.payloadHash ??
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    prevHash:
      overrides.prevHash ??
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    entryHash:
      overrides.entryHash ??
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  };
}

class MockAuditStore implements AuditStore {
  lockStream = jest.fn<Promise<void>, [string]>();
  resolveStreamId = jest.fn<Promise<string | null>, [string, string]>();
  findLatestForStream = jest.fn<Promise<AuditEntryRecord | null>, [string]>();
  createEntry = jest.fn<Promise<AuditEntryRecord>, [AuditEntryRecord]>();
  findEntriesForLane = jest.fn<
    Promise<AuditEntryRecord[]>,
    [string, AuditEntryFilters | undefined]
  >();
  findEntriesForEntity = jest.fn<
    Promise<AuditEntryRecord[]>,
    [string, string]
  >();

  async runInTransaction<T>(
    operation: (store: AuditStore) => Promise<T>,
  ): Promise<T> {
    return await operation(this);
  }
}

describe('AuditService', () => {
  let hashingService: HashingService;
  let store: MockAuditStore;
  let service: AuditService;

  beforeEach(() => {
    hashingService = new HashingService();
    store = new MockAuditStore();
    service = new AuditService(hashingService, store);
  });

  it('createEntry uses the genesis hash for the first lane entry', async () => {
    const timestamp = new Date('2026-03-16T07:00:00.000Z');
    const input: CreateAuditEntryInput = {
      actor: 'actor-1',
      action: AuditAction.CREATE,
      entityType: AuditEntityType.LANE,
      entityId: 'lane-1',
      payloadHash:
        '1111111111111111111111111111111111111111111111111111111111111111',
      timestamp,
    };

    store.resolveStreamId.mockResolvedValue('lane-1');
    store.findLatestForStream.mockResolvedValue(null);
    store.createEntry.mockImplementation((entry) =>
      Promise.resolve({
        ...entry,
        id: 'audit-1',
      }),
    );

    const created = await service.createEntry(input);

    expect(store.resolveStreamId).toHaveBeenCalledWith('LANE', 'lane-1');
    expect(store.lockStream).toHaveBeenCalledWith('lane-1');
    expect(store.findLatestForStream).toHaveBeenCalledWith('lane-1');
    expect(created.prevHash).toBe(getGenesisHash());
    expect(created.entryHash).toBe(
      hashingService.computeEntryHash({
        timestamp,
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        payloadHash: input.payloadHash,
        prevHash: created.prevHash,
      }),
    );
  });

  it('createEntry chains from the prior lane entry hash', async () => {
    const latest = buildEntry({
      id: 'audit-1',
      entryHash:
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    });

    store.resolveStreamId.mockResolvedValue('lane-1');
    store.findLatestForStream.mockResolvedValue(latest);
    store.createEntry.mockImplementation((entry) =>
      Promise.resolve({
        ...entry,
        id: 'audit-2',
      }),
    );

    const created = await service.createEntry({
      actor: 'actor-2',
      action: AuditAction.SIGN,
      entityType: AuditEntityType.CHECKPOINT,
      entityId: 'checkpoint-1',
      payloadHash:
        '2222222222222222222222222222222222222222222222222222222222222222',
      timestamp: new Date('2026-03-16T08:00:00.000Z'),
    });

    expect(store.lockStream).toHaveBeenCalledWith('lane-1');
    expect(created.prevHash).toBe(latest.entryHash);
  });

  it('createEntry throws when the entity cannot resolve to an audit stream', async () => {
    store.resolveStreamId.mockResolvedValue(null);

    await expect(
      service.createEntry({
        actor: 'actor-1',
        action: AuditAction.UPLOAD,
        entityType: AuditEntityType.ARTIFACT,
        entityId: 'artifact-1',
        payloadHash:
          '3333333333333333333333333333333333333333333333333333333333333333',
      }),
    ).rejects.toThrow('Unable to resolve audit stream for audit entry.');
  });

  it('createEntry chains rule changes in the global rules stream', async () => {
    const latest = buildEntry({
      id: 'audit-rules-1',
      entityType: AuditEntityType.RULE_SET,
      entityId: 'rule-set-1',
      entryHash:
        'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    });

    store.resolveStreamId.mockResolvedValue('GLOBAL_RULES_STREAM');
    store.findLatestForStream.mockResolvedValue(latest);
    store.createEntry.mockImplementation((entry) =>
      Promise.resolve({
        ...entry,
        id: 'audit-rules-2',
      }),
    );

    const created = await service.createEntry({
      actor: 'admin-1',
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.SUBSTANCE,
      entityId: 'substance-1',
      payloadHash:
        '6666666666666666666666666666666666666666666666666666666666666666',
      timestamp: new Date('2026-03-16T09:00:00.000Z'),
    });

    expect(store.lockStream).toHaveBeenCalledWith('GLOBAL_RULES_STREAM');
    expect(created.prevHash).toBe(latest.entryHash);
  });

  it('getEntriesForLane applies action, actor, and date filters', async () => {
    const filters: AuditEntryFilters = {
      action: AuditAction.VERIFY,
      actor: 'actor-1',
      from: new Date('2026-03-16T00:00:00.000Z'),
      to: new Date('2026-03-17T00:00:00.000Z'),
      page: 2,
      pageSize: 10,
    };

    store.findEntriesForLane.mockResolvedValue([buildEntry()]);

    const entries = await service.getEntriesForLane('lane-1', filters);

    expect(entries).toHaveLength(1);
    expect(store.findEntriesForLane).toHaveBeenCalledWith('lane-1', filters);
  });

  it('verifyChainForLane returns the first invalid entry id', async () => {
    const valid = buildEntry({
      id: 'audit-1',
      timestamp: new Date('2026-03-16T07:00:00.000Z'),
      actor: 'actor-1',
      action: AuditAction.CREATE,
      entityType: AuditEntityType.LANE,
      entityId: 'lane-1',
      payloadHash:
        '4444444444444444444444444444444444444444444444444444444444444444',
      prevHash: getGenesisHash(),
    });
    valid.entryHash = hashingService.computeEntryHash({
      timestamp: valid.timestamp,
      actor: valid.actor,
      action: valid.action,
      entityType: valid.entityType,
      entityId: valid.entityId,
      payloadHash: valid.payloadHash,
      prevHash: valid.prevHash,
    });
    const tampered = {
      ...valid,
      id: 'audit-2',
      timestamp: new Date('2026-03-16T08:00:00.000Z'),
      prevHash: valid.entryHash,
      entryHash:
        '5555555555555555555555555555555555555555555555555555555555555555',
    };

    store.findEntriesForLane.mockResolvedValue([valid, tampered]);

    const result = await service.verifyChainForLane('lane-1');

    expect(result).toEqual({
      valid: false,
      entriesChecked: 2,
      firstInvalidIndex: 1,
      firstInvalidEntryId: 'audit-2',
    });
  });

  it('exportForLane returns export metadata and entries', async () => {
    const entry = buildEntry();
    store.findEntriesForLane.mockResolvedValue([entry]);

    const exported = await service.exportForLane('lane-1');

    expect(exported.laneId).toBe('lane-1');
    expect(exported.entriesCount).toBe(1);
    expect(exported.entries[0]).toMatchObject({
      id: entry.id,
      actor: entry.actor,
      timestamp: entry.timestamp.toISOString(),
    });
  });

  it('throws when no audit store is configured', async () => {
    const serviceWithoutStore = new AuditService(hashingService);

    await expect(
      serviceWithoutStore.getEntriesForLane('lane-1'),
    ).rejects.toThrow('Audit store is not configured.');
  });
});

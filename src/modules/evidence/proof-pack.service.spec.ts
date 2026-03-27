import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import type { HashingService } from '../../common/hashing/hashing.service';
import { ProofPackService } from './proof-pack.service';
import type {
  ClaimedProofPackJob,
  ProofPackJobRecord,
  ProofPackRecord,
  ProofPackStore,
  ProofPackTemplateData,
} from './proof-pack.types';

jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('puppeteer-core', () => {
  throw new Error('puppeteer-core not available');
});

const mockedReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const actualNodeFs = jest.requireActual<typeof import('node:fs')>('node:fs');
const actualReadFileSync = actualNodeFs.readFileSync;

function buildTemplateData(
  overrides: Partial<ProofPackTemplateData> = {},
): ProofPackTemplateData {
  return {
    laneId: 'LN-2026-001',
    batchId: 'BATCH-001',
    product: 'MANGO',
    market: 'JAPAN',
    variety: 'Nam Dok Mai',
    quantity: 500,
    grade: 'PREMIUM',
    origin: 'Chiang Mai',
    harvestDate: '2026-03-15',
    transportMode: 'AIR',
    carrier: 'Thai Airways',
    completeness: 95,
    status: 'VALIDATED',
    checklistItems: [
      {
        label: 'Phytosanitary Certificate',
        category: 'REGULATORY',
        status: 'PRESENT',
      },
      { label: 'MRL Lab Report', category: 'QUALITY', status: 'PRESENT' },
    ],
    labResults: [
      {
        substance: 'Chlorpyrifos',
        thaiMrl: 0.5,
        destinationMrl: 0.01,
        measuredValue: 0.005,
        status: 'PASS',
      },
    ],
    checkpoints: [
      {
        sequence: 1,
        location: 'Packhouse',
        status: 'COMPLETED',
        timestamp: '2026-03-16T08:00:00.000Z',
        temperature: 12,
        signer: 'Inspector A',
      },
    ],
    generatedAt: '2026-03-16T10:00:00.000Z',
    packType: 'REGULATOR',
    ...overrides,
  };
}

function buildPackRecord(
  overrides: Partial<ProofPackRecord> = {},
): ProofPackRecord {
  return {
    id: 'pack-1',
    laneId: 'lane-1',
    packType: 'REGULATOR',
    version: 1,
    status: 'GENERATING',
    contentHash: null,
    filePath: null,
    errorMessage: null,
    generatedAt: new Date('2026-03-16T10:00:00.000Z'),
    generatedBy: 'user-1',
    recipient: null,
    ...overrides,
  };
}

function buildJobRecord(
  overrides: Partial<ProofPackJobRecord> = {},
): ProofPackJobRecord {
  return {
    id: 'job-1',
    proofPackId: 'pack-1',
    status: 'PROCESSING',
    payload: buildTemplateData(),
    attemptCount: 1,
    lastError: null,
    availableAt: new Date('2026-03-16T10:00:00.000Z'),
    leasedAt: new Date('2026-03-16T10:00:05.000Z'),
    leaseExpiresAt: new Date('2026-03-16T10:01:05.000Z'),
    completedAt: null,
    createdAt: new Date('2026-03-16T10:00:00.000Z'),
    updatedAt: new Date('2026-03-16T10:00:05.000Z'),
    ...overrides,
  };
}

function buildClaimedJob(
  overrides: Partial<ClaimedProofPackJob> = {},
): ClaimedProofPackJob {
  return {
    pack: buildPackRecord(),
    job: buildJobRecord(),
    ...overrides,
  };
}

describe('ProofPackService', () => {
  let store: {
    enqueuePack: jest.Mock;
    updatePack: jest.Mock;
    findPacksForLane: jest.Mock;
    findPackById: jest.Mock;
    findJobByPackId: jest.Mock;
    leaseNextJob: jest.Mock;
    renewJobLease: jest.Mock;
    completePackJob: jest.Mock;
    requeueJob: jest.Mock;
    failPackJob: jest.Mock;
    getJobMetrics: jest.Mock;
    getLatestVersion: jest.Mock;
  };
  let objectStore: {
    putObjectFromFile: jest.Mock;
    createReadStream: jest.Mock;
    deleteObject: jest.Mock;
  };
  let hashingService: {
    hashBuffer: jest.Mock;
    hashString: jest.Mock;
    hashFile: jest.Mock;
  };
  let auditService: {
    createEntry: jest.Mock;
  };
  let service: ProofPackService;

  beforeEach(() => {
    store = {
      enqueuePack: jest
        .fn()
        .mockImplementation((record: Omit<ProofPackRecord, 'id'>) => {
          return { id: 'pack-1', ...record };
        }),
      updatePack: jest.fn(),
      findPacksForLane: jest.fn().mockResolvedValue([]),
      findPackById: jest.fn(),
      findJobByPackId: jest.fn(),
      leaseNextJob: jest.fn(),
      renewJobLease: jest.fn(),
      completePackJob: jest.fn().mockResolvedValue(
        buildPackRecord({
          status: 'READY',
          contentHash: 'a'.repeat(64),
          filePath: 'packs/lane-1/regulator-v1.pdf',
        }),
      ),
      requeueJob: jest.fn(),
      failPackJob: jest.fn().mockResolvedValue(
        buildPackRecord({
          status: 'FAILED',
          errorMessage:
            'Proof pack generation failed after 3 attempts. Last error: ENOENT',
        }),
      ),
      getJobMetrics: jest.fn(),
      getLatestVersion: jest.fn().mockResolvedValue(0),
    };
    objectStore = {
      putObjectFromFile: jest.fn().mockResolvedValue(undefined),
      createReadStream: jest
        .fn()
        .mockResolvedValue(Readable.from(Buffer.from('proof-pack-bytes'))),
      deleteObject: jest.fn(),
    };
    hashingService = {
      hashBuffer: jest.fn().mockReturnValue('a'.repeat(64)),
      hashString: jest.fn().mockResolvedValue('b'.repeat(64)),
      hashFile: jest.fn().mockResolvedValue('a'.repeat(64)),
    };
    auditService = {
      createEntry: jest.fn().mockResolvedValue({
        id: 'audit-1',
        timestamp: new Date(),
        actor: 'user-1',
        action: AuditAction.GENERATE,
        entityType: AuditEntityType.PROOF_PACK,
        entityId: 'pack-1',
        payloadHash: 'b'.repeat(64),
        prevHash: 'c'.repeat(64),
        entryHash: 'd'.repeat(64),
      }),
    };

    service = new ProofPackService(
      store as unknown as ProofPackStore,
      objectStore as never,
      hashingService as unknown as HashingService,
      auditService as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enqueues proof-pack generation and returns generating status', async () => {
    const pack = await service.generatePack(
      { laneId: 'lane-1', packType: 'REGULATOR', generatedBy: 'user-1' },
      buildTemplateData(),
    );

    expect(store.enqueuePack).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: 'lane-1',
        packType: 'REGULATOR',
        version: 1,
        status: 'GENERATING',
      }),
      buildTemplateData(),
      expect.any(Date),
    );
    expect(pack.status).toBe('GENERATING');
    expect(pack.contentHash).toBeNull();
  });

  it('renders template with correct data', () => {
    const templateSource =
      '<html><body><h1>{{laneId}}</h1><p>{{product}}</p><p>{{market}}</p></body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);

    const html = service.renderTemplate('REGULATOR', buildTemplateData());

    expect(html).toContain('LN-2026-001');
    expect(html).toContain('MANGO');
    expect(html).toContain('JAPAN');
  });

  it.each([['REGULATOR' as const], ['BUYER' as const], ['DEFENSE' as const]])(
    'renders the shipped %s template with registered helpers',
    (packType) => {
      mockedReadFileSync.mockImplementation(((path, options) =>
        actualReadFileSync(path, options)) as typeof readFileSync);

      expect(() =>
        service.renderTemplate(
          packType,
          buildTemplateData({
            packType,
            qrCodeDataUrl: 'data:image/png;base64,fakeqr',
            verificationReference: 'zrl:proof-pack:LN-2026-001:REGULATOR:v1',
          }),
        ),
      ).not.toThrow();
    },
  );

  it('completes a leased proof-pack job and finalizes a ready pack', async () => {
    mockedReadFileSync.mockReturnValue('<html><body>{{laneId}}</body></html>');

    await service.completeLeasedJob(buildClaimedJob());

    expect(hashingService.hashBuffer).toHaveBeenCalledWith(expect.any(Buffer));
    expect(mockedWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('zrl-pack-'),
      expect.any(Buffer),
    );
    expect(objectStore.putObjectFromFile).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'packs/lane-1/regulator-v1.pdf',
        contentType: 'application/pdf',
      }),
    );
    expect(store.completePackJob).toHaveBeenCalledWith(
      'job-1',
      new Date('2026-03-16T10:01:05.000Z'),
      expect.any(Date),
      {
        contentHash: 'a'.repeat(64),
        filePath: 'packs/lane-1/regulator-v1.pdf',
      },
    );
    expect(auditService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.GENERATE,
        entityType: AuditEntityType.PROOF_PACK,
        entityId: 'pack-1',
      }),
    );
  });

  it('rejects leased completion when the worker no longer owns the lease', async () => {
    mockedReadFileSync.mockReturnValue('<html><body>{{laneId}}</body></html>');
    store.completePackJob.mockResolvedValue(null);

    await expect(service.completeLeasedJob(buildClaimedJob())).rejects.toThrow(
      new ConflictException('Proof pack job lease is no longer active.'),
    );
  });

  it('propagates rendering failures for the worker to retry', async () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    await expect(service.completeLeasedJob(buildClaimedJob())).rejects.toThrow(
      'ENOENT',
    );
    expect(store.completePackJob).not.toHaveBeenCalled();
  });

  it('marks a leased job as permanently failed and audits it', async () => {
    await service.failLeasedJob(
      buildClaimedJob({
        job: buildJobRecord({ attemptCount: 3 }),
      }),
      new Error('template render failed'),
    );

    expect(store.failPackJob).toHaveBeenCalledWith(
      'job-1',
      new Date('2026-03-16T10:01:05.000Z'),
      expect.any(Date),
      expect.stringContaining('failed after 3 attempts'),
      'template render failed',
    );
    expect(auditService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.PROOF_PACK,
        entityId: 'pack-1',
      }),
    );
  });

  it('rejects leased failure finalization when the worker no longer owns the lease', async () => {
    store.failPackJob.mockResolvedValue(null);

    await expect(
      service.failLeasedJob(
        buildClaimedJob(),
        new Error('template render failed'),
      ),
    ).rejects.toThrow(
      new ConflictException('Proof pack job lease is no longer active.'),
    );
  });

  it('getPackById returns pack metadata', async () => {
    const pack = buildPackRecord({
      status: 'READY',
      contentHash: 'a'.repeat(64),
      filePath: 'packs/lane-1/regulator-v1.pdf',
    });
    store.findPackById.mockResolvedValue(pack);

    await expect(service.getPackById('pack-1')).resolves.toEqual(pack);
  });

  it('getPackById throws NotFoundException for missing pack', async () => {
    store.findPackById.mockResolvedValue(null);

    await expect(service.getPackById('missing-pack')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('verifyPack re-hashes the stored object stream', async () => {
    store.findPackById.mockResolvedValue(
      buildPackRecord({
        status: 'READY',
        contentHash: 'a'.repeat(64),
        filePath: 'packs/lane-1/regulator-v1.pdf',
      }),
    );

    await expect(service.verifyPack('pack-1')).resolves.toEqual({
      valid: true,
      hash: 'a'.repeat(64),
      laneId: 'lane-1',
      generatedAt: '2026-03-16T10:00:00.000Z',
      packType: 'REGULATOR',
    });
    expect(objectStore.createReadStream).toHaveBeenCalledWith(
      'packs/lane-1/regulator-v1.pdf',
    );
  });

  it('verifyPack rejects packs that are still generating', async () => {
    store.findPackById.mockResolvedValue(buildPackRecord());

    await expect(service.verifyPack('pack-1')).rejects.toThrow(
      'Proof pack is still generating.',
    );
  });
});

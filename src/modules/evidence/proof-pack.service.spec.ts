import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import type { HashingService } from '../../common/hashing/hashing.service';
import { ProofPackService } from './proof-pack.service';
import type {
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

describe('ProofPackService', () => {
  let store: {
    createPack: jest.Mock;
    updatePack: jest.Mock;
    findPacksForLane: jest.Mock;
    findPackById: jest.Mock;
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
  let scheduledBackgroundTask: (() => Promise<void>) | null;

  function captureBackgroundTask(): void {
    scheduledBackgroundTask = null;
    jest
      .spyOn(service as never, 'runInBackground')
      .mockImplementation((task: () => Promise<void>) => {
        scheduledBackgroundTask = task;
      });
  }

  async function runScheduledBackgroundTask(): Promise<void> {
    if (scheduledBackgroundTask === null) {
      throw new Error('Expected a background task to be scheduled.');
    }

    await scheduledBackgroundTask();
  }

  beforeEach(() => {
    store = {
      createPack: jest.fn().mockImplementation(
        (record: Omit<ProofPackRecord, 'id'>): ProofPackRecord => ({
          id: 'pack-1',
          ...record,
        }),
      ),
      updatePack: jest.fn().mockImplementation(
        (
          id: string,
          input: Pick<
            ProofPackRecord,
            'status' | 'contentHash' | 'filePath' | 'errorMessage'
          >,
        ): ProofPackRecord => ({
          id,
          laneId: 'lane-1',
          packType: 'REGULATOR',
          version: 1,
          generatedAt: new Date('2026-03-16T10:00:00.000Z'),
          generatedBy: 'user-1',
          recipient: null,
          ...input,
        }),
      ),
      findPacksForLane: jest.fn().mockResolvedValue([]),
      findPackById: jest.fn(),
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
    scheduledBackgroundTask = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects generation when no template file exists', async () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    captureBackgroundTask();

    const pack = await service.generatePack(
      { laneId: 'lane-1', packType: 'REGULATOR', generatedBy: 'user-1' },
      buildTemplateData(),
    );

    await expect(runScheduledBackgroundTask()).rejects.toThrow('ENOENT');
    expect(pack.status).toBe('GENERATING');
    expect(store.updatePack).toHaveBeenCalledWith(
      'pack-1',
      expect.objectContaining({
        status: 'FAILED',
      }),
    );
  });

  it('renders template with correct data', () => {
    const templateSource =
      '<html><body><h1>{{laneId}}</h1><p>{{product}}</p><p>{{market}}</p></body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);

    const data = buildTemplateData();
    const html = service.renderTemplate('REGULATOR', data);

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

  it('computes content hash of generated PDF', async () => {
    const templateSource = '<html><body>{{laneId}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);
    captureBackgroundTask();

    await service.generatePack(
      { laneId: 'lane-1', packType: 'BUYER', generatedBy: 'user-1' },
      buildTemplateData({ packType: 'BUYER' }),
    );
    await runScheduledBackgroundTask();

    expect(hashingService.hashBuffer).toHaveBeenCalledTimes(1);
    expect(hashingService.hashBuffer).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('hashes the same proof-pack bytes it writes for upload', async () => {
    const templateSource =
      '<html><body>{{laneId}} {{verificationReference}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);
    captureBackgroundTask();

    await service.generatePack(
      { laneId: 'lane-1', packType: 'BUYER', generatedBy: 'user-1' },
      buildTemplateData({ packType: 'BUYER' }),
    );
    await runScheduledBackgroundTask();

    const hashBufferCalls = hashingService.hashBuffer.mock.calls as Array<
      [Buffer]
    >;
    const writeFileCalls = mockedWriteFile.mock.calls as Array<
      [string, Buffer]
    >;
    const hashedBuffer = hashBufferCalls[hashBufferCalls.length - 1][0];
    const writtenBuffer = writeFileCalls[writeFileCalls.length - 1][1];

    expect(Buffer.isBuffer(hashedBuffer)).toBe(true);
    expect(Buffer.isBuffer(writtenBuffer)).toBe(true);
    expect(writtenBuffer.equals(hashedBuffer)).toBe(true);
  });

  it('creates audit entry on generation', async () => {
    const templateSource = '<html><body>{{laneId}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);
    captureBackgroundTask();

    await service.generatePack(
      { laneId: 'lane-1', packType: 'REGULATOR', generatedBy: 'user-1' },
      buildTemplateData(),
    );
    await runScheduledBackgroundTask();

    expect(auditService.createEntry).toHaveBeenCalledTimes(1);
    const auditCalls = auditService.createEntry.mock.calls as Array<
      [
        {
          actor: string;
          action: string;
          entityType: string;
          entityId: string;
          payloadSnapshot?: { kind?: string; status?: string };
        },
      ]
    >;
    const auditCall = auditCalls[0]?.[0] as {
      actor: string;
      action: string;
      entityType: string;
      entityId: string;
      payloadSnapshot?: { kind?: string; status?: string };
    };
    expect(auditCall.actor).toBe('user-1');
    expect(auditCall.action).toBe(AuditAction.GENERATE);
    expect(auditCall.entityType).toBe(AuditEntityType.PROOF_PACK);
    expect(auditCall.entityId).toBe('pack-1');
    expect(auditCall.payloadSnapshot).toMatchObject({
      kind: 'proofPack',
      status: 'READY',
    });
  });

  it('increments version for same lane and pack type', async () => {
    const templateSource = '<html><body>{{laneId}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);
    store.getLatestVersion.mockResolvedValue(2);
    captureBackgroundTask();

    const result = await service.generatePack(
      { laneId: 'lane-1', packType: 'REGULATOR', generatedBy: 'user-1' },
      buildTemplateData(),
    );
    await runScheduledBackgroundTask();

    expect(result.version).toBe(3);
    expect(store.getLatestVersion).toHaveBeenCalledWith('lane-1', 'REGULATOR');
  });

  it('stores pack record with correct fields', async () => {
    const templateSource = '<html><body>{{laneId}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);
    store.getLatestVersion.mockResolvedValue(0);
    captureBackgroundTask();

    await service.generatePack(
      { laneId: 'lane-1', packType: 'DEFENSE', generatedBy: 'user-1' },
      buildTemplateData({ packType: 'DEFENSE' }),
    );
    await runScheduledBackgroundTask();

    expect(store.createPack).toHaveBeenCalledTimes(1);
    const calls = store.createPack.mock.calls as Array<
      [Omit<ProofPackRecord, 'id'>]
    >;
    const callArgs = calls[0][0];
    expect(callArgs.laneId).toBe('lane-1');
    expect(callArgs.packType).toBe('DEFENSE');
    expect(callArgs.version).toBe(1);
    expect(callArgs.status).toBe('GENERATING');
    expect(callArgs.contentHash).toBeNull();
    expect(callArgs.filePath).toBeNull();
    expect(callArgs.errorMessage).toBeNull();
    expect(callArgs.generatedBy).toBe('user-1');
    expect(callArgs.recipient).toBeNull();
    expect(callArgs.generatedAt).toBeInstanceOf(Date);
  });

  it('listPacks delegates to store', async () => {
    const mockPacks: ProofPackRecord[] = [
      {
        id: 'pack-1',
        laneId: 'lane-1',
        packType: 'REGULATOR',
        version: 1,
        status: 'READY',
        contentHash: 'a'.repeat(64),
        filePath: 'packs/lane-1/REGULATOR-v1.pdf',
        errorMessage: null,
        generatedAt: new Date(),
        generatedBy: 'user-1',
        recipient: null,
      },
    ];
    store.findPacksForLane.mockResolvedValue(mockPacks);

    const result = await service.listPacks('lane-1');

    expect(result).toEqual(mockPacks);
    expect(store.findPacksForLane).toHaveBeenCalledWith('lane-1');
  });

  it('getPackById returns pack metadata', async () => {
    const pack: ProofPackRecord = {
      id: 'pack-1',
      laneId: 'lane-1',
      packType: 'BUYER',
      version: 2,
      status: 'READY',
      contentHash: 'a'.repeat(64),
      filePath: 'packs/lane-1/buyer-v2.pdf',
      errorMessage: null,
      generatedAt: new Date('2026-03-16T10:00:00.000Z'),
      generatedBy: 'user-1',
      recipient: null,
    };
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
    const pack: ProofPackRecord = {
      id: 'pack-1',
      laneId: 'lane-1',
      packType: 'REGULATOR',
      version: 1,
      status: 'READY',
      contentHash: 'a'.repeat(64),
      filePath: 'packs/lane-1/regulator-v1.pdf',
      errorMessage: null,
      generatedAt: new Date('2026-03-16T10:00:00.000Z'),
      generatedBy: 'user-1',
      recipient: null,
    };
    store.findPackById.mockResolvedValue(pack);

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
    expect(hashingService.hashFile).toHaveBeenCalledWith(expect.any(Readable));
  });

  it('getPackDownload returns the pack record and object stream', async () => {
    const pack: ProofPackRecord = {
      id: 'pack-1',
      laneId: 'lane-1',
      packType: 'DEFENSE',
      version: 1,
      status: 'READY',
      contentHash: 'a'.repeat(64),
      filePath: 'packs/lane-1/defense-v1.pdf',
      errorMessage: null,
      generatedAt: new Date('2026-03-16T10:00:00.000Z'),
      generatedBy: 'user-1',
      recipient: null,
    };
    const stream = Readable.from(Buffer.from('download-bytes'));
    store.findPackById.mockResolvedValue(pack);
    objectStore.createReadStream.mockResolvedValue(stream);

    await expect(service.getPackDownload('pack-1')).resolves.toEqual({
      pack,
      stream,
    });
  });

  it('verifyPack rejects packs that are still generating', async () => {
    store.findPackById.mockResolvedValue({
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
    } satisfies ProofPackRecord);

    await expect(service.verifyPack('pack-1')).rejects.toThrow(
      'Proof pack is still generating.',
    );
  });
});

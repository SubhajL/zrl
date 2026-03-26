import { readFileSync } from 'node:fs';
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
}));

jest.mock('puppeteer-core', () => {
  throw new Error('puppeteer-core not available');
});

const mockedReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;

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
    qrCodeDataUrl: 'data:image/png;base64,fakeqr',
    contentHash: 'pending-generation',
    generatedAt: '2026-03-16T10:00:00.000Z',
    packType: 'REGULATOR',
    ...overrides,
  };
}

describe('ProofPackService', () => {
  let store: {
    createPack: jest.Mock;
    findPacksForLane: jest.Mock;
    getLatestVersion: jest.Mock;
  };
  let hashingService: {
    hashBuffer: jest.Mock;
    hashString: jest.Mock;
  };
  let auditService: {
    createEntry: jest.Mock;
  };
  let service: ProofPackService;

  beforeEach(() => {
    store = {
      createPack: jest.fn().mockImplementation(
        (record: Omit<ProofPackRecord, 'id'>): ProofPackRecord => ({
          id: 'pack-1',
          ...record,
        }),
      ),
      findPacksForLane: jest.fn().mockResolvedValue([]),
      getLatestVersion: jest.fn().mockResolvedValue(0),
    };
    hashingService = {
      hashBuffer: jest.fn().mockReturnValue('a'.repeat(64)),
      hashString: jest.fn().mockResolvedValue('b'.repeat(64)),
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
      hashingService as unknown as HashingService,
      auditService as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects generation when no template file exists', async () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    await expect(
      service.generatePack(
        { laneId: 'lane-1', packType: 'REGULATOR', generatedBy: 'user-1' },
        buildTemplateData(),
      ),
    ).rejects.toThrow('ENOENT');
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

  it('computes content hash of generated PDF', async () => {
    const templateSource = '<html><body>{{laneId}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);

    await service.generatePack(
      { laneId: 'lane-1', packType: 'BUYER', generatedBy: 'user-1' },
      buildTemplateData({ packType: 'BUYER' }),
    );

    expect(hashingService.hashBuffer).toHaveBeenCalledTimes(1);
    expect(hashingService.hashBuffer).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('creates audit entry on generation', async () => {
    const templateSource = '<html><body>{{laneId}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);

    await service.generatePack(
      { laneId: 'lane-1', packType: 'REGULATOR', generatedBy: 'user-1' },
      buildTemplateData(),
    );

    expect(auditService.createEntry).toHaveBeenCalledTimes(1);
    expect(auditService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'user-1',
        action: AuditAction.GENERATE,
        entityType: AuditEntityType.PROOF_PACK,
        entityId: 'pack-1',
      }),
    );
  });

  it('increments version for same lane and pack type', async () => {
    const templateSource = '<html><body>{{laneId}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);
    store.getLatestVersion.mockResolvedValue(2);

    const result = await service.generatePack(
      { laneId: 'lane-1', packType: 'REGULATOR', generatedBy: 'user-1' },
      buildTemplateData(),
    );

    expect(result.version).toBe(3);
    expect(store.getLatestVersion).toHaveBeenCalledWith('lane-1', 'REGULATOR');
  });

  it('stores pack record with correct fields', async () => {
    const templateSource = '<html><body>{{laneId}}</body></html>';
    mockedReadFileSync.mockReturnValue(templateSource);
    store.getLatestVersion.mockResolvedValue(0);

    await service.generatePack(
      { laneId: 'lane-1', packType: 'DEFENSE', generatedBy: 'user-1' },
      buildTemplateData({ packType: 'DEFENSE' }),
    );

    expect(store.createPack).toHaveBeenCalledTimes(1);
    const calls = store.createPack.mock.calls as Array<
      [Omit<ProofPackRecord, 'id'>]
    >;
    const callArgs = calls[0][0];
    expect(callArgs.laneId).toBe('lane-1');
    expect(callArgs.packType).toBe('DEFENSE');
    expect(callArgs.version).toBe(1);
    expect(callArgs.contentHash).toBe('a'.repeat(64));
    expect(callArgs.filePath).toBe('packs/lane-1/DEFENSE-v1.pdf');
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
        contentHash: 'a'.repeat(64),
        filePath: 'packs/lane-1/REGULATOR-v1.pdf',
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
});

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'node:stream';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/common/audit/audit.service';
import { AuthService } from '../src/common/auth/auth.service';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { ProofPackService } from '../src/modules/evidence/proof-pack.service';
import { LaneService } from '../src/modules/lane/lane.service';

describe('ProofPack endpoints (e2e)', () => {
  let app: INestApplication<App>;
  const authServiceMock = {
    verifyAccessToken: jest.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
      claims: {
        iss: 'zrl-auth',
        aud: 'zrl',
        sub: 'user-1',
        type: 'access',
        role: 'EXPORTER',
        sv: 0,
        mfa: false,
        email: 'exporter@example.com',
        companyName: 'Exporter Co',
        iat: 1,
        exp: 2,
        jti: 'jti',
      },
    }),
    resolveLaneOwnerId: jest.fn().mockResolvedValue('user-1'),
    resolveProofPackOwnerId: jest.fn().mockResolvedValue('user-1'),
    resolveCheckpointOwnerId: jest.fn().mockResolvedValue('user-1'),
  };
  const proofPackServiceMock = {
    generatePack: jest.fn().mockResolvedValue({
      id: 'pack-1',
      laneId: 'lane-db-1',
      packType: 'REGULATOR',
      version: 1,
      status: 'GENERATING',
      contentHash: null,
      filePath: null,
      errorMessage: null,
      generatedAt: new Date('2026-03-16T10:00:00.000Z'),
      generatedBy: 'user-1',
      recipient: null,
    }),
    listPacks: jest.fn().mockResolvedValue([]),
    getPackById: jest.fn().mockResolvedValue({
      id: 'pack-1',
      laneId: 'lane-db-1',
      packType: 'REGULATOR',
      version: 1,
      status: 'READY',
      contentHash: 'a'.repeat(64),
      filePath: 'packs/lane-db-1/regulator-v1.pdf',
      errorMessage: null,
      generatedAt: new Date('2026-03-16T10:00:00.000Z'),
      generatedBy: 'user-1',
      recipient: null,
    }),
    verifyPack: jest.fn().mockResolvedValue({
      valid: true,
      hash: 'a'.repeat(64),
      laneId: 'lane-db-1',
      generatedAt: '2026-03-16T10:00:00.000Z',
      packType: 'REGULATOR',
    }),
    getPackDownload: jest.fn().mockResolvedValue({
      pack: {
        id: 'pack-1',
        laneId: 'lane-db-1',
        packType: 'REGULATOR',
        version: 1,
        status: 'READY',
        contentHash: 'a'.repeat(64),
        filePath: 'packs/lane-db-1/regulator-v1.pdf',
        errorMessage: null,
        generatedAt: new Date('2026-03-16T10:00:00.000Z'),
        generatedBy: 'user-1',
        recipient: null,
      },
      stream: Readable.from(Buffer.from('fake-pdf-bytes')),
    }),
  };
  const laneServiceMock = {
    findById: jest.fn().mockResolvedValue({
      lane: {
        id: 'lane-db-1',
        laneId: 'LN-2026-001',
        exporterId: 'user-1',
        status: 'VALIDATED',
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        completenessScore: 97,
        coldChainMode: null,
        coldChainDeviceId: null,
        coldChainDataFrequencySeconds: null,
        statusChangedAt: new Date('2026-03-16T09:00:00.000Z'),
        createdAt: new Date('2026-03-16T08:00:00.000Z'),
        updatedAt: new Date('2026-03-16T09:00:00.000Z'),
        batch: {
          id: 'batch-1',
          laneId: 'lane-db-1',
          batchId: 'MNG-JPN-20260316-001',
          product: 'MANGO',
          variety: 'Nam Dok Mai',
          quantityKg: 500,
          originProvince: 'Chiang Mai',
          harvestDate: new Date('2026-03-15T00:00:00.000Z'),
          grade: 'A',
        },
        route: {
          id: 'route-1',
          laneId: 'lane-db-1',
          transportMode: 'AIR',
          carrier: 'Thai Airways',
          originGps: null,
          destinationGps: null,
          estimatedTransitHours: 8,
        },
        checkpoints: [],
        ruleSnapshot: null,
      },
    }),
  };
  const evidenceServiceMock = {
    listLaneArtifacts: jest.fn().mockResolvedValue({ artifacts: [] }),
  };
  const auditServiceMock = {
    getEntriesForLane: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(LaneService)
      .useValue(laneServiceMock)
      .overrideProvider(EvidenceService)
      .useValue(evidenceServiceMock)
      .overrideProvider(AuditService)
      .useValue(auditServiceMock)
      .overrideProvider(ProofPackService)
      .useValue(proofPackServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('POST /lanes/:id/packs/generate returns 400 for invalid pack type', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/packs/generate')
      .set('Authorization', 'Bearer access-token')
      .send({ packType: 'INVALID' })
      .expect(400)
      .expect((response: Response) => {
        const body = response.body as { message: string };
        expect(body.message).toContain('packType');
      });
  });

  it('POST /lanes/:id/packs/generate returns a generating pack status', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/packs/generate')
      .set('Authorization', 'Bearer access-token')
      .send({ packType: 'REGULATOR' })
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as {
          pack: { id: string; status: string; contentHash: string | null };
        };
        expect(body.pack.id).toBe('pack-1');
        expect(body.pack.status).toBe('GENERATING');
        expect(body.pack.contentHash).toBeNull();
      });
  });

  it('GET /lanes/:id/packs returns empty array initially', async () => {
    await request(app.getHttpServer())
      .get('/lanes/lane-db-1/packs')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { packs: unknown[] };
        expect(body.packs).toEqual([]);
        expect(proofPackServiceMock.listPacks).toHaveBeenCalledWith(
          'lane-db-1',
        );
      });
  });

  it('GET /packs/:id returns pack metadata', async () => {
    await request(app.getHttpServer())
      .get('/packs/pack-1')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          pack: { id: string; packType: string; contentHash: string };
        };
        expect(body.pack.id).toBe('pack-1');
        expect(body.pack.packType).toBe('REGULATOR');
        expect(body.pack.contentHash).toHaveLength(64);
      });
  });

  it('GET /packs/:id/verify is public and returns verification data', async () => {
    await request(app.getHttpServer())
      .get('/packs/pack-1/verify')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          valid: boolean;
          hash: string;
          laneId: string;
        };
        expect(body.valid).toBe(true);
        expect(body.hash).toHaveLength(64);
        expect(body.laneId).toBe('lane-db-1');
      });
  });

  it('GET /packs/:id/download returns PDF headers', async () => {
    await request(app.getHttpServer())
      .get('/packs/pack-1/download')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect(
        'Content-Disposition',
        /attachment; filename="proof-pack-pack-1\.pdf"/,
      );
  });
});

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { MrvLiteService } from '../src/modules/mrv-lite/mrv-lite.service';
import type {
  LaneEsgCard,
  ExporterEsgReport,
  PlatformEsgReport,
} from '../src/modules/mrv-lite/mrv-lite.types';

describe('MrvLiteController (e2e)', () => {
  let app: INestApplication<App>;
  const envSnapshot = { ...process.env };

  const mockLaneEsgCard: LaneEsgCard = {
    carbon: {
      co2eTotalKg: 2300,
      co2ePerKg: 2.3,
      transportMode: 'AIR',
      quantityKg: 1000,
    },
    waste: { laneStatus: 'VALIDATED', isRejected: false },
    social: { originProvince: 'Chanthaburi', product: 'MANGO' },
    governance: {
      completenessScore: 85,
      evidenceCount: 12,
      auditEntryCount: 5,
    },
  };

  const mockExporterReport: ExporterEsgReport = {
    exporterId: 'exporter-1',
    period: { quarter: 1, year: 2026 },
    environmental: { totalCo2eKg: 4600, avgCo2ePerKg: 2.3, laneCount: 2 },
    social: { distinctProvinces: 2, distinctProducts: 1 },
    governance: { avgCompleteness: 80, totalEvidenceCount: 24 },
  };

  const mockPlatformReport: PlatformEsgReport = {
    year: 2026,
    environmental: { totalCo2eKg: 50000, avgCo2ePerKg: 1.8, laneCount: 100 },
    social: {
      distinctExporters: 15,
      distinctProvinces: 8,
      distinctProducts: 4,
    },
    governance: {
      avgCompleteness: 75,
      totalEvidenceCount: 1200,
      totalAuditEntries: 600,
    },
  };

  const authServiceMock = {
    verifyAccessToken: jest.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        companyName: null,
        mfaEnabled: false,
        sessionVersion: 0,
      },
      claims: {
        iss: 'zrl-auth',
        aud: 'zrl',
        sub: 'user-1',
        type: 'access',
        role: 'ADMIN',
        sv: 0,
        mfa: false,
        email: 'admin@example.com',
        companyName: null,
        iat: 1,
        exp: 2,
        jti: 'jti',
      },
    }),
    resolveLaneOwnerId: jest.fn().mockResolvedValue('user-1'),
    resolveProofPackOwnerId: jest.fn().mockResolvedValue('user-1'),
    resolveCheckpointOwnerId: jest.fn().mockResolvedValue('user-1'),
  };

  const mrvLiteServiceMock = {
    getLaneEsgCard: jest.fn().mockResolvedValue(mockLaneEsgCard),
    getExporterReport: jest.fn().mockResolvedValue(mockExporterReport),
    getPlatformReport: jest.fn().mockResolvedValue(mockPlatformReport),
    getEmissionFactors: jest.fn().mockReturnValue([
      {
        product: 'MANGO',
        market: 'JAPAN',
        transportMode: 'AIR',
        co2ePerKg: 2.3,
      },
    ]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env['PROOF_PACK_WORKER_ENABLED'] = 'false';
    process.env['CERTIFICATION_EXPIRY_WORKER_ENABLED'] = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(MrvLiteService)
      .useValue(mrvLiteServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  afterAll(() => {
    process.env = envSnapshot;
  });

  it('GET /lanes/:id/esg returns 200 with ESG card', async () => {
    await request(app.getHttpServer())
      .get('/lanes/lane-1/esg')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as LaneEsgCard;
        expect(body).toHaveProperty('carbon');
        expect(body.carbon.co2eTotalKg).toBe(2300);
        expect(body).toHaveProperty('waste');
        expect(body).toHaveProperty('social');
        expect(body).toHaveProperty('governance');
      });

    expect(mrvLiteServiceMock.getLaneEsgCard).toHaveBeenCalledWith('lane-1');
  });

  it('GET /esg/exporter/:id returns 200', async () => {
    await request(app.getHttpServer())
      .get('/esg/exporter/exporter-1?quarter=1&year=2026')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as ExporterEsgReport;
        expect(body).toHaveProperty('exporterId');
        expect(body).toHaveProperty('period');
        expect(body).toHaveProperty('environmental');
        expect(body).toHaveProperty('social');
        expect(body).toHaveProperty('governance');
      });

    expect(mrvLiteServiceMock.getExporterReport).toHaveBeenCalledWith(
      'exporter-1',
      1,
      2026,
    );
  });

  it('GET /esg/platform returns 200 for admin', async () => {
    await request(app.getHttpServer())
      .get('/esg/platform?year=2026')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as PlatformEsgReport;
        expect(body).toHaveProperty('year');
        expect(body).toHaveProperty('environmental');
        expect(body).toHaveProperty('social');
        expect(body).toHaveProperty('governance');
      });

    expect(mrvLiteServiceMock.getPlatformReport).toHaveBeenCalledWith(2026);
  });

  it('GET /esg/carbon/factors returns 200 with factors array', async () => {
    await request(app.getHttpServer())
      .get('/esg/carbon/factors')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { factors: unknown[] };
        expect(body).toHaveProperty('factors');
        expect(Array.isArray(body.factors)).toBe(true);
        expect(body.factors).toHaveLength(1);
      });
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/lanes/lane-1/esg').expect(401);

    await request(app.getHttpServer())
      .get('/esg/exporter/exporter-1')
      .expect(401);

    await request(app.getHttpServer()).get('/esg/platform').expect(401);

    await request(app.getHttpServer()).get('/esg/carbon/factors').expect(401);
  });
});

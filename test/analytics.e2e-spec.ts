import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { ANALYTICS_STORE } from '../src/modules/analytics/analytics.service';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication<App>;
  const envSnapshot = { ...process.env };

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

  const analyticsStoreMock = {
    getOverview: jest.fn().mockResolvedValue({
      totalLanes: 10,
      avgCompleteness: 75,
      readyToShip: 5,
      coldChainCount: 8,
      marketsServed: 3,
      productsCovered: 4,
    }),
    getRejectionTrend: jest.fn().mockResolvedValue([
      {
        period: '2026-01-01',
        rejectionCount: 1,
        totalCount: 10,
        rejectionRate: 10,
      },
    ]),
    getCompletenessDistribution: jest
      .fn()
      .mockResolvedValue([{ label: '75-100%', count: 8, percentage: 80 }]),
    getExcursionHeatmap: jest
      .fn()
      .mockResolvedValue([{ segment: 'MANGO', severity: 'HIGH', count: 3 }]),
    getExporterLeaderboard: jest.fn().mockResolvedValue([
      {
        exporterId: 'user-1',
        companyName: 'Test Co',
        laneCount: 5,
        avgCompleteness: 90,
        readyToShipCount: 4,
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
      .overrideProvider(ANALYTICS_STORE)
      .useValue(analyticsStoreMock)
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

  it('GET /analytics/overview returns 200 with kpis object', async () => {
    await request(app.getHttpServer())
      .get('/analytics/overview')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          kpis: {
            totalLanes: number;
            avgCompleteness: number;
            readyToShip: number;
          };
        };
        expect(body).toHaveProperty('kpis');
        expect(body.kpis).toHaveProperty('totalLanes');
        expect(body.kpis.totalLanes).toBe(10);
        expect(body.kpis).toHaveProperty('avgCompleteness');
        expect(body.kpis).toHaveProperty('readyToShip');
      });
  });

  it('GET /analytics/rejection-trend returns 200 with datapoints', async () => {
    await request(app.getHttpServer())
      .get('/analytics/rejection-trend')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { datapoints: unknown[] };
        expect(body).toHaveProperty('datapoints');
        expect(Array.isArray(body.datapoints)).toBe(true);
        expect(body.datapoints).toHaveLength(1);
      });
  });

  it('GET /analytics/completeness-distribution returns 200 with brackets', async () => {
    await request(app.getHttpServer())
      .get('/analytics/completeness-distribution')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { brackets: unknown[] };
        expect(body).toHaveProperty('brackets');
        expect(Array.isArray(body.brackets)).toBe(true);
        expect(body.brackets).toHaveLength(1);
      });
  });

  it('GET /analytics/excursion-heatmap returns 200 with matrix', async () => {
    await request(app.getHttpServer())
      .get('/analytics/excursion-heatmap')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { matrix: unknown[] };
        expect(body).toHaveProperty('matrix');
        expect(Array.isArray(body.matrix)).toBe(true);
        expect(body.matrix).toHaveLength(1);
      });
  });

  it('GET /analytics/exporter-leaderboard returns 200 with exporters', async () => {
    await request(app.getHttpServer())
      .get('/analytics/exporter-leaderboard')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { exporters: unknown[] };
        expect(body).toHaveProperty('exporters');
        expect(Array.isArray(body.exporters)).toBe(true);
        expect(body.exporters).toHaveLength(1);
      });
  });

  it('GET /analytics/overview returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/analytics/overview').expect(401);
  });

  it('GET /analytics/overview passes from/to query params to store', async () => {
    await request(app.getHttpServer())
      .get('/analytics/overview?from=2026-01-01&to=2026-12-31')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(analyticsStoreMock.getOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date('2026-01-01'),
        to: new Date('2026-12-31'),
      }),
    );
  });
});

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { LaneService } from '../src/modules/lane/lane.service';

describe('LaneController (e2e)', () => {
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
  };
  const laneServiceMock = {
    create: jest.fn().mockResolvedValue({
      lane: {
        id: 'lane-db-1',
        laneId: 'LN-2026-002',
        exporterId: 'user-1',
        status: 'EVIDENCE_COLLECTING',
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        completenessScore: 0,
        createdAt: new Date('2026-03-22T05:00:00.000Z'),
        updatedAt: new Date('2026-03-22T05:00:00.000Z'),
        batch: {
          id: 'batch-db-1',
          laneId: 'lane-db-1',
          batchId: 'MNG-JPN-20260315-002',
          product: 'MANGO',
          variety: 'Nam Doc Mai',
          quantityKg: 5000,
          originProvince: 'Chachoengsao',
          harvestDate: new Date('2026-03-15T00:00:00.000Z'),
          grade: 'A',
        },
        route: {
          id: 'route-db-1',
          laneId: 'lane-db-1',
          transportMode: 'AIR',
          carrier: 'Thai Airways Cargo',
          originGps: { lat: 13.6904, lng: 101.0779 },
          destinationGps: { lat: 35.772, lng: 140.3929 },
          estimatedTransitHours: 8,
        },
        checkpoints: [],
        ruleSnapshot: null,
      },
    }),
    findAll: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'lane-db-1',
          laneId: 'LN-2026-002',
          exporterId: 'user-1',
          status: 'EVIDENCE_COLLECTING',
          productType: 'MANGO',
          destinationMarket: 'JAPAN',
          completenessScore: 0,
          coldChainMode: null,
          createdAt: new Date('2026-03-22T05:00:00.000Z'),
          updatedAt: new Date('2026-03-22T05:00:00.000Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    }),
    findById: jest.fn().mockResolvedValue({
      lane: {
        id: 'lane-db-1',
        laneId: 'LN-2026-002',
        exporterId: 'user-1',
        status: 'EVIDENCE_COLLECTING',
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        completenessScore: 0,
        createdAt: new Date('2026-03-22T05:00:00.000Z'),
        updatedAt: new Date('2026-03-22T05:00:00.000Z'),
        batch: null,
        route: null,
        checkpoints: [],
        ruleSnapshot: null,
      },
    }),
    update: jest.fn().mockResolvedValue({
      lane: {
        id: 'lane-db-1',
        laneId: 'LN-2026-002',
        exporterId: 'user-1',
        status: 'EVIDENCE_COLLECTING',
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        completenessScore: 0,
        createdAt: new Date('2026-03-22T05:00:00.000Z'),
        updatedAt: new Date('2026-03-22T05:10:00.000Z'),
        batch: null,
        route: null,
        checkpoints: [],
        ruleSnapshot: null,
      },
    }),
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
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('POST /lanes creates a lane', async () => {
    await request(app.getHttpServer())
      .post('/lanes')
      .set('Authorization', 'Bearer access-token')
      .send({
        product: 'MANGO',
        batch: {
          variety: 'Nam Doc Mai',
          quantityKg: 5000,
          originProvince: 'Chachoengsao',
          harvestDate: '2026-03-15',
          grade: 'A',
        },
        destination: {
          market: 'JAPAN',
        },
        route: {
          transportMode: 'AIR',
          carrier: 'Thai Airways Cargo',
          originGps: { lat: 13.6904, lng: 101.0779 },
          destinationGps: { lat: 35.772, lng: 140.3929 },
          estimatedTransitHours: 8,
        },
      })
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as {
          lane: { laneId: string; batch: { batchId: string } };
        };
        expect(body.lane.laneId).toBe('LN-2026-002');
        expect(body.lane.batch.batchId).toBe('MNG-JPN-20260315-002');
      });
  });

  it('GET /lanes lists lanes for authenticated users', async () => {
    await request(app.getHttpServer())
      .get('/lanes?page=1&limit=20')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          data: unknown[];
          meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
        expect(body.data).toHaveLength(1);
        expect(body.meta).toEqual({
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        });
      });
  });

  it('GET /lanes/:id returns lane detail with auth guard wiring', async () => {
    await request(app.getHttpServer())
      .get('/lanes/lane-db-1')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          lane: { laneId: string; batch: null };
        };
        expect(body.lane.laneId).toBe('LN-2026-002');
        expect(body.lane.batch).toBeNull();
      });
  });

  it('PATCH /lanes/:id updates a lane', async () => {
    await request(app.getHttpServer())
      .patch('/lanes/lane-db-1')
      .set('Authorization', 'Bearer access-token')
      .send({
        batch: {
          variety: 'Mahachanok',
        },
      })
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          lane: { updatedAt: string };
        };
        expect(body.lane.updatedAt).toBeDefined();
      });
  });

  it('POST /lanes rejects invalid payloads', async () => {
    await request(app.getHttpServer())
      .post('/lanes')
      .set('Authorization', 'Bearer access-token')
      .send({
        product: 'MANGO',
        batch: {
          variety: 'Nam Doc Mai',
        },
      })
      .expect(400);
  });
});

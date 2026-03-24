import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { ColdChainService } from '../src/modules/cold-chain/cold-chain.service';

describe('ColdChainController (e2e)', () => {
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
  const coldChainServiceMock = {
    listProfiles: jest.fn().mockResolvedValue([
      {
        id: 'fruit-1',
        productType: 'MANGO',
        optimalMinC: 10,
        optimalMaxC: 13,
        chillingThresholdC: 10,
        heatThresholdC: 15,
        shelfLifeMinDays: 14,
        shelfLifeMaxDays: 21,
      },
      {
        id: 'fruit-2',
        productType: 'DURIAN',
        optimalMinC: 12,
        optimalMaxC: 15,
        chillingThresholdC: 10,
        heatThresholdC: 18,
        shelfLifeMinDays: 7,
        shelfLifeMaxDays: 14,
      },
      {
        id: 'fruit-3',
        productType: 'MANGOSTEEN',
        optimalMinC: 10,
        optimalMaxC: 13,
        chillingThresholdC: 8,
        heatThresholdC: 15,
        shelfLifeMinDays: 14,
        shelfLifeMaxDays: 21,
      },
      {
        id: 'fruit-4',
        productType: 'LONGAN',
        optimalMinC: 2,
        optimalMaxC: 5,
        chillingThresholdC: null,
        heatThresholdC: 8,
        shelfLifeMinDays: 21,
        shelfLifeMaxDays: 30,
      },
    ]),
    getProfile: jest.fn().mockResolvedValue({
      id: 'fruit-1',
      productType: 'MANGO',
      optimalMinC: 10,
      optimalMaxC: 13,
      chillingThresholdC: 10,
      heatThresholdC: 15,
      shelfLifeMinDays: 14,
      shelfLifeMaxDays: 21,
    }),
    classifyTemperature: jest.fn(),
    validateLaneConfiguration: jest.fn(),
    ingestLaneReadings: jest.fn().mockResolvedValue({
      count: 2,
      excursionsDetected: 1,
      sla: {
        status: 'CONDITIONAL',
        shelfLifeImpactPercent: 12,
        remainingShelfLifeDays: 18,
      },
    }),
    listLaneTemperatureData: jest.fn().mockResolvedValue({
      readings: [
        {
          id: 'reading-1',
          laneId: 'lane-db-1',
          timestamp: new Date('2026-03-24T00:00:00.000Z'),
          temperatureC: 11,
          deviceId: 'logger-1',
        },
      ],
      excursions: [
        {
          id: 'exc-1',
          severity: 'MODERATE',
        },
      ],
      sla: {
        status: 'CONDITIONAL',
        shelfLifeImpactPercent: 12,
        remainingShelfLifeDays: 18,
      },
      meta: {
        resolution: '15m',
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
      .overrideProvider(ColdChainService)
      .useValue(coldChainServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('GET /cold-chain/profiles returns the canonical profile list', async () => {
    await request(app.getHttpServer())
      .get('/cold-chain/profiles')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          profiles: Array<{ productType: string }>;
        };
        expect(body.profiles).toHaveLength(4);
        expect(body.profiles[0].productType).toBe('MANGO');
      });
  });

  it('GET /cold-chain/profiles/MANGO returns a single profile', async () => {
    await request(app.getHttpServer())
      .get('/cold-chain/profiles/MANGO')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          profile: { productType: string; optimalMinC: number };
        };
        expect(body.profile.productType).toBe('MANGO');
        expect(body.profile.optimalMinC).toBe(10);
      });
  });

  it('POST /lanes/:id/temperature accepts JSON reading batches', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/temperature')
      .set('Authorization', 'Bearer access-token')
      .send({
        readings: [
          {
            timestamp: '2026-03-24T00:00:00.000Z',
            temperatureC: 11,
            deviceId: 'logger-1',
          },
          {
            timestamp: '2026-03-24T00:05:00.000Z',
            temperatureC: 9,
            deviceId: 'logger-1',
          },
        ],
      })
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as unknown as {
          count: number;
          excursionsDetected: number;
          sla: { status: string };
        };
        expect(body.count).toBe(2);
        expect(body.excursionsDetected).toBe(1);
        expect(body.sla.status).toBe('CONDITIONAL');
        const [calledLaneId, payload] = coldChainServiceMock.ingestLaneReadings
          .mock.calls[0] as [
          string,
          {
            readings: Array<{
              timestamp: Date;
              temperatureC: number;
              deviceId: string | null;
            }>;
          },
        ];

        expect(calledLaneId).toBe('lane-db-1');
        expect(payload.readings).toHaveLength(2);
        expect(payload.readings[0]?.timestamp).toBeInstanceOf(Date);
        expect(payload.readings[0]?.temperatureC).toBe(11);
        expect(payload.readings[0]?.deviceId).toBe('logger-1');
        expect(payload.readings[1]?.timestamp).toBeInstanceOf(Date);
        expect(payload.readings[1]?.temperatureC).toBe(9);
        expect(payload.readings[1]?.deviceId).toBe('logger-1');
      });
  });

  it('POST /lanes/:id/temperature accepts CSV upload', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/temperature')
      .set('Authorization', 'Bearer access-token')
      .attach(
        'file',
        Buffer.from(
          'timestamp,temperatureC,deviceId\n2026-03-24T00:00:00.000Z,10.5,logger-1\n',
        ),
        'temperature.csv',
      )
      .expect(201)
      .expect(() => {
        const [calledLaneId, payload] = coldChainServiceMock.ingestLaneReadings
          .mock.calls[0] as [
          string,
          {
            readings: Array<{
              timestamp: Date;
              temperatureC: number;
              deviceId: string | null;
            }>;
          },
        ];

        expect(calledLaneId).toBe('lane-db-1');
        expect(payload.readings).toHaveLength(1);
        expect(payload.readings[0]?.timestamp).toBeInstanceOf(Date);
        expect(payload.readings[0]?.temperatureC).toBe(10.5);
        expect(payload.readings[0]?.deviceId).toBe('logger-1');
      });
  });

  it('GET /lanes/:id/temperature returns filtered lane temperature data', async () => {
    await request(app.getHttpServer())
      .get(
        '/lanes/lane-db-1/temperature?from=2026-03-24T00:00:00.000Z&to=2026-03-24T01:00:00.000Z&resolution=15m',
      )
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as unknown as {
          readings: Array<{ id: string }>;
          excursions: Array<{ id: string }>;
          sla: { status: string };
          meta: { resolution: string };
        };
        expect(body.readings).toHaveLength(1);
        expect(body.excursions).toHaveLength(1);
        expect(body.sla.status).toBe('CONDITIONAL');
        expect(body.meta.resolution).toBe('15m');
        expect(
          coldChainServiceMock.listLaneTemperatureData,
        ).toHaveBeenCalledWith('lane-db-1', {
          from: new Date('2026-03-24T00:00:00.000Z'),
          to: new Date('2026-03-24T01:00:00.000Z'),
          resolution: '15m',
        });
      });
  });
});

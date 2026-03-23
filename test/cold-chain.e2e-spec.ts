import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ColdChainService } from '../src/modules/cold-chain/cold-chain.service';

describe('ColdChainController (e2e)', () => {
  let app: INestApplication<App>;
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
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
});

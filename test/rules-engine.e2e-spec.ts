import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/common/auth/auth.service';
import type { AuthPrincipalRequest } from './../src/common/auth/auth.types';
import {
  ApiKeyAuthGuard,
  JwtAuthGuard,
  RolesGuard,
} from './../src/common/auth/auth.guards';
import { RulesEngineService } from './../src/modules/rules-engine/rules-engine.service';

describe('RulesEngineController (e2e)', () => {
  let app: INestApplication<App>;
  const adminUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'ADMIN',
    companyName: 'ZRL Platform',
    mfaEnabled: true,
    sessionVersion: 0,
  };

  const rulesEngineServiceMock = {
    listMarkets: jest.fn().mockResolvedValue(['JAPAN']),
    listSubstances: jest.fn().mockResolvedValue([
      {
        id: 'sub-1',
        market: 'JAPAN',
        name: 'Chlorpyrifos',
        cas: '2921-88-2',
        thaiMrl: 0.5,
        destinationMrl: 0.01,
        stringencyRatio: 50,
        riskLevel: 'CRITICAL',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ]),
    createSubstance: jest.fn().mockResolvedValue({
      id: 'sub-2',
      market: 'JAPAN',
      name: 'Imidacloprid',
      cas: '138261-41-3',
      thaiMrl: 1,
      destinationMrl: 0.2,
      stringencyRatio: 5,
      riskLevel: 'HIGH',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    }),
    updateSubstance: jest.fn().mockResolvedValue({
      id: 'sub-1',
      market: 'JAPAN',
      name: 'Chlorpyrifos',
      cas: '2921-88-2',
      thaiMrl: 0.5,
      destinationMrl: 0.02,
      stringencyRatio: 25,
      riskLevel: 'CRITICAL',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    }),
    getRuleSnapshot: jest.fn().mockResolvedValue({
      market: 'JAPAN',
      product: 'MANGO',
      version: 1,
      effectiveDate: new Date('2026-03-01'),
      sourcePath: '/rules/japan/mango.yaml',
      requiredDocuments: ['Phytosanitary Certificate'],
      completenessWeights: {
        regulatory: 0.4,
        quality: 0.25,
        coldChain: 0.2,
        chainOfCustody: 0.15,
      },
      substances: [
        {
          name: 'Chlorpyrifos',
          cas: '2921-88-2',
          thaiMrl: 0.5,
          destinationMrl: 0.01,
          stringencyRatio: 50,
          riskLevel: 'CRITICAL',
        },
      ],
    }),
    listRuleVersions: jest.fn().mockResolvedValue([]),
    reloadRules: jest.fn().mockResolvedValue({ loaded: 1, ruleSets: [] }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue({
        verifyAccessToken: jest.fn().mockResolvedValue({
          user: adminUser,
          claims: {
            iss: 'zrl-auth',
            aud: 'zrl',
            sub: 'admin-1',
            type: 'access',
            role: 'ADMIN',
            sv: 0,
            mfa: true,
            email: 'admin@example.com',
            companyName: 'ZRL Platform',
            iat: 1,
            exp: 2,
            jti: 'jti',
          },
        }),
      })
      .overrideProvider(RulesEngineService)
      .useValue(rulesEngineServiceMock)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn((context: ExecutionContext) => {
          const requestContext = context
            .switchToHttp()
            .getRequest<AuthPrincipalRequest>();
          requestContext.user = adminUser;
          return true;
        }),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .overrideGuard(ApiKeyAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('GET /rules/markets returns available markets', async () => {
    await request(app.getHttpServer())
      .get('/rules/markets')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect(['JAPAN']);
  });

  it('POST /rules/reload reloads the yaml-backed rule store', async () => {
    await request(app.getHttpServer())
      .post('/rules/reload')
      .set('Authorization', 'Bearer access-token')
      .expect(201)
      .expect({ loaded: 1 });

    expect(rulesEngineServiceMock.reloadRules).toHaveBeenCalled();
  });

  it('GET /rules/markets/JAPAN/products/MANGO/ruleset returns the current rule snapshot', async () => {
    await request(app.getHttpServer())
      .get('/rules/markets/JAPAN/products/MANGO/ruleset')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          market: string;
          product: string;
          version: number;
        };
        expect(body.market).toBe('JAPAN');
        expect(body.product).toBe('MANGO');
        expect(body.version).toBe(1);
      });
  });

  it('POST /rules/markets/JAPAN/substances forwards the authenticated actor to the service', async () => {
    const payload = {
      name: 'Imidacloprid',
      cas: '138261-41-3',
      thaiMrl: 1,
      destinationMrl: 0.2,
    };

    await request(app.getHttpServer())
      .post('/rules/markets/JAPAN/substances')
      .set('Authorization', 'Bearer access-token')
      .send(payload)
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as {
          id: string;
          market: string;
          name: string;
        };
        expect(body.id).toBe('sub-2');
        expect(body.market).toBe('JAPAN');
        expect(body.name).toBe('Imidacloprid');
      });

    expect(rulesEngineServiceMock.createSubstance).toHaveBeenCalledWith(
      'JAPAN',
      payload,
      'admin-1',
    );
  });

  it('PATCH /rules/substances/:id forwards the authenticated actor to the service', async () => {
    const payload = {
      name: 'Chlorpyrifos',
      cas: '2921-88-2',
      thaiMrl: 0.5,
      destinationMrl: 0.02,
    };

    await request(app.getHttpServer())
      .patch('/rules/substances/sub-1')
      .set('Authorization', 'Bearer access-token')
      .send(payload)
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          id: string;
          market: string;
          destinationMrl: number;
        };
        expect(body.id).toBe('sub-1');
        expect(body.market).toBe('JAPAN');
        expect(body.destinationMrl).toBe(0.02);
      });

    expect(rulesEngineServiceMock.updateSubstance).toHaveBeenCalledWith(
      'sub-1',
      payload,
      'admin-1',
    );
  });
});

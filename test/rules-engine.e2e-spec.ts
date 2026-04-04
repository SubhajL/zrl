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
  const envSnapshot = { ...process.env };

  afterAll(() => {
    process.env = envSnapshot;
  });
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
      metadata: {
        coverageState: 'FULL_EXHAUSTIVE',
        sourceQuality: 'PRIMARY_PLUS_SECONDARY',
        retrievedAt: new Date('2026-04-04'),
        commodityCode: null,
        nonPesticideChecks: [
          {
            type: 'PHYTO_CERT',
            status: 'REQUIRED',
            parameters: {
              issuingAuthority: 'Thai NPPO',
              mustStateFruitFlyFree: true,
              mustStateTreatmentPerformed: true,
            },
            sourceRef: 'MAFF Plant Protection Station Thailand mango standard',
            note: null,
          },
          {
            type: 'VHT',
            status: 'REQUIRED',
            parameters: {
              minCoreTemperatureC: 47,
              minHoldMinutes: 20,
              alternateAllowedVariety: 'Nang Klang Wan',
              alternateMinCoreTemperatureC: 46.5,
              alternateMinHoldMinutes: 10,
            },
            sourceRef: 'MAFF Plant Protection Station Thailand mango standard',
            note: null,
          },
        ],
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
    getChecklist: jest.fn().mockResolvedValue({
      checklist: [
        {
          key: 'phytosanitary-certificate',
          label: 'Phytosanitary Certificate',
          category: 'REGULATORY',
          weight: 0.4,
          required: true,
          present: false,
          status: 'MISSING',
          artifactIds: [],
        },
      ],
    }),
    listRuleVersions: jest.fn().mockResolvedValue([]),
    reloadRules: jest.fn().mockResolvedValue({ loaded: 1, ruleSets: [] }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env['CERTIFICATION_EXPIRY_WORKER_ENABLED'] = 'false';
    process.env['PROOF_PACK_WORKER_ENABLED'] = 'false';

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
          metadata: {
            coverageState: string;
            sourceQuality: string;
            retrievedAt: string;
            nonPesticideChecks: Array<{
              type: string;
              parameters: Record<string, string | number | boolean>;
            }>;
          };
        };
        expect(body.market).toBe('JAPAN');
        expect(body.product).toBe('MANGO');
        expect(body.version).toBe(1);
        expect(body.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
        expect(body.metadata.sourceQuality).toBe('PRIMARY_PLUS_SECONDARY');
        expect(body.metadata.retrievedAt).toContain('2026-04-04');
        const phytoCheck = body.metadata.nonPesticideChecks.find(
          (check) => check.type === 'PHYTO_CERT',
        );
        const vhtCheck = body.metadata.nonPesticideChecks.find(
          (check) => check.type === 'VHT',
        );
        expect(phytoCheck).toBeDefined();
        expect(vhtCheck?.parameters.minCoreTemperatureC).toBe(47);
        expect(vhtCheck?.parameters.alternateAllowedVariety).toBe(
          'Nang Klang Wan',
        );
      });
  });

  it('GET /rules/markets/JAPAN/checklist returns the market checklist for a product', async () => {
    await request(app.getHttpServer())
      .get('/rules/markets/JAPAN/checklist?product=MANGO')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          checklist: Array<{ label: string; category: string }>;
        };
        expect(body.checklist).toEqual([
          expect.objectContaining({
            label: 'Phytosanitary Certificate',
            category: 'REGULATORY',
          }),
        ]);
      });

    expect(rulesEngineServiceMock.getChecklist).toHaveBeenCalledWith(
      'JAPAN',
      'MANGO',
    );
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

  it('GET /rules/markets/KOREA/products/MANGO/ruleset returns lab policy and fallback metadata', async () => {
    rulesEngineServiceMock.getRuleSnapshot.mockResolvedValueOnce({
      market: 'KOREA',
      product: 'MANGO',
      version: 1,
      effectiveDate: new Date('2026-04-03'),
      sourcePath: 'rules/korea/mango.yaml',
      requiredDocuments: ['Phytosanitary Certificate', 'MRL Test Results'],
      completenessWeights: {
        regulatory: 0.4,
        quality: 0.25,
        coldChain: 0.2,
        chainOfCustody: 0.15,
      },
      labPolicy: {
        enforcementMode: 'FULL_PESTICIDE',
        requiredArtifactType: 'MRL_TEST',
        acceptedUnits: ['mg/kg', 'ppm'],
        defaultDestinationMrlMgKg: 0.01,
      },
      metadata: {
        coverageState: 'FULL_EXHAUSTIVE',
        sourceQuality: 'PRIMARY_ONLY',
        retrievedAt: new Date('2026-04-04'),
        commodityCode: 'ap105050006',
        nonPesticideChecks: [
          {
            type: 'VHT',
            status: 'REQUIRED',
            parameters: {
              minCoreTemperatureC: 47,
              minHoldMinutes: 20,
              overseasInspectionRequired: true,
              registrationRequired: true,
              allowedVarieties: 'Nang klarngwan|Nam Dork Mai|Rad|Mahachanok',
            },
            sourceRef: 'QIA fruit import conditions',
            note: null,
          },
        ],
      },
      substances: [
        {
          name: 'Acetamiprid',
          aliases: ['아세타미프리드'],
          cas: '135410-20-7',
          thaiMrl: null,
          destinationMrl: 0.2,
          stringencyRatio: null,
          riskLevel: null,
          sourceRef: 'MFDS foodView:ap105050006',
          note: null,
        },
      ],
    });

    await request(app.getHttpServer())
      .get('/rules/markets/KOREA/products/MANGO/ruleset')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          market: string;
          product: string;
          labPolicy: {
            enforcementMode: string;
            defaultDestinationMrlMgKg: number;
          };
          metadata: {
            coverageState: string;
            sourceQuality: string;
            commodityCode: string | null;
            nonPesticideChecks: Array<{
              type: string;
              status: string;
            }>;
          };
          substances: Array<{
            name: string;
            thaiMrl: number | null;
            riskLevel: string | null;
          }>;
        };
        expect(body.market).toBe('KOREA');
        expect(body.product).toBe('MANGO');
        expect(body.labPolicy).toEqual(
          expect.objectContaining({
            enforcementMode: 'FULL_PESTICIDE',
            defaultDestinationMrlMgKg: 0.01,
          }),
        );
        expect(body.metadata).toEqual(
          expect.objectContaining({
            coverageState: 'FULL_EXHAUSTIVE',
            sourceQuality: 'PRIMARY_ONLY',
            commodityCode: 'ap105050006',
            nonPesticideChecks: [
              expect.objectContaining({
                type: 'VHT',
                status: 'REQUIRED',
              }),
            ],
          }),
        );
        expect(body.substances[0].name).toBe('Acetamiprid');
        expect(body.substances[0].thaiMrl).toBeNull();
        expect(body.substances[0].riskLevel).toBeNull();
      });
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

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { PartnerIntegrationsService } from '../src/integrations/integrations.service';

describe('PartnerIntegrationsController (e2e)', () => {
  let app: INestApplication<App>;
  const envSnapshot = { ...process.env };

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

  const integrationsServiceMock = {
    lookupAcfsCertificate: jest.fn().mockResolvedValue({
      provider: 'acfs',
      certificateNumber: 'GAP-100',
      valid: true,
      expiryDate: '2026-12-31',
      holderName: 'Exporter Co',
      scope: ['Mango', 'Packing'],
      checkedAt: '2026-04-02T10:00:00.000Z',
    }),
    importAcfsCertificate: jest.fn().mockResolvedValue({
      provider: 'acfs',
      certificateNumber: 'GAP-100',
      valid: true,
      artifact: {
        id: 'artifact-gap-1',
        artifactType: 'GAP_CERT',
      },
    }),
    importLabResults: jest.fn().mockResolvedValue({
      provider: 'central-lab-thai',
      artifact: {
        id: 'artifact-lab-1',
        artifactType: 'MRL_TEST',
      },
    }),
    importTemperatureData: jest.fn().mockResolvedValue({
      provider: 'kerry',
      artifact: {
        id: 'artifact-temp-1',
        artifactType: 'TEMP_DATA',
      },
      ingestion: {
        count: 1,
        excursionsDetected: 0,
        sla: {
          status: 'PASS',
          defensibilityScore: 100,
          shelfLifeImpactPercent: 0,
          remainingShelfLifeDays: 14,
          excursionCount: 0,
          totalExcursionMinutes: 0,
          maxDeviationC: 0,
        },
      },
    }),
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
      .overrideProvider(PartnerIntegrationsService)
      .useValue(integrationsServiceMock)
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

  it('GET /integrations/certifications/acfs/:certificateNumber requires auth', async () => {
    await request(app.getHttpServer())
      .get('/integrations/certifications/acfs/GAP-100')
      .expect(401);
  });

  it('GET /integrations/certifications/acfs/:certificateNumber returns lookup payload', async () => {
    await request(app.getHttpServer())
      .get('/integrations/certifications/acfs/GAP-100')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          lookup: { valid: boolean; certificateNumber: string };
        };
        expect(body.lookup.valid).toBe(true);
        expect(body.lookup.certificateNumber).toBe('GAP-100');
      });
  });

  it('POST /lanes/:id/integrations/lab-results/:provider/import enforces lane ownership and delegates to the service', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/integrations/lab-results/central-lab-thai/import')
      .set('Authorization', 'Bearer access-token')
      .send({ reportId: 'CL-001' })
      .expect(201)
      .expect((response) => {
        const body = response.body as {
          artifact: { id: string };
        };
        expect(body.artifact.id).toBe('artifact-lab-1');
      });

    expect(integrationsServiceMock.importLabResults).toHaveBeenCalledWith(
      'central-lab-thai',
      'lane-db-1',
      { reportId: 'CL-001' },
      expect.objectContaining({ id: 'user-1' }),
    );
  });

  it('POST /lanes/:id/integrations/temperature/:provider/import delegates to the service', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/integrations/temperature/kerry/import')
      .set('Authorization', 'Bearer access-token')
      .send({ shipmentId: 'KRY-9' })
      .expect(201)
      .expect((response) => {
        const body = response.body as {
          artifact: { id: string };
          ingestion: { count: number };
        };
        expect(body.artifact.id).toBe('artifact-temp-1');
        expect(body.ingestion.count).toBe(1);
      });
  });

  it('POST /lanes/:id/integrations/certifications/acfs/import imports a GAP certificate artifact', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/integrations/certifications/acfs/import')
      .set('Authorization', 'Bearer access-token')
      .send({ certificateNumber: 'GAP-100' })
      .expect(201)
      .expect((response) => {
        const body = response.body as {
          artifact: { artifactType: string };
          valid: boolean;
        };
        expect(body.artifact.artifactType).toBe('GAP_CERT');
        expect(body.valid).toBe(true);
      });
  });
});

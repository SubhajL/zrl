import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { ProofPackWorkerService } from '../src/modules/evidence/proof-pack.worker';
import { PrivacyService } from '../src/modules/privacy/privacy.service';
import { CertificationExpiryWorkerService } from '../src/modules/rules-engine/certification-expiry.worker';

interface PrivacyProfileResponse {
  user: { email: string };
  consent: { type: string };
}

interface PrivacyRequestResponse {
  request: { status: string; type: string };
}

interface PrivacyOpenRequestsResponse {
  requests: Array<{ type: string }>;
}

interface PrivacyFulfillmentResponse {
  request: { status: string; processedByUserId: string | null };
}

interface PrivacyBreachIncidentResponse {
  incident: { id: string; pdpaOfficeNotifiedAt: string | null };
}

describe('Privacy endpoints (e2e)', () => {
  let app: INestApplication<App>;
  const authServiceMock = {
    verifyAccessToken: jest.fn((token: string) => {
      if (token === 'admin-token') {
        return Promise.resolve({
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
            companyName: 'ZRL Platform',
            mfaEnabled: true,
            sessionVersion: 0,
          },
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
            jti: 'jti-admin',
          },
        });
      }

      return Promise.resolve({
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
          jti: 'jti-exporter',
        },
      });
    }),
  };
  const privacyServiceMock = {
    getCurrentProfile: jest.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
      },
      consent: {
        type: 'MARKETING_COMMUNICATIONS',
        granted: true,
        source: 'seed',
        updatedAt: '2026-03-28T04:00:00.000Z',
      },
      requests: [],
    }),
    getCurrentConsent: jest.fn().mockResolvedValue({
      consent: {
        type: 'MARKETING_COMMUNICATIONS',
        granted: true,
        source: 'seed',
        updatedAt: '2026-03-28T04:00:00.000Z',
      },
    }),
    updateConsent: jest.fn().mockResolvedValue({
      consent: {
        type: 'MARKETING_COMMUNICATIONS',
        granted: false,
        source: 'settings-ui',
        updatedAt: '2026-03-28T05:00:00.000Z',
      },
    }),
    createRightsRequest: jest.fn().mockResolvedValue({
      request: {
        id: 'request-1',
        type: 'DELETION',
        status: 'PENDING',
        reason: 'Delete my account',
        dueAt: '2026-04-27T05:00:00.000Z',
      },
    }),
    requestDataExport: jest.fn().mockResolvedValue({
      requestId: 'export-1',
      estimatedReady: '2026-03-28T05:00:00.000Z',
    }),
    downloadDataExport: jest.fn().mockResolvedValue({
      fileName: 'pdpa-export-user-1.zip',
      contentType: 'application/zip',
      buffer: Buffer.from('zip-bytes'),
    }),
    listOpenPrivacyRequests: jest.fn().mockResolvedValue({
      requests: [
        {
          id: 'request-1',
          type: 'DELETION',
          status: 'PENDING',
          reason: 'Delete my account',
          details: null,
          dueAt: '2026-04-27T05:00:00.000Z',
          completedAt: null,
          processedByUserId: null,
          resolution: null,
          createdAt: '2026-03-28T05:00:00.000Z',
          updatedAt: '2026-03-28T05:00:00.000Z',
        },
      ],
    }),
    fulfillPrivacyRequest: jest.fn().mockResolvedValue({
      request: {
        id: 'request-1',
        type: 'DELETION',
        status: 'COMPLETED',
        reason: 'Delete my account',
        details: null,
        dueAt: '2026-04-27T05:00:00.000Z',
        completedAt: '2026-03-28T06:00:00.000Z',
        processedByUserId: 'admin-1',
        resolution: {
          action: 'ANONYMIZED',
        },
        createdAt: '2026-03-28T05:00:00.000Z',
        updatedAt: '2026-03-28T06:00:00.000Z',
      },
    }),
    reportBreachIncident: jest.fn().mockResolvedValue({
      incident: {
        id: 'breach-1',
        summary: 'Unauthorized export shared to an external recipient',
        description: 'A generated export was sent to the wrong inbox.',
        affectedUserIds: ['user-1'],
        detectedAt: '2026-03-28T04:00:00.000Z',
        occurredAt: '2026-03-28T03:00:00.000Z',
        pdpaOfficeNotifiedAt: '2026-03-28T04:30:00.000Z',
        dataSubjectsNotifiedAt: '2026-03-28T04:30:00.000Z',
        createdAt: '2026-03-28T04:00:00.000Z',
        updatedAt: '2026-03-28T04:30:00.000Z',
      },
    }),
  };
  const proofPackWorkerServiceMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    getJobMetrics: jest.fn(),
  };
  const certificationExpiryWorkerMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(PrivacyService)
      .useValue(privacyServiceMock)
      .overrideProvider(ProofPackWorkerService)
      .useValue(proofPackWorkerServiceMock)
      .overrideProvider(CertificationExpiryWorkerService)
      .useValue(certificationExpiryWorkerMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('GET /users/me requires JWT', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('GET /users/me returns the authenticated profile', async () => {
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response) => {
        const body = response.body as PrivacyProfileResponse;
        expect(body.user.email).toBe('exporter@example.com');
        expect(body.consent.type).toBe('MARKETING_COMMUNICATIONS');
      });
  });

  it('GET and POST /users/me/consent read and update marketing consent', async () => {
    await request(app.getHttpServer())
      .get('/users/me/consent')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect({
        consent: {
          type: 'MARKETING_COMMUNICATIONS',
          granted: true,
          source: 'seed',
          updatedAt: '2026-03-28T04:00:00.000Z',
        },
      });

    await request(app.getHttpServer())
      .post('/users/me/consent')
      .set('Authorization', 'Bearer access-token')
      .send({
        type: 'MARKETING_COMMUNICATIONS',
        granted: false,
        source: 'settings-ui',
      })
      .expect(201)
      .expect({
        consent: {
          type: 'MARKETING_COMMUNICATIONS',
          granted: false,
          source: 'settings-ui',
          updatedAt: '2026-03-28T05:00:00.000Z',
        },
      });

    expect(privacyServiceMock.updateConsent).toHaveBeenCalledWith('user-1', {
      type: 'MARKETING_COMMUNICATIONS',
      granted: false,
      source: 'settings-ui',
    });
  });

  it('POST /users/me/privacy-requests records a deletion request', async () => {
    await request(app.getHttpServer())
      .post('/users/me/privacy-requests')
      .set('Authorization', 'Bearer access-token')
      .send({
        type: 'DELETION',
        reason: 'Delete my account',
      })
      .expect(201)
      .expect((response) => {
        const body = response.body as PrivacyRequestResponse;
        expect(body.request.status).toBe('PENDING');
        expect(body.request.type).toBe('DELETION');
      });
  });

  it('POST /users/me/data-export and GET /users/me/data-export/:id return a zip', async () => {
    await request(app.getHttpServer())
      .post('/users/me/data-export')
      .set('Authorization', 'Bearer access-token')
      .expect(201)
      .expect({
        requestId: 'export-1',
        estimatedReady: '2026-03-28T05:00:00.000Z',
      });

    await request(app.getHttpServer())
      .get('/users/me/data-export/export-1')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect('Content-Type', /application\/zip/)
      .expect(
        'Content-Disposition',
        'attachment; filename="pdpa-export-user-1.zip"',
      );
  });

  it('GET /privacy/requests is admin-only', async () => {
    await request(app.getHttpServer())
      .get('/privacy/requests')
      .set('Authorization', 'Bearer exporter-token')
      .expect(403);

    await request(app.getHttpServer())
      .get('/privacy/requests')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)
      .expect((response) => {
        const body = response.body as PrivacyOpenRequestsResponse;
        expect(body.requests).toHaveLength(1);
        expect(body.requests[0]?.type).toBe('DELETION');
      });
  });

  it('POST /privacy/requests/:id/fulfill forwards the admin actor', async () => {
    await request(app.getHttpServer())
      .post('/privacy/requests/request-1/fulfill')
      .set('Authorization', 'Bearer admin-token')
      .expect(201)
      .expect((response) => {
        const body = response.body as PrivacyFulfillmentResponse;
        expect(body.request.status).toBe('COMPLETED');
        expect(body.request.processedByUserId).toBe('admin-1');
      });

    expect(privacyServiceMock.fulfillPrivacyRequest).toHaveBeenCalledWith(
      'admin-1',
      'request-1',
    );
  });

  it('POST /privacy/breach-incidents reports a breach through the admin route', async () => {
    await request(app.getHttpServer())
      .post('/privacy/breach-incidents')
      .set('Authorization', 'Bearer admin-token')
      .send({
        summary: 'Unauthorized export shared to an external recipient',
        description: 'A generated export was sent to the wrong inbox.',
        affectedUserIds: ['user-1'],
        detectedAt: '2026-03-28T04:00:00.000Z',
        occurredAt: '2026-03-28T03:00:00.000Z',
      })
      .expect(201)
      .expect((response) => {
        const body = response.body as PrivacyBreachIncidentResponse;
        expect(body.incident.id).toBe('breach-1');
        expect(body.incident.pdpaOfficeNotifiedAt).toBe(
          '2026-03-28T04:30:00.000Z',
        );
      });

    expect(privacyServiceMock.reportBreachIncident).toHaveBeenCalledWith(
      'admin-1',
      {
        summary: 'Unauthorized export shared to an external recipient',
        description: 'A generated export was sent to the wrong inbox.',
        affectedUserIds: ['user-1'],
        detectedAt: '2026-03-28T04:00:00.000Z',
        occurredAt: '2026-03-28T03:00:00.000Z',
      },
    );
  });
});

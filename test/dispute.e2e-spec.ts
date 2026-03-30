import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { DisputeService } from '../src/modules/dispute/dispute.service';

describe('DisputeController (e2e)', () => {
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

  const baseDisputeResult = {
    id: 'dispute-1',
    laneId: 'lane-db-1',
    type: 'QUALITY_CLAIM',
    description: 'Fruit arrived damaged',
    claimant: 'Importer Co',
    status: 'OPEN',
    financialImpact: 50000,
    resolutionNotes: null,
    defensePackId: null,
    createdAt: new Date('2026-03-29T10:00:00.000Z'),
    updatedAt: new Date('2026-03-29T10:00:00.000Z'),
    resolvedAt: null,
  };

  const disputeServiceMock = {
    createDispute: jest.fn().mockResolvedValue(baseDisputeResult),
    getDispute: jest.fn().mockResolvedValue(baseDisputeResult),
    listDisputesForLane: jest.fn().mockResolvedValue([baseDisputeResult]),
    generateDefensePack: jest.fn().mockResolvedValue({
      ...baseDisputeResult,
      defensePackId: 'pack-1',
      status: 'DEFENSE_SUBMITTED',
    }),
    updateDispute: jest.fn().mockResolvedValue({
      ...baseDisputeResult,
      status: 'INVESTIGATING',
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
      .overrideProvider(DisputeService)
      .useValue(disputeServiceMock)
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

  it('POST /lanes/:id/disputes returns 200 with dispute', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/disputes')
      .set('Authorization', 'Bearer access-token')
      .send({
        type: 'QUALITY_CLAIM',
        description: 'Fruit arrived damaged',
        claimant: 'Importer Co',
        financialImpact: 50000,
      })
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as { dispute: { id: string } };
        expect(body.dispute.id).toBe('dispute-1');
      });

    expect(disputeServiceMock.createDispute).toHaveBeenCalledWith(
      'lane-db-1',
      expect.objectContaining({
        type: 'QUALITY_CLAIM',
        description: 'Fruit arrived damaged',
        claimant: 'Importer Co',
        financialImpact: 50000,
      }),
      expect.objectContaining({ id: 'user-1' }),
    );
  });

  it('GET /disputes/:id returns dispute detail', async () => {
    await request(app.getHttpServer())
      .get('/disputes/dispute-1')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          dispute: { id: string; type: string };
        };
        expect(body.dispute.id).toBe('dispute-1');
        expect(body.dispute.type).toBe('QUALITY_CLAIM');
      });
  });

  it('GET /lanes/:id/disputes returns disputes list', async () => {
    await request(app.getHttpServer())
      .get('/lanes/lane-db-1/disputes')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          disputes: Array<{ id: string }>;
        };
        expect(body.disputes).toHaveLength(1);
        expect(body.disputes[0].id).toBe('dispute-1');
      });
  });

  it('POST /disputes/:id/defense-pack triggers generation', async () => {
    await request(app.getHttpServer())
      .post('/disputes/dispute-1/defense-pack')
      .set('Authorization', 'Bearer access-token')
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as {
          dispute: { defensePackId: string; status: string };
        };
        expect(body.dispute.defensePackId).toBe('pack-1');
        expect(body.dispute.status).toBe('DEFENSE_SUBMITTED');
      });
  });

  it('PATCH /disputes/:id updates status', async () => {
    await request(app.getHttpServer())
      .patch('/disputes/dispute-1')
      .set('Authorization', 'Bearer access-token')
      .send({ status: 'INVESTIGATING' })
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { dispute: { status: string } };
        expect(body.dispute.status).toBe('INVESTIGATING');
      });
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/disputes/dispute-1').expect(401);
  });

  it('returns 401 for unauthenticated dispute creation', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/disputes')
      .send({
        type: 'QUALITY_CLAIM',
        description: 'Test',
        claimant: 'Test Co',
      })
      .expect(401);
  });
});

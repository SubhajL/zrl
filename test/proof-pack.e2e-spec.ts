import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { ProofPackService } from '../src/modules/evidence/proof-pack.service';

describe('ProofPack endpoints (e2e)', () => {
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
  const proofPackServiceMock = {
    generatePack: jest.fn().mockResolvedValue({
      id: 'pack-1',
      laneId: 'lane-db-1',
      packType: 'REGULATOR',
      version: 1,
      contentHash: 'a'.repeat(64),
      filePath: 'packs/lane-db-1/REGULATOR-v1.pdf',
      generatedAt: new Date('2026-03-16T10:00:00.000Z'),
      generatedBy: 'user-1',
      recipient: null,
    }),
    listPacks: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(ProofPackService)
      .useValue(proofPackServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('POST /lanes/:id/packs returns 400 for invalid pack type', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/packs')
      .set('Authorization', 'Bearer access-token')
      .send({ packType: 'INVALID' })
      .expect(400)
      .expect((response: Response) => {
        const body = response.body as { message: string };
        expect(body.message).toContain('packType');
      });
  });

  it('GET /lanes/:id/packs returns empty array initially', async () => {
    await request(app.getHttpServer())
      .get('/lanes/lane-db-1/packs')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { packs: unknown[] };
        expect(body.packs).toEqual([]);
        expect(proofPackServiceMock.listPacks).toHaveBeenCalledWith(
          'lane-db-1',
        );
      });
  });
});

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { EvidenceService } from '../src/modules/evidence/evidence.service';

describe('EvidenceController (e2e)', () => {
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
    validateApiKey: jest.fn().mockResolvedValue({
      state: 'VALID',
      user: {
        id: 'partner-1',
        email: 'partner@example.com',
        role: 'PARTNER',
        companyName: 'Partner Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
      apiKey: {
        id: 'key-1',
        scopes: ['*'],
      },
    }),
    resolveLaneOwnerId: jest.fn().mockResolvedValue('user-1'),
  };
  const evidenceServiceMock = {
    listLaneArtifacts: jest.fn().mockResolvedValue({
      artifacts: [
        {
          id: 'artifact-1',
          laneId: 'lane-db-1',
          artifactType: 'PHYTO_CERT',
          fileName: 'phyto.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 2048,
          contentHash:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          contentHashPreview: 'aaaaaaaa',
          storagePath: 'evidence/LN-2026-001/PHYTO_CERT/hash.pdf',
          source: 'UPLOAD',
          checkpointId: null,
          verificationStatus: 'PENDING',
          metadata: null,
          createdAt: '2026-03-22T10:00:00.000Z',
          updatedAt: '2026-03-22T10:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    }),
    uploadArtifact: jest.fn().mockResolvedValue({
      artifact: {
        id: 'artifact-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
      },
    }),
    getArtifact: jest.fn().mockResolvedValue({
      artifact: {
        id: 'artifact-1',
        artifactType: 'PHYTO_CERT',
      },
    }),
    verifyArtifact: jest.fn().mockResolvedValue({
      artifactId: 'artifact-1',
      valid: true,
      storedHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      computedHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }),
    getLaneGraph: jest.fn().mockResolvedValue({
      nodes: [
        {
          id: 'node-1',
          artifactId: 'artifact-1',
          artifactType: 'PHYTO_CERT',
          label: 'Phyto Certificate',
          status: 'PENDING',
          hashPreview: 'aaaaaaaa',
        },
      ],
      edges: [],
    }),
    createPartnerLabArtifact: jest.fn().mockResolvedValue({
      artifact: {
        id: 'artifact-2',
        artifactType: 'MRL_TEST',
      },
    }),
    createPartnerTemperatureArtifact: jest.fn().mockResolvedValue({
      artifact: {
        id: 'artifact-3',
        artifactType: 'TEMP_DATA',
      },
    }),
    deleteArtifact: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(EvidenceService)
      .useValue(evidenceServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('GET /lanes/:id/evidence returns the evidence list', async () => {
    await request(app.getHttpServer())
      .get('/lanes/lane-db-1/evidence?type=PHYTO_CERT&status=PENDING')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          artifacts: Array<{ id: string }>;
          meta: { total: number };
        };
        expect(body.artifacts).toHaveLength(1);
        expect(body.meta.total).toBe(1);
      });
  });

  it('POST /lanes/:id/evidence accepts multipart uploads', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-db-1/evidence')
      .set('Authorization', 'Bearer access-token')
      .field('artifactType', 'PHYTO_CERT')
      .attach('file', Buffer.from('phyto-pdf'), 'phyto.pdf')
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as { artifact: { id: string } };
        expect(body.artifact.id).toBe('artifact-1');
      });
  });

  it('GET /evidence/:id returns artifact detail', async () => {
    await request(app.getHttpServer())
      .get('/evidence/artifact-1')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          artifact: { id: string; artifactType: string };
        };
        expect(body.artifact).toEqual({
          id: 'artifact-1',
          artifactType: 'PHYTO_CERT',
        });
      });
  });

  it('GET /evidence/:id/verify returns verification data', async () => {
    await request(app.getHttpServer())
      .get('/evidence/artifact-1/verify')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { valid: boolean };
        expect(body.valid).toBe(true);
      });
  });

  it('DELETE /evidence/:id soft-deletes the artifact', async () => {
    await request(app.getHttpServer())
      .delete('/evidence/artifact-1')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { success: boolean };
        expect(body.success).toBe(true);
      });
  });

  it('GET /lanes/:id/evidence/graph returns graph data', async () => {
    await request(app.getHttpServer())
      .get('/lanes/lane-db-1/evidence/graph')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { nodes: unknown[]; edges: unknown[] };
        expect(body.nodes).toHaveLength(1);
        expect(body.edges).toHaveLength(0);
      });
  });

  it('POST /partner/lab/results accepts partner evidence pushes', async () => {
    await request(app.getHttpServer())
      .post('/partner/lab/results')
      .set('x-api-key', 'partner-key')
      .send({
        laneId: 'lane-db-1',
        issuer: 'Thai Lab',
        results: [{ substance: 'Chlorpyrifos', value: 0.01 }],
      })
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as { artifact: { artifactType: string } };
        expect(body.artifact.artifactType).toBe('MRL_TEST');
      });
  });
});

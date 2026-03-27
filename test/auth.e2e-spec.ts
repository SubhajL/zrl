import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/common/auth/auth.service';
import { ProofPackWorkerService } from './../src/modules/evidence/proof-pack.worker';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  const authServiceMock = {
    login: jest.fn().mockResolvedValue({
      requireMfa: false,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
      },
    }),
    verifyMfa: jest.fn().mockResolvedValue({
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
      user: {
        id: 'user-2',
        email: 'admin@example.com',
        role: 'ADMIN',
        companyName: null,
        mfaEnabled: true,
      },
    }),
    forgotPassword: jest.fn().mockResolvedValue({
      message:
        'If an account exists for that email, password reset instructions have been sent.',
      resetTokenPreview: 'preview-token',
    }),
    resetPassword: jest.fn().mockResolvedValue({ success: true }),
    verifyAccessToken: jest.fn().mockResolvedValue({
      user: {
        id: 'user-2',
        email: 'admin@example.com',
        role: 'ADMIN',
        companyName: null,
        mfaEnabled: true,
        sessionVersion: 0,
      },
      claims: {
        iss: 'zrl-auth',
        aud: 'zrl',
        sub: 'user-2',
        type: 'access',
        role: 'ADMIN',
        sv: 0,
        mfa: true,
        email: 'admin@example.com',
        companyName: null,
        iat: 1,
        exp: 2,
        jti: 'jti',
      },
    }),
    logout: jest.fn().mockResolvedValue({ success: true }),
  };
  const proofPackWorkerServiceMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    getJobMetrics: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(ProofPackWorkerService)
      .useValue(proofPackWorkerServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('POST /auth/login returns auth tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'exporter@example.com',
        password: 'password',
        ipAddress: '127.0.0.1',
      })
      .expect(201)
      .expect({
        requireMfa: false,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'exporter@example.com',
          role: 'EXPORTER',
          companyName: 'Exporter Co',
          mfaEnabled: false,
        },
      });
  });

  it('POST /auth/logout is guarded and returns success', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer access-token')
      .expect(201)
      .expect({ success: true });

    expect(authServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      'access-token',
    );
    expect(authServiceMock.logout).toHaveBeenCalledWith('user-2');
  });

  it('POST /auth/forgot-password returns a generic response', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({
        email: 'exporter@example.com',
      })
      .expect(201)
      .expect({
        message:
          'If an account exists for that email, password reset instructions have been sent.',
        resetTokenPreview: 'preview-token',
      });

    expect(authServiceMock.forgotPassword).toHaveBeenCalledWith({
      email: 'exporter@example.com',
    });
  });

  it('POST /auth/reset-password completes the reset flow', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: 'reset-token',
        newPassword: 'new-password',
      })
      .expect(201)
      .expect({ success: true });

    expect(authServiceMock.resetPassword).toHaveBeenCalledWith({
      token: 'reset-token',
      newPassword: 'new-password',
    });
  });
});

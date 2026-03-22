import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/common/auth/auth.service';

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
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
});

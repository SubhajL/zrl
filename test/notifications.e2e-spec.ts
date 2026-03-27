import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { ProofPackWorkerService } from '../src/modules/evidence/proof-pack.worker';

describe('Notifications endpoints (e2e)', () => {
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
  };
  const notificationServiceMock = {
    listNotifications: jest.fn().mockResolvedValue({
      notifications: [
        {
          id: 'notification-1',
          userId: 'user-1',
          laneId: 'lane-1',
          type: 'PACK_GENERATED',
          title: 'Proof pack ready',
          message: 'Your regulator pack is ready.',
          data: { packId: 'pack-1' },
          readAt: null,
          createdAt: '2026-03-27T14:00:00.000Z',
        },
      ],
    }),
    markAsRead: jest.fn().mockResolvedValue({ success: true }),
    getUnreadCount: jest.fn().mockResolvedValue({ count: 1 }),
    listPreferences: jest.fn().mockResolvedValue({
      preferences: [],
    }),
    updatePreferences: jest.fn().mockResolvedValue({
      preferences: [],
    }),
    getChannelTargets: jest.fn().mockResolvedValue({
      targets: {
        lineUserId: 'line-user-1',
        pushEndpoint: null,
      },
    }),
    updateChannelTargets: jest.fn().mockResolvedValue({
      targets: {
        lineUserId: 'line-user-1',
        pushEndpoint: 'https://push.example.com/device-1',
      },
    }),
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
      .overrideProvider(NotificationService)
      .useValue(notificationServiceMock)
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

  it('GET /notifications requires JWT', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
  });

  it('GET /notifications returns caller notifications', async () => {
    await request(app.getHttpServer())
      .get('/notifications?read=false&type=PACK_GENERATED&page=2')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          notifications: Array<{ id: string; type: string }>;
        };
        expect(body.notifications).toHaveLength(1);
        expect(body.notifications[0]).toMatchObject({
          id: 'notification-1',
          type: 'PACK_GENERATED',
        });
      });

    expect(notificationServiceMock.listNotifications).toHaveBeenCalledWith(
      'user-1',
      {
        read: false,
        type: 'PACK_GENERATED',
        page: 2,
      },
    );
  });

  it('PATCH /notifications/:id/read marks a row read', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/notification-1/read')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect({ success: true });

    expect(notificationServiceMock.markAsRead).toHaveBeenCalledWith(
      'user-1',
      'notification-1',
    );
  });

  it('GET /notifications/unread-count returns unread count', async () => {
    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect({ count: 1 });
  });

  it('GET /notifications/channel-targets returns caller targets', async () => {
    await request(app.getHttpServer())
      .get('/notifications/channel-targets')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect({
        targets: {
          lineUserId: 'line-user-1',
          pushEndpoint: null,
        },
      });

    expect(notificationServiceMock.getChannelTargets).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('PUT /notifications/channel-targets updates caller targets', async () => {
    await request(app.getHttpServer())
      .put('/notifications/channel-targets')
      .set('Authorization', 'Bearer access-token')
      .send({
        lineUserId: 'line-user-1',
        pushEndpoint: 'https://push.example.com/device-1',
      })
      .expect(200)
      .expect({
        targets: {
          lineUserId: 'line-user-1',
          pushEndpoint: 'https://push.example.com/device-1',
        },
      });

    expect(notificationServiceMock.updateChannelTargets).toHaveBeenCalledWith(
      'user-1',
      {
        lineUserId: 'line-user-1',
        pushEndpoint: 'https://push.example.com/device-1',
      },
    );
  });
});

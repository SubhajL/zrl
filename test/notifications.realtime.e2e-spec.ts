import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, type Socket } from 'socket.io-client';
import { AuthService } from '../src/common/auth/auth.service';
import { NotificationModule } from '../src/modules/notifications/notification.module';
import { RealtimeEventsService } from '../src/modules/notifications/realtime-events.service';
import {
  NOTIFICATION_STORE,
  type NotificationServiceStore,
} from '../src/modules/notifications/notification.types';

function createNotificationStoreMock(): NotificationServiceStore {
  return {
    listNotifications: jest.fn().mockResolvedValue([]),
    findNotificationById: jest.fn().mockResolvedValue(null),
    countUnreadNotifications: jest.fn().mockResolvedValue(0),
    markNotificationRead: jest.fn().mockResolvedValue(null),
    createNotifications: jest.fn().mockResolvedValue([]),
    listPreferences: jest.fn().mockResolvedValue([]),
    upsertPreferences: jest.fn().mockResolvedValue([]),
    getChannelTargets: jest.fn().mockResolvedValue({
      lineUserId: null,
      pushEndpoint: null,
    }),
    upsertChannelTargets: jest.fn().mockResolvedValue({
      lineUserId: null,
      pushEndpoint: null,
    }),
    findLaneRealtimeAccess: jest.fn().mockImplementation((laneId: string) => {
      if (laneId === 'lane-db-1' || laneId === 'LN-2026-001') {
        return {
          id: 'lane-db-1',
          laneId: 'LN-2026-001',
          exporterId: 'user-1',
        };
      }

      return null;
    }),
    findLaneOwnerUserId: jest.fn().mockResolvedValue('user-1'),
    listMarketAudienceUserIds: jest
      .fn()
      .mockResolvedValue(['user-1', 'auditor-1']),
    listDeliveryTargets: jest.fn().mockResolvedValue([]),
  };
}

async function connectClient(baseUrl: string, token: string): Promise<Socket> {
  return await new Promise<Socket>((resolve, reject) => {
    const socket = io(`${baseUrl}/ws`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: 2000,
    });

    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error: Error) => {
      socket.close();
      reject(error);
    });
  });
}

async function emitWithAck<TResponse>(
  socket: Socket,
  event: string,
  payload: Record<string, unknown>,
): Promise<TResponse> {
  return (await socket.timeout(2000).emitWithAck(event, payload)) as TResponse;
}

async function waitForEvent<TPayload>(
  socket: Socket,
  event: string,
): Promise<TPayload> {
  return await new Promise<TPayload>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, 2000);

    socket.once(event, (payload: TPayload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

describe('Notifications realtime gateway (e2e)', () => {
  let app: INestApplication;
  let realtimeEvents: RealtimeEventsService;
  let baseUrl: string;
  const sockets: Socket[] = [];
  const notificationStoreMock = createNotificationStoreMock();
  const authServiceMock = {
    verifyAccessToken: jest.fn().mockImplementation((token: string) => {
      switch (token) {
        case 'owner-token':
          return {
            user: {
              id: 'user-1',
              email: 'exporter@example.com',
              role: 'EXPORTER',
              companyName: 'Exporter Co',
              mfaEnabled: false,
              sessionVersion: 0,
            },
            claims: {},
          };
        case 'auditor-token':
          return {
            user: {
              id: 'auditor-1',
              email: 'auditor@example.com',
              role: 'AUDITOR',
              companyName: 'Audit Co',
              mfaEnabled: false,
              sessionVersion: 0,
            },
            claims: {},
          };
        case 'admin-token':
          return {
            user: {
              id: 'admin-1',
              email: 'admin@example.com',
              role: 'ADMIN',
              companyName: 'Admin Co',
              mfaEnabled: true,
              sessionVersion: 0,
            },
            claims: {},
          };
        default:
          throw new Error('invalid token');
      }
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env['REDIS_URL'];

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotificationModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(NOTIFICATION_STORE)
      .useValue(notificationStoreMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);

    realtimeEvents = app.get(RealtimeEventsService);

    const server = app.getHttpServer() as {
      address(): AddressInfo | string | null;
    };
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Unable to resolve test server address.');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) {
      if (socket.connected) {
        socket.disconnect();
      }
    }

    if (app !== undefined) {
      await app.close();
    }
  });

  it('broadcasts lane events to all subscribed authorized clients only', async () => {
    const owner = await connectClient(baseUrl, 'owner-token');
    const auditor = await connectClient(baseUrl, 'auditor-token');
    const idleOwner = await connectClient(baseUrl, 'owner-token');
    sockets.push(owner, auditor, idleOwner);

    await emitWithAck(owner, 'lane.subscribe', { laneId: 'LN-2026-001' });
    await emitWithAck(auditor, 'lane.subscribe', { laneId: 'lane-db-1' });

    const ownerEvent = waitForEvent<{
      laneId: string;
      oldStatus: string;
      newStatus: string;
    }>(owner, 'lane.status.changed');
    const auditorEvent = waitForEvent<{
      laneId: string;
      oldStatus: string;
      newStatus: string;
    }>(auditor, 'lane.status.changed');

    let idleReceived = false;
    idleOwner.once('lane.status.changed', () => {
      idleReceived = true;
    });

    await realtimeEvents.publishLaneStatusChanged({
      laneId: 'lane-db-1',
      oldStatus: 'EVIDENCE_COLLECTING',
      newStatus: 'VALIDATED',
    });

    await expect(ownerEvent).resolves.toMatchObject({
      laneId: 'lane-db-1',
      oldStatus: 'EVIDENCE_COLLECTING',
      newStatus: 'VALIDATED',
    });
    await expect(auditorEvent).resolves.toMatchObject({
      laneId: 'lane-db-1',
      oldStatus: 'EVIDENCE_COLLECTING',
      newStatus: 'VALIDATED',
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(idleReceived).toBe(false);
  });

  it('GET /notifications/ws/metrics returns metrics for admin', async () => {
    const res = await request(app.getHttpServer() as App)
      .get('/notifications/ws/metrics')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
    expect(res.body).toHaveProperty('scope', 'instance');
    expect(res.body).toHaveProperty('activeConnections');
    expect(res.body).toHaveProperty('laneSubscriptions');
  });
});

import { NotificationGateway } from './notification.gateway';
import { NotificationPubSub } from './notification.pubsub';
import type { NotificationRecord } from './notification.types';

function buildNotification(): NotificationRecord {
  return {
    id: 'notification-1',
    userId: 'user-1',
    laneId: 'lane-1',
    type: 'PACK_GENERATED',
    title: 'Pack ready',
    message: 'Proof pack generated.',
    data: { packId: 'pack-1' },
    readAt: null,
    createdAt: new Date('2026-03-28T00:00:00.000Z'),
  };
}

describe('NotificationPubSub', () => {
  beforeEach(() => {
    process.env['REDIS_URL'] = 'redis://localhost:6379';
  });

  afterEach(() => {
    delete process.env['REDIS_URL'];
  });

  it('publishes serialized notifications when redis is connected', async () => {
    const publish = jest.fn().mockResolvedValue(1);
    const subscribe = jest.fn().mockResolvedValue(undefined);
    const connect = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const pubSub = new NotificationPubSub(
      {
        emitNotification: jest.fn(),
      } as unknown as NotificationGateway,
      () => ({
        duplicate: jest.fn().mockReturnValue({
          connect,
          subscribe,
          disconnect,
        }),
        connect,
        publish,
        disconnect,
      }),
    );

    await pubSub.onModuleInit();
    await expect(
      pubSub.publishNotificationCreated(buildNotification()),
    ).resolves.toBe(true);
  });

  it('emits notifications received from the pubsub channel', async () => {
    const emitNotification = jest.fn();
    const handlers = new Map<string, (payload: string) => void>();
    const connect = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const pubSub = new NotificationPubSub(
      {
        emitNotification,
      } as unknown as NotificationGateway,
      () => ({
        duplicate: jest.fn().mockReturnValue({
          connect,
          subscribe: jest
            .fn()
            .mockImplementation(
              (channel: string, callback: (payload: string) => void) => {
                handlers.set(channel, callback);
                return Promise.resolve();
              },
            ),
          disconnect,
        }),
        connect,
        publish: jest.fn().mockResolvedValue(1),
        disconnect,
      }),
    );

    await pubSub.onModuleInit();
    handlers.get('notification.created')?.(
      JSON.stringify({
        notification: {
          ...buildNotification(),
          createdAt: buildNotification().createdAt.toISOString(),
          readAt: null,
        },
      }),
    );

    expect(emitNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        id: 'notification-1',
      }),
    );
  });

  it('publishes and replays serialized temperature excursion events', async () => {
    const emitLaneEvent = jest.fn();
    const handlers = new Map<string, (payload: string) => void>();
    const connect = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const publish = jest.fn().mockResolvedValue(1);
    const pubSub = new NotificationPubSub(
      {
        emitNotification: jest.fn(),
        emitLaneEvent,
        emitUserEvent: jest.fn(),
      } as unknown as NotificationGateway,
      () => ({
        duplicate: jest.fn().mockReturnValue({
          connect,
          subscribe: jest
            .fn()
            .mockImplementation(
              (channel: string, callback: (payload: string) => void) => {
                handlers.set(channel, callback);
                return Promise.resolve();
              },
            ),
          disconnect,
        }),
        connect,
        publish,
        disconnect,
      }),
    );

    await pubSub.onModuleInit();
    await expect(
      (
        pubSub as unknown as {
          publishLaneEvent: (
            eventName: string,
            laneId: string,
            payload: {
              laneId: string;
              highestSeverity: string;
              excursionCount: number;
              slaBreached: boolean;
            },
          ) => Promise<boolean>;
        }
      ).publishLaneEvent('temperature.excursion', 'lane-db-1', {
        laneId: 'lane-1',
        highestSeverity: 'SEVERE',
        excursionCount: 1,
        slaBreached: false,
        notificationId: 'notification-1',
        title: 'Critical temperature excursion detected',
        message: '1 new temperature excursion was detected for this lane.',
        excursions: [
          {
            severity: 'SEVERE',
            startedAt: new Date('2026-03-28T01:00:00.000Z'),
            endedAt: null,
            type: 'HEAT',
            direction: 'HIGH',
            durationMinutes: 45,
          },
        ],
      }),
    ).resolves.toBe(true);

    handlers.get('realtime.lane')?.(
      JSON.stringify({
        eventName: 'temperature.excursion',
        laneId: 'lane-db-1',
        payload: {
          laneId: 'lane-1',
          highestSeverity: 'SEVERE',
          excursionCount: 1,
          slaBreached: false,
          notificationId: 'notification-1',
          title: 'Critical temperature excursion detected',
          message: '1 new temperature excursion was detected for this lane.',
          excursions: [
            {
              severity: 'SEVERE',
              startedAt: '2026-03-28T01:00:00.000Z',
              endedAt: null,
              type: 'HEAT',
              direction: 'HIGH',
              durationMinutes: 45,
            },
          ],
        },
      }),
    );

    expect(emitLaneEvent).toHaveBeenCalledWith(
      'temperature.excursion',
      'lane-db-1',
      expect.objectContaining({
        laneId: 'lane-1',
        highestSeverity: 'SEVERE',
      }),
    );
  });

  it('publishes and replays user scoped realtime events', async () => {
    const emitUserEvent = jest.fn();
    const handlers = new Map<string, (payload: string) => void>();
    const connect = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const publish = jest.fn().mockResolvedValue(1);
    const pubSub = new NotificationPubSub(
      {
        emitNotification: jest.fn(),
        emitLaneEvent: jest.fn(),
        emitUserEvent,
      } as unknown as NotificationGateway,
      () => ({
        duplicate: jest.fn().mockReturnValue({
          connect,
          subscribe: jest
            .fn()
            .mockImplementation(
              (channel: string, callback: (payload: string) => void) => {
                handlers.set(channel, callback);
                return Promise.resolve();
              },
            ),
          disconnect,
        }),
        connect,
        publish,
        disconnect,
      }),
    );

    await pubSub.onModuleInit();
    await expect(
      (
        pubSub as unknown as {
          publishUserEvent: (
            eventName: string,
            userId: string,
            payload: { marketId: string; changedSubstances: string[] },
          ) => Promise<boolean>;
        }
      ).publishUserEvent('rule.updated', 'user-1', {
        marketId: 'JAPAN',
        changedSubstances: ['Carbendazim'],
      }),
    ).resolves.toBe(true);

    handlers.get('realtime.user')?.(
      JSON.stringify({
        eventName: 'rule.updated',
        userId: 'user-1',
        payload: {
          marketId: 'JAPAN',
          changedSubstances: ['Carbendazim'],
        },
      }),
    );

    expect(emitUserEvent).toHaveBeenCalledWith('rule.updated', 'user-1', {
      marketId: 'JAPAN',
      changedSubstances: ['Carbendazim'],
    });
  });
});

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
    let handler: ((payload: string) => void) | undefined;
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
              (_channel: string, callback: (payload: string) => void) => {
                handler = callback;
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
    handler?.(
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
});

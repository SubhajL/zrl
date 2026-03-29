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
  it('delegates notification to gateway directly', async () => {
    const emitNotification = jest.fn();
    const pubSub = new NotificationPubSub({
      emitNotification,
    } as unknown as NotificationGateway);
    const notification = buildNotification();
    await pubSub.publishNotificationCreated(notification);
    expect(emitNotification).toHaveBeenCalledWith(
      notification.userId,
      notification,
    );
  });

  it('delegates lane events to gateway directly', async () => {
    const emitLaneEvent = jest.fn();
    const pubSub = new NotificationPubSub({
      emitLaneEvent,
    } as unknown as NotificationGateway);
    await pubSub.publishLaneEvent('lane.status.changed', 'lane-1', {
      laneId: 'lane-1',
      oldStatus: 'CREATED',
      newStatus: 'VALIDATED',
    });
    expect(emitLaneEvent).toHaveBeenCalledWith(
      'lane.status.changed',
      'lane-1',
      expect.objectContaining({ laneId: 'lane-1' }),
    );
  });

  it('delegates user events to gateway directly', async () => {
    const emitUserEvent = jest.fn();
    const pubSub = new NotificationPubSub({
      emitUserEvent,
    } as unknown as NotificationGateway);
    await pubSub.publishUserEvent('rule.updated', 'user-1', {
      marketId: 'JAPAN',
      changedSubstances: ['Carbendazim'],
    });
    expect(emitUserEvent).toHaveBeenCalledWith(
      'rule.updated',
      'user-1',
      expect.objectContaining({ marketId: 'JAPAN' }),
    );
  });

  it('returns true when redis adapter is configured', async () => {
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    const connect = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const mockServer = { adapter: jest.fn() };
    const gateway = {
      emitNotification: jest.fn(),
      server: mockServer,
    } as unknown as NotificationGateway;
    const pubSub = new NotificationPubSub(gateway, () => ({
      duplicate: jest.fn().mockReturnValue({ connect, disconnect }),
      connect,
      disconnect,
    }));
    await pubSub.onModuleInit();
    const result = await pubSub.publishNotificationCreated(buildNotification());
    expect(result).toBe(true);
    expect(mockServer.adapter).toHaveBeenCalled();
    delete process.env['REDIS_URL'];
  });

  it('returns false when redis is not configured', async () => {
    delete process.env['REDIS_URL'];
    const emitNotification = jest.fn();
    const pubSub = new NotificationPubSub({
      emitNotification,
    } as unknown as NotificationGateway);
    await pubSub.onModuleInit();
    const result = await pubSub.publishNotificationCreated(buildNotification());
    expect(result).toBe(false);
  });
});

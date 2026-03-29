import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { NotificationGateway } from './notification.gateway';
import type {
  LaneRealtimeEventName,
  LaneRealtimeEventPayloadMap,
  NotificationFanoutPublisher,
  NotificationRecord,
  TemperatureExcursionRealtimeEvent,
  UserRealtimeEventName,
  UserRealtimeEventPayloadMap,
} from './notification.types';

interface NotificationRedisClient {
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  duplicate(): NotificationRedisClient;
}

export type NotificationRedisClientFactory = () => NotificationRedisClient;

export const NOTIFICATION_REDIS_CLIENT_FACTORY = Symbol(
  'NOTIFICATION_REDIS_CLIENT_FACTORY',
);

@Injectable()
export class NotificationPubSub implements NotificationFanoutPublisher {
  private readonly logger = new Logger(NotificationPubSub.name);
  private publisher: NotificationRedisClient | null = null;
  private subscriber: NotificationRedisClient | null = null;

  constructor(
    private readonly gateway: NotificationGateway,
    @Optional()
    @Inject(NOTIFICATION_REDIS_CLIENT_FACTORY)
    private readonly createRedisClient: NotificationRedisClientFactory = () =>
      createClient({
        url: process.env['REDIS_URL']?.trim() || undefined,
      }),
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env['REDIS_URL']?.trim() || null;
    if (redisUrl === null) {
      this.logger.warn(
        'Notification Redis pubsub disabled: REDIS_URL is not configured.',
      );
      return;
    }

    try {
      const pubClient = this.createRedisClient();
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      this.gateway.server.adapter(createAdapter(pubClient, subClient));
      this.publisher = pubClient;
      this.subscriber = subClient;
      this.logger.log('Redis adapter configured for cross-instance pubsub.');
    } catch (error) {
      this.logger.warn(
        `Notification Redis pubsub unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.onModuleDestroy();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.publisher?.disconnect(),
      this.subscriber?.disconnect(),
    ]);
    this.publisher = null;
    this.subscriber = null;
  }

  publishNotificationCreated(
    notification: NotificationRecord,
  ): Promise<boolean> {
    this.gateway.emitNotification(notification.userId, notification);
    return Promise.resolve(this.publisher !== null);
  }

  publishLaneEvent<TEventName extends LaneRealtimeEventName>(
    eventName: TEventName,
    laneId: string,
    payload: LaneRealtimeEventPayloadMap[TEventName],
  ): Promise<boolean> {
    this.gateway.emitLaneEvent(eventName, laneId, payload);
    return Promise.resolve(this.publisher !== null);
  }

  publishUserEvent<TEventName extends UserRealtimeEventName>(
    eventName: TEventName,
    userId: string,
    payload: UserRealtimeEventPayloadMap[TEventName],
  ): Promise<boolean> {
    this.gateway.emitUserEvent(eventName, userId, payload);
    return Promise.resolve(this.publisher !== null);
  }

  publishTemperatureExcursion(
    event: TemperatureExcursionRealtimeEvent,
  ): Promise<boolean> {
    this.gateway.emitLaneEvent('temperature.excursion', event.laneId, event);
    return Promise.resolve(this.publisher !== null);
  }
}

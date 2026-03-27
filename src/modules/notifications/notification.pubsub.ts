import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createClient } from 'redis';
import { NOTIFICATION_CREATED_CHANNEL } from './notification.constants';
import { NotificationGateway } from './notification.gateway';
import type {
  NotificationFanoutPublisher,
  NotificationRecord,
} from './notification.types';

interface NotificationRedisClient {
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  duplicate(): NotificationRedisClient;
  publish(channel: string, payload: string): Promise<unknown>;
  subscribe(
    channel: string,
    listener: (payload: string) => void,
  ): Promise<unknown>;
}

export type NotificationRedisClientFactory = () => NotificationRedisClient;

export const NOTIFICATION_REDIS_CLIENT_FACTORY = Symbol(
  'NOTIFICATION_REDIS_CLIENT_FACTORY',
);

interface SerializedNotificationRecord extends Omit<
  NotificationRecord,
  'createdAt' | 'readAt'
> {
  readonly createdAt: string;
  readonly readAt: string | null;
}

interface NotificationCreatedEventPayload {
  readonly notification: SerializedNotificationRecord;
}

function serializeNotificationRecord(
  notification: NotificationRecord,
): NotificationCreatedEventPayload {
  return {
    notification: {
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
    },
  };
}

function parseNotificationRecord(
  value: NotificationCreatedEventPayload,
): NotificationRecord {
  return {
    ...value.notification,
    createdAt: new Date(value.notification.createdAt),
    readAt:
      value.notification.readAt === null
        ? null
        : new Date(value.notification.readAt),
  };
}

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
      const publisher = this.createRedisClient();
      const subscriber = publisher.duplicate();
      await publisher.connect();
      await subscriber.connect();
      await subscriber.subscribe(
        NOTIFICATION_CREATED_CHANNEL,
        (payload: string) => {
          this.handleMessage(payload);
        },
      );
      this.publisher = publisher;
      this.subscriber = subscriber;
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

  async publishNotificationCreated(
    notification: NotificationRecord,
  ): Promise<boolean> {
    if (this.publisher === null) {
      this.gateway.emitNotification(notification.userId, notification);
      return false;
    }

    try {
      await this.publisher.publish(
        NOTIFICATION_CREATED_CHANNEL,
        JSON.stringify(serializeNotificationRecord(notification)),
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Notification publish failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.gateway.emitNotification(notification.userId, notification);
      return false;
    }
  }

  private handleMessage(payload: string): void {
    try {
      const event = JSON.parse(payload) as NotificationCreatedEventPayload;
      const notification = parseNotificationRecord(event);
      this.gateway.emitNotification(notification.userId, notification);
    } catch (error) {
      this.logger.warn(
        `Ignoring invalid notification pubsub payload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

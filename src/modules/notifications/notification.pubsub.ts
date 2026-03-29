import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createClient } from 'redis';
import {
  LANE_REALTIME_CHANNEL,
  NOTIFICATION_CREATED_CHANNEL,
  TEMPERATURE_EXCURSION_CHANNEL,
  USER_REALTIME_CHANNEL,
} from './notification.constants';
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

interface SerializedTemperatureExcursionAlertSummary {
  readonly severity: TemperatureExcursionRealtimeEvent['highestSeverity'];
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly type: 'CHILLING' | 'HEAT';
  readonly direction: 'LOW' | 'HIGH';
  readonly durationMinutes: number;
}

interface TemperatureExcursionEventPayload {
  readonly eventName: 'temperature.excursion';
  readonly laneId: string;
  readonly payload: Omit<TemperatureExcursionRealtimeEvent, 'excursions'> & {
    readonly excursions: readonly SerializedTemperatureExcursionAlertSummary[];
  };
}

interface GenericLaneRealtimeEventPayload {
  readonly eventName: Exclude<LaneRealtimeEventName, 'temperature.excursion'>;
  readonly laneId: string;
  readonly payload: Record<string, unknown>;
}

interface UserRealtimeEventPayload {
  readonly eventName: UserRealtimeEventName;
  readonly userId: string;
  readonly payload: UserRealtimeEventPayloadMap[UserRealtimeEventName];
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

function serializeTemperatureExcursionEvent(
  event: TemperatureExcursionRealtimeEvent,
): TemperatureExcursionEventPayload {
  return {
    eventName: 'temperature.excursion',
    laneId: event.laneId,
    payload: {
      ...event,
      excursions: event.excursions.map((excursion) => ({
        ...excursion,
        startedAt: excursion.startedAt.toISOString(),
        endedAt: excursion.endedAt?.toISOString() ?? null,
      })),
    },
  };
}

function parseTemperatureExcursionEvent(
  value: TemperatureExcursionEventPayload,
): {
  laneId: string;
  event: TemperatureExcursionRealtimeEvent;
} {
  return {
    laneId: value.laneId,
    event: {
      ...value.payload,
      excursions: value.payload.excursions.map((excursion) => ({
        ...excursion,
        startedAt: new Date(excursion.startedAt),
        endedAt:
          excursion.endedAt === null ? null : new Date(excursion.endedAt),
      })),
    },
  };
}

function serializeLaneEvent<TEventName extends LaneRealtimeEventName>(
  eventName: TEventName,
  laneId: string,
  payload: LaneRealtimeEventPayloadMap[TEventName],
): TemperatureExcursionEventPayload | GenericLaneRealtimeEventPayload {
  if (eventName === 'temperature.excursion') {
    return serializeTemperatureExcursionEvent(
      payload as LaneRealtimeEventPayloadMap['temperature.excursion'],
    );
  }

  return {
    eventName,
    laneId,
    payload: payload as unknown as Record<string, unknown>,
  };
}

function parseLaneEvent(
  value: TemperatureExcursionEventPayload | GenericLaneRealtimeEventPayload,
): {
  eventName: LaneRealtimeEventName;
  laneId: string;
  payload: LaneRealtimeEventPayloadMap[LaneRealtimeEventName];
} {
  if (value.eventName === 'temperature.excursion') {
    const parsed = parseTemperatureExcursionEvent(value);
    return {
      eventName: 'temperature.excursion',
      laneId: parsed.laneId,
      payload: parsed.event,
    };
  }

  return {
    eventName: value.eventName,
    laneId: value.laneId,
    payload:
      value.payload as unknown as LaneRealtimeEventPayloadMap[LaneRealtimeEventName],
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
          this.handleNotificationMessage(payload);
        },
      );
      await subscriber.subscribe(
        TEMPERATURE_EXCURSION_CHANNEL,
        (payload: string) => {
          this.handleTemperatureExcursionMessage(payload);
        },
      );
      await subscriber.subscribe(LANE_REALTIME_CHANNEL, (payload: string) => {
        this.handleLaneRealtimeMessage(payload);
      });
      await subscriber.subscribe(USER_REALTIME_CHANNEL, (payload: string) => {
        this.handleUserRealtimeMessage(payload);
      });
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

  async publishTemperatureExcursion(
    event: TemperatureExcursionRealtimeEvent,
  ): Promise<boolean> {
    return await this.publishLaneEvent(
      'temperature.excursion',
      event.laneId,
      event,
    );
  }

  async publishLaneEvent<TEventName extends LaneRealtimeEventName>(
    eventName: TEventName,
    laneId: string,
    payload: LaneRealtimeEventPayloadMap[TEventName],
  ): Promise<boolean> {
    if (this.publisher === null) {
      this.gateway.emitLaneEvent(eventName, laneId, payload);
      return false;
    }

    try {
      await this.publisher.publish(
        eventName === 'temperature.excursion'
          ? TEMPERATURE_EXCURSION_CHANNEL
          : LANE_REALTIME_CHANNEL,
        JSON.stringify(serializeLaneEvent(eventName, laneId, payload)),
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Lane realtime publish failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.gateway.emitLaneEvent(eventName, laneId, payload);
      return false;
    }
  }

  async publishUserEvent<TEventName extends UserRealtimeEventName>(
    eventName: TEventName,
    userId: string,
    payload: UserRealtimeEventPayloadMap[TEventName],
  ): Promise<boolean> {
    if (this.publisher === null) {
      this.gateway.emitUserEvent(eventName, userId, payload);
      return false;
    }

    try {
      await this.publisher.publish(
        USER_REALTIME_CHANNEL,
        JSON.stringify({
          eventName,
          userId,
          payload,
        } satisfies UserRealtimeEventPayload),
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `User realtime publish failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.gateway.emitUserEvent(eventName, userId, payload);
      return false;
    }
  }

  private handleNotificationMessage(payload: string): void {
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

  private handleTemperatureExcursionMessage(payload: string): void {
    try {
      const parsed = parseTemperatureExcursionEvent(
        JSON.parse(payload) as TemperatureExcursionEventPayload,
      );
      this.gateway.emitLaneEvent(
        'temperature.excursion',
        parsed.laneId,
        parsed.event,
      );
    } catch (error) {
      this.logger.warn(
        `Ignoring invalid temperature excursion pubsub payload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private handleLaneRealtimeMessage(payload: string): void {
    try {
      const parsed = parseLaneEvent(
        JSON.parse(payload) as GenericLaneRealtimeEventPayload,
      );
      this.gateway.emitLaneEvent(
        parsed.eventName,
        parsed.laneId,
        parsed.payload,
      );
    } catch (error) {
      this.logger.warn(
        `Ignoring invalid lane realtime pubsub payload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private handleUserRealtimeMessage(payload: string): void {
    try {
      const parsed = JSON.parse(payload) as UserRealtimeEventPayload;
      this.gateway.emitUserEvent(
        parsed.eventName,
        parsed.userId,
        parsed.payload,
      );
    } catch (error) {
      this.logger.warn(
        `Ignoring invalid user realtime pubsub payload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

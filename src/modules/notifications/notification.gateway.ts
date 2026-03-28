import {
  BadRequestException,
  ForbiddenException,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../../common/auth/auth.service';
import type {
  LaneRealtimeEventName,
  LaneRealtimeEventPayloadMap,
  LaneSubscriptionInput,
  NotificationRecord,
  NotificationServiceStore,
  TemperatureExcursionRealtimeEvent,
  UserRealtimeEventName,
  UserRealtimeEventPayloadMap,
} from './notification.types';
import { NOTIFICATION_STORE } from './notification.types';

function getBearerToken(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1] ?? null;
}

interface NotificationSocketData {
  userId?: string;
  role?: string;
}

type NotificationSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  NotificationSocketData
>;

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly authService: AuthService,
    @Inject(NOTIFICATION_STORE)
    private readonly store: NotificationServiceStore,
  ) {}

  async handleConnection(client: NotificationSocket): Promise<void> {
    const authToken = this.resolveToken(client);
    if (authToken === null) {
      throw new UnauthorizedException('Missing websocket bearer token.');
    }

    const verified = await this.authService.verifyAccessToken(authToken);
    client.data['userId'] = verified.user.id;
    client.data['role'] = verified.user.role;
    await client.join(this.roomName(verified.user.id));
  }

  @SubscribeMessage('lane.subscribe')
  async handleSubscribeLane(
    @ConnectedSocket() client: NotificationSocket,
    @MessageBody() body: LaneSubscriptionInput,
  ): Promise<{ laneId: string }> {
    const access = await this.requireLaneAccess(client, body);
    await client.join(this.laneRoomName(access.id));
    return { laneId: access.id };
  }

  @SubscribeMessage('lane.unsubscribe')
  async handleUnsubscribeLane(
    @ConnectedSocket() client: NotificationSocket,
    @MessageBody() body: LaneSubscriptionInput,
  ): Promise<{ laneId: string }> {
    const access = await this.requireLaneAccess(client, body);
    await client.leave(this.laneRoomName(access.id));
    return { laneId: access.id };
  }

  emitNotification(userId: string, notification: NotificationRecord): void {
    this.server.to(this.roomName(userId)).emit('notification.new', {
      notification,
    });
  }

  emitLaneEvent<TEventName extends LaneRealtimeEventName>(
    eventName: TEventName,
    laneId: string,
    payload: LaneRealtimeEventPayloadMap[TEventName],
  ): void {
    this.server.to(this.laneRoomName(laneId)).emit(eventName, payload);
  }

  emitUserEvent<TEventName extends UserRealtimeEventName>(
    eventName: TEventName,
    userId: string,
    payload: UserRealtimeEventPayloadMap[TEventName],
  ): void {
    this.server.to(this.roomName(userId)).emit(eventName, payload);
  }

  emitTemperatureExcursion(
    _userId: string,
    event: TemperatureExcursionRealtimeEvent,
  ): void {
    this.emitLaneEvent('temperature.excursion', event.laneId, event);
  }

  private resolveToken(client: NotificationSocket): string | null {
    const auth = client.handshake.auth as Record<string, unknown>;
    const authToken = auth['token'];
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const headerValue = client.handshake.headers['authorization'];
    if (typeof headerValue === 'string') {
      return getBearerToken(headerValue);
    }

    return null;
  }

  private roomName(userId: string): string {
    return `user:${userId}`;
  }

  private laneRoomName(laneId: string): string {
    return `lane:${laneId}`;
  }

  private async requireLaneAccess(
    client: NotificationSocket,
    body: LaneSubscriptionInput,
  ) {
    const userId = client.data['userId'];
    const role = client.data['role'];
    if (
      userId === undefined ||
      role === undefined ||
      userId.trim().length === 0 ||
      role.trim().length === 0
    ) {
      throw new UnauthorizedException('Authentication required.');
    }

    const laneId = body?.laneId?.trim() ?? '';
    if (laneId.length === 0) {
      throw new BadRequestException('laneId is required.');
    }

    const access = await this.store.findLaneRealtimeAccess(laneId);
    if (access === null) {
      throw new ForbiddenException('Lane ownership required.');
    }

    if (
      role !== 'ADMIN' &&
      role !== 'AUDITOR' &&
      access.exporterId !== userId
    ) {
      throw new ForbiddenException('Lane ownership required.');
    }

    return access;
  }
}

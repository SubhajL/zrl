import { UnauthorizedException } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../../common/auth/auth.service';
import type {
  NotificationRecord,
  TemperatureExcursionRealtimeEvent,
} from './notification.types';

function getBearerToken(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1] ?? null;
}

interface NotificationSocketData {
  userId?: string;
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

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: NotificationSocket): Promise<void> {
    const authToken = this.resolveToken(client);
    if (authToken === null) {
      throw new UnauthorizedException('Missing websocket bearer token.');
    }

    const verified = await this.authService.verifyAccessToken(authToken);
    client.data['userId'] = verified.user.id;
    await client.join(this.roomName(verified.user.id));
  }

  emitNotification(userId: string, notification: NotificationRecord): void {
    this.server.to(this.roomName(userId)).emit('notification.new', {
      notification,
    });
  }

  emitTemperatureExcursion(
    userId: string,
    event: TemperatureExcursionRealtimeEvent,
  ): void {
    this.server.to(this.roomName(userId)).emit('temperature.excursion', event);
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
}

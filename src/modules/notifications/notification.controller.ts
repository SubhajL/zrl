import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/auth.guards';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { NotificationService } from './notification.service';
import {
  NotificationType,
  SUPPORTED_NOTIFICATION_TYPES,
  type NotificationChannelPreference,
  type NotificationChannelTargets,
  type NotificationListFilter,
} from './notification.types';

function assertString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value.trim();
}

function parseBoolean(
  value: string | undefined,
  context: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  throw new BadRequestException(`Invalid ${context}.`);
}

function parseInteger(
  value: string | undefined,
  context: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return parsed;
}

function parseNotificationType(
  value: string | undefined,
): NotificationType | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = assertString(
    value,
    'type',
  ).toUpperCase() as NotificationType;
  if (!SUPPORTED_NOTIFICATION_TYPES.includes(normalized)) {
    throw new BadRequestException('Unsupported notification type.');
  }

  return normalized;
}

function parsePreferenceBody(body: unknown): NotificationChannelPreference[] {
  if (!Array.isArray(body)) {
    throw new BadRequestException('Invalid notification preferences payload.');
  }

  return body.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new BadRequestException('Invalid notification preference.');
    }

    const record = entry as Record<string, unknown>;
    const type = parseNotificationType(assertString(record['type'], 'type'))!;
    return {
      type,
      inAppEnabled: Boolean(record['inAppEnabled']),
      emailEnabled: Boolean(record['emailEnabled']),
      pushEnabled: Boolean(record['pushEnabled']),
      lineEnabled: Boolean(record['lineEnabled']),
    };
  });
}

function parseOptionalTargetValue(
  value: unknown,
  context: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function parseChannelTargetsBody(body: unknown): NotificationChannelTargets {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException(
      'Invalid notification channel targets payload.',
    );
  }

  const record = body as Record<string, unknown>;
  return {
    lineUserId: parseOptionalTargetValue(record['lineUserId'], 'lineUserId'),
    pushEndpoint: parseOptionalTargetValue(
      record['pushEndpoint'],
      'pushEndpoint',
    ),
  };
}

function requireUserId(request: AuthPrincipalRequest): string {
  const userId = request.user?.id ?? request.auth?.user.id;
  if (userId === undefined) {
    throw new BadRequestException('Authentication context missing.');
  }

  return userId;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async listNotifications(
    @Req() request: AuthPrincipalRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return await this.notificationService.listNotifications(
      requireUserId(request),
      {
        read: parseBoolean(query['read'], 'read'),
        type: parseNotificationType(query['type']),
        page: parseInteger(query['page'], 'page'),
      } satisfies NotificationListFilter,
    );
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.notificationService.markAsRead(
      requireUserId(request),
      notificationId,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Req() request: AuthPrincipalRequest) {
    return await this.notificationService.getUnreadCount(
      requireUserId(request),
    );
  }

  @Get('preferences')
  async listPreferences(@Req() request: AuthPrincipalRequest) {
    return await this.notificationService.listPreferences(
      requireUserId(request),
    );
  }

  @Put('preferences')
  async updatePreferences(
    @Req() request: AuthPrincipalRequest,
    @Body() body: unknown,
  ) {
    return await this.notificationService.updatePreferences(
      requireUserId(request),
      parsePreferenceBody(body),
    );
  }

  @Get('channel-targets')
  async getChannelTargets(@Req() request: AuthPrincipalRequest) {
    return await this.notificationService.getChannelTargets(
      requireUserId(request),
    );
  }

  @Put('channel-targets')
  async updateChannelTargets(
    @Req() request: AuthPrincipalRequest,
    @Body() body: unknown,
  ) {
    return await this.notificationService.updateChannelTargets(
      requireUserId(request),
      parseChannelTargetsBody(body),
    );
  }
}

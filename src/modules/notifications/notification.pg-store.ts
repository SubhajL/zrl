import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool, type QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';
import type {
  NotificationChannelPreference,
  NotificationChannelTargets,
  NotificationCreationInput,
  NotificationDeliveryTarget,
  NotificationListFilter,
  NotificationRecord,
  NotificationServiceStore,
  NotificationType,
  UserNotificationPreferenceRecord,
} from './notification.types';

interface NotificationRow extends QueryResultRow {
  id: string;
  user_id: string;
  lane_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | string | null;
  read_at: Date | string | null;
  created_at: Date | string;
}

interface NotificationPreferenceRow extends QueryResultRow {
  id: string;
  user_id: string;
  type: NotificationType;
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  line_enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface UserDeliveryTargetRow extends QueryResultRow {
  id: string;
  email: string | null;
  line_user_id: string | null;
  push_endpoint: string | null;
}

interface NotificationChannelTargetRow extends QueryResultRow {
  line_user_id: string | null;
  push_endpoint: string | null;
}

@Injectable()
export class PrismaNotificationStore implements NotificationServiceStore {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | undefined) {}

  async listNotifications(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<NotificationRecord[]> {
    const values: Array<string | number | boolean> = [userId];
    const conditions = ['user_id = $1'];

    if (filter.read !== undefined) {
      conditions.push(filter.read ? `read_at IS NOT NULL` : `read_at IS NULL`);
    }

    if (filter.type !== undefined) {
      values.push(filter.type);
      conditions.push(`type = $${values.length}`);
    }

    const limit = filter.limit ?? 20;
    const page = filter.page ?? 1;
    values.push(limit);
    values.push((page - 1) * limit);

    const result = await this.requirePool().query<NotificationRow>(
      `
        SELECT
          id,
          user_id,
          lane_id,
          type,
          title,
          message,
          data,
          read_at,
          created_at
        FROM notifications
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => this.mapNotificationRow(row));
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    const result = await this.requirePool().query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM notifications
        WHERE user_id = $1
          AND read_at IS NULL
      `,
      [userId],
    );
    return Number(result.rows[0]?.count ?? '0');
  }

  async findNotificationById(
    notificationId: string,
    userId: string,
  ): Promise<NotificationRecord | null> {
    const result = await this.requirePool().query<NotificationRow>(
      `
        SELECT
          id,
          user_id,
          lane_id,
          type,
          title,
          message,
          data,
          read_at,
          created_at
        FROM notifications
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [notificationId, userId],
    );

    return result.rowCount === 0
      ? null
      : this.mapNotificationRow(result.rows[0]);
  }

  async markNotificationRead(
    notificationId: string,
    userId: string,
    readAt: Date,
  ): Promise<NotificationRecord | null> {
    const result = await this.requirePool().query<NotificationRow>(
      `
        UPDATE notifications
        SET read_at = COALESCE(read_at, $3)
        WHERE id = $1
          AND user_id = $2
        RETURNING
          id,
          user_id,
          lane_id,
          type,
          title,
          message,
          data,
          read_at,
          created_at
      `,
      [notificationId, userId, readAt],
    );

    return result.rowCount === 0
      ? null
      : this.mapNotificationRow(result.rows[0]);
  }

  async createNotifications(
    inputs: NotificationCreationInput[],
  ): Promise<NotificationRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    const values: unknown[] = [];
    const tuples = inputs.map((input, index) => {
      const base = index * 7;
      values.push(
        randomUUID(),
        input.userId,
        input.laneId,
        input.type,
        input.title,
        input.message,
        input.data === null ? null : JSON.stringify(input.data),
        input.createdAt,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb, NULL, $${base + 8})`;
    });

    const result = await this.requirePool().query<NotificationRow>(
      `
        INSERT INTO notifications (
          id,
          user_id,
          lane_id,
          type,
          title,
          message,
          data,
          read_at,
          created_at
        )
        VALUES ${tuples.join(', ')}
        RETURNING
          id,
          user_id,
          lane_id,
          type,
          title,
          message,
          data,
          read_at,
          created_at
      `,
      values,
    );

    return result.rows.map((row) => this.mapNotificationRow(row));
  }

  async listPreferences(
    userId: string,
  ): Promise<UserNotificationPreferenceRecord[]> {
    const result = await this.requirePool().query<NotificationPreferenceRow>(
      `
        SELECT
          id,
          user_id,
          type,
          in_app_enabled,
          email_enabled,
          push_enabled,
          line_enabled,
          created_at,
          updated_at
        FROM notification_preferences
        WHERE user_id = $1
        ORDER BY type ASC
      `,
      [userId],
    );

    return result.rows.map((row) => this.mapPreferenceRow(row));
  }

  async upsertPreferences(
    userId: string,
    preferences: NotificationChannelPreference[],
  ): Promise<UserNotificationPreferenceRecord[]> {
    if (preferences.length === 0) {
      return await this.listPreferences(userId);
    }

    const values: unknown[] = [];
    const tuples = preferences.map((preference, index) => {
      const base = index * 8;
      values.push(
        randomUUID(),
        userId,
        preference.type,
        preference.inAppEnabled,
        preference.emailEnabled,
        preference.pushEnabled,
        preference.lineEnabled,
        new Date(),
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 8})`;
    });

    await this.requirePool().query(
      `
        INSERT INTO notification_preferences (
          id,
          user_id,
          type,
          in_app_enabled,
          email_enabled,
          push_enabled,
          line_enabled,
          created_at,
          updated_at
        )
        VALUES ${tuples.join(', ')}
        ON CONFLICT (user_id, type)
        DO UPDATE SET
          in_app_enabled = EXCLUDED.in_app_enabled,
          email_enabled = EXCLUDED.email_enabled,
          push_enabled = EXCLUDED.push_enabled,
          line_enabled = EXCLUDED.line_enabled,
          updated_at = EXCLUDED.updated_at
      `,
      values,
    );

    return await this.listPreferences(userId);
  }

  async getChannelTargets(userId: string): Promise<NotificationChannelTargets> {
    const result = await this.requirePool().query<NotificationChannelTargetRow>(
      `
        SELECT line_user_id, push_endpoint
        FROM notification_channel_targets
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId],
    );

    return result.rowCount === 0
      ? {
          lineUserId: null,
          pushEndpoint: null,
        }
      : this.mapChannelTargetRow(result.rows[0]);
  }

  async upsertChannelTargets(
    userId: string,
    targets: NotificationChannelTargets,
  ): Promise<NotificationChannelTargets> {
    await this.requirePool().query(
      `
        INSERT INTO notification_channel_targets (
          id,
          user_id,
          line_user_id,
          push_endpoint,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $5)
        ON CONFLICT (user_id)
        DO UPDATE SET
          line_user_id = EXCLUDED.line_user_id,
          push_endpoint = EXCLUDED.push_endpoint,
          updated_at = EXCLUDED.updated_at
      `,
      [
        randomUUID(),
        userId,
        targets.lineUserId,
        targets.pushEndpoint,
        new Date(),
      ],
    );

    return await this.getChannelTargets(userId);
  }

  async findLaneOwnerUserId(laneId: string): Promise<string | null> {
    const result = await this.requirePool().query<{ exporter_id: string }>(
      `
        SELECT exporter_id
        FROM lanes
        WHERE id = $1
        LIMIT 1
      `,
      [laneId],
    );

    return result.rowCount === 0 ? null : result.rows[0].exporter_id;
  }

  async listMarketAudienceUserIds(market: string): Promise<string[]> {
    const result = await this.requirePool().query<{ user_id: string }>(
      `
        SELECT DISTINCT exporter_id AS user_id
        FROM lanes
        WHERE destination_market = $1

        UNION

        SELECT id AS user_id
        FROM users
        WHERE role IN ('ADMIN', 'AUDITOR')
      `,
      [market],
    );

    return result.rows.map((row) => row.user_id);
  }

  async listDeliveryTargets(
    userIds: readonly string[],
  ): Promise<NotificationDeliveryTarget[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.requirePool().query<UserDeliveryTargetRow>(
      `
        SELECT
          users.id,
          users.email,
          targets.line_user_id,
          targets.push_endpoint
        FROM users
        LEFT JOIN notification_channel_targets AS targets
          ON targets.user_id = users.id
        WHERE id::text = ANY($1::text[])
      `,
      [userIds],
    );

    return result.rows.map((row) => ({
      userId: row.id,
      email: row.email,
      lineUserId: row.line_user_id,
      pushEndpoint: row.push_endpoint,
    }));
  }

  private mapNotificationRow(row: NotificationRow): NotificationRecord {
    return {
      id: row.id,
      userId: row.user_id,
      laneId: row.lane_id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: this.parseJson(row.data),
      readAt: row.read_at === null ? null : new Date(row.read_at),
      createdAt: new Date(row.created_at),
    };
  }

  private mapPreferenceRow(
    row: NotificationPreferenceRow,
  ): UserNotificationPreferenceRecord {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      inAppEnabled: row.in_app_enabled,
      emailEnabled: row.email_enabled,
      pushEnabled: row.push_enabled,
      lineEnabled: row.line_enabled,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapChannelTargetRow(
    row: NotificationChannelTargetRow,
  ): NotificationChannelTargets {
    return {
      lineUserId: row.line_user_id,
      pushEndpoint: row.push_endpoint,
    };
  }

  private parseJson(
    value: NotificationRow['data'],
  ): Record<string, unknown> | null {
    if (value === null) {
      return null;
    }

    return typeof value === 'string'
      ? (JSON.parse(value) as Record<string, unknown>)
      : value;
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('Notification store requires DATABASE_URL.');
    }

    return this.pool;
  }
}

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  buildDefaultNotificationPreferences,
  DEFAULT_NOTIFICATION_PAGE_SIZE,
} from './notification.constants';
import { NotificationChannels } from './notification.channels';
import type {
  NotificationChannelDispatcher,
  NotificationChannelPreference,
  NotificationChannelTargets,
  NotificationChannelTargetsResult,
  NotificationFanoutPublisher,
  NotificationListFilter,
  NotificationListResult,
  NotificationPreferencesResult,
  NotificationRecord,
  NotificationServiceStore,
  TemperatureExcursionAlertInput,
  TemperatureExcursionAlertSeverity,
  TemperatureExcursionRealtimeEvent,
  NotificationUnreadCountResult,
  NotifyUsersInput,
  UserNotificationPreferenceRecord,
} from './notification.types';
import { NOTIFICATION_FANOUT, NOTIFICATION_STORE } from './notification.types';

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function normalizeTargetValue(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(NOTIFICATION_STORE)
    private readonly store: NotificationServiceStore,
    @Inject(NOTIFICATION_FANOUT)
    private readonly fanout: NotificationFanoutPublisher,
    @Inject(NotificationChannels)
    private readonly channels: NotificationChannelDispatcher,
  ) {}

  async listNotifications(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<NotificationListResult> {
    return {
      notifications: await this.store.listNotifications(userId, {
        ...filter,
        page: filter.page ?? 1,
        limit: filter.limit ?? DEFAULT_NOTIFICATION_PAGE_SIZE,
      }),
    };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<{ success: true }> {
    const notification = await this.store.markNotificationRead(
      notificationId,
      userId,
      new Date(),
    );
    if (notification === null) {
      const found = await this.store.findNotificationById(
        notificationId,
        userId,
      );
      if (found === null) {
        throw new NotFoundException('Notification not found.');
      }
    }

    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<NotificationUnreadCountResult> {
    return {
      count: await this.store.countUnreadNotifications(userId),
    };
  }

  async listPreferences(
    userId: string,
  ): Promise<NotificationPreferencesResult> {
    const preferences = await this.resolvePreferencesByUserId([userId]);
    return {
      preferences:
        preferences.get(userId) ?? buildDefaultNotificationPreferences(),
    };
  }

  async updatePreferences(
    userId: string,
    preferences: NotificationChannelPreference[],
  ): Promise<NotificationPreferencesResult> {
    const stored = await this.store.upsertPreferences(userId, preferences);
    return {
      preferences: this.mergeWithDefaults(stored),
    };
  }

  async getChannelTargets(
    userId: string,
  ): Promise<NotificationChannelTargetsResult> {
    return {
      targets: await this.store.getChannelTargets(userId),
    };
  }

  async updateChannelTargets(
    userId: string,
    targets: NotificationChannelTargets,
  ): Promise<NotificationChannelTargetsResult> {
    return {
      targets: await this.store.upsertChannelTargets(userId, {
        lineUserId: normalizeTargetValue(targets.lineUserId),
        pushEndpoint: normalizeTargetValue(targets.pushEndpoint),
      }),
    };
  }

  async notifyUsers(input: NotifyUsersInput): Promise<NotificationRecord[]> {
    const userIds = dedupeStrings(input.userIds);
    if (userIds.length === 0) {
      return [];
    }

    const preferencesByUser = await this.resolvePreferencesByUserId(userIds);
    const dispatchableUserIds = userIds.filter((userId) =>
      this.hasAnyEnabledChannel(preferencesByUser.get(userId), input.type),
    );

    if (dispatchableUserIds.length === 0) {
      return [];
    }

    const createdAt = new Date();
    const created = await this.store.createNotifications(
      dispatchableUserIds.map((userId) => ({
        userId,
        laneId: input.laneId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
        createdAt,
      })),
    );
    return await this.dispatchCreatedNotifications(created, (notification) =>
      this.requirePreference(
        preferencesByUser.get(notification.userId),
        input.type,
      ),
    );
  }

  async notifyLaneOwner(
    laneId: string,
    input: Omit<NotifyUsersInput, 'userIds' | 'laneId'>,
  ): Promise<NotificationRecord[]> {
    const ownerId = await this.store.findLaneOwnerUserId(laneId);
    if (ownerId === null) {
      this.logger.warn(
        `Skipping notification for lane ${laneId}: no owner found.`,
      );
      return [];
    }

    return await this.notifyUsers({
      userIds: [ownerId],
      laneId,
      ...input,
    });
  }

  async notifyMarketAudience(
    market: string,
    input: Omit<NotifyUsersInput, 'userIds'>,
  ): Promise<NotificationRecord[]> {
    const userIds = await this.store.listMarketAudienceUserIds(market);
    return await this.notifyUsers({
      userIds,
      ...input,
    });
  }

  async notifyLaneOwnerAboutTemperatureExcursions(
    laneId: string,
    input: TemperatureExcursionAlertInput,
  ): Promise<NotificationRecord[]> {
    const ownerId = await this.store.findLaneOwnerUserId(laneId);
    if (ownerId === null) {
      this.logger.warn(
        `Skipping temperature excursion alert for lane ${laneId}: no owner found.`,
      );
      return [];
    }

    const preferencesByUser = await this.resolvePreferencesByUserId([ownerId]);
    const storedPreference = this.requirePreference(
      preferencesByUser.get(ownerId),
      'EXCURSION_ALERT',
    );
    const effectivePreference = this.buildExcursionAlertPreference(
      storedPreference,
      input.highestSeverity,
    );
    const title = this.buildExcursionAlertTitle(input.highestSeverity);
    const message = this.buildExcursionAlertMessage(input.excursionCount);
    const createdAt = new Date();
    const created = await this.store.createNotifications([
      {
        userId: ownerId,
        laneId,
        type: 'EXCURSION_ALERT',
        title,
        message,
        data: {
          excursionCount: input.excursionCount,
          highestSeverity: input.highestSeverity,
          slaBreached: input.slaBreached,
          excursions: input.excursions,
        },
        createdAt,
      },
    ]);

    return await this.dispatchCreatedNotifications(
      created,
      () => effectivePreference,
      async (notification) => {
        await this.fanout.publishTemperatureExcursion(
          ownerId,
          this.buildTemperatureExcursionEvent(laneId, notification, input),
        );
      },
    );
  }

  private async resolvePreferencesByUserId(
    userIds: readonly string[],
  ): Promise<Map<string, NotificationChannelPreference[]>> {
    const preferencesByUser = new Map<
      string,
      NotificationChannelPreference[]
    >();

    await Promise.all(
      userIds.map(async (userId) => {
        const stored = await this.store.listPreferences(userId);
        preferencesByUser.set(userId, this.mergeWithDefaults(stored));
      }),
    );

    return preferencesByUser;
  }

  private mergeWithDefaults(
    stored: readonly UserNotificationPreferenceRecord[],
  ): NotificationChannelPreference[] {
    const storedByType = new Map(stored.map((row) => [row.type, row] as const));

    return buildDefaultNotificationPreferences().map((entry) => {
      const existing = storedByType.get(entry.type);
      return existing === undefined
        ? entry
        : {
            type: entry.type,
            inAppEnabled: existing.inAppEnabled,
            emailEnabled: existing.emailEnabled,
            pushEnabled: existing.pushEnabled,
            lineEnabled: existing.lineEnabled,
          };
    });
  }

  private requirePreference(
    preferences: NotificationChannelPreference[] | undefined,
    type: NotificationChannelPreference['type'],
  ): NotificationChannelPreference {
    const preference = preferences?.find((entry) => entry.type === type);
    return (
      preference ??
      buildDefaultNotificationPreferences().find(
        (entry) => entry.type === type,
      )!
    );
  }

  private hasAnyEnabledChannel(
    preferences: NotificationChannelPreference[] | undefined,
    type: NotificationChannelPreference['type'],
  ): boolean {
    const preference = this.requirePreference(preferences, type);
    return (
      preference.inAppEnabled ||
      preference.emailEnabled ||
      preference.pushEnabled ||
      preference.lineEnabled
    );
  }

  private async dispatchCreatedNotifications(
    created: readonly NotificationRecord[],
    resolvePreference: (
      notification: NotificationRecord,
    ) => NotificationChannelPreference,
    afterInAppPublish?: (notification: NotificationRecord) => Promise<void>,
  ): Promise<NotificationRecord[]> {
    if (created.length === 0) {
      return [];
    }

    const userIds = dedupeStrings(
      created.map((notification) => notification.userId),
    );
    const deliveryTargets = await this.store.listDeliveryTargets(userIds);
    const deliveryTargetByUser = new Map(
      deliveryTargets.map((target) => [target.userId, target] as const),
    );

    for (const notification of created) {
      const preference = resolvePreference(notification);
      const deliveryTarget =
        deliveryTargetByUser.get(notification.userId) ?? null;

      if (preference.inAppEnabled) {
        await this.fanout.publishNotificationCreated(notification);
      }
      if (afterInAppPublish !== undefined) {
        await afterInAppPublish(notification);
      }

      try {
        await this.channels.dispatch(notification, preference, deliveryTarget);
      } catch (error) {
        this.logger.warn(
          `Notification dispatch failed for ${notification.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return [...created];
  }

  private buildExcursionAlertPreference(
    storedPreference: NotificationChannelPreference,
    severity: TemperatureExcursionAlertSeverity,
  ): NotificationChannelPreference {
    const requiredChannels = this.requiredExcursionChannels(severity);

    return {
      type: storedPreference.type,
      inAppEnabled:
        storedPreference.inAppEnabled || requiredChannels.inAppEnabled,
      emailEnabled:
        storedPreference.emailEnabled || requiredChannels.emailEnabled,
      pushEnabled: storedPreference.pushEnabled || requiredChannels.pushEnabled,
      lineEnabled: storedPreference.lineEnabled || requiredChannels.lineEnabled,
    };
  }

  private requiredExcursionChannels(
    severity: TemperatureExcursionAlertSeverity,
  ): Omit<NotificationChannelPreference, 'type'> {
    switch (severity) {
      case 'MINOR':
        return {
          inAppEnabled: true,
          emailEnabled: false,
          pushEnabled: false,
          lineEnabled: false,
        };
      case 'MODERATE':
        return {
          inAppEnabled: true,
          emailEnabled: true,
          pushEnabled: false,
          lineEnabled: false,
        };
      case 'SEVERE':
        return {
          inAppEnabled: true,
          emailEnabled: true,
          pushEnabled: true,
          lineEnabled: false,
        };
      case 'CRITICAL':
        return {
          inAppEnabled: true,
          emailEnabled: true,
          pushEnabled: true,
          lineEnabled: true,
        };
    }
  }

  private buildExcursionAlertTitle(
    severity: TemperatureExcursionAlertSeverity,
  ): string {
    switch (severity) {
      case 'MINOR':
        return 'Temperature excursion detected';
      case 'MODERATE':
        return 'Urgent temperature excursion detected';
      case 'SEVERE':
      case 'CRITICAL':
        return 'Critical temperature excursion detected';
    }
  }

  private buildExcursionAlertMessage(excursionCount: number): string {
    return excursionCount === 1
      ? '1 new temperature excursion was detected for this lane.'
      : `${excursionCount} new temperature excursions were detected for this lane.`;
  }

  private buildTemperatureExcursionEvent(
    laneId: string,
    notification: NotificationRecord,
    input: TemperatureExcursionAlertInput,
  ): TemperatureExcursionRealtimeEvent {
    return {
      laneId,
      notificationId: notification.id,
      title: notification.title,
      message: notification.message,
      excursionCount: input.excursionCount,
      highestSeverity: input.highestSeverity,
      slaBreached: input.slaBreached,
      excursions: input.excursions,
    };
  }
}

export const NotificationType = {
  RULE_CHANGE: 'RULE_CHANGE',
  EXCURSION_ALERT: 'EXCURSION_ALERT',
  MISSING_DOCUMENT: 'MISSING_DOCUMENT',
  PACK_GENERATED: 'PACK_GENERATED',
  CLAIM_FILED: 'CLAIM_FILED',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const SUPPORTED_NOTIFICATION_TYPES = Object.values(NotificationType);

export interface NotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly laneId: string | null;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly data: Record<string, unknown> | null;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface NotificationListFilter {
  readonly read?: boolean;
  readonly type?: NotificationType;
  readonly page?: number;
  readonly limit?: number;
}

export interface NotificationChannelPreference {
  readonly type: NotificationType;
  readonly inAppEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly pushEnabled: boolean;
  readonly lineEnabled: boolean;
}

export interface UserNotificationPreferenceRecord extends NotificationChannelPreference {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NotificationCreationInput {
  readonly userId: string;
  readonly laneId: string | null;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly data: Record<string, unknown> | null;
  readonly createdAt: Date;
}

export interface NotificationDeliveryTarget {
  readonly userId: string;
  readonly email: string | null;
  readonly lineUserId: string | null;
  readonly pushEndpoint: string | null;
}

export interface NotificationChannelTargets {
  readonly lineUserId: string | null;
  readonly pushEndpoint: string | null;
}

export interface NotificationChannelTargetsResult {
  readonly targets: NotificationChannelTargets;
}

export interface NotifyUsersInput {
  readonly userIds: readonly string[];
  readonly laneId: string | null;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly data: Record<string, unknown> | null;
}

export interface NotificationListResult {
  readonly notifications: readonly NotificationRecord[];
}

export interface NotificationUnreadCountResult {
  readonly count: number;
}

export interface NotificationPreferencesResult {
  readonly preferences: readonly NotificationChannelPreference[];
}

export interface NotificationCreatedEvent {
  readonly notification: NotificationRecord;
}

export interface NotificationServiceStore {
  listNotifications(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<NotificationRecord[]>;
  findNotificationById(
    notificationId: string,
    userId: string,
  ): Promise<NotificationRecord | null>;
  countUnreadNotifications(userId: string): Promise<number>;
  markNotificationRead(
    notificationId: string,
    userId: string,
    readAt: Date,
  ): Promise<NotificationRecord | null>;
  createNotifications(
    inputs: NotificationCreationInput[],
  ): Promise<NotificationRecord[]>;
  listPreferences(userId: string): Promise<UserNotificationPreferenceRecord[]>;
  upsertPreferences(
    userId: string,
    preferences: NotificationChannelPreference[],
  ): Promise<UserNotificationPreferenceRecord[]>;
  getChannelTargets(userId: string): Promise<NotificationChannelTargets>;
  upsertChannelTargets(
    userId: string,
    targets: NotificationChannelTargets,
  ): Promise<NotificationChannelTargets>;
  findLaneOwnerUserId(laneId: string): Promise<string | null>;
  listMarketAudienceUserIds(market: string): Promise<string[]>;
  listDeliveryTargets(
    userIds: readonly string[],
  ): Promise<NotificationDeliveryTarget[]>;
}

export interface NotificationChannelDispatcher {
  dispatch(
    notification: NotificationRecord,
    preference: NotificationChannelPreference,
    target: NotificationDeliveryTarget | null,
  ): Promise<void>;
}

export interface NotificationRealtimeGateway {
  emitNotification(userId: string, notification: NotificationRecord): void;
}

export interface NotificationFanoutPublisher {
  publishNotificationCreated(
    notification: NotificationRecord,
  ): Promise<boolean>;
}

export const NOTIFICATION_STORE = Symbol('NOTIFICATION_STORE');
export const NOTIFICATION_FANOUT = Symbol('NOTIFICATION_FANOUT');

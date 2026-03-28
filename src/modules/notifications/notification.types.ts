export const NotificationType = {
  RULE_CHANGE: 'RULE_CHANGE',
  EXCURSION_ALERT: 'EXCURSION_ALERT',
  CERTIFICATION_EXPIRY: 'CERTIFICATION_EXPIRY',
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

export interface DirectEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly message: string;
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

export interface LaneRealtimeAccessRecord {
  readonly id: string;
  readonly laneId: string;
  readonly exporterId: string;
}

export interface LaneSubscriptionInput {
  readonly laneId: string;
}

export type TemperatureExcursionAlertSeverity =
  | 'MINOR'
  | 'MODERATE'
  | 'SEVERE'
  | 'CRITICAL';

export interface TemperatureExcursionAlertSummary {
  readonly severity: TemperatureExcursionAlertSeverity;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly type: 'CHILLING' | 'HEAT';
  readonly direction: 'LOW' | 'HIGH';
  readonly durationMinutes: number;
}

export interface TemperatureExcursionAlertInput {
  readonly excursionCount: number;
  readonly highestSeverity: TemperatureExcursionAlertSeverity;
  readonly slaBreached: boolean;
  readonly excursions: readonly TemperatureExcursionAlertSummary[];
}

export interface TemperatureExcursionRealtimeEvent extends TemperatureExcursionAlertInput {
  readonly laneId: string;
  readonly notificationId: string | null;
  readonly title: string;
  readonly message: string;
}

export interface LaneStatusChangedRealtimeEvent {
  readonly laneId: string;
  readonly oldStatus: string;
  readonly newStatus: string;
}

export interface EvidenceUploadedRealtimeEvent {
  readonly laneId: string;
  readonly artifactId: string;
  readonly type: string;
  readonly completeness: number;
}

export interface CheckpointRecordedRealtimeEvent {
  readonly laneId: string;
  readonly checkpointId: string;
  readonly sequence: number;
}

export interface PackGeneratedRealtimeEvent {
  readonly laneId: string;
  readonly packId: string;
  readonly packType: string;
}

export interface RuleUpdatedRealtimeEvent {
  readonly marketId: string;
  readonly changedSubstances: readonly string[];
}

export interface LaneRealtimeEventPayloadMap {
  readonly 'lane.status.changed': LaneStatusChangedRealtimeEvent;
  readonly 'evidence.uploaded': EvidenceUploadedRealtimeEvent;
  readonly 'checkpoint.recorded': CheckpointRecordedRealtimeEvent;
  readonly 'temperature.excursion': TemperatureExcursionRealtimeEvent;
  readonly 'pack.generated': PackGeneratedRealtimeEvent;
}

export type LaneRealtimeEventName = keyof LaneRealtimeEventPayloadMap;

export interface UserRealtimeEventPayloadMap {
  readonly 'rule.updated': RuleUpdatedRealtimeEvent;
}

export type UserRealtimeEventName = keyof UserRealtimeEventPayloadMap;

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
  findLaneRealtimeAccess(
    laneId: string,
  ): Promise<LaneRealtimeAccessRecord | null>;
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
  sendDirectEmail(input: DirectEmailInput): Promise<void>;
}

export interface NotificationRealtimeGateway {
  emitNotification(userId: string, notification: NotificationRecord): void;
  emitLaneEvent<TEventName extends LaneRealtimeEventName>(
    eventName: TEventName,
    laneId: string,
    payload: LaneRealtimeEventPayloadMap[TEventName],
  ): void;
  emitUserEvent<TEventName extends UserRealtimeEventName>(
    eventName: TEventName,
    userId: string,
    payload: UserRealtimeEventPayloadMap[TEventName],
  ): void;
  emitTemperatureExcursion(
    userId: string,
    event: TemperatureExcursionRealtimeEvent,
  ): void;
}

export interface NotificationFanoutPublisher {
  publishNotificationCreated(
    notification: NotificationRecord,
  ): Promise<boolean>;
  publishLaneEvent<TEventName extends LaneRealtimeEventName>(
    eventName: TEventName,
    laneId: string,
    payload: LaneRealtimeEventPayloadMap[TEventName],
  ): Promise<boolean>;
  publishUserEvent<TEventName extends UserRealtimeEventName>(
    eventName: TEventName,
    userId: string,
    payload: UserRealtimeEventPayloadMap[TEventName],
  ): Promise<boolean>;
  publishTemperatureExcursion(
    userId: string,
    event: TemperatureExcursionRealtimeEvent,
  ): Promise<boolean>;
}

export const NOTIFICATION_STORE = Symbol('NOTIFICATION_STORE');
export const NOTIFICATION_FANOUT = Symbol('NOTIFICATION_FANOUT');

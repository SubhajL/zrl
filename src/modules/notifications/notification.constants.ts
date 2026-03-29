import {
  NotificationType,
  type NotificationChannelPreference,
} from './notification.types';

export const DEFAULT_NOTIFICATION_PAGE_SIZE = 20;

export function buildDefaultNotificationPreferences(): NotificationChannelPreference[] {
  return Object.values(NotificationType).map((type) => ({
    type,
    inAppEnabled: true,
    emailEnabled: false,
    pushEnabled: false,
    lineEnabled: false,
  }));
}

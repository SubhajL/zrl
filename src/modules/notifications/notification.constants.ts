import {
  NotificationType,
  type NotificationChannelPreference,
} from './notification.types';

export const DEFAULT_NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_CREATED_CHANNEL = 'notification.created';
export const TEMPERATURE_EXCURSION_CHANNEL = 'temperature.excursion';

export function buildDefaultNotificationPreferences(): NotificationChannelPreference[] {
  return Object.values(NotificationType).map((type) => ({
    type,
    inAppEnabled: true,
    emailEnabled: false,
    pushEnabled: false,
    lineEnabled: false,
  }));
}

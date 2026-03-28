import { loadAllLanes } from './lanes-data';
import { requestAppJson } from './app-api';
import type { Lane } from './types';

interface NotificationRecord {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly createdAt: string;
}

interface NotificationsResponse {
  readonly notifications: NotificationRecord[];
}

interface UnreadCountResponse {
  readonly count: number;
}

interface CurrentProfileResponse {
  readonly user: {
    readonly email: string;
    readonly companyName: string | null;
  };
}

export interface DashboardPageData {
  readonly userLabel: string;
  readonly lanes: Lane[];
  readonly recentNotifications: NotificationRecord[];
  readonly kpis: {
    readonly totalLanes: number;
    readonly avgCompleteness: number;
    readonly readyToShip: number;
    readonly unreadAlerts: number;
  };
}

export async function loadDashboardPageData(): Promise<DashboardPageData> {
  const [lanes, notifications, unreadCount, profile] = await Promise.all([
    loadAllLanes(),
    requestAppJson<NotificationsResponse>('/api/zrl/notifications?page=1'),
    requestAppJson<UnreadCountResponse>('/api/zrl/notifications/unread-count'),
    requestAppJson<CurrentProfileResponse>('/api/zrl/users/me'),
  ]);

  const totalLanes = lanes.length;
  const avgCompleteness =
    totalLanes === 0
      ? 0
      : Math.round(
          lanes.reduce((sum, lane) => sum + lane.completenessScore, 0) /
            totalLanes,
        );
  const readyToShip = lanes.filter((lane) =>
    ['VALIDATED', 'PACKED', 'CLOSED'].includes(lane.status),
  ).length;

  return {
    userLabel: profile.user.companyName ?? profile.user.email,
    lanes: lanes.slice(0, 12),
    recentNotifications: notifications.notifications.slice(0, 5),
    kpis: {
      totalLanes,
      avgCompleteness,
      readyToShip,
      unreadAlerts: unreadCount.count,
    },
  };
}

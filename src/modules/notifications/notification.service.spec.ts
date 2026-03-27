import { NotificationService } from './notification.service';
import type {
  NotificationChannelPreference,
  NotificationChannelTargets,
  NotificationRecord,
  NotificationServiceStore,
  NotificationType,
  UserNotificationPreferenceRecord,
} from './notification.types';

function buildNotification(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    id: 'notification-1',
    userId: 'user-1',
    laneId: 'lane-1',
    type: 'PACK_GENERATED',
    title: 'Proof pack ready',
    message: 'Your regulator pack is ready.',
    data: { packId: 'pack-1' },
    readAt: null,
    createdAt: new Date('2026-03-27T14:00:00.000Z'),
    ...overrides,
  };
}

function buildPreference(
  overrides: Partial<UserNotificationPreferenceRecord> = {},
): UserNotificationPreferenceRecord {
  return {
    id: 'pref-1',
    userId: 'user-1',
    type: 'PACK_GENERATED',
    inAppEnabled: true,
    emailEnabled: false,
    pushEnabled: false,
    lineEnabled: false,
    createdAt: new Date('2026-03-27T14:00:00.000Z'),
    updatedAt: new Date('2026-03-27T14:00:00.000Z'),
    ...overrides,
  };
}

class MockNotificationStore implements NotificationServiceStore {
  listNotifications = jest.fn<
    Promise<NotificationRecord[]>,
    [string, unknown]
  >();
  findNotificationById = jest.fn<
    Promise<NotificationRecord | null>,
    [string, string]
  >();
  countUnreadNotifications = jest.fn<Promise<number>, [string]>();
  markNotificationRead = jest.fn<
    Promise<NotificationRecord | null>,
    [string, string, Date]
  >();
  createNotifications = jest.fn<
    Promise<NotificationRecord[]>,
    [
      Array<{
        userId: string;
        laneId: string | null;
        type: NotificationType;
        title: string;
        message: string;
        data: Record<string, unknown> | null;
        createdAt: Date;
      }>,
    ]
  >();
  listPreferences = jest.fn<
    Promise<UserNotificationPreferenceRecord[]>,
    [string]
  >();
  upsertPreferences = jest.fn<
    Promise<UserNotificationPreferenceRecord[]>,
    [string, NotificationChannelPreference[]]
  >();
  findLaneOwnerUserId = jest.fn<Promise<string | null>, [string]>();
  listMarketAudienceUserIds = jest.fn<Promise<string[]>, [string]>();
  listDeliveryTargets = jest.fn<
    Promise<
      Array<{
        userId: string;
        email: string | null;
        lineUserId: string | null;
        pushEndpoint: string | null;
      }>
    >,
    [readonly string[]]
  >();
  getChannelTargets = jest.fn<Promise<NotificationChannelTargets>, [string]>();
  upsertChannelTargets = jest.fn<
    Promise<NotificationChannelTargets>,
    [string, NotificationChannelTargets]
  >();
}

describe('NotificationService', () => {
  let store: MockNotificationStore;
  let fanout: { publishNotificationCreated: jest.Mock };
  let channels: { dispatch: jest.Mock };
  let service: NotificationService;

  beforeEach(() => {
    store = new MockNotificationStore();
    store.listDeliveryTargets.mockResolvedValue([
      {
        userId: 'user-1',
        email: 'exporter@example.com',
        lineUserId: 'line-user-1',
        pushEndpoint: 'https://push.example.com/device-1',
      },
    ]);
    store.getChannelTargets.mockResolvedValue({
      lineUserId: null,
      pushEndpoint: null,
    });
    fanout = { publishNotificationCreated: jest.fn().mockResolvedValue(true) };
    channels = { dispatch: jest.fn().mockResolvedValue(undefined) };

    service = new NotificationService(
      store,
      fanout as never,
      channels as never,
    );
  });

  it('creates rows before publishing and dispatching downstream channels', async () => {
    store.createNotifications.mockResolvedValue([buildNotification()]);
    store.listPreferences.mockResolvedValue([]);

    const created = await service.notifyUsers({
      userIds: ['user-1'],
      laneId: 'lane-1',
      type: 'PACK_GENERATED',
      title: 'Proof pack ready',
      message: 'Your regulator pack is ready.',
      data: { packId: 'pack-1' },
    });

    expect(store.createNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'user-1',
        laneId: 'lane-1',
        type: 'PACK_GENERATED',
      }),
    ]);
    expect(fanout.publishNotificationCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'notification-1',
        userId: 'user-1',
      }),
    );
    expect(channels.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notification-1' }),
      expect.objectContaining({
        inAppEnabled: true,
        emailEnabled: false,
      }),
      expect.objectContaining({
        userId: 'user-1',
        email: 'exporter@example.com',
        lineUserId: 'line-user-1',
        pushEndpoint: 'https://push.example.com/device-1',
      }),
    );
    expect(created).toHaveLength(1);
  });

  it('uses stored channel preferences when dispatching', async () => {
    store.createNotifications.mockResolvedValue([
      buildNotification({
        type: 'RULE_CHANGE',
        title: 'Japan rule update',
      }),
    ]);
    store.listPreferences.mockResolvedValue([
      buildPreference({
        type: 'RULE_CHANGE',
        emailEnabled: true,
        inAppEnabled: true,
      }),
    ]);

    await service.notifyUsers({
      userIds: ['user-1'],
      laneId: null,
      type: 'RULE_CHANGE',
      title: 'Japan rule update',
      message: 'Updated MRL thresholds published.',
      data: { market: 'JAPAN' },
    });

    expect(channels.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RULE_CHANGE' }),
      expect.objectContaining({
        inAppEnabled: true,
        emailEnabled: true,
        pushEnabled: false,
        lineEnabled: false,
      }),
      expect.objectContaining({
        userId: 'user-1',
        email: 'exporter@example.com',
        lineUserId: 'line-user-1',
        pushEndpoint: 'https://push.example.com/device-1',
      }),
    );
  });

  it('returns stored channel targets for the caller', async () => {
    store.getChannelTargets.mockResolvedValue({
      lineUserId: 'line-user-1',
      pushEndpoint: 'https://push.example.com/device-1',
    });

    await expect(service.getChannelTargets('user-1')).resolves.toEqual({
      targets: {
        lineUserId: 'line-user-1',
        pushEndpoint: 'https://push.example.com/device-1',
      },
    });
  });

  it('normalizes blank channel target values before persisting', async () => {
    store.upsertChannelTargets.mockResolvedValue({
      lineUserId: null,
      pushEndpoint: null,
    });

    await expect(
      service.updateChannelTargets('user-1', {
        lineUserId: '   ',
        pushEndpoint: '',
      }),
    ).resolves.toEqual({
      targets: {
        lineUserId: null,
        pushEndpoint: null,
      },
    });

    expect(store.upsertChannelTargets).toHaveBeenCalledWith('user-1', {
      lineUserId: null,
      pushEndpoint: null,
    });
  });

  it('marks notifications as read idempotently', async () => {
    store.markNotificationRead
      .mockResolvedValueOnce(
        buildNotification({
          readAt: new Date('2026-03-27T14:05:00.000Z'),
        }),
      )
      .mockResolvedValueOnce(null);
    store.findNotificationById.mockResolvedValue(
      buildNotification({
        id: 'notification-1',
        readAt: new Date('2026-03-27T14:05:00.000Z'),
      }),
    );

    await expect(
      service.markAsRead('user-1', 'notification-1'),
    ).resolves.toEqual({ success: true });
    await expect(
      service.markAsRead('user-1', 'notification-1'),
    ).resolves.toEqual({ success: true });
  });

  it('returns only the caller unread count', async () => {
    store.countUnreadNotifications.mockResolvedValue(3);

    await expect(service.getUnreadCount('user-1')).resolves.toEqual({
      count: 3,
    });
    expect(store.countUnreadNotifications).toHaveBeenCalledWith('user-1');
  });
});

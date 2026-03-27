import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: {
    listNotifications: jest.Mock;
    markAsRead: jest.Mock;
    getUnreadCount: jest.Mock;
    listPreferences: jest.Mock;
    updatePreferences: jest.Mock;
    getChannelTargets: jest.Mock;
    updateChannelTargets: jest.Mock;
  };

  beforeEach(() => {
    service = {
      listNotifications: jest.fn().mockResolvedValue({
        notifications: [],
      }),
      markAsRead: jest.fn().mockResolvedValue({ success: true }),
      getUnreadCount: jest.fn().mockResolvedValue({ count: 2 }),
      listPreferences: jest.fn().mockResolvedValue({
        preferences: [],
      }),
      updatePreferences: jest.fn().mockResolvedValue({
        preferences: [],
      }),
      getChannelTargets: jest.fn().mockResolvedValue({
        targets: {
          lineUserId: 'line-user-1',
          pushEndpoint: 'https://push.example.com/device-1',
        },
      }),
      updateChannelTargets: jest.fn().mockResolvedValue({
        targets: {
          lineUserId: 'line-user-1',
          pushEndpoint: null,
        },
      }),
    };
    controller = new NotificationController(
      service as unknown as NotificationService,
    );
  });

  it('maps GET filters into the service query', async () => {
    await controller.listNotifications(
      {
        user: {
          id: 'user-1',
        },
      } as never,
      {
        read: 'false',
        type: 'PACK_GENERATED',
        page: '2',
      },
    );

    expect(service.listNotifications).toHaveBeenCalledWith('user-1', {
      read: false,
      type: 'PACK_GENERATED',
      page: 2,
    });
  });

  it('marks a notification as read for the current user', async () => {
    await expect(
      controller.markAsRead('notification-1', {
        user: {
          id: 'user-1',
        },
      } as never),
    ).resolves.toEqual({ success: true });

    expect(service.markAsRead).toHaveBeenCalledWith('user-1', 'notification-1');
  });

  it('returns unread count for the current user', async () => {
    await expect(
      controller.getUnreadCount({
        user: {
          id: 'user-1',
        },
      } as never),
    ).resolves.toEqual({ count: 2 });
  });

  it('returns channel targets for the current user', async () => {
    await expect(
      controller.getChannelTargets({
        user: {
          id: 'user-1',
        },
      } as never),
    ).resolves.toEqual({
      targets: {
        lineUserId: 'line-user-1',
        pushEndpoint: 'https://push.example.com/device-1',
      },
    });
  });

  it('updates channel targets for the current user', async () => {
    await expect(
      controller.updateChannelTargets(
        {
          user: {
            id: 'user-1',
          },
        } as never,
        {
          lineUserId: 'line-user-1',
          pushEndpoint: null,
        },
      ),
    ).resolves.toEqual({
      targets: {
        lineUserId: 'line-user-1',
        pushEndpoint: null,
      },
    });

    expect(service.updateChannelTargets).toHaveBeenCalledWith('user-1', {
      lineUserId: 'line-user-1',
      pushEndpoint: null,
    });
  });
});

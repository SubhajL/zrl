import { NotificationChannels } from './notification.channels';
import type {
  NotificationChannelPreference,
  NotificationDeliveryTarget,
  NotificationRecord,
} from './notification.types';

function buildNotification(): NotificationRecord {
  return {
    id: 'notification-1',
    userId: 'user-1',
    laneId: 'lane-1',
    type: 'PACK_GENERATED',
    title: 'Pack ready',
    message: 'Proof pack generated.',
    data: { packId: 'pack-1' },
    readAt: null,
    createdAt: new Date('2026-03-28T00:00:00.000Z'),
  };
}

function buildPreference(
  overrides: Partial<NotificationChannelPreference> = {},
): NotificationChannelPreference {
  return {
    type: 'PACK_GENERATED',
    inAppEnabled: true,
    emailEnabled: false,
    pushEnabled: true,
    lineEnabled: true,
    ...overrides,
  };
}

function buildTarget(
  overrides: Partial<NotificationDeliveryTarget> = {},
): NotificationDeliveryTarget {
  return {
    userId: 'user-1',
    email: 'exporter@example.com',
    lineUserId: 'line-user-1',
    pushEndpoint: 'https://push.example.com/device-1',
    ...overrides,
  };
}

describe('NotificationChannels', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env['NOTIFICATIONS_PUSH_WEBHOOK_URL'] =
      'https://push-webhook.example.com';
    process.env['LINE_CHANNEL_ACCESS_TOKEN'] = 'line-token';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
  });

  afterEach(() => {
    if (originalFetch === undefined) {
      delete (global as { fetch?: typeof fetch }).fetch;
    } else {
      global.fetch = originalFetch;
    }
    delete process.env['NOTIFICATIONS_PUSH_WEBHOOK_URL'];
    delete process.env['LINE_CHANNEL_ACCESS_TOKEN'];
  });

  it('sends push notifications to the explicit user endpoint', async () => {
    const channels = new NotificationChannels();

    await channels.dispatch(
      buildNotification(),
      buildPreference(),
      buildTarget(),
    );

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://push-webhook.example.com');
    expect(init.method).toBe('POST');
    expect(init.body).toEqual(
      expect.stringContaining('https://push.example.com/device-1'),
    );
  });

  it('skips LINE delivery when the user target is missing', async () => {
    const channels = new NotificationChannels();

    await channels.dispatch(
      buildNotification(),
      buildPreference({ pushEnabled: false }),
      buildTarget({ lineUserId: null }),
    );

    expect(global.fetch).not.toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.anything(),
    );
  });
});

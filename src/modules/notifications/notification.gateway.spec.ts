import { UnauthorizedException } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';

describe('NotificationGateway', () => {
  let authService: {
    verifyAccessToken: jest.Mock;
  };
  let gateway: NotificationGateway;

  beforeEach(() => {
    authService = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'exporter@example.com',
          role: 'EXPORTER',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
        claims: {
          iss: 'zrl-auth',
          aud: 'zrl',
          sub: 'user-1',
          type: 'access',
          role: 'EXPORTER',
          sv: 0,
          mfa: false,
          email: 'exporter@example.com',
          companyName: 'Exporter Co',
          iat: 1,
          exp: 2,
          jti: 'jti',
        },
      }),
    };

    gateway = new NotificationGateway(authService as never);
    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as never;
  });

  it('rejects websocket connections without a bearer token', async () => {
    await expect(
      gateway.handleConnection({
        handshake: { auth: {}, headers: {} },
      } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('joins the user room after jwt verification', async () => {
    const join = jest.fn();
    const client = {
      handshake: {
        auth: { token: 'jwt-token' },
        headers: {},
      },
      join,
      data: {},
    };

    await gateway.handleConnection(client as never);

    expect(authService.verifyAccessToken).toHaveBeenCalledWith('jwt-token');
    expect(join).toHaveBeenCalledWith('user:user-1');
    expect(client.data['userId']).toBe('user-1');
  });

  it('emits notification.new to the recipient room', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;

    gateway.emitNotification('user-1', {
      id: 'notification-1',
      userId: 'user-1',
      laneId: 'lane-1',
      type: 'PACK_GENERATED',
      title: 'Ready',
      message: 'Pack complete',
      data: null,
      readAt: null,
      createdAt: new Date('2026-03-27T14:00:00.000Z'),
    });

    expect(to).toHaveBeenCalledWith('user:user-1');
    const [event, payload] = emit.mock.calls[0] as [
      string,
      { notification: { id: string; type: string } },
    ];
    expect(event).toBe('notification.new');
    expect(payload.notification).toMatchObject({
      id: 'notification-1',
      type: 'PACK_GENERATED',
    });
  });

  it('emits temperature.excursion to the recipient room', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;

    (
      gateway as unknown as {
        emitTemperatureExcursion: (
          userId: string,
          payload: {
            laneId: string;
            highestSeverity: string;
            excursionCount: number;
            slaBreached: boolean;
          },
        ) => void;
      }
    ).emitTemperatureExcursion('user-1', {
      laneId: 'lane-1',
      highestSeverity: 'CRITICAL',
      excursionCount: 2,
      slaBreached: true,
    });

    expect(to).toHaveBeenCalledWith('user:user-1');
    const [event, payload] = emit.mock.calls[0] as [
      string,
      {
        laneId: string;
        highestSeverity: string;
        excursionCount: number;
        slaBreached: boolean;
      },
    ];
    expect(event).toBe('temperature.excursion');
    expect(payload).toMatchObject({
      laneId: 'lane-1',
      highestSeverity: 'CRITICAL',
      excursionCount: 2,
      slaBreached: true,
    });
  });
});

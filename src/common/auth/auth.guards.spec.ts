import { Reflector } from '@nestjs/core';
import {
  ApiKeyAuthGuard,
  AuditorReadOnlyGuard,
  JwtAuthGuard,
  LaneOwnerGuard,
  PartnerScopeGuard,
  RolesGuard,
} from './auth.guards';
import type { AuthPrincipalRequest, AuthRole } from './auth.types';
import { AuthService } from './auth.service';

function createExecutionContext(request: Partial<AuthPrincipalRequest>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

describe('Auth guards', () => {
  it('roles guard blocks unauthorized role access', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request: Partial<AuthPrincipalRequest> = {
      user: {
        id: 'user-1',
        email: 'exporter@example.com',
        role: 'EXPORTER' as AuthRole,
        companyName: null,
        mfaEnabled: false,
        sessionVersion: 0,
      },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      'Insufficient role.',
    );
  });

  it('lane owner guard allows the lane exporter and blocks others', async () => {
    const resolveLaneOwnerId = jest.fn().mockResolvedValue('user-1');
    const authService = {
      resolveLaneOwnerId,
    } as unknown as AuthService;
    const guard = new LaneOwnerGuard(authService);
    const request: Partial<AuthPrincipalRequest> = {
      params: { laneId: 'lane-1' },
      user: {
        id: 'user-1',
        email: 'exporter@example.com',
        role: 'EXPORTER' as AuthRole,
        companyName: null,
        mfaEnabled: false,
        sessionVersion: 0,
      },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
    expect(resolveLaneOwnerId).toHaveBeenCalledWith('lane-1');
  });

  it('partner scope guard enforces lane-scoped api keys', () => {
    const guard = new PartnerScopeGuard();
    const request: Partial<AuthPrincipalRequest> = {
      params: { laneId: 'lane-1' },
      auth: {
        kind: 'api-key',
        user: {
          id: 'user-2',
          email: 'partner@example.com',
          role: 'PARTNER',
          companyName: null,
          mfaEnabled: false,
          sessionVersion: 0,
        },
        apiKey: {
          id: 'key-1',
          userId: 'user-2',
          keyHash: 'hash',
          name: 'partner',
          scopes: ['lane:read'],
          ipWhitelist: ['127.0.0.1'],
          expiresAt: null,
          revokedAt: null,
        },
      },
    };

    expect(guard.canActivate(createExecutionContext(request))).toBe(true);
  });

  it('auditor read only guard blocks write methods', () => {
    const guard = new AuditorReadOnlyGuard();
    const request: Partial<AuthPrincipalRequest> = {
      method: 'POST',
      user: {
        id: 'user-3',
        email: 'auditor@example.com',
        role: 'AUDITOR' as AuthRole,
        companyName: null,
        mfaEnabled: true,
        sessionVersion: 0,
      },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      'Auditor role is read-only.',
    );
  });

  it('jwt auth guard attaches the authenticated user', async () => {
    const authService = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        user: {
          id: 'user-4',
          email: 'exporter4@example.com',
          role: 'EXPORTER' as AuthRole,
          companyName: null,
          mfaEnabled: false,
          sessionVersion: 0,
        },
        claims: {
          iss: 'zrl-auth',
          aud: 'zrl',
          sub: 'user-4',
          type: 'access',
          role: 'EXPORTER' as AuthRole,
          sv: 0,
          mfa: false,
          email: 'exporter4@example.com',
          companyName: null,
          iat: 1,
          exp: 2,
          jti: 'jti',
        },
      }),
    } as unknown as AuthService;
    const guard = new JwtAuthGuard(authService);
    const request: Partial<AuthPrincipalRequest> = {
      headers: { authorization: 'Bearer token' },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
    expect(request.user?.email).toBe('exporter4@example.com');
  });

  it('api key auth guard rejects missing keys', async () => {
    const authService = {
      validateApiKey: jest.fn(),
    } as unknown as AuthService;
    const guard = new ApiKeyAuthGuard(authService);
    const request: Partial<AuthPrincipalRequest> = {
      headers: {},
      ip: '127.0.0.1',
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toThrow('Missing API key.');
  });

  it('api key auth guard forwards the first proxy ip from x-forwarded-for', async () => {
    const validateApiKey = jest.fn().mockResolvedValue({
      state: 'VALID',
      user: {
        id: 'user-5',
        email: 'partner5@example.com',
        role: 'PARTNER' as AuthRole,
        companyName: null,
        mfaEnabled: false,
        sessionVersion: 0,
      },
      apiKey: {
        id: 'key-5',
        userId: 'user-5',
        keyHash: 'hash',
        name: 'partner',
        scopes: ['lane:read'],
        ipWhitelist: ['203.0.113.10'],
        expiresAt: null,
        revokedAt: null,
      },
    });
    const authService = {
      validateApiKey,
    } as unknown as AuthService;
    const guard = new ApiKeyAuthGuard(authService);
    const request: Partial<AuthPrincipalRequest> = {
      headers: {
        'x-api-key': 'partner-key',
        'x-forwarded-for': '203.0.113.10, 198.51.100.8',
      },
      method: 'GET',
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
    expect(validateApiKey).toHaveBeenCalledWith({
      apiKey: 'partner-key',
      ipAddress: '203.0.113.10',
    });
  });
});

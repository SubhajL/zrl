import { hashSync } from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { AuthService } from './auth.service';
import { AuthApiKeyState, AuthRole } from './auth.types';
import type { AuthStore, AuthUserRecord } from './auth.types';

class MockAuthStore implements AuthStore {
  findUserByEmail = jest.fn<Promise<AuthUserRecord | null>, [string]>();
  findUserById = jest.fn<Promise<AuthUserRecord | null>, [string]>();
  updateUserMfa = jest.fn<
    Promise<AuthUserRecord | null>,
    [string, { mfaEnabled: boolean; totpSecret: string | null }]
  >();
  incrementUserSessionVersion = jest.fn<
    Promise<AuthUserRecord | null>,
    [string]
  >();
  findApiKeyByHash = jest.fn<
    Promise<{
      id: string;
      userId: string;
      keyHash: string;
      name: string;
      scopes: string[];
      ipWhitelist: string[];
      expiresAt: Date | null;
      revokedAt: Date | null;
    } | null>,
    [string]
  >();
  createApiKey = jest.fn();
  revokeApiKey = jest.fn();
  resolveLaneOwnerId = jest.fn<Promise<string | null>, [string]>();
}

function buildUser(overrides: Partial<AuthUserRecord>): AuthUserRecord {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: hashSync('password', 10),
    role: AuthRole.EXPORTER,
    companyName: 'Exporter Co',
    mfaEnabled: false,
    totpSecret: null,
    sessionVersion: 0,
    createdAt: new Date('2026-03-22T03:00:00.000Z'),
    updatedAt: new Date('2026-03-22T03:00:00.000Z'),
    ...overrides,
  };
}

describe('AuthService', () => {
  it('issues tokens for an exporter with valid credentials', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.findUserByEmail.mockResolvedValue(
      buildUser({
        id: 'user-1',
        email: 'exporter@example.com',
      }),
    );

    const result = await service.login({
      email: 'exporter@example.com',
      password: 'password',
      ipAddress: '127.0.0.1',
    });

    expect(result.requireMfa).toBe(false);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('exporter@example.com');
  });

  it('requires mfa for admin before issuing tokens', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.findUserByEmail.mockResolvedValue(
      buildUser({
        id: 'admin-1',
        email: 'admin@example.com',
        role: AuthRole.ADMIN,
        mfaEnabled: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      }),
    );

    const result = await service.login({
      email: 'admin@example.com',
      password: 'password',
      ipAddress: '127.0.0.1',
    });

    expect(result.requireMfa).toBe(true);
    if (result.requireMfa) {
      expect(result.mfaToken).toBeDefined();
      expect(result.user.role).toBe(AuthRole.ADMIN);
    }
  });

  it('verifies the mfa challenge and returns a token pair', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.findUserByEmail.mockResolvedValue(
      buildUser({
        id: 'admin-2',
        email: 'admin2@example.com',
        role: AuthRole.ADMIN,
        mfaEnabled: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      }),
    );
    store.findUserById.mockResolvedValue(
      buildUser({
        id: 'admin-2',
        email: 'admin2@example.com',
        role: AuthRole.ADMIN,
        mfaEnabled: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      }),
    );

    const challenge = await service.login({
      email: 'admin2@example.com',
      password: 'password',
      ipAddress: '127.0.0.1',
    });

    if (!challenge.requireMfa) {
      throw new Error('Expected MFA challenge.');
    }

    const code = speakeasy.totp({
      secret: 'JBSWY3DPEHPK3PXP',
      encoding: 'base32',
    });

    const verified = await service.verifyMfa({
      mfaToken: challenge.mfaToken,
      code,
      ipAddress: '127.0.0.1',
    });

    expect(verified.accessToken).toBeDefined();
    expect(verified.refreshToken).toBeDefined();
    expect(verified.user.role).toBe(AuthRole.ADMIN);
  });

  it('enrolls and confirms mfa for a user', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.findUserById.mockResolvedValue(
      buildUser({
        id: 'user-2',
        email: 'user2@example.com',
        role: AuthRole.EXPORTER,
      }),
    );
    store.updateUserMfa.mockResolvedValue(
      buildUser({
        id: 'user-2',
        email: 'user2@example.com',
        role: AuthRole.EXPORTER,
        mfaEnabled: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      }),
    );

    const enrollment = await service.startMfaEnrollment('user-2');
    expect(enrollment.secret).toBeDefined();
    expect(enrollment.enrollmentToken).toBeDefined();

    const code = speakeasy.totp({
      secret: enrollment.secret,
      encoding: 'base32',
    });

    const confirmed = await service.confirmMfaEnrollment({
      enrollmentToken: enrollment.enrollmentToken,
      code,
    });

    expect(confirmed.success).toBe(true);
    expect(store.updateUserMfa).toHaveBeenCalledWith('user-2', {
      mfaEnabled: true,
      totpSecret: enrollment.secret,
    });
  });

  it('validates partner api keys and rejects revoked keys', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.findUserById.mockResolvedValue(
      buildUser({
        id: 'user-3',
        email: 'partner@example.com',
        role: AuthRole.PARTNER,
      }),
    );

    store.findApiKeyByHash.mockResolvedValue({
      id: 'key-1',
      userId: 'user-3',
      keyHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'partner',
      scopes: ['lane:read'],
      ipWhitelist: ['127.0.0.1'],
      expiresAt: null,
      revokedAt: null,
    });

    const valid = await service.validateApiKey({
      apiKey: 'plain-key',
      ipAddress: '127.0.0.1',
    });

    expect(valid.state).toBe(AuthApiKeyState.VALID);

    store.findApiKeyByHash.mockResolvedValue({
      id: 'key-1',
      userId: 'user-3',
      keyHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'partner',
      scopes: ['lane:read'],
      ipWhitelist: ['127.0.0.1'],
      expiresAt: null,
      revokedAt: new Date('2026-03-22T03:00:00.000Z'),
    });

    const revoked = await service.validateApiKey({
      apiKey: 'plain-key',
      ipAddress: '127.0.0.1',
    });

    expect(revoked.state).toBe(AuthApiKeyState.REVOKED);
  });

  it('revokes the current session on logout and rejects stale refresh tokens', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.findUserByEmail.mockResolvedValue(
      buildUser({
        id: 'user-4',
        email: 'exporter4@example.com',
        sessionVersion: 3,
      }),
    );
    store.findUserById
      .mockResolvedValueOnce(
        buildUser({
          id: 'user-4',
          email: 'exporter4@example.com',
          sessionVersion: 3,
        }),
      )
      .mockResolvedValueOnce(
        buildUser({
          id: 'user-4',
          email: 'exporter4@example.com',
          sessionVersion: 4,
        }),
      );
    store.incrementUserSessionVersion.mockResolvedValue(
      buildUser({
        id: 'user-4',
        email: 'exporter4@example.com',
        sessionVersion: 4,
      }),
    );

    const login = await service.login({
      email: 'exporter4@example.com',
      password: 'password',
      ipAddress: '127.0.0.1',
    });

    expect(login.requireMfa).toBe(false);
    if (login.requireMfa) {
      throw new Error('Expected token pair.');
    }

    const refreshed = await service.refresh({
      refreshToken: login.refreshToken,
    });
    expect(refreshed.accessToken).toBeDefined();

    const logout = await service.logout('user-4');
    expect(logout.success).toBe(true);
    expect(store.incrementUserSessionVersion).toHaveBeenCalledWith('user-4');

    await expect(
      service.refresh({
        refreshToken: login.refreshToken,
      }),
    ).rejects.toThrow('Refresh token is stale.');
  });
});

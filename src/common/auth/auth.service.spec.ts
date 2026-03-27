import { hashSync } from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { AuthService } from './auth.service';
import { AuthApiKeyState, AuthRole } from './auth.types';
import type {
  AuthApiKeyCreationInput,
  AuthApiKeyRecord,
  AuthPasswordResetConsumeResult,
  AuthPasswordResetRequestInput,
  AuthPasswordResetRequestRecord,
  AuthStore,
  AuthUserRecord,
} from './auth.types';

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
  createApiKey = jest.fn<
    Promise<AuthApiKeyRecord>,
    [AuthApiKeyCreationInput]
  >();
  revokeApiKey = jest.fn<Promise<AuthApiKeyRecord | null>, [string]>();
  countPasswordResetRequestsSince = jest.fn<Promise<number>, [string, Date]>();
  createPasswordResetRequest = jest.fn<
    Promise<AuthPasswordResetRequestRecord>,
    [AuthPasswordResetRequestInput]
  >();
  consumePasswordResetToken = jest.fn<
    Promise<AuthPasswordResetConsumeResult>,
    [string, string, Date]
  >();
  resolveLaneOwnerId = jest.fn<Promise<string | null>, [string]>();
  resolveProofPackOwnerId = jest.fn<Promise<string | null>, [string]>();
  resolveCheckpointOwnerId = jest.fn<Promise<string | null>, [string]>();
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

  it('creates a password reset request for a known user', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.countPasswordResetRequestsSince.mockResolvedValue(0);
    store.findUserByEmail.mockResolvedValue(
      buildUser({
        id: 'user-5',
        email: 'reset@example.com',
      }),
    );
    store.createPasswordResetRequest.mockResolvedValue({
      id: 'reset-request-1',
      email: 'reset@example.com',
      userId: 'user-5',
      tokenHash: 'token-hash',
      expiresAt: new Date('2026-03-27T14:00:00.000Z'),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date('2026-03-27T13:00:00.000Z'),
    });

    const result = await service.forgotPassword({
      email: 'reset@example.com',
    });

    expect(result.message).toContain('If an account exists');
    expect(store.countPasswordResetRequestsSince).toHaveBeenCalledWith(
      'reset@example.com',
      expect.any(Date),
    );
    expect(store.createPasswordResetRequest).toHaveBeenCalledTimes(1);
    const createdRequest = store.createPasswordResetRequest.mock.calls[0]?.[0];
    expect(createdRequest).toMatchObject({
      email: 'reset@example.com',
      userId: 'user-5',
    });
    expect(typeof createdRequest?.tokenHash).toBe('string');
    expect(createdRequest?.expiresAt).toBeInstanceOf(Date);
  });

  it('records a generic forgot-password attempt for an unknown email', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.countPasswordResetRequestsSince.mockResolvedValue(0);
    store.findUserByEmail.mockResolvedValue(null);
    store.createPasswordResetRequest.mockResolvedValue({
      id: 'reset-request-2',
      email: 'missing@example.com',
      userId: null,
      tokenHash: null,
      expiresAt: null,
      usedAt: null,
      revokedAt: null,
      createdAt: new Date('2026-03-27T13:00:00.000Z'),
    });

    const result = await service.forgotPassword({
      email: 'missing@example.com',
    });

    expect(result.message).toContain('If an account exists');
    expect(store.createPasswordResetRequest).toHaveBeenCalledWith({
      email: 'missing@example.com',
      userId: null,
      tokenHash: null,
      expiresAt: null,
    });
  });

  it('rate limits forgot-password requests after three attempts in one hour', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.countPasswordResetRequestsSince.mockResolvedValue(3);

    const result = await service.forgotPassword({
      email: 'reset@example.com',
    });

    expect(result.message).toContain('If an account exists');
    expect(store.findUserByEmail).not.toHaveBeenCalled();
    expect(store.createPasswordResetRequest).not.toHaveBeenCalled();
  });

  it('resets a password with a valid token and invalidates existing sessions', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.consumePasswordResetToken.mockResolvedValue({
      state: 'SUCCESS',
      user: buildUser({
        id: 'user-6',
        email: 'reset2@example.com',
        sessionVersion: 4,
      }),
    });

    const result = await service.resetPassword({
      token: 'raw-reset-token',
      newPassword: 'new-password',
    });

    expect(result).toEqual({ success: true });
    expect(store.consumePasswordResetToken).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.stringContaining('new-password'),
      expect.any(Date),
    );
  });

  it('rejects invalid or expired password reset tokens', async () => {
    const store = new MockAuthStore();
    const service = new AuthService(store);

    store.consumePasswordResetToken.mockResolvedValue({
      state: 'EXPIRED',
    });

    await expect(
      service.resetPassword({
        token: 'expired-token',
        newPassword: 'new-password',
      }),
    ).rejects.toThrow('Invalid or expired password reset token.');
  });
});

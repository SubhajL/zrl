import { Inject, Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import * as speakeasy from 'speakeasy';
import {
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_API_KEY_PREFIX,
  AUTH_JWT_AUDIENCE,
  AUTH_JWT_ISSUER,
  AUTH_MFA_ENROLLMENT_TOKEN_TTL_SECONDS,
  AUTH_MFA_TOKEN_TTL_SECONDS,
  AUTH_PASSWORD_MIN_LENGTH,
  AUTH_PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW,
  AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS,
  AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS,
  AUTH_REFRESH_TOKEN_TTL_SECONDS,
  AUTH_TOTP_WINDOW,
  AUTH_STORE,
} from './auth.constants';
import {
  buildPublicAuthUser,
  createPasswordResetToken,
  createRawApiKey,
  hashApiKey,
  hashPasswordResetToken,
  type JwtBaseClaims,
  resolveAuthSecret,
  signAccessToken,
  signEnrollmentToken,
  signMfaToken,
  signRefreshToken,
  verifyJwt,
} from './auth.utils';
import { AuthPasswordResetConsumeState } from './auth.types';
import type {
  AuthAccessTokenClaims,
  AuthApiKeyCreationInput,
  AuthApiKeyCreationResult,
  AuthApiKeyValidationInput,
  AuthApiKeyValidationResult,
  AuthEnrollmentTokenClaims,
  AuthForgotPasswordInput,
  AuthForgotPasswordResult,
  AuthLoginInput,
  AuthLoginResult,
  AuthLoginSuccessResult,
  AuthLogoutResult,
  AuthMfaEnrollmentConfirmationInput,
  AuthMfaEnrollmentStartResult,
  AuthMfaTokenClaims,
  AuthMfaVerificationInput,
  AuthRefreshInput,
  AuthRefreshTokenClaims,
  AuthRole,
  AuthJwtVerificationResult,
  AuthResetPasswordInput,
  AuthStore,
  AuthTokenPair,
  AuthUserRecord,
} from './auth.types';

function isPrivilegedRole(role: AuthRole): boolean {
  return role === 'ADMIN' || role === 'AUDITOR';
}

function normalizeIpAddress(ipAddress: string): string {
  return ipAddress.trim();
}

function normalizeScope(scope: string): string {
  return scope.trim().toLowerCase();
}

const PASSWORD_RESET_GENERIC_MESSAGE =
  'If an account exists for that email, password reset instructions have been sent.';

@Injectable()
export class AuthService {
  constructor(@Inject(AUTH_STORE) private readonly authStore: AuthStore) {}

  async login(input: AuthLoginInput): Promise<AuthLoginResult> {
    const user = await this.requireValidUser(input.email, input.password);

    if (isPrivilegedRole(user.role)) {
      if (!user.mfaEnabled || user.totpSecret === null) {
        throw new Error('MFA enrollment required.');
      }

      if (input.totpCode === undefined || input.totpCode.length === 0) {
        return this.buildMfaChallenge(user);
      }

      this.assertTotpCode(user, input.totpCode);
    }

    return this.buildSessionTokens(user);
  }

  async verifyMfa(input: AuthMfaVerificationInput): Promise<AuthTokenPair> {
    const claims = this.verifyTypedJwt<AuthMfaTokenClaims>(
      input.mfaToken,
      'mfa',
    );
    const user = await this.requireUserById(claims.sub);

    if (user.sessionVersion !== claims.sv) {
      throw new Error('MFA challenge is stale.');
    }

    this.assertTotpCode(user, input.code);
    return this.buildSessionTokens(user);
  }

  async startMfaEnrollment(
    userId: string,
  ): Promise<AuthMfaEnrollmentStartResult> {
    const user = await this.requireUserById(userId);
    const secret = speakeasy.generateSecret({
      name: `ZRL:${user.email}`,
      length: 20,
    });

    return {
      secret: secret.base32,
      qrUri: secret.otpauth_url ?? '',
      enrollmentToken: signEnrollmentToken(
        {
          iss: AUTH_JWT_ISSUER,
          aud: AUTH_JWT_AUDIENCE,
          sub: user.id,
          type: 'enrollment',
          role: user.role,
          secret: secret.base32,
        },
        AUTH_MFA_ENROLLMENT_TOKEN_TTL_SECONDS,
      ),
    };
  }

  async confirmMfaEnrollment(
    input: AuthMfaEnrollmentConfirmationInput,
    userId?: string,
  ): Promise<{ success: true }> {
    const claims = this.verifyTypedJwt<AuthEnrollmentTokenClaims>(
      input.enrollmentToken,
      'enrollment',
    );
    if (userId !== undefined && claims.sub !== userId) {
      throw new Error(
        'MFA enrollment token does not match the authenticated user.',
      );
    }

    const user = await this.requireUserById(claims.sub);

    this.assertTotpSecretCode(claims.secret, input.code);

    const updated = await this.authStore.updateUserMfa(user.id, {
      mfaEnabled: true,
      totpSecret: claims.secret,
    });

    if (updated === null) {
      throw new Error('Unable to persist MFA enrollment.');
    }

    return { success: true };
  }

  async refresh(input: AuthRefreshInput): Promise<{ accessToken: string }> {
    const claims = this.verifyTypedJwt<AuthRefreshTokenClaims>(
      input.refreshToken,
      'refresh',
    );
    const user = await this.requireUserById(claims.sub);

    if (user.sessionVersion !== claims.sv) {
      throw new Error('Refresh token is stale.');
    }

    return {
      accessToken: signAccessToken(
        {
          iss: AUTH_JWT_ISSUER,
          aud: AUTH_JWT_AUDIENCE,
          sub: user.id,
          type: 'access',
          role: user.role,
          sv: user.sessionVersion,
          mfa: user.mfaEnabled,
          email: user.email,
          companyName: user.companyName,
        },
        AUTH_ACCESS_TOKEN_TTL_SECONDS,
      ),
    };
  }

  async forgotPassword(
    input: AuthForgotPasswordInput,
  ): Promise<AuthForgotPasswordResult> {
    const email = input.email.toLowerCase().trim();
    const now = new Date();
    const windowStart = new Date(
      now.getTime() - AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS * 1000,
    );
    const recentRequestCount =
      await this.authStore.countPasswordResetRequestsSince(email, windowStart);

    if (recentRequestCount >= AUTH_PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW) {
      return this.buildForgotPasswordResult(null);
    }

    const user = await this.authStore.findUserByEmail(email);
    if (user === null) {
      await this.authStore.createPasswordResetRequest({
        email,
        userId: null,
        tokenHash: null,
        expiresAt: null,
      });
      return this.buildForgotPasswordResult(null);
    }

    const rawToken = createPasswordResetToken();
    const expiresAt = new Date(
      now.getTime() + AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000,
    );

    await this.authStore.createPasswordResetRequest({
      email,
      userId: user.id,
      tokenHash: hashPasswordResetToken(rawToken),
      expiresAt,
    });

    return this.buildForgotPasswordResult(rawToken);
  }

  async resetPassword(
    input: AuthResetPasswordInput,
  ): Promise<{ success: true }> {
    if (input.newPassword.length < AUTH_PASSWORD_MIN_LENGTH) {
      throw new Error(
        `Password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`,
      );
    }

    const now = new Date();
    const passwordHash = await hash(input.newPassword, 10);
    const result = await this.authStore.consumePasswordResetToken(
      hashPasswordResetToken(input.token.trim()),
      passwordHash,
      now,
    );

    if (result.state !== AuthPasswordResetConsumeState.SUCCESS) {
      throw new Error('Invalid or expired password reset token.');
    }

    return { success: true };
  }

  async logout(userId: string): Promise<AuthLogoutResult> {
    const updated = await this.authStore.incrementUserSessionVersion(userId);
    if (updated === null) {
      throw new Error('Unable to revoke session.');
    }

    return { success: true };
  }

  async validateApiKey(
    input: AuthApiKeyValidationInput,
  ): Promise<AuthApiKeyValidationResult> {
    const apiKeyHash = this.hashApiKey(input.apiKey);
    const apiKey = await this.authStore.findApiKeyByHash(apiKeyHash);

    if (apiKey === null) {
      return { state: 'NOT_FOUND' };
    }

    const user = await this.requireUserById(apiKey.userId);
    const now = new Date();

    if (apiKey.revokedAt !== null) {
      return {
        state: 'REVOKED',
        user: {
          ...buildPublicAuthUser(user),
          sessionVersion: user.sessionVersion,
        },
        apiKey,
      };
    }

    if (
      apiKey.expiresAt !== null &&
      apiKey.expiresAt.getTime() <= now.getTime()
    ) {
      return {
        state: 'EXPIRED',
        user: {
          ...buildPublicAuthUser(user),
          sessionVersion: user.sessionVersion,
        },
        apiKey,
      };
    }

    if (!this.ipMatches(apiKey.ipWhitelist, input.ipAddress)) {
      return {
        state: 'IP_MISMATCH',
        user: {
          ...buildPublicAuthUser(user),
          sessionVersion: user.sessionVersion,
        },
        apiKey,
      };
    }

    if (!this.scopesMatch(apiKey.scopes, input.requiredScopes ?? [])) {
      return {
        state: 'INSUFFICIENT_SCOPE',
        user: {
          ...buildPublicAuthUser(user),
          sessionVersion: user.sessionVersion,
        },
        apiKey,
      };
    }

    return {
      state: 'VALID',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        mfaEnabled: user.mfaEnabled,
        sessionVersion: user.sessionVersion,
      },
      apiKey,
    };
  }

  async createApiKey(
    input: AuthApiKeyCreationInput,
  ): Promise<AuthApiKeyCreationResult> {
    const rawKey = `${AUTH_API_KEY_PREFIX}${createRawApiKey()}`;
    const keyHash = this.hashApiKey(rawKey);

    const apiKey = await this.authStore.createApiKey({
      userId: input.userId,
      name: input.name,
      keyHash,
      scopes: input.scopes,
      ipWhitelist: input.ipWhitelist,
      expiresAt: input.expiresAt ?? null,
    });

    return {
      apiKey: {
        ...apiKey,
        keyHash,
      },
      key: rawKey,
    };
  }

  async revokeApiKey(apiKeyId: string): Promise<AuthLogoutResult> {
    const revoked = await this.authStore.revokeApiKey(apiKeyId);
    if (revoked === null) {
      throw new Error('Unable to revoke API key.');
    }

    return { success: true };
  }

  async verifyAccessToken(token: string): Promise<AuthJwtVerificationResult> {
    const claims = this.verifyTypedJwt<AuthAccessTokenClaims>(token, 'access');
    const user = await this.requireUserById(claims.sub);

    if (user.sessionVersion !== claims.sv) {
      throw new Error('Access token is stale.');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        mfaEnabled: user.mfaEnabled,
        sessionVersion: user.sessionVersion,
      },
      claims,
    };
  }

  async resolveLaneOwnerId(laneId: string): Promise<string | null> {
    return await this.authStore.resolveLaneOwnerId(laneId);
  }

  async resolveProofPackOwnerId(packId: string): Promise<string | null> {
    return await this.authStore.resolveProofPackOwnerId(packId);
  }

  async resolveCheckpointOwnerId(checkpointId: string): Promise<string | null> {
    return await this.authStore.resolveCheckpointOwnerId(checkpointId);
  }

  private buildSessionTokens(user: AuthUserRecord): AuthLoginSuccessResult {
    return {
      requireMfa: false,
      accessToken: signAccessToken(
        {
          iss: AUTH_JWT_ISSUER,
          aud: AUTH_JWT_AUDIENCE,
          sub: user.id,
          type: 'access',
          role: user.role,
          sv: user.sessionVersion,
          mfa: user.mfaEnabled,
          email: user.email,
          companyName: user.companyName,
        },
        AUTH_ACCESS_TOKEN_TTL_SECONDS,
      ),
      refreshToken: signRefreshToken(
        {
          iss: AUTH_JWT_ISSUER,
          aud: AUTH_JWT_AUDIENCE,
          sub: user.id,
          type: 'refresh',
          role: user.role,
          sv: user.sessionVersion,
        },
        AUTH_REFRESH_TOKEN_TTL_SECONDS,
      ),
      user: buildPublicAuthUser(user),
    };
  }

  private buildMfaChallenge(user: AuthUserRecord) {
    return {
      requireMfa: true as const,
      mfaToken: signMfaToken(
        {
          iss: AUTH_JWT_ISSUER,
          aud: AUTH_JWT_AUDIENCE,
          sub: user.id,
          type: 'mfa',
          role: user.role,
          sv: user.sessionVersion,
        },
        AUTH_MFA_TOKEN_TTL_SECONDS,
      ),
      user: buildPublicAuthUser(user),
    };
  }

  private buildForgotPasswordResult(
    resetTokenPreview: string | null,
  ): AuthForgotPasswordResult {
    if (process.env['NODE_ENV'] === 'production') {
      return {
        message: PASSWORD_RESET_GENERIC_MESSAGE,
      };
    }

    return {
      message: PASSWORD_RESET_GENERIC_MESSAGE,
      resetTokenPreview,
    };
  }

  private async requireValidUser(
    email: string,
    password: string,
  ): Promise<AuthUserRecord> {
    const user = await this.authStore.findUserByEmail(
      email.toLowerCase().trim(),
    );
    if (user === null) {
      throw new Error('Invalid credentials.');
    }

    const matches = await compare(password, user.passwordHash);
    if (!matches) {
      throw new Error('Invalid credentials.');
    }

    return user;
  }

  private async requireUserById(userId: string): Promise<AuthUserRecord> {
    const user = await this.authStore.findUserById(userId);
    if (user === null) {
      throw new Error('User not found.');
    }

    return user;
  }

  private verifyTypedJwt<T extends JwtBaseClaims & { type: string }>(
    token: string,
    expectedType: T['type'],
  ): T {
    const claims = verifyJwt<T>(token, resolveAuthSecret());

    if (claims.type !== expectedType) {
      throw new Error('Invalid token type.');
    }

    if (claims.iss !== AUTH_JWT_ISSUER || claims.aud !== AUTH_JWT_AUDIENCE) {
      throw new Error('Invalid JWT audience.');
    }

    return claims;
  }

  private assertTotpCode(user: AuthUserRecord, code: string): void {
    if (!user.mfaEnabled || user.totpSecret === null) {
      throw new Error('MFA enrollment required.');
    }

    this.assertTotpSecretCode(user.totpSecret, code);
  }

  private assertTotpSecretCode(secret: string, code: string): void {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: AUTH_TOTP_WINDOW,
    });

    if (!verified) {
      throw new Error('Invalid MFA code.');
    }
  }

  private hashApiKey(key: string): string {
    return hashApiKey(key);
  }

  private ipMatches(whitelist: string[], ipAddress: string): boolean {
    if (whitelist.length === 0) {
      return false;
    }

    const normalizedIp = normalizeIpAddress(ipAddress);
    return whitelist.some((allowed) => allowed === normalizedIp);
  }

  private scopesMatch(scopes: string[], requiredScopes: string[]): boolean {
    if (requiredScopes.length === 0) {
      return true;
    }

    const normalizedScopes = scopes.map(normalizeScope);
    return requiredScopes.every((requiredScope) => {
      const normalizedRequired = normalizeScope(requiredScope);
      return (
        normalizedScopes.includes(normalizedRequired) ||
        normalizedScopes.includes('lane:*') ||
        normalizedScopes.includes('*')
      );
    });
  }
}

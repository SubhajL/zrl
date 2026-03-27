import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  AUTH_API_KEY_BYTES,
  AUTH_PASSWORD_RESET_TOKEN_BYTES,
} from './auth.constants';
import type {
  AuthAccessTokenClaims,
  AuthEnrollmentTokenClaims,
  AuthMfaTokenClaims,
  AuthRefreshTokenClaims,
  AuthRole,
} from './auth.types';

export interface JwtBaseClaims {
  iss: string;
  aud: string;
  sub: string;
  type: string;
  role: AuthRole;
  iat: number;
  exp: number;
  jti: string;
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getAuthSecret(): string {
  const envSecret = process.env['AUTH_JWT_SECRET'] ?? process.env['JWT_SECRET'];

  if (envSecret !== undefined && envSecret.length > 0) {
    return envSecret;
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('AUTH_JWT_SECRET must be configured in production.');
  }

  return 'zrl-development-auth-secret';
}

export function resolveAuthSecret(): string {
  return getAuthSecret();
}

export function createJwtId(): string {
  return randomBytes(16).toString('hex');
}

export function createRawApiKey(): string {
  return randomBytes(AUTH_API_KEY_BYTES).toString('hex');
}

export function createPasswordResetToken(): string {
  return randomBytes(AUTH_PASSWORD_RESET_TOKEN_BYTES).toString('base64url');
}

export function hashApiKey(key: string): string {
  return createHmac('sha256', 'zrl-api-key-hash').update(key).digest('hex');
}

export function hashPasswordResetToken(token: string): string {
  return createHmac('sha256', `${resolveAuthSecret()}:password-reset`)
    .update(token)
    .digest('hex');
}

function normalizeJwtClaims<T extends JwtBaseClaims>(claims: T): T {
  return {
    ...claims,
    aud: claims.aud,
    iss: claims.iss,
    sub: claims.sub,
    type: claims.type,
    role: claims.role,
    iat: claims.iat,
    exp: claims.exp,
    jti: claims.jti,
  };
}

export function signJwt<T extends JwtBaseClaims>(
  claims: T,
  secret = resolveAuthSecret(),
): string {
  const header = base64UrlEncode(
    JSON.stringify({
      alg: 'HS256',
      typ: 'JWT',
    }),
  );
  const payload = base64UrlEncode(JSON.stringify(normalizeJwtClaims(claims)));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifyJwt<T extends JwtBaseClaims>(
  token: string,
  secret = resolveAuthSecret(),
): T {
  const [headerPart, payloadPart, signaturePart] = token.split('.');

  if (
    headerPart === undefined ||
    payloadPart === undefined ||
    signaturePart === undefined
  ) {
    throw new Error('Malformed JWT.');
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url');

  const provided = Buffer.from(signaturePart);
  const expected = Buffer.from(expectedSignature);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    throw new Error('Invalid JWT signature.');
  }

  const header = JSON.parse(base64UrlDecode(headerPart)) as { alg?: string };
  if (header.alg !== 'HS256') {
    throw new Error('Unsupported JWT algorithm.');
  }

  const claims = JSON.parse(base64UrlDecode(payloadPart)) as T;
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) {
    throw new Error('JWT expired.');
  }

  return claims;
}

export function signAccessToken(
  claims: Omit<AuthAccessTokenClaims, 'iat' | 'exp' | 'jti'>,
  ttlSeconds: number,
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  return signJwt<AuthAccessTokenClaims>({
    ...claims,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: createJwtId(),
  });
}

export function signRefreshToken(
  claims: Omit<AuthRefreshTokenClaims, 'iat' | 'exp' | 'jti'>,
  ttlSeconds: number,
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  return signJwt<AuthRefreshTokenClaims>({
    ...claims,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: createJwtId(),
  });
}

export function signMfaToken(
  claims: Omit<AuthMfaTokenClaims, 'iat' | 'exp' | 'jti'>,
  ttlSeconds: number,
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  return signJwt<AuthMfaTokenClaims>({
    ...claims,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: createJwtId(),
  });
}

export function signEnrollmentToken(
  claims: Omit<AuthEnrollmentTokenClaims, 'iat' | 'exp' | 'jti'>,
  ttlSeconds: number,
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  return signJwt<AuthEnrollmentTokenClaims>({
    ...claims,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: createJwtId(),
  });
}

export function buildPublicAuthUser(user: {
  id: string;
  email: string;
  role: AuthRole;
  companyName: string | null;
  mfaEnabled: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
    mfaEnabled: user.mfaEnabled,
  };
}

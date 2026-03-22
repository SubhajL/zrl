export const AuthRole = {
  EXPORTER: 'EXPORTER',
  PARTNER: 'PARTNER',
  ADMIN: 'ADMIN',
  AUDITOR: 'AUDITOR',
} as const;

export type AuthRole = (typeof AuthRole)[keyof typeof AuthRole];

export const AuthApiKeyState = {
  VALID: 'VALID',
  NOT_FOUND: 'NOT_FOUND',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  IP_MISMATCH: 'IP_MISMATCH',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
} as const;

export type AuthApiKeyState =
  (typeof AuthApiKeyState)[keyof typeof AuthApiKeyState];

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: AuthRole;
  companyName: string | null;
  mfaEnabled: boolean;
  totpSecret: string | null;
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPublicUser {
  id: string;
  email: string;
  role: AuthRole;
  companyName: string | null;
  mfaEnabled: boolean;
}

export interface AuthApiKeyRecord {
  id: string;
  userId: string;
  keyHash: string;
  name: string;
  scopes: string[];
  ipWhitelist: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface AuthApiKeyCreationInput {
  userId: string;
  name: string;
  keyHash: string;
  scopes: string[];
  ipWhitelist: string[];
  expiresAt?: Date | null;
}

export interface AuthApiKeyCreationResult {
  apiKey: AuthApiKeyRecord;
  key: string;
}

export interface AuthLoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  totpCode?: string;
}

export interface AuthLoginSuccessResult {
  requireMfa: false;
  accessToken: string;
  refreshToken: string;
  user: AuthPublicUser;
}

export interface AuthMfaChallengeResult {
  requireMfa: true;
  mfaToken: string;
  user: AuthPublicUser;
}

export type AuthLoginResult = AuthLoginSuccessResult | AuthMfaChallengeResult;

export interface AuthMfaVerificationInput {
  mfaToken: string;
  code: string;
  ipAddress?: string;
}

export interface AuthMfaEnrollmentStartResult {
  secret: string;
  qrUri: string;
  enrollmentToken: string;
}

export interface AuthMfaEnrollmentConfirmationInput {
  enrollmentToken: string;
  code: string;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  user: AuthPublicUser;
}

export interface AuthRefreshInput {
  refreshToken: string;
}

export interface AuthLogoutResult {
  success: true;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  role: AuthRole;
  companyName: string | null;
  mfaEnabled: boolean;
  sessionVersion: number;
}

export interface AuthAccessTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  type: 'access';
  role: AuthRole;
  sv: number;
  mfa: boolean;
  email: string;
  companyName: string | null;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthRefreshTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  type: 'refresh';
  role: AuthRole;
  sv: number;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthMfaTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  type: 'mfa';
  role: AuthRole;
  sv: number;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthEnrollmentTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  type: 'enrollment';
  role: AuthRole;
  secret: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthStore {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(id: string): Promise<AuthUserRecord | null>;
  updateUserMfa(
    userId: string,
    input: { mfaEnabled: boolean; totpSecret: string | null },
  ): Promise<AuthUserRecord | null>;
  incrementUserSessionVersion(userId: string): Promise<AuthUserRecord | null>;
  findApiKeyByHash(hash: string): Promise<AuthApiKeyRecord | null>;
  createApiKey(input: AuthApiKeyCreationInput): Promise<AuthApiKeyRecord>;
  revokeApiKey(apiKeyId: string): Promise<AuthApiKeyRecord | null>;
  resolveLaneOwnerId(laneId: string): Promise<string | null>;
}

export interface AuthApiKeyValidationInput {
  apiKey: string;
  ipAddress: string;
  requiredScopes?: string[];
}

export interface AuthApiKeyValidationResult {
  state: AuthApiKeyState;
  user?: AuthSessionUser;
  apiKey?: AuthApiKeyRecord;
}

export interface AuthenticatedJwtRequest {
  auth?: {
    kind: 'jwt';
    user: AuthSessionUser;
    token: AuthAccessTokenClaims | AuthRefreshTokenClaims;
  };
  user?: AuthSessionUser;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  params?: Record<string, string>;
  body?: unknown;
  ip?: string;
  route?: { path?: string };
}

export interface AuthenticatedApiKeyRequest {
  auth?: {
    kind: 'api-key';
    user: AuthSessionUser;
    apiKey: AuthApiKeyRecord;
  };
  user?: AuthSessionUser;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  params?: Record<string, string>;
  body?: unknown;
  ip?: string;
  route?: { path?: string };
}

export type AuthPrincipalRequest =
  | AuthenticatedJwtRequest
  | AuthenticatedApiKeyRequest;

export interface AuthJwtVerificationResult {
  user: AuthSessionUser;
  claims: AuthAccessTokenClaims;
}

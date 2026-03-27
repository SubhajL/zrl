export const AUTH_MODULE_SECRET_ENV_KEYS = ['AUTH_JWT_SECRET', 'JWT_SECRET'];

export const AUTH_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const AUTH_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const AUTH_MFA_TOKEN_TTL_SECONDS = 5 * 60;
export const AUTH_MFA_ENROLLMENT_TOKEN_TTL_SECONDS = 10 * 60;
export const AUTH_TOTP_WINDOW = 1;
export const AUTH_SESSION_TIMEOUT_SECONDS = 30 * 60;
export const AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 60;
export const AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
export const AUTH_PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW = 3;
export const AUTH_PASSWORD_RESET_TOKEN_BYTES = 32;
export const AUTH_PASSWORD_MIN_LENGTH = 8;

export const AUTH_JWT_ISSUER = 'zrl-auth';
export const AUTH_JWT_AUDIENCE = 'zrl';
export const AUTH_STORE = 'AUTH_STORE';

export const AUTH_API_KEY_BYTES = 32;
export const AUTH_API_KEY_PREFIX = 'zrl_';

export const AUTH_DEFAULT_SECRET = 'zrl-development-auth-secret';

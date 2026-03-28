export const AUTH_ACCESS_COOKIE = 'zrl_access_token';
export const AUTH_REFRESH_COOKIE = 'zrl_refresh_token';
export const AUTH_MFA_COOKIE = 'zrl_mfa_token';

export const AUTH_ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60;
export const AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const AUTH_MFA_COOKIE_MAX_AGE_SECONDS = 5 * 60;

export interface MutableCookieStore {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options?: {
      readonly httpOnly?: boolean;
      readonly maxAge?: number;
      readonly path?: string;
      readonly sameSite?: 'lax' | 'strict' | 'none';
      readonly secure?: boolean;
    },
  ): void;
  delete(name: string): void;
}

function isSecureCookieEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax' as const,
    secure: isSecureCookieEnvironment(),
  };
}

export function setAccessTokenCookie(
  cookieStore: MutableCookieStore,
  token: string,
) {
  cookieStore.set(
    AUTH_ACCESS_COOKIE,
    token,
    buildCookieOptions(AUTH_ACCESS_COOKIE_MAX_AGE_SECONDS),
  );
}

export function setRefreshTokenCookie(
  cookieStore: MutableCookieStore,
  token: string,
) {
  cookieStore.set(
    AUTH_REFRESH_COOKIE,
    token,
    buildCookieOptions(AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS),
  );
}

export function setMfaTokenCookie(cookieStore: MutableCookieStore, token: string) {
  cookieStore.set(
    AUTH_MFA_COOKIE,
    token,
    buildCookieOptions(AUTH_MFA_COOKIE_MAX_AGE_SECONDS),
  );
}

export function clearSessionCookies(cookieStore: MutableCookieStore) {
  cookieStore.delete(AUTH_ACCESS_COOKIE);
  cookieStore.delete(AUTH_REFRESH_COOKIE);
  cookieStore.delete(AUTH_MFA_COOKIE);
}

export function readAccessTokenCookie(
  cookieStore: Pick<MutableCookieStore, 'get'>,
): string | null {
  return cookieStore.get(AUTH_ACCESS_COOKIE)?.value ?? null;
}

export function readRefreshTokenCookie(
  cookieStore: Pick<MutableCookieStore, 'get'>,
): string | null {
  return cookieStore.get(AUTH_REFRESH_COOKIE)?.value ?? null;
}

export function readMfaTokenCookie(
  cookieStore: Pick<MutableCookieStore, 'get'>,
): string | null {
  return cookieStore.get(AUTH_MFA_COOKIE)?.value ?? null;
}

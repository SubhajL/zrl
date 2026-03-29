import {
  AUTH_ACCESS_COOKIE,
  setAccessTokenCookie,
  type MutableCookieStore,
} from '@/lib/auth-session';

type CookieSetCall = {
  readonly name: string;
  readonly value: string;
  readonly options:
    | {
        readonly httpOnly?: boolean;
        readonly maxAge?: number;
        readonly path?: string;
        readonly sameSite?: 'lax' | 'strict' | 'none';
        readonly secure?: boolean;
      }
    | undefined;
};

function createCookieStore(): MutableCookieStore & {
  readonly setCalls: CookieSetCall[];
} {
  const values = new Map<string, string>();
  const setCalls: CookieSetCall[] = [];

  return {
    setCalls,
    get(name) {
      const value = values.get(name);
      return value === undefined ? undefined : { value };
    },
    set(name, value, options) {
      values.set(name, value);
      setCalls.push({ name, value, options });
    },
    delete(name) {
      values.delete(name);
    },
  };
}

describe('auth-session cookie options', () => {
  const originalEnv = process.env;

  function setEnvironment(overrides: Record<string, string | undefined>) {
    process.env = {
      ...process.env,
      ...overrides,
    };
  }

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to insecure cookies outside production', () => {
    setEnvironment({
      NODE_ENV: 'test',
      AUTH_COOKIE_SECURE: undefined,
    });
    const cookieStore = createCookieStore();

    setAccessTokenCookie(cookieStore, 'access-token');

    expect(cookieStore.setCalls).toEqual([
      expect.objectContaining({
        name: AUTH_ACCESS_COOKIE,
        value: 'access-token',
        options: expect.objectContaining({
          secure: false,
        }),
      }),
    ]);
  });

  it('defaults to secure cookies in production', () => {
    setEnvironment({
      NODE_ENV: 'production',
      AUTH_COOKIE_SECURE: undefined,
    });
    const cookieStore = createCookieStore();

    setAccessTokenCookie(cookieStore, 'access-token');

    expect(cookieStore.setCalls[0]?.options?.secure).toBe(true);
  });

  it('allows explicit insecure-cookie override for local HTTP e2e', () => {
    setEnvironment({
      NODE_ENV: 'production',
      AUTH_COOKIE_SECURE: 'false',
    });
    const cookieStore = createCookieStore();

    setAccessTokenCookie(cookieStore, 'access-token');

    expect(cookieStore.setCalls[0]?.options?.secure).toBe(false);
  });
});

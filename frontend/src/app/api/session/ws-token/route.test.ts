jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@/lib/auth-session', () => ({
  readAccessTokenCookie: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: () => Promise.resolve(body),
    }),
  },
}));

import { cookies } from 'next/headers';
import { readAccessTokenCookie } from '@/lib/auth-session';
import { POST } from './route';

const cookiesMock = jest.mocked(cookies);
const readTokenMock = jest.mocked(readAccessTokenCookie);

describe('POST /api/session/ws-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookiesMock.mockResolvedValue({} as never);
  });

  it('returns token from httpOnly cookie', async () => {
    readTokenMock.mockReturnValue('access-token-123');
    const response = await POST();
    const body = (await response.json()) as { token: string };
    expect(response.status).toBe(200);
    expect(body.token).toBe('access-token-123');
  });

  it('returns 401 when no cookie present', async () => {
    readTokenMock.mockReturnValue(null);
    const response = await POST();
    const body = (await response.json()) as { token: null };
    expect(response.status).toBe(401);
    expect(body.token).toBeNull();
  });
});

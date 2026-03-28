import { resolveServerAccessToken } from './server-access-token';

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: {
      get: () => 'application/json',
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('resolveServerAccessToken', () => {
  const originalFetch = global.fetch;
  const originalApiBaseUrl = process.env.ZRL_API_BASE_URL;

  beforeEach(() => {
    process.env.ZRL_API_BASE_URL = 'http://backend.test';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalApiBaseUrl === undefined) {
      delete process.env.ZRL_API_BASE_URL;
    } else {
      process.env.ZRL_API_BASE_URL = originalApiBaseUrl;
    }
  });

  it('returns the existing access token without calling refresh', async () => {
    await expect(
      resolveServerAccessToken({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    ).resolves.toBe('access-token');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses the refresh token when no access token exists', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      jsonResponse({
        accessToken: 'refreshed-access-token',
      }),
    );

    await expect(
      resolveServerAccessToken({
        accessToken: null,
        refreshToken: 'refresh-token',
      }),
    ).resolves.toBe('refreshed-access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/auth/refresh',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});

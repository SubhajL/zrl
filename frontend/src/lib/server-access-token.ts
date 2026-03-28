import { requestBackendJson } from './backend-api';

export async function resolveServerAccessToken(input: {
  readonly accessToken?: string | null;
  readonly refreshToken?: string | null;
}): Promise<string | null> {
  const accessToken = input.accessToken?.trim() ?? '';
  if (accessToken.length > 0) {
    return accessToken;
  }

  const refreshToken = input.refreshToken?.trim() ?? '';
  if (refreshToken.length === 0) {
    return null;
  }

  try {
    const result = await requestBackendJson<{ accessToken: string }>(
      '/auth/refresh',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      },
    );

    return result.accessToken;
  } catch {
    return null;
  }
}

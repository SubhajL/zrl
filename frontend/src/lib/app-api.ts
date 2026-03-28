export class AppApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Request failed with status ${status}.`);
    this.name = 'AppApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType =
    typeof response.headers?.get === 'function'
      ? response.headers.get('content-type') ?? ''
      : 'application/json';
  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

export async function requestAppJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: new Headers(init.headers),
  });
  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new AppApiError(response.status, body);
  }

  return body as T;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AppApiError) {
    if (
      typeof error.body === 'object' &&
      error.body !== null &&
      'message' in error.body &&
      typeof (error.body as { message?: unknown }).message === 'string'
    ) {
      return (error.body as { message: string }).message;
    }

    if (typeof error.body === 'string' && error.body.length > 0) {
      return error.body;
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

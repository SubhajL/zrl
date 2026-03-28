const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3000';

export class BackendApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Backend request failed with status ${status}.`);
    this.name = 'BackendApiError';
    this.status = status;
    this.body = body;
  }
}

export function resolveBackendBaseUrl(): string {
  return (
    process.env.ZRL_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_BACKEND_BASE_URL
  ).replace(/\/$/, '');
}

function buildBackendHeaders(
  headers: HeadersInit | undefined,
  accessToken: string | null | undefined,
): Headers {
  const resolved = new Headers(headers);
  if (accessToken && !resolved.has('authorization')) {
    resolved.set('authorization', `Bearer ${accessToken}`);
  }

  return resolved;
}

export async function requestBackend(
  path: string,
  input: RequestInit & { readonly accessToken?: string | null } = {},
): Promise<Response> {
  const { accessToken, headers, ...init } = input;
  return await fetch(`${resolveBackendBaseUrl()}${path}`, {
    ...init,
    headers: buildBackendHeaders(headers, accessToken),
    cache: 'no-store',
  });
}

export async function parseBackendBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

export async function requestBackendJson<T>(
  path: string,
  input: RequestInit & { readonly accessToken?: string | null } = {},
): Promise<T> {
  const response = await requestBackend(path, input);
  const body = await parseBackendBody(response);

  if (!response.ok) {
    throw new BackendApiError(response.status, body);
  }

  return body as T;
}

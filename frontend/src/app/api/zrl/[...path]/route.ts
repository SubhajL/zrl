import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  clearSessionCookies,
  readAccessTokenCookie,
  readRefreshTokenCookie,
  setAccessTokenCookie,
} from '@/lib/auth-session';
import { requestBackend, requestBackendJson } from '@/lib/backend-api';

async function buildBackendBody(request: Request): Promise<BodyInit | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  const bytes = await request.arrayBuffer();
  return bytes.byteLength === 0 ? undefined : bytes;
}

function buildProxyHeaders(request: Request): Headers {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');

  if (contentType !== null) {
    headers.set('content-type', contentType);
  }

  if (accept !== null) {
    headers.set('accept', accept);
  }

  return headers;
}

async function toNextResponse(response: Response) {
  const body = await response.arrayBuffer();
  const headers = new Headers();

  for (const [key, value] of response.headers.entries()) {
    const normalized = key.toLowerCase();
    if (
      normalized === 'content-type' ||
      normalized === 'content-disposition'
    ) {
      headers.set(key, value);
    }
  }

  return new NextResponse(body, {
    status: response.status,
    headers,
  });
}

async function refreshAccessToken(
  refreshToken: string,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
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

    setAccessTokenCookie(cookieStore, result.accessToken);
    return result.accessToken;
  } catch {
    clearSessionCookies(cookieStore);
    return null;
  }
}

async function proxyRequest(request: Request, pathSegments: string[]) {
  const cookieStore = await cookies();
  const accessToken = readAccessTokenCookie(cookieStore);
  const refreshToken = readRefreshTokenCookie(cookieStore);

  if (accessToken === null && refreshToken === null) {
    return NextResponse.json(
      { message: 'Authentication required.' },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const path = `/${pathSegments.join('/')}${url.search}`;
  const body = await buildBackendBody(request);
  const headers = buildProxyHeaders(request);

  let backendResponse = await requestBackend(path, {
    method: request.method,
    headers,
    body,
    accessToken,
  });

  if (backendResponse.status === 401 && refreshToken !== null) {
    const refreshedAccessToken = await refreshAccessToken(
      refreshToken,
      cookieStore,
    );

    if (refreshedAccessToken !== null) {
      backendResponse = await requestBackend(path, {
        method: request.method,
        headers,
        body,
        accessToken: refreshedAccessToken,
      });
    }
  }

  if (backendResponse.status === 401) {
    clearSessionCookies(cookieStore);
  }

  return await toNextResponse(backendResponse);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return await proxyRequest(request, (await context.params).path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return await proxyRequest(request, (await context.params).path);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return await proxyRequest(request, (await context.params).path);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return await proxyRequest(request, (await context.params).path);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return await proxyRequest(request, (await context.params).path);
}

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  clearSessionCookies,
  setAccessTokenCookie,
  setMfaTokenCookie,
  setRefreshTokenCookie,
} from '@/lib/auth-session';
import { BackendApiError, requestBackendJson } from '@/lib/backend-api';

interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly companyName: string | null;
  readonly fullName: string;
  readonly mfaEnabled: boolean;
}

interface LoginRouteResult {
  readonly requireMfa: boolean;
  readonly mfaToken: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: SessionUser;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();

  try {
    const body = (await request.json()) as {
      readonly email?: string;
      readonly password?: string;
    };
    const result = await requestBackendJson<LoginRouteResult>('/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    });

    clearSessionCookies(cookieStore);

    if (result.requireMfa) {
      setMfaTokenCookie(cookieStore, result.mfaToken);
      return NextResponse.json(
        {
          requireMfa: true,
          user: result.user,
        },
        { status: 200 },
      );
    }

    setAccessTokenCookie(cookieStore, result.accessToken);
    setRefreshTokenCookie(cookieStore, result.refreshToken);

    return NextResponse.json(
      {
        requireMfa: false,
        user: result.user,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    return NextResponse.json(
      { message: 'Unable to sign in.' },
      { status: 500 },
    );
  }
}

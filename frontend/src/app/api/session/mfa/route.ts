import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  clearSessionCookies,
  readMfaTokenCookie,
  setAccessTokenCookie,
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

interface MfaVerifyResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: SessionUser;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const mfaToken = readMfaTokenCookie(cookieStore);

  if (mfaToken === null) {
    return NextResponse.json(
      { message: 'MFA challenge expired. Please sign in again.' },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      readonly code?: string;
    };
    const result = await requestBackendJson<MfaVerifyResult>('/auth/mfa/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        mfaToken,
        code: body.code,
      }),
    });

    clearSessionCookies(cookieStore);
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
      { message: 'Unable to verify MFA code.' },
      { status: 500 },
    );
  }
}

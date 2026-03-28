import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearSessionCookies, readAccessTokenCookie } from '@/lib/auth-session';
import { requestBackend } from '@/lib/backend-api';

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = readAccessTokenCookie(cookieStore);

  if (accessToken !== null) {
    await requestBackend('/auth/logout', {
      method: 'POST',
      accessToken,
    }).catch(() => undefined);
  }

  clearSessionCookies(cookieStore);
  return NextResponse.json({ success: true });
}

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readAccessTokenCookie } from '@/lib/auth-session';

// SECURITY: This endpoint exposes the httpOnly access token to client-side JS
// for WebSocket auth (Socket.IO requires token in handshake). Using POST
// instead of GET to prevent CSRF via <img> or <script> tags. The token is
// already implicitly available to same-origin JS via the API proxy, so this
// doesn't meaningfully widen the XSS attack surface. Future improvement:
// exchange for a short-lived WS-specific token with narrower scope.
export async function POST() {
  const cookieStore = await cookies();
  const token = readAccessTokenCookie(cookieStore);
  if (token === null) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  return NextResponse.json({ token });
}

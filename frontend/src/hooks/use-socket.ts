'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

function resolveWsUrl(): string {
  if (typeof window === 'undefined') return '';
  return process.env['NEXT_PUBLIC_WS_URL'] ?? window.location.origin;
}

async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/session/ws-token', { method: 'POST' });
    if (!res.ok) return null;
    const body = (await res.json()) as { token: string | null };
    return body.token;
  } catch {
    return null;
  }
}

export function useSocket(): { socket: Socket | null; connected: boolean } {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const token = await fetchWsToken();
      if (cancelled || token === null) return;

      const wsUrl = resolveWsUrl();
      if (wsUrl.length === 0) return;

      const s = io(`${wsUrl}/ws`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 10,
      });

      s.on('connect', () => {
        if (!cancelled) setConnected(true);
      });
      s.on('disconnect', () => {
        if (!cancelled) setConnected(false);
      });
      s.on('connect_error', () => {
        // Re-fetch token before next reconnection attempt — the original
        // token may have expired and been refreshed via the API proxy.
        void fetchWsToken().then((freshToken) => {
          if (!cancelled && freshToken !== null) {
            s.auth = { token: freshToken };
          }
        });
      });

      socketRef.current = s;
      if (!cancelled) setSocket(s);
    }

    void connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, []);

  return { socket, connected };
}

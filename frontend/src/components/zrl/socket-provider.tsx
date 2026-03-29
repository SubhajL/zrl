'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useSocket } from '@/hooks/use-socket';

interface SocketContextValue {
  readonly socket: Socket | null;
  readonly connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

export function SocketProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const value = useSocket();
  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocketContext(): SocketContextValue {
  return useContext(SocketContext);
}

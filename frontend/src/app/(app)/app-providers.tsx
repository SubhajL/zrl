'use client';

import { SocketProvider } from '@/components/zrl/socket-provider';

export function AppProviders({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <SocketProvider>{children}</SocketProvider>;
}

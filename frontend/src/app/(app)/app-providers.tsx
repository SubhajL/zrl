'use client';

import { lazy, Suspense, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SocketProvider } from '@/components/zrl/socket-provider';
import { createQueryClient } from '@/lib/query-client';

const DevTools =
  process.env.NODE_ENV === 'development'
    ? lazy(() =>
        import('@tanstack/react-query-devtools').then((m) => ({
          default: m.ReactQueryDevtools,
        })),
      )
    : () => null;

export function AppProviders({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>{children}</SocketProvider>
      <Suspense>
        <DevTools initialIsOpen={false} />
      </Suspense>
    </QueryClientProvider>
  );
}

'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AuthError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      <AlertTriangle className="size-10 text-destructive" />
      <div className="text-center">
        <h2 className="text-lg font-bold">Authentication Error</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <RefreshCw className="mr-2 inline size-4" />
        Try Again
      </button>
    </div>
  );
}

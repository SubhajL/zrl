import * as React from 'react';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

import { cn } from '@/lib/utils';

export type StatusDotStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusDotProps {
  readonly status: StatusDotStatus;
  readonly size?: 'sm' | 'md';
  readonly pulse?: boolean;
  readonly className?: string;
}

const statusColorMap: Record<StatusDotStatus, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
};

const sizeMap: Record<NonNullable<StatusDotProps['size']>, string> = {
  sm: 'size-2',
  md: 'size-2.5',
};

export function StatusDot({
  status,
  size = 'md',
  pulse = false,
  className,
}: StatusDotProps) {
  return (
    <span
      className={cn('inline-flex items-center', className)}
      role="img"
      aria-hidden="true"
    >
      <span
        className={cn(
          'inline-block rounded-full',
          statusColorMap[status],
          sizeMap[size],
          pulse && 'animate-pulse',
        )}
      />
      <VisuallyHidden.Root>
        {status}
      </VisuallyHidden.Root>
    </span>
  );
}

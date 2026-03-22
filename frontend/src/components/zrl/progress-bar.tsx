'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export type ProgressBarTint = 'primary' | 'success' | 'warning' | 'error';

export interface ProgressBarProps {
  readonly value: number;
  readonly label?: string;
  readonly showPercentage?: boolean;
  readonly className?: string;
  readonly tint?: ProgressBarTint;
}

const tintIndicatorMap: Record<ProgressBarTint, string> = {
  primary: '[&>div]:bg-primary',
  success: '[&>div]:bg-emerald-500',
  warning: '[&>div]:bg-amber-500',
  error: '[&>div]:bg-red-500',
};

export function ProgressBar({
  value,
  label,
  showPercentage = false,
  className,
  tint = 'primary',
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && (
            <span className="font-medium text-foreground">{label}</span>
          )}
          {showPercentage && (
            <span className="tabular-nums text-muted-foreground">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <Progress
        value={clampedValue}
        aria-label={label ?? `Progress: ${Math.round(clampedValue)}%`}
        className={cn(tintIndicatorMap[tint])}
      />
    </div>
  );
}

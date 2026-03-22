import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export type KpiTileTint = 'blue' | 'purple' | 'emerald' | 'amber';

export interface KpiTileDelta {
  readonly value: string;
  readonly trend: 'up' | 'down' | 'neutral';
}

export interface KpiTileProps {
  readonly title: string;
  readonly value: string | number;
  readonly delta?: KpiTileDelta;
  readonly icon?: React.ReactNode;
  readonly tint?: KpiTileTint;
  readonly className?: string;
}

const tintCardMap: Record<KpiTileTint, string> = {
  blue: 'bg-blue-50',
  purple: 'bg-purple-50',
  emerald: 'bg-emerald-50',
  amber: 'bg-amber-50',
};

const tintIconContainerMap: Record<KpiTileTint, string> = {
  blue: 'bg-blue-100/10',
  purple: 'bg-purple-100/10',
  emerald: 'bg-emerald-100/10',
  amber: 'bg-amber-100/10',
};

const trendColorMap: Record<KpiTileDelta['trend'], string> = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-muted-foreground',
};

const TrendIcon: Record<KpiTileDelta['trend'], React.ComponentType<{ className?: string }>> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function KpiTile({
  title,
  value,
  delta,
  icon,
  tint = 'blue',
  className,
}: KpiTileProps) {
  return (
    <Card className={cn(tintCardMap[tint], className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums">
              {value}
            </p>
            {delta && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs',
                  trendColorMap[delta.trend],
                )}
              >
                {React.createElement(TrendIcon[delta.trend], {
                  className: 'size-3',
                })}
                <span>{delta.value}</span>
              </div>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                'rounded-lg p-2',
                tintIconContainerMap[tint],
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

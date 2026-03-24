import { MapPin, Thermometer, User, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatTimestamp } from '@/lib/format';
import type { Checkpoint } from '@/lib/types';

const STATUS_BADGE_VARIANT: Record<
  string,
  'success' | 'secondary' | 'destructive'
> = {
  COMPLETED: 'success',
  PENDING: 'secondary',
  OVERDUE: 'destructive',
};

const CIRCLE_COLOR: Record<string, string> = {
  COMPLETED: 'bg-success',
  PENDING: 'bg-muted-foreground',
  OVERDUE: 'bg-destructive',
};

/* ── Component ── */

export interface TabCheckpointsProps {
  readonly checkpoints: readonly Checkpoint[];
}

export function TabCheckpoints({ checkpoints }: TabCheckpointsProps) {
  if (checkpoints.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MapPin className="size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold text-muted-foreground">
            No Checkpoints
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            No checkpoint data available for this lane.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      {checkpoints.map((checkpoint) => (
        <div key={checkpoint.id} className="relative pl-12 pb-8">
          {/* Circle indicator */}
          <div
            className={cn(
              'absolute left-2.5 w-3 h-3 rounded-full',
              CIRCLE_COLOR[checkpoint.status] ?? 'bg-muted-foreground',
            )}
          />

          <Card>
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">
                    CP{checkpoint.sequence}: {checkpoint.locationName}
                  </span>
                </div>
                <Badge
                  variant={
                    STATUS_BADGE_VARIANT[checkpoint.status] ?? 'secondary'
                  }
                >
                  {checkpoint.status}
                </Badge>
              </div>

              {/* Body */}
              {checkpoint.status === 'COMPLETED' ? (
                <div className="space-y-2 text-sm">
                  {checkpoint.timestamp && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span>{formatTimestamp(checkpoint.timestamp)}</span>
                    </div>
                  )}
                  {checkpoint.temperature != null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Thermometer className="size-3.5" />
                      <span className="font-mono tabular-nums">
                        {checkpoint.temperature}°C
                      </span>
                    </div>
                  )}
                  {checkpoint.signerName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="size-3.5" />
                      <span>{checkpoint.signerName}</span>
                    </div>
                  )}
                  {checkpoint.conditionNotes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {checkpoint.conditionNotes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Awaiting checkpoint data
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/zrl/progress-bar';
import { StatusDot } from '@/components/zrl/status-dot';
import type { LaneDetail } from '@/lib/types';
import {
  PRODUCT_EMOJI,
  PRODUCT_LABELS,
  MARKET_FLAGS,
  MARKET_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
} from '@/lib/types';

export interface LaneHeaderProps {
  readonly lane: LaneDetail;
}

function getTemperatureStatus(
  lane: LaneDetail,
): 'success' | 'warning' | 'error' | 'neutral' {
  if (!lane.temperatureProfile) return 'neutral';
  if (lane.status === 'CREATED') return 'neutral';
  return 'success';
}

export function LaneHeader({ lane }: LaneHeaderProps) {
  const variety = lane.batch?.variety ? ` (${lane.batch.variety})` : '';
  const completeness = lane.completenessScore;
  const tempStatus = getTemperatureStatus(lane);

  return (
    <div className="space-y-3">
      {/* Row 1: Lane ID + Status Badge + Temperature StatusDot */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-mono font-bold">{lane.laneId}</h1>
        <Badge variant={STATUS_VARIANT[lane.status] as 'default'}>
          {STATUS_LABELS[lane.status]}
        </Badge>
        <StatusDot
          status={tempStatus}
          pulse={tempStatus === 'warning' || tempStatus === 'error'}
        />
      </div>

      {/* Row 2: Product + destination */}
      <p className="text-muted-foreground">
        {PRODUCT_EMOJI[lane.productType]} {PRODUCT_LABELS[lane.productType]}
        {variety} {'\u2192'} {MARKET_FLAGS[lane.destinationMarket]}{' '}
        {MARKET_LABELS[lane.destinationMarket]}
      </p>

      {/* Row 3: Completeness progress bar */}
      <div className="max-w-md">
        <ProgressBar
          value={completeness}
          label="Completeness"
          showPercentage
          tint={
            completeness >= 80
              ? 'success'
              : completeness >= 50
                ? 'warning'
                : 'error'
          }
        />
      </div>

      {/* Row 4: Quick action buttons */}
      <div className="flex items-center gap-2">
        <Button disabled={completeness < 95}>Generate Pack</Button>
        <Button variant="ghost">View Audit Trail</Button>
      </div>
    </div>
  );
}

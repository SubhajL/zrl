import { ShieldOff, Shield, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ── Component ── */

export interface TabDisputeProps {
  readonly laneId: string;
  readonly hasDispute?: boolean;
}

export function TabDispute({ laneId, hasDispute }: TabDisputeProps) {
  if (!hasDispute) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <ShieldOff className="size-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-semibold">No Active Disputes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This lane has no active claims or disputes.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            If a claim is filed, the dispute resolution tools will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active dispute card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-red-500" />
              <CardTitle className="text-base">Dispute Status</CardTitle>
            </div>
            <Badge variant="destructive">Dispute Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A claim has been filed against this lane. Use the tools below to
            generate a defense pack and review the claim timeline.
          </p>
          <Button>
            <Shield className="size-4" />
            Generate Claim Defense Pack
          </Button>
        </CardContent>
      </Card>

      {/* Timeline placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Claim Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Claim timeline events will appear here once populated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

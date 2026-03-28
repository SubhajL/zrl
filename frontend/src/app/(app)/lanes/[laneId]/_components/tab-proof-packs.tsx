'use client';

import * as React from 'react';
import { FileCheck, Package, Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getErrorMessage, requestAppJson } from '@/lib/app-api';
import { formatTimestamp } from '@/lib/format';
import type {
  ProofPackStatus,
  ProofPackSummary,
  ProofPackType,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface PackDefinition {
  readonly type: ProofPackType;
  readonly name: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly iconBg: string;
  readonly description: string;
}

const PACK_DEFINITIONS: readonly PackDefinition[] = [
  {
    type: 'REGULATOR',
    name: 'Regulator Pack',
    icon: FileCheck,
    iconBg: 'bg-info/10',
    description:
      'All MRL results, phyto cert, VHT cert, customs forms (Thai and English).',
  },
  {
    type: 'BUYER',
    name: 'Buyer Pack',
    icon: Package,
    iconBg: 'bg-success/10',
    description:
      'MRL summary, phyto, VHT, temp SLA, and checkpoint photos for buyers.',
  },
  {
    type: 'DEFENSE',
    name: 'Defense Pack',
    icon: Shield,
    iconBg: 'bg-warning/10',
    description:
      'Full chain-of-custody, excursion analysis, and audit-trail evidence.',
  },
] as const;

const PACK_STATUS_VARIANT: Record<
  ProofPackStatus,
  'warning' | 'success' | 'destructive'
> = {
  GENERATING: 'warning',
  READY: 'success',
  FAILED: 'destructive',
};

export interface TabProofPacksProps {
  readonly laneId: string;
  readonly completeness: number;
  readonly packs: readonly ProofPackSummary[];
}

function formatPackStatus(status: ProofPackStatus): string {
  switch (status) {
    case 'GENERATING':
      return 'Generating';
    case 'READY':
      return 'Ready';
    case 'FAILED':
      return 'Failed';
  }
}

function groupPacksByType(
  packs: readonly ProofPackSummary[],
): Record<ProofPackType, ProofPackSummary[]> {
  return {
    REGULATOR: packs.filter((pack) => pack.packType === 'REGULATOR'),
    BUYER: packs.filter((pack) => pack.packType === 'BUYER'),
    DEFENSE: packs.filter((pack) => pack.packType === 'DEFENSE'),
  };
}

export function TabProofPacks({
  laneId,
  completeness,
  packs,
}: TabProofPacksProps) {
  const [currentPacks, setCurrentPacks] = React.useState<ProofPackSummary[]>([
    ...packs,
  ]);
  const [loadingType, setLoadingType] = React.useState<ProofPackType | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const packsByType = React.useMemo(
    () => groupPacksByType(currentPacks),
    [currentPacks],
  );

  async function handleGenerate(packType: ProofPackType, packName: string) {
    setLoadingType(packType);
    setError(null);

    try {
      const response = await requestAppJson<{ pack: ProofPackSummary }>(
        `/api/zrl/lanes/${encodeURIComponent(laneId)}/packs/generate`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ packType }),
        },
      );

      setCurrentPacks((existing) =>
        [response.pack, ...existing].sort((left, right) =>
          right.generatedAt.localeCompare(left.generatedAt),
        ),
      );
      setStatusMessage(`${packName} queued on the live backend.`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, `Unable to generate ${packName}.`));
    } finally {
      setLoadingType(null);
    }
  }

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PACK_DEFINITIONS.map((packDefinition) => {
          const Icon = packDefinition.icon;
          const packHistory = packsByType[packDefinition.type];
          const latestPack = packHistory[0] ?? null;
          const canGenerate = completeness >= 95;
          const isGenerating = loadingType === packDefinition.type;
          const generateDisabled =
            !canGenerate || latestPack?.status === 'GENERATING' || isGenerating;

          return (
            <Card key={packDefinition.type} className="flex flex-col">
              <CardHeader>
                <div className={cn('w-fit rounded-lg p-3', packDefinition.iconBg)}>
                  <Icon className="size-6" />
                </div>
                <CardTitle className="mt-3 text-base">
                  {packDefinition.name}
                </CardTitle>
                <CardDescription>{packDefinition.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-4 text-sm">
                {latestPack === null ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">
                    No pack generated yet. The live API will create version 1.
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        Version {latestPack.version}
                      </span>
                      <Badge variant={PACK_STATUS_VARIANT[latestPack.status]}>
                        {formatPackStatus(latestPack.status)}
                      </Badge>
                    </div>
                    <dl className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between gap-3">
                        <dt>Generated</dt>
                        <dd>{formatTimestamp(latestPack.generatedAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Pack ID</dt>
                        <dd className="font-mono">{latestPack.id}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Hash</dt>
                        <dd className="font-mono">
                          {latestPack.contentHash?.slice(0, 12) ?? '--'}
                        </dd>
                      </div>
                    </dl>
                    {latestPack.errorMessage && (
                      <p className="text-xs text-destructive">
                        {latestPack.errorMessage}
                      </p>
                    )}
                  </div>
                )}

                {packHistory.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      History
                    </p>
                    <div className="space-y-2">
                      {packHistory.slice(1).map((historicPack) => (
                        <div
                          key={historicPack.id}
                          className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                        >
                          <span>v{historicPack.version}</span>
                          <span className="text-muted-foreground">
                            {formatPackStatus(historicPack.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col items-stretch gap-3">
                <Button
                  className="w-full"
                  disabled={generateDisabled}
                  aria-label={`Generate ${packDefinition.name}`}
                  onClick={() =>
                    void handleGenerate(packDefinition.type, packDefinition.name)
                  }
                >
                  {isGenerating
                    ? 'Queueing...'
                    : latestPack === null
                      ? 'Generate'
                      : 'Regenerate'}
                </Button>

                {latestPack?.status === 'READY' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline">
                      <a
                        href={`/api/zrl/packs/${encodeURIComponent(latestPack.id)}/download`}
                      >
                        Download
                      </a>
                    </Button>
                    <Button asChild variant="outline">
                      <a
                        href={`/api/zrl/packs/${encodeURIComponent(latestPack.id)}/verify`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Verify
                      </a>
                    </Button>
                  </div>
                )}

                <p className="text-center text-xs text-muted-foreground">
                  {canGenerate
                    ? 'Pack actions are wired to the live backend for this lane.'
                    : `Requires at least 95% completeness. Current lane completeness: ${completeness}%.`}
                </p>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

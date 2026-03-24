import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Upload,
  FileText,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/zrl/status-dot';
import type {
  EvidenceArtifact,
  EvidenceGraph,
  ArtifactType,
} from '@/lib/types';

/* ── Category definitions ── */

interface EvidenceCategory {
  readonly label: string;
  readonly types: readonly ArtifactType[];
}

const EVIDENCE_CATEGORIES: readonly EvidenceCategory[] = [
  {
    label: 'Regulatory Documents',
    types: ['MRL_TEST', 'VHT_CERT', 'PHYTO_CERT'],
  },
  {
    label: 'Quality Documents',
    types: ['GAP_CERT', 'INVOICE'],
  },
  {
    label: 'Cold-Chain',
    types: ['TEMP_DATA'],
  },
  {
    label: 'Chain of Custody',
    types: ['CHECKPOINT_PHOTO', 'HANDOFF_SIGNATURE'],
  },
] as const;

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  MRL_TEST: 'MRL Test Report',
  VHT_CERT: 'VHT Certificate',
  PHYTO_CERT: 'Phytosanitary Certificate',
  GAP_CERT: 'GAP Certificate',
  INVOICE: 'Invoice',
  TEMP_DATA: 'Temperature Data',
  CHECKPOINT_PHOTO: 'Checkpoint Photo',
  HANDOFF_SIGNATURE: 'Handoff Signature',
};

const SOURCE_VARIANT: Record<string, 'default' | 'secondary' | 'info'> = {
  UPLOAD: 'secondary',
  PARTNER_API: 'info',
  CAMERA: 'default',
};

/* ── Helpers ── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusIcon({ status }: { readonly status: string }) {
  switch (status) {
    case 'VERIFIED':
      return <CheckCircle className="size-5 text-emerald-600" />;
    case 'PENDING':
      return <Loader2 className="size-5 text-blue-500 animate-spin" />;
    case 'FAILED':
      return <AlertTriangle className="size-5 text-amber-500" />;
    default:
      return <FileText className="size-5 text-muted-foreground" />;
  }
}

function GraphStatusDot({
  status,
}: {
  readonly status: 'COMPLETE' | 'PENDING' | 'FAILED';
}) {
  const dotStatus =
    status === 'COMPLETE'
      ? 'success'
      : status === 'PENDING'
        ? 'warning'
        : 'error';
  return <StatusDot status={dotStatus} size="sm" />;
}

/* ── Component ── */

export interface TabEvidenceProps {
  readonly evidence: EvidenceArtifact[];
  readonly graph?: EvidenceGraph;
}

export function TabEvidence({ evidence, graph }: TabEvidenceProps) {
  const evidenceByType = new Map<ArtifactType, EvidenceArtifact>();
  for (const artifact of evidence) {
    evidenceByType.set(artifact.artifactType, artifact);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left column — Evidence Checklist */}
      <div className="lg:col-span-8 space-y-6">
        {EVIDENCE_CATEGORIES.map((category) => (
          <Card key={category.label}>
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                {category.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {category.types.map((artifactType) => {
                const artifact = evidenceByType.get(artifactType);

                if (!artifact) {
                  return (
                    <div
                      key={artifactType}
                      className="flex items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/20 p-4 text-muted-foreground"
                    >
                      <Upload className="size-5" />
                      <span className="text-sm font-medium">
                        Upload {ARTIFACT_TYPE_LABELS[artifactType]}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={artifactType}
                    className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <StatusIcon status={artifact.verificationStatus} />
                    <span className="text-sm font-medium flex-1 truncate">
                      {artifact.fileName}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {artifact.contentHash.slice(0, 8)}
                    </span>
                    <Badge
                      variant={SOURCE_VARIANT[artifact.source] ?? 'secondary'}
                    >
                      {artifact.source}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(artifact.createdAt)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Right column — Evidence Graph */}
      <div className="lg:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">Evidence Graph</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {graph?.nodes && graph.nodes.length > 0 ? (
              graph.nodes.map((node) => (
                <div key={node.id} className="flex items-center gap-2">
                  <GraphStatusDot status={node.status} />
                  <span className="text-sm flex-1 truncate">{node.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {node.hashPreview}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No graph data available yet.
              </p>
            )}
          </CardContent>
          <CardFooter>
            <span className="text-xs font-medium text-primary cursor-pointer hover:underline">
              View Full Graph &rarr;
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useRef, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Upload,
  FileText,
  ShieldCheck,
  Clock3,
} from 'lucide-react';

import { formatTimestamp } from '@/lib/format';
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

/* ── Constants ── */

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.csv,.json';

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

const ANALYZABLE_ARTIFACT_TYPES = new Set<ArtifactType>([
  'PHYTO_CERT',
  'VHT_CERT',
  'MRL_TEST',
  'GAP_CERT',
  'INVOICE',
]);

const VERIFICATION_STATUS_VARIANT = {
  VERIFIED: 'success',
  PENDING: 'warning',
  FAILED: 'destructive',
} as const;

const VERIFICATION_STATUS_LABEL = {
  VERIFIED: 'Verified',
  PENDING: 'Pending verification',
  FAILED: 'Failed integrity',
} as const;

/* ── Helpers ── */

function StatusIcon({ status }: { readonly status: string }) {
  switch (status) {
    case 'VERIFIED':
      return <CheckCircle className="size-5 text-success" />;
    case 'PENDING':
      return <Clock3 className="size-5 text-info" />;
    case 'FAILED':
      return <AlertTriangle className="size-5 text-warning" />;
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
  readonly onUpload?: (artifactType: string, file: File) => Promise<void>;
  readonly onVerifyGraph?: () => Promise<void>;
  readonly onVerifyArtifact?: (artifactId: string) => Promise<void>;
  readonly onReanalyzeArtifact?: (artifactId: string) => Promise<void>;
  readonly onBackfillAnalysis?: () => Promise<void>;
}

export function TabEvidence({
  evidence,
  graph,
  onUpload,
  onVerifyGraph,
  onVerifyArtifact,
  onReanalyzeArtifact,
  onBackfillAnalysis,
}: TabEvidenceProps) {
  const evidenceByType = new Map<ArtifactType, EvidenceArtifact>();
  for (const artifact of evidence) {
    evidenceByType.set(artifact.artifactType, artifact);
  }

  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{
    type: string;
    message: string;
  } | null>(null);
  const [graphVerificationError, setGraphVerificationError] = useState<
    string | null
  >(null);
  const [isVerifyingGraph, setIsVerifyingGraph] = useState(false);
  const [artifactVerificationError, setArtifactVerificationError] = useState<{
    artifactId: string;
    message: string;
  } | null>(null);
  const [verifyingArtifactId, setVerifyingArtifactId] = useState<string | null>(
    null,
  );
  const [artifactAnalysisError, setArtifactAnalysisError] = useState<{
    artifactId: string;
    message: string;
  } | null>(null);
  const [reanalyzingArtifactId, setReanalyzingArtifactId] = useState<
    string | null
  >(null);
  const [backfillAnalysisError, setBackfillAnalysisError] = useState<
    string | null
  >(null);
  const [isBackfillingAnalysis, setIsBackfillingAnalysis] = useState(false);

  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const setFileInputRef = useCallback(
    (artifactType: string) => (el: HTMLInputElement | null) => {
      if (el) {
        fileInputRefs.current.set(artifactType, el);
      } else {
        fileInputRefs.current.delete(artifactType);
      }
    },
    [],
  );

  function handleUploadZoneClick(artifactType: string) {
    if (!onUpload) return;
    const input = fileInputRefs.current.get(artifactType);
    input?.click();
  }

  async function handleFileSelected(artifactType: string, file: File) {
    setUploadingType(artifactType);
    setUploadError(null);
    try {
      await onUpload?.(artifactType, file);
    } catch (err) {
      setUploadError({
        type: artifactType,
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setUploadingType(null);
    }
  }

  async function handleVerifyGraph() {
    if (!onVerifyGraph) {
      return;
    }

    setGraphVerificationError(null);
    setIsVerifyingGraph(true);
    try {
      await onVerifyGraph();
    } catch (error) {
      setGraphVerificationError(
        error instanceof Error
          ? error.message
          : 'Unable to verify evidence graph.',
      );
    } finally {
      setIsVerifyingGraph(false);
    }
  }

  async function handleVerifyArtifact(artifactId: string) {
    if (!onVerifyArtifact) {
      return;
    }

    setArtifactVerificationError(null);
    setVerifyingArtifactId(artifactId);
    try {
      await onVerifyArtifact(artifactId);
    } catch (error) {
      setArtifactVerificationError({
        artifactId,
        message:
          error instanceof Error ? error.message : 'Unable to verify artifact.',
      });
    } finally {
      setVerifyingArtifactId(null);
    }
  }

  async function handleReanalyzeArtifact(artifactId: string) {
    if (!onReanalyzeArtifact) {
      return;
    }

    setArtifactAnalysisError(null);
    setReanalyzingArtifactId(artifactId);
    try {
      await onReanalyzeArtifact(artifactId);
    } catch (error) {
      setArtifactAnalysisError({
        artifactId,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to reanalyze artifact.',
      });
    } finally {
      setReanalyzingArtifactId(null);
    }
  }

  async function handleBackfillAnalysis() {
    if (!onBackfillAnalysis) {
      return;
    }

    setBackfillAnalysisError(null);
    setIsBackfillingAnalysis(true);
    try {
      await onBackfillAnalysis();
    } catch (error) {
      setBackfillAnalysisError(
        error instanceof Error
          ? error.message
          : 'Unable to backfill missing analysis.',
      );
    } finally {
      setIsBackfillingAnalysis(false);
    }
  }

  const artifactsNeedingBackfill = evidence.filter(
    (artifact) =>
      ANALYZABLE_ARTIFACT_TYPES.has(artifact.artifactType) &&
      (artifact.latestAnalysis === null ||
        artifact.latestAnalysis.fieldCompleteness === null),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left column — Evidence Checklist */}
      <div className="lg:col-span-8 space-y-6">
        {EVIDENCE_CATEGORIES.map((category) => (
          <Card key={category.label}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  {category.label}
                </CardTitle>
                {category.label === 'Regulatory Documents' &&
                  artifactsNeedingBackfill.length > 0 && (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => void handleBackfillAnalysis()}
                        disabled={!onBackfillAnalysis || isBackfillingAnalysis}
                        className="rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isBackfillingAnalysis
                          ? 'Backfilling...'
                          : 'Backfill Missing Analysis'}
                      </button>
                      {backfillAnalysisError && (
                        <p className="text-xs text-destructive">
                          {backfillAnalysisError}
                        </p>
                      )}
                    </div>
                  )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {category.types.map((artifactType) => {
                const artifact = evidenceByType.get(artifactType);

                if (!artifact) {
                  const isUploading = uploadingType === artifactType;
                  const isInteractive = !!onUpload;

                  return (
                    <div key={artifactType}>
                      <div
                        role={isInteractive ? 'button' : undefined}
                        tabIndex={isInteractive ? 0 : undefined}
                        onClick={
                          isInteractive
                            ? () => handleUploadZoneClick(artifactType)
                            : undefined
                        }
                        onKeyDown={
                          isInteractive
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleUploadZoneClick(artifactType);
                                }
                              }
                            : undefined
                        }
                        className={[
                          'flex items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/20 p-4 text-muted-foreground',
                          isInteractive
                            ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/5'
                            : '',
                        ].join(' ')}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="size-5 animate-spin" />
                            <span className="text-sm font-medium">
                              Uploading...
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="size-5" />
                            <span className="text-sm font-medium">
                              Upload {ARTIFACT_TYPE_LABELS[artifactType]}
                            </span>
                          </>
                        )}
                      </div>
                      {onUpload && (
                        <input
                          type="file"
                          ref={setFileInputRef(artifactType)}
                          data-artifact-type={artifactType}
                          accept={ACCEPTED_FILE_TYPES}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void handleFileSelected(artifactType, file);
                            }
                            // Reset value so re-selecting the same file triggers onChange
                            e.target.value = '';
                          }}
                        />
                      )}
                      {uploadError?.type === artifactType && !isUploading && (
                        <p className="mt-1 text-xs text-destructive">
                          {uploadError.message}
                        </p>
                      )}
                    </div>
                  );
                }

                const isVerifyingArtifact = verifyingArtifactId === artifact.id;
                const isReanalyzingArtifact =
                  reanalyzingArtifactId === artifact.id;
                const analysis = artifact.latestAnalysis;
                const fieldCompleteness = analysis?.fieldCompleteness;
                const presentCount =
                  fieldCompleteness?.presentFieldKeys.length ?? 0;
                const expectedCount =
                  fieldCompleteness?.expectedFieldKeys.length ?? 0;

                return (
                  <div
                    key={artifactType}
                    className="space-y-1"
                    data-testid={`evidence-artifact-${artifact.id}`}
                  >
                    <div className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <StatusIcon status={artifact.verificationStatus} />
                      <span className="text-sm font-medium flex-1 truncate">
                        {artifact.fileName}
                      </span>
                      <Badge
                        variant={
                          VERIFICATION_STATUS_VARIANT[
                            artifact.verificationStatus
                          ]
                        }
                      >
                        {VERIFICATION_STATUS_LABEL[artifact.verificationStatus]}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {artifact.contentHash.slice(0, 8)}
                      </span>
                      <Badge
                        variant={SOURCE_VARIANT[artifact.source] ?? 'secondary'}
                      >
                        {artifact.source}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => void handleVerifyArtifact(artifact.id)}
                        disabled={!onVerifyArtifact || isVerifyingArtifact}
                        className="rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isVerifyingArtifact ? 'Verifying...' : 'Verify'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleReanalyzeArtifact(artifact.id)
                        }
                        disabled={!onReanalyzeArtifact || isReanalyzingArtifact}
                        className="rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isReanalyzingArtifact ? 'Reanalyzing...' : 'Reanalyze'}
                      </button>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(artifact.createdAt)}
                      </span>
                    </div>
                    {analysis && (
                      <div className="px-3 pb-1 space-y-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            Document analysis
                          </span>
                          {analysis.documentLabel && (
                            <Badge variant="secondary">
                              {analysis.documentLabel}
                            </Badge>
                          )}
                          {analysis.confidence && (
                            <Badge variant="outline">
                              {analysis.confidence}
                            </Badge>
                          )}
                          {fieldCompleteness && fieldCompleteness.supported && (
                            <Badge variant="info">
                              Present {presentCount}/{expectedCount}
                            </Badge>
                          )}
                          {fieldCompleteness &&
                            !fieldCompleteness.supported && (
                              <Badge variant="warning">
                                Unsupported matrix coverage
                              </Badge>
                            )}
                        </div>
                        {analysis.summaryText && <p>{analysis.summaryText}</p>}
                        {fieldCompleteness && (
                          <div className="space-y-1">
                            {fieldCompleteness.missingFieldKeys.length > 0 && (
                              <p>
                                Missing:{' '}
                                {fieldCompleteness.missingFieldKeys.join(', ')}
                              </p>
                            )}
                            {fieldCompleteness.lowConfidenceFieldKeys.length >
                              0 && (
                              <p>
                                Low confidence:{' '}
                                {fieldCompleteness.lowConfidenceFieldKeys.join(
                                  ', ',
                                )}
                              </p>
                            )}
                            {fieldCompleteness.unsupportedFieldKeys.length >
                              0 && (
                              <p>
                                Unsupported extract:{' '}
                                {fieldCompleteness.unsupportedFieldKeys.join(
                                  ', ',
                                )}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {artifactVerificationError?.artifactId === artifact.id && (
                      <p className="px-3 text-xs text-destructive">
                        {artifactVerificationError.message}
                      </p>
                    )}
                    {artifactAnalysisError?.artifactId === artifact.id && (
                      <p className="px-3 text-xs text-destructive">
                        {artifactAnalysisError.message}
                      </p>
                    )}
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
            <div className="flex w-full flex-col gap-2">
              {graphVerificationError && (
                <p className="text-xs text-destructive">
                  {graphVerificationError}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleVerifyGraph()}
                disabled={!onVerifyGraph || isVerifyingGraph}
                className="inline-flex items-center gap-2 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                {isVerifyingGraph ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {isVerifyingGraph
                  ? 'Verifying graph...'
                  : 'Verify Evidence Graph'}
              </button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

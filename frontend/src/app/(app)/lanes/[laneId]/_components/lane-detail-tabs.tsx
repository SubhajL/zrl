'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { LaneHeader } from './lane-header';
import { TabAuditTrail } from './tab-audit-trail';
import { TabCheckpoints } from './tab-checkpoints';
import { TabDispute } from './tab-dispute';
import { TabEvidence } from './tab-evidence';
import { TabProofPacks } from './tab-proof-packs';
import { TabTemperature } from './tab-temperature';
import { useSocketContext } from '@/components/zrl/socket-provider';
import { useLaneEvents } from '@/hooks/use-lane-events';
import { getErrorMessage, requestAppJson } from '@/lib/app-api';
import type { LaneDetailPageData } from '@/lib/lane-detail-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TabId =
  | 'evidence'
  | 'checkpoints'
  | 'temperature'
  | 'packs'
  | 'audit'
  | 'dispute';

interface TabDef {
  readonly id: TabId;
  readonly label: string;
}

const TABS: readonly TabDef[] = [
  { id: 'evidence', label: 'Evidence' },
  { id: 'checkpoints', label: 'Checkpoints' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'packs', label: 'Proof Packs' },
  { id: 'audit', label: 'Audit Trail' },
  { id: 'dispute', label: 'Dispute' },
] as const;

const ANALYZABLE_ARTIFACT_TYPES = new Set([
  'PHYTO_CERT',
  'VHT_CERT',
  'MRL_TEST',
  'GAP_CERT',
  'INVOICE',
]);

function hasLabValidation(
  completeness: LaneDetailPageData['completeness'],
): completeness is LaneDetailPageData['completeness'] & {
  labValidation: NonNullable<
    LaneDetailPageData['completeness']['labValidation']
  >;
} {
  return completeness.labValidation !== null;
}

export interface LaneDetailTabsProps {
  readonly data: LaneDetailPageData;
}

export function LaneDetailTabs({ data }: LaneDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('evidence');
  const [stale, setStale] = useState(false);
  const [compliance, setCompliance] = useState(data.completeness);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [isRunningComplianceCheck, setIsRunningComplianceCheck] =
    useState(false);
  const [isComplianceOpen, setIsComplianceOpen] = useState(true);
  const router = useRouter();
  const { socket, connected } = useSocketContext();
  const lane = data.lane;

  async function handleEvidenceUpload(artifactType: string, file: File) {
    const formData = new FormData();
    formData.set('artifactType', artifactType);
    formData.set('source', 'UPLOAD');
    formData.set('file', file);

    try {
      await requestAppJson(
        `/api/zrl/lanes/${encodeURIComponent(lane.laneId)}/evidence`,
        {
          method: 'POST',
          body: formData,
        },
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Unable to upload evidence artifact.'),
      );
    }

    startTransition(() => {
      setStale(false);
      router.refresh();
    });
  }

  async function handleVerifyEvidenceGraph() {
    try {
      await requestAppJson(
        `/api/zrl/lanes/${encodeURIComponent(lane.laneId)}/evidence/graph/verify`,
        {
          method: 'POST',
        },
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Unable to verify lane evidence graph.'),
      );
    }

    startTransition(() => {
      setStale(false);
      router.refresh();
    });
  }

  async function handleVerifyArtifact(artifactId: string) {
    try {
      await requestAppJson(
        `/api/zrl/evidence/${encodeURIComponent(artifactId)}/verify`,
      );
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Unable to verify artifact.'));
    }

    startTransition(() => {
      setStale(false);
      router.refresh();
    });
  }

  async function handleReanalyzeArtifact(artifactId: string) {
    try {
      await requestAppJson(
        `/api/zrl/evidence/${encodeURIComponent(artifactId)}/reanalyze`,
        {
          method: 'POST',
        },
      );
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Unable to reanalyze artifact.'));
    }

    startTransition(() => {
      setStale(false);
      router.refresh();
    });
  }

  async function handleBackfillAnalysis() {
    const artifactIds = data.evidence
      .filter(
        (artifact) =>
          ANALYZABLE_ARTIFACT_TYPES.has(artifact.artifactType) &&
          (artifact.latestAnalysis === null ||
            artifact.latestAnalysis.fieldCompleteness === null),
      )
      .map((artifact) => artifact.id);

    try {
      await Promise.all(
        artifactIds.map((artifactId) =>
          requestAppJson(
            `/api/zrl/evidence/${encodeURIComponent(artifactId)}/reanalyze`,
            {
              method: 'POST',
            },
          ),
        ),
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Unable to backfill missing analysis.'),
      );
    }

    startTransition(() => {
      setStale(false);
      router.refresh();
    });
  }

  async function handleRunComplianceCheck() {
    setIsComplianceOpen(true);
    setComplianceError(null);
    setIsRunningComplianceCheck(true);
    try {
      const latest = await requestAppJson<typeof data.completeness>(
        `/api/zrl/lanes/${encodeURIComponent(lane.laneId)}/completeness`,
      );
      setCompliance(latest);
    } catch (error) {
      setComplianceError(
        getErrorMessage(error, 'Unable to run compliance check.'),
      );
    } finally {
      setIsRunningComplianceCheck(false);
    }
  }

  useLaneEvents(socket, connected, lane.id, {
    onStatusChanged: () => setStale(true),
    onEvidenceUploaded: () => setStale(true),
    onCheckpointRecorded: () => setStale(true),
    onTemperatureExcursion: () => setStale(true),
    onPackGenerated: () => setStale(true),
  });

  return (
    <div className="space-y-6">
      <LaneHeader
        lane={lane}
        completeness={compliance}
        onRunComplianceCheck={handleRunComplianceCheck}
        complianceCheckRunning={isRunningComplianceCheck}
        compliancePanelOpen={isComplianceOpen}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Compliance Check
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsComplianceOpen((open) => !open)}
          >
            {isComplianceOpen ? (
              <>
                <ChevronUp className="mr-2 size-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 size-4" />
                Expand
              </>
            )}
          </Button>
        </CardHeader>
        {isComplianceOpen && (
          <CardContent className="space-y-4 text-sm">
            {complianceError && (
              <p className="text-destructive">{complianceError}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={compliance.score >= 95 ? 'success' : 'warning'}>
                Completeness {compliance.score}%
              </Badge>
              {hasLabValidation(compliance) && (
                <Badge
                  variant={
                    compliance.labValidation.status === 'PASS'
                      ? 'success'
                      : compliance.labValidation.status === 'FAIL'
                        ? 'destructive'
                        : 'warning'
                  }
                >
                  MRL {compliance.labValidation.status}
                </Badge>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <h3 className="font-semibold">Required Documents</h3>
                {compliance.checklist.length === 0 ? (
                  <p className="text-muted-foreground">
                    No checklist available.
                  </p>
                ) : (
                  compliance.checklist.map((item) => (
                    <div key={item.key} className="flex items-center gap-2">
                      {item.status === 'PRESENT' ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : item.status === 'EXPIRED' ? (
                        <AlertTriangle className="size-4 text-amber-500" />
                      ) : (
                        <AlertTriangle className="size-4 text-rose-500" />
                      )}
                      <span className="flex-1">{item.label}</span>
                      <Badge
                        variant={
                          item.status === 'PRESENT'
                            ? 'success'
                            : item.status === 'EXPIRED'
                              ? 'warning'
                              : 'destructive'
                        }
                      >
                        {item.status === 'PRESENT'
                          ? 'Present'
                          : item.status === 'EXPIRED'
                            ? 'Expired'
                            : 'Missing'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Category Scores</h3>
                {compliance.categories.length === 0 ? (
                  <p className="text-muted-foreground">
                    No category scores available.
                  </p>
                ) : (
                  compliance.categories.map((category) => (
                    <div
                      key={category.category}
                      className="rounded-lg border border-border/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{category.category.replaceAll('_', ' ')}</span>
                        <Badge
                          variant={category.score >= 1 ? 'success' : 'warning'}
                        >
                          {Math.round(category.score * 100)}%
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {category.present}/{category.required} present, weight{' '}
                        {Math.round(category.weight * 100)}%
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">MRL Evaluation</h3>
                {!hasLabValidation(compliance) ? (
                  <p className="text-muted-foreground">
                    No MRL enforcement is configured for this lane snapshot.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          compliance.labValidation.status === 'PASS'
                            ? 'success'
                            : compliance.labValidation.status === 'FAIL'
                              ? 'destructive'
                              : 'warning'
                        }
                      >
                        {compliance.labValidation.status}
                      </Badge>
                      {compliance.labValidation.hasUnknowns && (
                        <Badge variant="warning">Unknowns present</Badge>
                      )}
                    </div>
                    {compliance.labValidation.blockingReasons.length > 0 && (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {compliance.labValidation.blockingReasons.map(
                          (reason) => (
                            <p key={reason}>{reason}</p>
                          ),
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      {compliance.labValidation.results
                        .slice(0, 8)
                        .map((result) => (
                          <div
                            key={`${result.substance}-${result.cas ?? 'na'}`}
                            className="rounded-lg border border-border/60 p-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                {result.substance}
                              </span>
                              <Badge
                                variant={
                                  result.status === 'PASS'
                                    ? 'success'
                                    : result.status === 'FAIL'
                                      ? 'destructive'
                                      : 'warning'
                                }
                              >
                                {result.status}
                              </Badge>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              Measured {result.valueMgKg ?? '--'} mg/kg vs limit{' '}
                              {result.limitMgKg ?? '--'} mg/kg
                            </p>
                          </div>
                        ))}
                      {compliance.labValidation.results.length > 8 && (
                        <p className="text-xs text-muted-foreground">
                          Showing first 8 of{' '}
                          {compliance.labValidation.results.length} MRL checks.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {stale && (
        <div className="rounded-lg border border-info/30 bg-info/10 px-4 py-2 text-sm text-info">
          This lane has been updated.{' '}
          <button
            onClick={() => window.location.reload()}
            className="font-medium underline"
          >
            Refresh
          </button>{' '}
          to see changes.
        </div>
      )}

      <div role="tablist" className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'evidence' && (
          <TabEvidence
            evidence={data.evidence}
            graph={data.evidenceGraph}
            onUpload={handleEvidenceUpload}
            onVerifyGraph={handleVerifyEvidenceGraph}
            onVerifyArtifact={handleVerifyArtifact}
            onReanalyzeArtifact={handleReanalyzeArtifact}
            onBackfillAnalysis={handleBackfillAnalysis}
          />
        )}
        {activeTab === 'checkpoints' && (
          <TabCheckpoints checkpoints={lane.checkpoints} />
        )}
        {activeTab === 'temperature' && (
          <TabTemperature
            readings={data.temperature.readings}
            excursions={data.temperature.excursions}
            sla={data.temperature.sla}
            profile={lane.temperatureProfile!}
          />
        )}
        {activeTab === 'packs' && (
          <TabProofPacks
            laneId={lane.laneId}
            completeness={lane.completenessScore}
            packs={data.proofPacks.packs}
          />
        )}
        {activeTab === 'audit' && (
          <TabAuditTrail
            entries={data.auditEntries}
            laneId={lane.laneId}
            exportUrl={data.auditExportUrl}
          />
        )}
        {activeTab === 'dispute' && (
          <TabDispute laneId={lane.laneId} hasDispute={false} />
        )}
      </div>
    </div>
  );
}

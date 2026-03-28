'use client';

import { useState } from 'react';

import { LaneHeader } from './lane-header';
import { TabAuditTrail } from './tab-audit-trail';
import { TabCheckpoints } from './tab-checkpoints';
import { TabDispute } from './tab-dispute';
import { TabEvidence } from './tab-evidence';
import { TabProofPacks } from './tab-proof-packs';
import { TabTemperature } from './tab-temperature';
import type { LaneDetailPageData } from '@/lib/lane-detail-data';

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

export interface LaneDetailTabsProps {
  readonly data: LaneDetailPageData;
}

export function LaneDetailTabs({ data }: LaneDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('evidence');
  const lane = data.lane;

  return (
    <div className="space-y-6">
      <LaneHeader lane={lane} />

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

'use client';

import { useState } from 'react';

import { LaneHeader } from './_components/lane-header';
import { TabEvidence } from './_components/tab-evidence';
import { TabCheckpoints } from './_components/tab-checkpoints';
import { TabTemperature } from './_components/tab-temperature';
import { TabProofPacks } from './_components/tab-proof-packs';
import { TabAuditTrail } from './_components/tab-audit-trail';
import { TabDispute } from './_components/tab-dispute';
import {
  MOCK_LANE_DETAIL,
  MOCK_EVIDENCE,
  MOCK_AUDIT_ENTRIES,
  MOCK_TEMPERATURE_READINGS,
  MOCK_EXCURSIONS,
  MOCK_SLA_RESULT,
  MOCK_EVIDENCE_GRAPH,
} from '@/lib/mock-data';
import { FRUIT_TEMPERATURE_PROFILES } from '@/lib/types';

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

export default function LaneDetailPage() {
  const [activeTab, setActiveTab] = useState<TabId>('evidence');

  const lane = MOCK_LANE_DETAIL;

  return (
    <div className="space-y-6">
      <LaneHeader lane={lane} />

      {/* Tab navigation */}
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

      {/* Tab content */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'evidence' && (
          <TabEvidence
            evidence={MOCK_EVIDENCE}
            graph={MOCK_EVIDENCE_GRAPH}
          />
        )}
        {activeTab === 'checkpoints' && (
          <TabCheckpoints checkpoints={MOCK_LANE_DETAIL.checkpoints} />
        )}
        {activeTab === 'temperature' && (
          <TabTemperature
            readings={MOCK_TEMPERATURE_READINGS}
            excursions={MOCK_EXCURSIONS}
            sla={MOCK_SLA_RESULT}
            profile={FRUIT_TEMPERATURE_PROFILES[lane.productType]}
          />
        )}
        {activeTab === 'packs' && (
          <TabProofPacks
            laneId={lane.laneId}
            completeness={lane.completenessScore}
          />
        )}
        {activeTab === 'audit' && (
          <TabAuditTrail
            entries={MOCK_AUDIT_ENTRIES}
            laneId={lane.laneId}
          />
        )}
        {activeTab === 'dispute' && (
          <TabDispute laneId={lane.laneId} hasDispute={false} />
        )}
      </div>
    </div>
  );
}

export type DisputeType =
  | 'CUSTOMS_REJECTION'
  | 'QUALITY_CLAIM'
  | 'INSURANCE_CLAIM'
  | 'GRADE_DISPUTE'
  | 'CARGO_DAMAGE';

export type DisputeStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'DEFENSE_SUBMITTED'
  | 'RESOLVED';

export interface DisputeRecord {
  id: string;
  laneId: string;
  type: DisputeType;
  description: string;
  claimant: string;
  status: DisputeStatus;
  financialImpact: number | null;
  resolutionNotes: string | null;
  defensePackId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface CreateDisputeInput {
  type: DisputeType;
  description: string;
  claimant: string;
  financialImpact?: number;
}

export interface UpdateDisputeInput {
  status?: DisputeStatus;
  resolutionNotes?: string;
}

export interface DisputeTimelineEvent {
  readonly timestamp: string;
  readonly category:
    | 'LANE_STATUS'
    | 'CHECKPOINT'
    | 'TEMPERATURE'
    | 'EXCURSION'
    | 'ARTIFACT'
    | 'AUDIT';
  readonly title: string;
  readonly details: string;
  readonly actor: string | null;
  readonly location: string | null;
  readonly signer: string | null;
  readonly temperatureC: number | null;
}

export interface DefenseTemperatureForensics {
  readonly slaStatus: 'PASS' | 'CONDITIONAL' | 'FAIL';
  readonly defensibilityScore: number;
  readonly remainingShelfLifeDays: number;
  readonly totalExcursionMinutes: number;
  readonly maxDeviationC: number;
  readonly readingCount: number;
  readonly chartPoints: ReadonlyArray<{
    readonly label: string;
    readonly temperatureC: number;
    readonly heightPercent: number;
  }>;
  readonly checkpointMarkers: ReadonlyArray<{
    readonly label: string;
    readonly timestamp: string | null;
  }>;
  readonly excursions: ReadonlyArray<{
    readonly severity: string;
    readonly type: string;
    readonly direction: string;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly durationMinutes: number;
    readonly maxDeviationC: number;
  }>;
  readonly narrative: string;
}

export interface DefenseVisualEvidenceItem {
  readonly fileName: string;
  readonly checkpointLabel: string | null;
  readonly capturedAt: string | null;
  readonly gps: string | null;
  readonly cameraModel: string | null;
  readonly source: string;
  readonly exifStatus: string;
}

export interface DisputeStore {
  runInTransaction<T>(
    operation: (store: DisputeStore) => Promise<T>,
  ): Promise<T>;
  createDispute(
    laneId: string,
    input: CreateDisputeInput,
  ): Promise<DisputeRecord>;
  findDisputeById(id: string): Promise<DisputeRecord | null>;
  findDisputesForLane(laneId: string): Promise<DisputeRecord[]>;
  updateDispute(
    id: string,
    input: UpdateDisputeInput,
  ): Promise<DisputeRecord | null>;
  linkDefensePack(
    disputeId: string,
    defensePackId: string,
  ): Promise<DisputeRecord | null>;
  countDisputesForLane(laneId: string): Promise<number>;
  countExcursionsForLane(laneId: string): Promise<number>;
}

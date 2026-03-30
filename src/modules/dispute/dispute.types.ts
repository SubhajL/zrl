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

export interface DisputeStore {
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

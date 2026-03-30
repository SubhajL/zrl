import {
  LANE_ARCHIVE_RETENTION_YEARS,
  LANE_VALIDATION_COMPLETENESS_THRESHOLD,
} from './lane.constants';
import type { LaneDetail, LaneStatus } from './lane.types';

// ─── Violation types (framework-independent) ────────────────────────

export interface TransitionViolation {
  readonly code: 'INVALID_TRANSITION' | 'GUARD_FAILED';
  readonly message: string;
}

// ─── Transition graph ───────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<LaneStatus, LaneStatus[]> = {
  CREATED: ['EVIDENCE_COLLECTING'],
  EVIDENCE_COLLECTING: ['VALIDATED'],
  VALIDATED: ['PACKED', 'INCOMPLETE'],
  PACKED: ['CLOSED'],
  CLOSED: ['CLAIM_DEFENSE', 'ARCHIVED'],
  INCOMPLETE: ['EVIDENCE_COLLECTING'],
  CLAIM_DEFENSE: ['DISPUTE_RESOLVED'],
  DISPUTE_RESOLVED: [],
  ARCHIVED: [],
};

export function validateTransitionGraph(
  currentStatus: LaneStatus,
  targetStatus: LaneStatus,
): TransitionViolation | null {
  const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowedTargets.includes(targetStatus)) {
    return {
      code: 'INVALID_TRANSITION',
      message: `Invalid lane transition from ${currentStatus} to ${targetStatus}.`,
    };
  }
  return null;
}

// ─── Automatic transition targets ───────────────────────────────────

export function getAutomaticTransitionTarget(
  lane: Pick<LaneDetail, 'status' | 'completenessScore'>,
): LaneStatus | null {
  if (lane.completenessScore < LANE_VALIDATION_COMPLETENESS_THRESHOLD) {
    return null;
  }

  if (lane.status === 'CREATED' || lane.status === 'INCOMPLETE') {
    return 'EVIDENCE_COLLECTING';
  }

  if (lane.status === 'EVIDENCE_COLLECTING') {
    return 'VALIDATED';
  }

  return null;
}

// ─── Transition guards ──────────────────────────────────────────────

// Extend this context as new guards are added (e.g., defense pack count for
// CLAIM_DEFENSE → DISPUTE_RESOLVED in Task 16).
export interface TransitionGuardContext {
  readonly proofPackCount: number;
}

export function validateTransitionGuards(
  lane: Pick<LaneDetail, 'completenessScore' | 'statusChangedAt'>,
  targetStatus: LaneStatus,
  context: TransitionGuardContext,
): TransitionViolation | null {
  if (
    targetStatus === 'VALIDATED' &&
    lane.completenessScore < LANE_VALIDATION_COMPLETENESS_THRESHOLD
  ) {
    return {
      code: 'GUARD_FAILED',
      message: 'Lane completeness must be at least 95% before validation.',
    };
  }

  if (targetStatus === 'PACKED' && context.proofPackCount < 1) {
    return {
      code: 'GUARD_FAILED',
      message: 'At least one proof pack is required before packing.',
    };
  }

  if (targetStatus === 'ARCHIVED') {
    const archiveEligibleAt = new Date(lane.statusChangedAt);
    archiveEligibleAt.setUTCFullYear(
      archiveEligibleAt.getUTCFullYear() + LANE_ARCHIVE_RETENTION_YEARS,
    );

    if (archiveEligibleAt.getTime() > Date.now()) {
      return {
        code: 'GUARD_FAILED',
        message: 'Lane cannot be archived before the retention period ends.',
      };
    }
  }

  return null;
}

import type {
  AuditAction,
  AuditEntityType,
} from '../../common/audit/audit.types';
import type { AuthSessionUser } from '../../common/auth/auth.types';
import type {
  RuleLaneArtifact,
  RuleLaneEvaluation,
} from '../rules-engine/rules-engine.types';

export const LaneStatus = {
  CREATED: 'CREATED',
  EVIDENCE_COLLECTING: 'EVIDENCE_COLLECTING',
  VALIDATED: 'VALIDATED',
  PACKED: 'PACKED',
  CLOSED: 'CLOSED',
  INCOMPLETE: 'INCOMPLETE',
  CLAIM_DEFENSE: 'CLAIM_DEFENSE',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type LaneStatus = (typeof LaneStatus)[keyof typeof LaneStatus];

export const LaneProduct = {
  MANGO: 'MANGO',
  DURIAN: 'DURIAN',
  MANGOSTEEN: 'MANGOSTEEN',
  LONGAN: 'LONGAN',
} as const;

export type LaneProduct = (typeof LaneProduct)[keyof typeof LaneProduct];

export const LaneMarket = {
  JAPAN: 'JAPAN',
  CHINA: 'CHINA',
  KOREA: 'KOREA',
  EU: 'EU',
} as const;

export type LaneMarket = (typeof LaneMarket)[keyof typeof LaneMarket];

export const LaneTransportMode = {
  AIR: 'AIR',
  SEA: 'SEA',
  TRUCK: 'TRUCK',
} as const;

export type LaneTransportMode =
  (typeof LaneTransportMode)[keyof typeof LaneTransportMode];

export const LaneGrade = {
  PREMIUM: 'PREMIUM',
  A: 'A',
  B: 'B',
} as const;

export type LaneGrade = (typeof LaneGrade)[keyof typeof LaneGrade];

export type LaneColdChainMode = 'MANUAL' | 'LOGGER' | 'TELEMETRY' | null;

export interface LaneColdChainConfigInput {
  mode: Exclude<LaneColdChainMode, null>;
  deviceId?: string;
  dataFrequencySeconds?: number;
}

export interface LaneGpsPoint {
  lat: number;
  lng: number;
}

export interface CreateLaneInput {
  product: LaneProduct;
  batch: {
    variety?: string;
    quantityKg: number;
    originProvince: string;
    harvestDate: Date;
    grade: LaneGrade;
  };
  destination: {
    market: LaneMarket;
  };
  route: {
    transportMode: LaneTransportMode;
    carrier?: string;
    originGps?: LaneGpsPoint;
    destinationGps?: LaneGpsPoint;
    estimatedTransitHours?: number;
  };
  checkpoints?: Array<{
    sequence: number;
    locationName: string;
    gpsLat?: number;
    gpsLng?: number;
    timestamp?: Date;
    temperature?: number;
    signatureHash?: string;
    signerName?: string;
    conditionNotes?: string;
    status?: 'PENDING' | 'COMPLETED' | 'OVERDUE';
  }>;
  coldChainMode?: LaneColdChainMode;
  coldChainConfig?: LaneColdChainConfigInput;
}

export interface UpdateLaneInput {
  coldChainMode?: LaneColdChainMode;
  coldChainConfig?: LaneColdChainConfigInput;
  batch?: Partial<CreateLaneInput['batch']>;
  route?: Partial<CreateLaneInput['route']>;
}

export interface CreateCheckpointInput {
  sequence: number;
  locationName: string;
  gpsLat?: number;
  gpsLng?: number;
  timestamp?: Date;
  temperature?: number;
  signatureHash?: string;
  signerName?: string;
  conditionNotes?: string;
  status?: 'PENDING' | 'COMPLETED' | 'OVERDUE';
}

export interface UpdateCheckpointInput {
  status?: 'PENDING' | 'COMPLETED' | 'OVERDUE';
  timestamp?: Date;
  temperature?: number;
  gpsLat?: number;
  gpsLng?: number;
  signatureHash?: string;
  signerName?: string;
  conditionNotes?: string;
}

export interface LaneListQuery {
  page?: number;
  limit?: number;
  status?: LaneStatus;
  product?: LaneProduct;
  market?: LaneMarket;
}

export interface LaneSummary {
  id: string;
  laneId: string;
  exporterId: string;
  status: LaneStatus;
  productType: LaneProduct;
  destinationMarket: LaneMarket;
  completenessScore: number;
  coldChainMode: LaneColdChainMode;
  coldChainDeviceId: string | null;
  coldChainDataFrequencySeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
  statusChangedAt: Date;
}

export interface LaneRuleSnapshot {
  id: string;
  laneId: string;
  market: LaneMarket;
  product: LaneProduct;
  version: number;
  rules: {
    sourcePath?: string;
    requiredDocuments?: string[];
    completenessWeights?: {
      regulatory: number;
      quality: number;
      coldChain: number;
      chainOfCustody: number;
    };
    metadata?: {
      coverageState:
        | 'FULL_EXHAUSTIVE'
        | 'PRIMARY_PARTIAL'
        | 'CURATED_HIGH_RISK'
        | 'PROXY_MIXED';
      sourceQuality:
        | 'PRIMARY_ONLY'
        | 'PRIMARY_PLUS_SECONDARY'
        | 'SECONDARY_ONLY';
      retrievedAt: Date | string;
      commodityCode?: string | null;
      nonPesticideChecks?: Array<{
        type: 'PHYTO_CERT' | 'VHT' | 'GAP_CERT' | 'COLD_CHAIN';
        status: 'REQUIRED' | 'CONDITIONAL' | 'INFORMATIONAL';
        parameters?: Record<string, string | number | boolean>;
        sourceRef?: string | null;
        note?: string | null;
      }>;
    };
    labPolicy?: {
      enforcementMode: 'DOCUMENT_ONLY' | 'FULL_PESTICIDE';
      requiredArtifactType: 'MRL_TEST';
      acceptedUnits: string[];
      defaultDestinationMrlMgKg: number | null;
    };
    substances?: Array<{
      name: string;
      cas: string | null;
      thaiMrl: number | null;
      destinationMrl: number;
      stringencyRatio: number | null;
      riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
    }>;
  };
  effectiveDate: Date;
  createdAt: Date;
}

export interface LaneDetail extends LaneSummary {
  batch: {
    id: string;
    laneId: string;
    batchId: string;
    product: LaneProduct;
    variety: string | null;
    quantityKg: number;
    originProvince: string;
    harvestDate: Date;
    grade: LaneGrade;
  } | null;
  route: {
    id: string;
    laneId: string;
    transportMode: LaneTransportMode;
    carrier: string | null;
    originGps: LaneGpsPoint | null;
    destinationGps: LaneGpsPoint | null;
    estimatedTransitHours: number | null;
  } | null;
  checkpoints: Array<{
    id: string;
    laneId: string;
    sequence: number;
    locationName: string;
    gpsLat: number | null;
    gpsLng: number | null;
    timestamp: Date | null;
    temperature: number | null;
    signatureHash: string | null;
    signerName: string | null;
    conditionNotes: string | null;
    status: 'PENDING' | 'COMPLETED' | 'OVERDUE';
  }>;
  ruleSnapshot: LaneRuleSnapshot | null;
}

export interface TransitionLaneInput {
  targetStatus: LaneStatus;
}

export interface LaneRuleSnapshotPayload {
  market: LaneMarket;
  product: LaneProduct;
  version: number;
  effectiveDate: Date;
  sourcePath?: string;
  requiredDocuments: string[];
  completenessWeights: {
    regulatory: number;
    quality: number;
    coldChain: number;
    chainOfCustody: number;
  };
  metadata: {
    coverageState:
      | 'FULL_EXHAUSTIVE'
      | 'PRIMARY_PARTIAL'
      | 'CURATED_HIGH_RISK'
      | 'PROXY_MIXED';
    sourceQuality: 'PRIMARY_ONLY' | 'PRIMARY_PLUS_SECONDARY' | 'SECONDARY_ONLY';
    retrievedAt: Date;
    commodityCode: string | null;
    nonPesticideChecks: Array<{
      type: 'PHYTO_CERT' | 'VHT' | 'GAP_CERT' | 'COLD_CHAIN';
      status: 'REQUIRED' | 'CONDITIONAL' | 'INFORMATIONAL';
      parameters: Record<string, string | number | boolean>;
      sourceRef: string | null;
      note: string | null;
    }>;
  };
  labPolicy?: {
    enforcementMode: 'DOCUMENT_ONLY' | 'FULL_PESTICIDE';
    requiredArtifactType: 'MRL_TEST';
    acceptedUnits: string[];
    defaultDestinationMrlMgKg: number | null;
  };
  substances: Array<{
    name: string;
    cas: string | null;
    thaiMrl: number | null;
    destinationMrl: number;
    stringencyRatio: number | null;
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  }>;
}

export interface LaneRuleSnapshotResolver {
  resolve(
    market: LaneMarket,
    product: LaneProduct,
  ): Promise<LaneRuleSnapshotPayload | null>;
}

export interface LaneStore {
  runInTransaction<T>(operation: (store: LaneStore) => Promise<T>): Promise<T>;
  findLatestLaneIdByYear(year: number): Promise<string | null>;
  findLatestBatchIdByPrefix(prefix: string): Promise<string | null>;
  createLaneBundle(input: {
    exporterId: string;
    laneId: string;
    status: LaneStatus;
    productType: LaneProduct;
    destinationMarket: LaneMarket;
    completenessScore: number;
    coldChainMode?: LaneColdChainMode;
    coldChainDeviceId?: string | null;
    coldChainDataFrequencySeconds?: number | null;
    batchId: string;
    batch: CreateLaneInput['batch'];
    route: CreateLaneInput['route'];
    checkpoints: NonNullable<CreateLaneInput['checkpoints']>;
    ruleSnapshot: LaneRuleSnapshotPayload | null;
  }): Promise<LaneDetail>;
  findLanes(filter: {
    exporterId?: string;
    page: number;
    limit: number;
    status?: LaneStatus;
    product?: LaneProduct;
    market?: LaneMarket;
  }): Promise<{ items: LaneSummary[]; total: number }>;
  findLaneById(id: string): Promise<LaneDetail | null>;
  listEvidenceArtifactsForLane(id: string): Promise<RuleLaneArtifact[]>;
  updateLaneBundle(
    id: string,
    input: UpdateLaneInput,
  ): Promise<LaneDetail | null>;
  transitionLaneStatus(
    id: string,
    targetStatus: LaneStatus,
    transitionedAt: Date,
  ): Promise<LaneDetail | null>;
  countProofPacksForLane(id: string): Promise<number>;
  findCheckpointsForLane(laneId: string): Promise<LaneDetail['checkpoints']>;
  findCheckpointById(
    checkpointId: string,
  ): Promise<LaneDetail['checkpoints'][number] | null>;
  createCheckpoint(
    laneId: string,
    input: CreateCheckpointInput,
  ): Promise<LaneDetail['checkpoints'][number]>;
  updateCheckpoint(
    laneId: string,
    checkpointId: string,
    input: UpdateCheckpointInput,
  ): Promise<LaneDetail['checkpoints'][number] | null>;
  findProofPackSummaryById(packId: string): Promise<{
    id: string;
    laneId: string;
    packType: string;
    version: number;
    status: string;
    generatedAt: Date;
    generatedBy: string;
  } | null>;
}

export type LaneCompletenessResponse = RuleLaneEvaluation;

export type LaneTimelineEventMetadata =
  | {
      readonly kind: 'lane';
      readonly status: LaneStatus;
      readonly completenessScore: number;
      readonly productType: LaneProduct;
      readonly destinationMarket: LaneMarket;
      readonly statusChangedAt: Date;
    }
  | {
      readonly kind: 'checkpoint';
      readonly sequence: number;
      readonly locationName: string;
      readonly status: 'PENDING' | 'COMPLETED' | 'OVERDUE';
      readonly timestamp: Date | null;
      readonly temperature: number | null;
      readonly signerName: string | null;
      readonly conditionNotes: string | null;
    }
  | {
      readonly kind: 'artifact';
      readonly artifactType: string;
      readonly fileName: string;
      readonly metadata: Record<string, unknown> | null;
    }
  | {
      readonly kind: 'proofPack';
      readonly packType: string;
      readonly version: number;
      readonly status: 'GENERATING' | 'READY' | 'FAILED';
      readonly contentHash: string | null;
      readonly generatedAt: Date;
      readonly errorMessage: string | null;
    };

export interface LaneTimelineEvent {
  readonly id: string;
  readonly timestamp: Date;
  readonly actor: string;
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly description: string;
  readonly metadata?: LaneTimelineEventMetadata;
}

export interface LaneAuditInput {
  actor: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  payloadHash: string;
}

export interface LaneListResult {
  data: LaneSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type LaneRequestUser = AuthSessionUser;

export interface LaneReconciler {
  reconcileAfterEvidenceChange(
    laneId: string,
    actorId: string,
  ): Promise<{ lane: LaneDetail; transitions: LaneStatus[] }>;
}

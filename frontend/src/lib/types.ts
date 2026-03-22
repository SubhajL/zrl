/* ═══════════════════════════════════════════════════
   ZRL Shared Types — used across all frontend screens
   Aligned with backend contracts:
   - src/modules/lane/lane.types.ts
   - src/common/audit/audit.types.ts
   - docs/frontend-backend-contract-task-25.md
   ═══════════════════════════════════════════════════ */

// ── Enums (mirror Prisma schema + backend types) ──

export type LaneStatus =
  | 'CREATED'
  | 'EVIDENCE_COLLECTING'
  | 'VALIDATED'
  | 'PACKED'
  | 'CLOSED'
  | 'INCOMPLETE'
  | 'CLAIM_DEFENSE'
  | 'DISPUTE_RESOLVED'
  | 'ARCHIVED';

export type ProductType = 'MANGO' | 'DURIAN' | 'MANGOSTEEN' | 'LONGAN';

export type DestinationMarket = 'JAPAN' | 'CHINA' | 'KOREA' | 'EU';

export type TransportMode = 'AIR' | 'SEA' | 'TRUCK';

export type ColdChainMode = 'MANUAL' | 'LOGGER' | 'TELEMETRY';

export type UserRole = 'EXPORTER' | 'PARTNER' | 'ADMIN' | 'AUDITOR';

export type ArtifactType =
  | 'MRL_TEST'
  | 'VHT_CERT'
  | 'PHYTO_CERT'
  | 'CHECKPOINT_PHOTO'
  | 'TEMP_DATA'
  | 'HANDOFF_SIGNATURE'
  | 'INVOICE'
  | 'GAP_CERT';

export type ArtifactVerificationStatus = 'VERIFIED' | 'PENDING' | 'FAILED';

export type ArtifactSource = 'UPLOAD' | 'PARTNER_API' | 'CAMERA';

export type CheckpointStatus = 'COMPLETED' | 'PENDING' | 'OVERDUE';

export type ExcursionSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL';

export type ExcursionType = 'CHILLING_INJURY' | 'HEAT_DAMAGE';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type LaneGrade = 'PREMIUM' | 'A' | 'B';

// Gap #4: Typed enums matching backend audit.types.ts
export type AuditAction =
  | 'UPLOAD'
  | 'SIGN'
  | 'GENERATE'
  | 'VERIFY'
  | 'CREATE'
  | 'UPDATE';

export type AuditEntityType =
  | 'LANE'
  | 'ARTIFACT'
  | 'CHECKPOINT'
  | 'PROOF_PACK'
  | 'RULE_SET'
  | 'SUBSTANCE';

export type SlaStatus = 'PASS' | 'CONDITIONAL' | 'FAIL';

// ── Core Entities ──

export interface User {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly companyName: string | null;
  readonly fullName: string;
  readonly mfaEnabled: boolean;
}

// Gap #1: Added coldChainMode to match backend LaneSummary
export interface Lane {
  readonly id: string;
  readonly laneId: string;
  readonly exporterId: string;
  readonly status: LaneStatus;
  readonly productType: ProductType;
  readonly destinationMarket: DestinationMarket;
  readonly completenessScore: number;
  readonly coldChainMode: ColdChainMode | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Full lane detail matching backend LaneDetail
export interface LaneDetail extends Lane {
  readonly batch: Batch | null;
  readonly route: Route | null;
  readonly checkpoints: readonly Checkpoint[];
  readonly ruleSnapshot: RuleSnapshot | null;
  readonly temperatureProfile?: TemperatureProfile;
}

export interface Batch {
  readonly id: string;
  readonly laneId: string;
  readonly batchId: string;
  readonly product: ProductType;
  readonly variety: string | null;
  readonly quantityKg: number;
  readonly originProvince: string;
  readonly harvestDate: string;
  readonly grade: LaneGrade;
}

export interface Route {
  readonly id: string;
  readonly laneId: string;
  readonly transportMode: TransportMode;
  readonly carrier: string | null;
  readonly originGps: GpsPoint | null;
  readonly destinationGps: GpsPoint | null;
  readonly estimatedTransitHours: number | null;
}

export interface GpsPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface Checkpoint {
  readonly id: string;
  readonly laneId: string;
  readonly sequence: number;
  readonly locationName: string;
  readonly status: CheckpointStatus;
  readonly timestamp: string | null;
  readonly temperature: number | null;
  readonly gpsLat: number | null;
  readonly gpsLng: number | null;
  readonly signatureHash: string | null;
  readonly signerName: string | null;
  readonly conditionNotes: string | null;
}

export interface RuleSnapshot {
  readonly market: DestinationMarket;
  readonly product: ProductType;
  readonly version: number;
  readonly effectiveDate: string;
  readonly requiredDocuments: readonly string[];
  readonly completenessWeights: {
    readonly regulatory: number;
    readonly quality: number;
    readonly coldChain: number;
    readonly chainOfCustody: number;
  };
  readonly substances: readonly RuleSnapshotSubstance[];
}

export interface RuleSnapshotSubstance {
  readonly name: string;
  readonly cas: string;
  readonly thaiMrl: number;
  readonly destinationMrl: number;
  readonly stringencyRatio: number;
  readonly riskLevel: RiskLevel;
}

// Gap #6: Temperature profile matching contract
export interface TemperatureProfile {
  readonly fruit: ProductType;
  readonly optimalMinC: number;
  readonly optimalMaxC: number;
  readonly chillingThresholdC: number | null;
  readonly heatThresholdC: number;
  readonly baseShelfLifeDays: number;
  readonly minShelfLifeDays: number;
}

// Gap #2: EvidenceArtifact expanded to match contract
export interface EvidenceArtifact {
  readonly id: string;
  readonly laneId: string;
  readonly artifactType: ArtifactType;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly contentHash: string;
  readonly contentHashPreview: string;
  readonly storagePath: string;
  readonly verificationStatus: ArtifactVerificationStatus;
  readonly source: ArtifactSource;
  readonly checkpointId: string | null;
  readonly metadata?: {
    readonly capturedAt?: string;
    readonly gpsLat?: number;
    readonly gpsLng?: number;
    readonly cameraModel?: string;
    readonly exifTimestamp?: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

// Evidence graph types from contract
export interface EvidenceGraphNode {
  readonly id: string;
  readonly artifactId: string;
  readonly artifactType: string;
  readonly label: string;
  readonly status: 'COMPLETE' | 'PENDING' | 'FAILED';
  readonly hashPreview: string;
}

export interface EvidenceGraphEdge {
  readonly id: string;
  readonly sourceArtifactId: string;
  readonly targetArtifactId: string;
  readonly relationshipType: string;
}

export interface EvidenceGraph {
  readonly nodes: readonly EvidenceGraphNode[];
  readonly edges: readonly EvidenceGraphEdge[];
}

// Temperature reading from contract
export interface TemperatureReading {
  readonly id: string;
  readonly timestamp: string;
  readonly valueC: number;
  readonly deviceId: string | null;
  readonly source: 'MANUAL' | 'LOGGER' | 'TELEMETRY';
  readonly checkpointId: string | null;
}

// Excursion from contract
export interface Excursion {
  readonly id: string;
  readonly type: ExcursionType;
  readonly severity: ExcursionSeverity;
  readonly startAt: string;
  readonly endAt: string | null;
  readonly durationMinutes: number;
  readonly maxDeviationC: number;
  readonly shelfLifeImpactPct: number;
}

// SLA result from contract
export interface TemperatureSlaResult {
  readonly laneId: string;
  readonly status: SlaStatus;
  readonly totalExcursionMinutes: number;
  readonly excursionCount: number;
  readonly maxDeviationC: number;
  readonly remainingShelfLifeDays: number;
  readonly shelfLifeImpactPct: number;
}

export interface MrlSubstance {
  readonly id: string;
  readonly name: string;
  readonly casNumber: string | null;
  readonly thaiMrl: number;
  readonly destinationMrl: number;
  readonly stringencyRatio: number;
  readonly riskLevel: RiskLevel;
  readonly updatedAt: string;
}

// Gap #3 + #4: AuditEntry with payloadHash and typed enums
export interface AuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly payloadHash: string;
  readonly prevHash: string;
  readonly entryHash: string;
}

// Audit verification result from contract
export interface AuditVerificationResult {
  readonly valid: boolean;
  readonly entriesChecked: number;
  readonly firstInvalidIndex?: number;
  readonly firstInvalidEntryId?: string;
}

// Completeness result from contract
export interface CompletenessResult {
  readonly score: number;
  readonly required: number;
  readonly present: number;
  readonly missing: readonly string[];
}

// Paginated response meta from contract
export interface PaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

// ── UI Display Helpers ──

export const PRODUCT_LABELS: Record<ProductType, string> = {
  MANGO: 'Mango',
  DURIAN: 'Durian',
  MANGOSTEEN: 'Mangosteen',
  LONGAN: 'Longan',
};

export const PRODUCT_EMOJI: Record<ProductType, string> = {
  MANGO: '🥭',
  DURIAN: '🥝',
  MANGOSTEEN: '🍇',
  LONGAN: '🟤',
};

export const MARKET_FLAGS: Record<DestinationMarket, string> = {
  JAPAN: '🇯🇵',
  CHINA: '🇨🇳',
  KOREA: '🇰🇷',
  EU: '🇪🇺',
};

export const MARKET_LABELS: Record<DestinationMarket, string> = {
  JAPAN: 'Japan',
  CHINA: 'China',
  KOREA: 'Korea',
  EU: 'EU',
};

export const STATUS_LABELS: Record<LaneStatus, string> = {
  CREATED: 'Created',
  EVIDENCE_COLLECTING: 'Collecting',
  VALIDATED: 'Validated',
  PACKED: 'Packed',
  CLOSED: 'Closed',
  INCOMPLETE: 'Incomplete',
  CLAIM_DEFENSE: 'Claim Defense',
  DISPUTE_RESOLVED: 'Resolved',
  ARCHIVED: 'Archived',
};

export const STATUS_VARIANT: Record<
  LaneStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'
> = {
  CREATED: 'secondary',
  EVIDENCE_COLLECTING: 'warning',
  VALIDATED: 'success',
  PACKED: 'info',
  CLOSED: 'default',
  INCOMPLETE: 'destructive',
  CLAIM_DEFENSE: 'destructive',
  DISPUTE_RESOLVED: 'success',
  ARCHIVED: 'secondary',
};

// Gap #6: Fruit-specific temperature profiles (from CLAUDE.md domain table)
export const FRUIT_TEMPERATURE_PROFILES: Record<ProductType, TemperatureProfile> = {
  MANGO: {
    fruit: 'MANGO',
    optimalMinC: 10,
    optimalMaxC: 13,
    chillingThresholdC: 10,
    heatThresholdC: 15,
    baseShelfLifeDays: 21,
    minShelfLifeDays: 14,
  },
  DURIAN: {
    fruit: 'DURIAN',
    optimalMinC: 12,
    optimalMaxC: 15,
    chillingThresholdC: 10,
    heatThresholdC: 18,
    baseShelfLifeDays: 14,
    minShelfLifeDays: 7,
  },
  MANGOSTEEN: {
    fruit: 'MANGOSTEEN',
    optimalMinC: 10,
    optimalMaxC: 13,
    chillingThresholdC: 8,
    heatThresholdC: 15,
    baseShelfLifeDays: 21,
    minShelfLifeDays: 14,
  },
  LONGAN: {
    fruit: 'LONGAN',
    optimalMinC: 2,
    optimalMaxC: 5,
    chillingThresholdC: null,
    heatThresholdC: 8,
    baseShelfLifeDays: 30,
    minShelfLifeDays: 21,
  },
};

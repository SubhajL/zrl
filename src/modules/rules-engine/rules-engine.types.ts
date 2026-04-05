import type { AuditAction } from '../../common/audit/audit.types';

export const RuleMarket = {
  JAPAN: 'JAPAN',
  CHINA: 'CHINA',
  KOREA: 'KOREA',
  EU: 'EU',
} as const;

export type RuleMarket = (typeof RuleMarket)[keyof typeof RuleMarket];

export const RuleProduct = {
  MANGO: 'MANGO',
  DURIAN: 'DURIAN',
  MANGOSTEEN: 'MANGOSTEEN',
  LONGAN: 'LONGAN',
} as const;

export type RuleProduct = (typeof RuleProduct)[keyof typeof RuleProduct];

export const RuleRiskLevel = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type RuleRiskLevel = (typeof RuleRiskLevel)[keyof typeof RuleRiskLevel];

export const RULE_MARKETS = Object.values(RuleMarket);
export const RULE_PRODUCTS = Object.values(RuleProduct);

export interface RuleCompletenessWeights {
  regulatory: number;
  quality: number;
  coldChain: number;
  chainOfCustody: number;
}

export const RuleChecklistCategory = {
  REGULATORY: 'REGULATORY',
  QUALITY: 'QUALITY',
  COLD_CHAIN: 'COLD_CHAIN',
  CHAIN_OF_CUSTODY: 'CHAIN_OF_CUSTODY',
} as const;

export type RuleChecklistCategory =
  (typeof RuleChecklistCategory)[keyof typeof RuleChecklistCategory];

export const RuleLabEnforcementMode = {
  DOCUMENT_ONLY: 'DOCUMENT_ONLY',
  FULL_PESTICIDE: 'FULL_PESTICIDE',
} as const;

export type RuleLabEnforcementMode =
  (typeof RuleLabEnforcementMode)[keyof typeof RuleLabEnforcementMode];

export const RuleLabValidationStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
} as const;

export type RuleLabValidationStatus =
  (typeof RuleLabValidationStatus)[keyof typeof RuleLabValidationStatus];

export const RuleLabLimitSource = {
  SPECIFIC: 'SPECIFIC',
  DEFAULT_FALLBACK: 'DEFAULT_FALLBACK',
} as const;

export type RuleLabLimitSource =
  (typeof RuleLabLimitSource)[keyof typeof RuleLabLimitSource];

export const RuleCoverageState = {
  FULL_EXHAUSTIVE: 'FULL_EXHAUSTIVE',
  PRIMARY_PARTIAL: 'PRIMARY_PARTIAL',
  CURATED_HIGH_RISK: 'CURATED_HIGH_RISK',
  PROXY_MIXED: 'PROXY_MIXED',
} as const;

export type RuleCoverageState =
  (typeof RuleCoverageState)[keyof typeof RuleCoverageState];

export const RuleSourceQuality = {
  PRIMARY_ONLY: 'PRIMARY_ONLY',
  PRIMARY_PLUS_SECONDARY: 'PRIMARY_PLUS_SECONDARY',
  SECONDARY_ONLY: 'SECONDARY_ONLY',
} as const;

export type RuleSourceQuality =
  (typeof RuleSourceQuality)[keyof typeof RuleSourceQuality];

export const RuleNonPesticideCheckType = {
  PHYTO_CERT: 'PHYTO_CERT',
  VHT: 'VHT',
  GAP_CERT: 'GAP_CERT',
  COLD_CHAIN: 'COLD_CHAIN',
} as const;

export type RuleNonPesticideCheckType =
  (typeof RuleNonPesticideCheckType)[keyof typeof RuleNonPesticideCheckType];

export const RuleNonPesticideCheckStatus = {
  REQUIRED: 'REQUIRED',
  CONDITIONAL: 'CONDITIONAL',
  INFORMATIONAL: 'INFORMATIONAL',
} as const;

export type RuleNonPesticideCheckStatus =
  (typeof RuleNonPesticideCheckStatus)[keyof typeof RuleNonPesticideCheckStatus];

export type RuleMetadataParameterValue = string | number | boolean;

export interface RuleNonPesticideCheck {
  type: RuleNonPesticideCheckType;
  status: RuleNonPesticideCheckStatus;
  parameters: Record<string, RuleMetadataParameterValue>;
  sourceRef: string | null;
  note: string | null;
}

export interface RuleMetadata {
  coverageState: RuleCoverageState;
  sourceQuality: RuleSourceQuality;
  retrievedAt: Date;
  commodityCode: string | null;
  nonPesticideChecks: RuleNonPesticideCheck[];
}

export interface RuleLabPolicy {
  enforcementMode: RuleLabEnforcementMode;
  requiredArtifactType: 'MRL_TEST';
  acceptedUnits: string[];
  defaultDestinationMrlMgKg: number | null;
}

export interface RuleSubstanceDefinition {
  name: string;
  aliases: string[];
  cas: string | null;
  thaiMrl: number | null;
  destinationMrl: number;
  destinationLimitType?:
    | 'NUMERIC'
    | 'NON_DETECT'
    | 'PHYSIOLOGICAL_LEVEL'
    | 'NO_NUMERIC_LIMIT';
  stringencyRatio: number | null;
  riskLevel: RuleRiskLevel | null;
  sourceRef: string | null;
  note: string | null;
}

export interface RuleSetDefinition {
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  effectiveDate: Date;
  sourcePath: string;
  requiredDocuments: string[];
  completenessWeights: RuleCompletenessWeights;
  metadata: RuleMetadata;
  labPolicy?: RuleLabPolicy;
  substances: RuleSubstanceDefinition[];
}

export interface RuleSubstanceRecord {
  id: string;
  market: RuleMarket;
  name: string;
  cas: string | null;
  thaiMrl: number | null;
  destinationMrl: number;
  stringencyRatio: number | null;
  riskLevel: RuleRiskLevel | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleSetRecord {
  id: string;
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  effectiveDate: Date;
  sourcePath: string | null;
  payload: RuleSetDefinition;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleVersionRecord {
  id: string;
  ruleSetId: string;
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  changesSummary: string;
  payload: RuleSetDefinition;
  changedAt: Date;
}

export interface RuleSnapshotPayload {
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  effectiveDate: Date;
  sourcePath: string;
  requiredDocuments: string[];
  completenessWeights: RuleCompletenessWeights;
  metadata: RuleMetadata;
  labPolicy?: RuleLabPolicy;
  substances: RuleSubstanceDefinition[];
}

export interface RuleLaneArtifact {
  id: string;
  artifactType: string;
  fileName: string;
  metadata: Record<string, unknown> | null;
}

export interface RuleChecklistItem {
  key: string;
  label: string;
  category: RuleChecklistCategory;
  weight: number;
  required: boolean;
  present: boolean;
  status: 'PRESENT' | 'MISSING' | 'EXPIRED';
  artifactIds: string[];
}

export interface RuleChecklistCategorySummary {
  category: RuleChecklistCategory;
  weight: number;
  required: number;
  present: number;
  score: number;
}

export interface RuleLabValidationResultItem {
  substance: string;
  cas: string | null;
  valueMgKg: number | null;
  limitMgKg: number | null;
  passed: boolean;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  riskLevel: RuleRiskLevel | null;
  limitSource: RuleLabLimitSource;
}

export interface RuleLabValidationResult {
  status: RuleLabValidationStatus;
  valid: boolean;
  hasUnknowns: boolean;
  blockingReasons: string[];
  results: RuleLabValidationResultItem[];
}

export interface RuleCertificationAlert {
  artifactType: 'PHYTO_CERT' | 'VHT_CERT' | 'GAP_CERT';
  status: 'MISSING' | 'EXPIRED' | 'VALID';
  expiresAt: string | null;
  artifactId: string | null;
  message: string;
}

export type RuleCertificationArtifactType =
  | 'PHYTO_CERT'
  | 'VHT_CERT'
  | 'GAP_CERT';

export interface RuleCertificationArtifact extends RuleLaneArtifact {
  artifactType: RuleCertificationArtifactType;
}

export interface RuleCertificationUploadAlertInput {
  laneId: string;
  lanePublicId: string;
  artifact: RuleCertificationArtifact;
}

export interface RuleCertificationScanArtifact {
  laneId: string;
  lanePublicId: string;
  artifactId: string;
  artifactType: RuleCertificationArtifactType;
  fileName: string;
  metadata: Record<string, unknown> | null;
  uploadedAt: Date;
}

export interface RuleCertificationAlertDeliveryClaimInput {
  laneId: string;
  artifactId: string;
  artifactType: RuleCertificationArtifactType;
  alertCode: string;
  warningDays: number | null;
  expiresAt: Date | null;
  claimedAt: Date;
}

export interface RuleCertificationAlertDeliveryClaimRecord {
  id: string;
}

export interface RuleCertificationAlertDeliveryCompletionInput {
  notificationId: string | null;
  deliveryStatus: 'DELIVERED' | 'SKIPPED';
  deliveredAt: Date;
}

export interface RuleCertificationScanResult {
  processed: number;
  notified: number;
  skipped: number;
}

export interface RuleLaneEvaluation {
  score: number;
  required: number;
  present: number;
  missing: string[];
  checklist: RuleChecklistItem[];
  categories: RuleChecklistCategorySummary[];
  labValidation: RuleLabValidationResult | null;
  certificationAlerts: RuleCertificationAlert[];
}

export interface RuleReloadResult {
  loaded: number;
  ruleSets: RuleSetRecord[];
}

export interface RuleLoaderPort {
  reload(): Promise<RuleSetDefinition[]>;
  getRuleDefinition(
    market: string,
    product: string,
  ): Promise<RuleSetDefinition | null>;
  listRuleDefinitions(): Promise<RuleSetDefinition[]>;
}

export interface RuleStore {
  runInTransaction<T>(operation: (store: RuleStore) => Promise<T>): Promise<T>;
  syncRuleDefinition(definition: RuleSetDefinition): Promise<RuleSetRecord>;
  findLatestRuleSet(
    market: RuleMarket,
    product: RuleProduct,
  ): Promise<RuleSetRecord | null>;
  listMarkets(): Promise<RuleMarket[]>;
  listSubstances(market?: RuleMarket): Promise<RuleSubstanceRecord[]>;
  createSubstance(
    market: RuleMarket,
    input: RuleSubstanceInput,
  ): Promise<RuleSubstanceRecord>;
  bumpRuleVersionsForMarket(
    market: RuleMarket,
    changesSummary: string,
  ): Promise<RuleSetRecord[]>;
  updateSubstance(
    substanceId: string,
    input: Partial<RuleSubstanceInput>,
  ): Promise<RuleSubstanceRecord>;
  listRuleVersions(filter?: {
    market?: RuleMarket;
    product?: RuleProduct;
  }): Promise<RuleVersionRecord[]>;
  appendSubstanceAuditEntry(input: {
    actor: string;
    action: AuditAction;
    substanceId: string;
    payloadHash: string;
  }): Promise<void>;
  listLatestActiveCertificationArtifacts(): Promise<
    RuleCertificationScanArtifact[]
  >;
  claimCertificationAlertDelivery(
    input: RuleCertificationAlertDeliveryClaimInput,
  ): Promise<RuleCertificationAlertDeliveryClaimRecord | null>;
  completeCertificationAlertDelivery(
    deliveryId: string,
    input: RuleCertificationAlertDeliveryCompletionInput,
  ): Promise<void>;
  releaseCertificationAlertDelivery(deliveryId: string): Promise<void>;
}

export interface RuleVersionFilter {
  market?: RuleMarket;
  product?: RuleProduct;
}

export interface RuleSubstanceInput {
  name: string;
  cas: string;
  thaiMrl: number;
  destinationMrl: number;
}

export interface RuleDefinitionSource {
  market: string;
  product: string;
  version: number;
  effectiveDate: string | Date;
  sourcePath?: string;
  substancesFile?: string;
  requiredDocuments: string[];
  completenessWeights: RuleCompletenessWeights;
  metadata?: {
    coverageState: RuleCoverageState;
    sourceQuality: RuleSourceQuality;
    retrievedAt: string | Date;
    commodityCode?: string | null;
    nonPesticideChecks?: Array<{
      type: RuleNonPesticideCheckType;
      status: RuleNonPesticideCheckStatus;
      parameters?: Record<string, RuleMetadataParameterValue>;
      sourceRef?: string | null;
      note?: string | null;
    }>;
  };
  labPolicy?: {
    enforcementMode: RuleLabEnforcementMode;
    requiredArtifactType?: 'MRL_TEST';
    acceptedUnits?: string[];
    defaultDestinationMrlMgKg?: number | null;
  };
  substances?: Array<{
    name: string;
    aliases?: string[];
    cas?: string | null;
    thaiMrl?: number | null;
    destinationMrl: number;
    destinationLimitType?:
      | 'NUMERIC'
      | 'NON_DETECT'
      | 'PHYSIOLOGICAL_LEVEL'
      | 'NO_NUMERIC_LIMIT';
    sourceRef?: string | null;
    note?: string | null;
  }>;
}

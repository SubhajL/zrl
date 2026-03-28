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

export interface RuleSubstanceDefinition {
  name: string;
  cas: string;
  thaiMrl: number;
  destinationMrl: number;
  stringencyRatio: number;
  riskLevel: RuleRiskLevel;
}

export interface RuleSetDefinition {
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  effectiveDate: Date;
  sourcePath: string;
  requiredDocuments: string[];
  completenessWeights: RuleCompletenessWeights;
  substances: RuleSubstanceDefinition[];
}

export interface RuleSubstanceRecord {
  id: string;
  market: RuleMarket;
  name: string;
  cas: string;
  thaiMrl: number;
  destinationMrl: number;
  stringencyRatio: number;
  riskLevel: RuleRiskLevel;
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
  cas: string;
  valueMgKg: number | null;
  limitMgKg: number;
  passed: boolean;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  riskLevel: RuleRiskLevel;
}

export interface RuleLabValidationResult {
  valid: boolean;
  hasUnknowns: boolean;
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
    input: Omit<RuleSubstanceDefinition, 'stringencyRatio' | 'riskLevel'>,
  ): Promise<RuleSubstanceRecord>;
  bumpRuleVersionsForMarket(
    market: RuleMarket,
    changesSummary: string,
  ): Promise<RuleSetRecord[]>;
  updateSubstance(
    substanceId: string,
    input: Partial<
      Omit<RuleSubstanceDefinition, 'stringencyRatio' | 'riskLevel'>
    >,
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
  substances?: Array<{
    name: string;
    cas: string;
    thaiMrl: number;
    destinationMrl: number;
  }>;
}
import type { AuditAction } from '../../common/audit/audit.types';

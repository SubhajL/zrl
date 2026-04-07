import type { AuthSessionUser } from '../../common/auth/auth.types';
import type { AuditStore } from '../../common/audit/audit.types';
import type { Readable } from 'node:stream';
import type {
  RuleLaneArtifact,
  RuleSnapshotPayload,
} from '../rules-engine/rules-engine.types';

export const ArtifactSource = {
  UPLOAD: 'UPLOAD',
  PARTNER_API: 'PARTNER_API',
  CAMERA: 'CAMERA',
} as const;

export type ArtifactSource =
  (typeof ArtifactSource)[keyof typeof ArtifactSource];

export type EvidenceVerificationStatus = 'PENDING' | 'VERIFIED' | 'FAILED';

export type EvidenceArtifactAnalysisStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export type EvidenceArtifactType =
  | 'MRL_TEST'
  | 'VHT_CERT'
  | 'PHYTO_CERT'
  | 'CHECKPOINT_PHOTO'
  | 'TEMP_DATA'
  | 'HANDOFF_SIGNATURE'
  | 'INVOICE'
  | 'GAP_CERT';

export type EvidenceRequestUser = AuthSessionUser;

export interface EvidenceLaneRecord {
  id: string;
  laneId: string;
  exporterId: string;
  completenessScore: number;
  ruleSnapshot: RuleSnapshotPayload | null;
}

export interface EvidenceArtifactRecord {
  id: string;
  laneId: string;
  lanePublicId: string;
  exporterId: string;
  artifactType: EvidenceArtifactType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  filePath: string;
  contentHash: string;
  source: ArtifactSource;
  checkpointId: string | null;
  verificationStatus: EvidenceVerificationStatus;
  metadata: Record<string, unknown> | null;
  latestAnalysis: EvidenceArtifactAnalysisRecord | null;
  uploadedBy: string;
  uploadedAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface EvidenceArtifactAnalysisRecord {
  id: string;
  artifactId: string;
  analyzerVersion: string;
  analysisStatus: EvidenceArtifactAnalysisStatus;
  documentLabel: string | null;
  documentRole: string | null;
  confidence: string | null;
  summaryText: string | null;
  extractedFields: Record<string, unknown> | null;
  missingFieldKeys: string[];
  lowConfidenceFieldKeys: string[];
  fieldCompleteness: EvidenceDocumentFieldCompleteness | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidenceDocumentFieldCompleteness {
  supported: boolean;
  documentMatrixVersion: number;
  expectedFieldKeys: string[];
  presentFieldKeys: string[];
  missingFieldKeys: string[];
  lowConfidenceFieldKeys: string[];
  unsupportedFieldKeys: string[];
}

export interface CreateArtifactAnalysisInput {
  artifactId: string;
  laneId: string;
  analyzerVersion: string;
  analysisStatus: EvidenceArtifactAnalysisStatus;
  documentLabel: string | null;
  documentRole: string | null;
  confidence: string | null;
  summaryText: string | null;
  extractedFields: Record<string, unknown> | null;
  missingFieldKeys: string[];
  lowConfidenceFieldKeys: string[];
  fieldCompleteness: EvidenceDocumentFieldCompleteness | null;
  completedAt: Date | null;
}

export interface EvidenceArtifactResponse {
  id: string;
  laneId: string;
  artifactType: EvidenceArtifactType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  contentHash: string;
  contentHashPreview: string;
  storagePath: string;
  verificationStatus: EvidenceVerificationStatus;
  source: ArtifactSource;
  checkpointId: string | null;
  metadata: Record<string, unknown> | null;
  latestAnalysis: EvidenceArtifactAnalysisResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceArtifactAnalysisResponse {
  id: string;
  artifactId: string;
  analyzerVersion: string;
  analysisStatus: EvidenceArtifactAnalysisStatus;
  documentLabel: string | null;
  documentRole: string | null;
  confidence: string | null;
  summaryText: string | null;
  extractedFields: Record<string, unknown> | null;
  missingFieldKeys: string[];
  lowConfidenceFieldKeys: string[];
  fieldCompleteness: EvidenceDocumentFieldCompleteness | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceGraphNode {
  id: string;
  artifactId: string;
  artifactType: EvidenceArtifactType;
  label: string;
  status: EvidenceVerificationStatus;
  hashPreview: string;
}

export interface EvidenceGraphEdge {
  id: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  relationshipType: string;
}

export interface EvidenceArtifactGraph {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}

export interface EvidenceGraphVerificationResult {
  valid: boolean;
  invalidNodeIds: string[];
  checkedCount: number;
}

export interface EvidenceListFilters {
  type?: EvidenceArtifactType;
  status?: EvidenceVerificationStatus;
  page?: number;
  limit?: number;
}

export interface UploadArtifactInput {
  laneId: string;
  artifactType: EvidenceArtifactType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  tempFilePath: string;
  source: ArtifactSource;
  checkpointId: string | null;
  metadata: Record<string, unknown> | null;
  links: Array<{
    targetArtifactId: string;
    relationshipType: string;
  }>;
}

export interface CreateArtifactRecordInput {
  laneId: string;
  artifactType: EvidenceArtifactType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  filePath: string;
  contentHash: string;
  source: ArtifactSource;
  checkpointId: string | null;
  verificationStatus: EvidenceVerificationStatus;
  metadata: Record<string, unknown> | null;
  uploadedBy: string;
}

export interface EvidenceArtifactStore {
  runInTransaction<T>(
    operation: (transactionalStore: EvidenceArtifactStore) => Promise<T>,
  ): Promise<T>;
  asAuditStore(): AuditStore;
  findLaneById(id: string): Promise<EvidenceLaneRecord | null>;
  createArtifact(
    input: CreateArtifactRecordInput,
  ): Promise<EvidenceArtifactRecord>;
  createArtifactLinks(
    sourceArtifactId: string,
    links: Array<{ targetArtifactId: string; relationshipType: string }>,
  ): Promise<void>;
  findLatestArtifactForLane(
    laneId: string,
  ): Promise<EvidenceArtifactRecord | null>;
  findLatestArtifactForCheckpoint(
    checkpointId: string,
  ): Promise<EvidenceArtifactRecord | null>;
  linkCreatesCycle(
    sourceArtifactId: string,
    targetArtifactId: string,
  ): Promise<boolean>;
  listArtifactsForLane(
    laneId: string,
    filters: EvidenceListFilters,
  ): Promise<{ items: EvidenceArtifactRecord[]; total: number }>;
  listArtifactsForEvaluation(laneId: string): Promise<RuleLaneArtifact[]>;
  listArtifactsForIntegrityCheck(
    laneId: string,
  ): Promise<EvidenceArtifactRecord[]>;
  findArtifactById(id: string): Promise<EvidenceArtifactRecord | null>;
  updateArtifactVerificationStatus(
    id: string,
    status: EvidenceVerificationStatus,
  ): Promise<EvidenceArtifactRecord>;
  findArtifactGraphForLane(laneId: string): Promise<EvidenceArtifactGraph>;
  updateLaneCompletenessScore(laneId: string, score: number): Promise<void>;
  softDeleteArtifact(id: string): Promise<EvidenceArtifactRecord | null>;
  createArtifactAnalysis(
    input: CreateArtifactAnalysisInput,
  ): Promise<EvidenceArtifactAnalysisRecord>;
}

export interface PutObjectFromFileInput {
  key: string;
  filePath: string;
  contentType: string;
  contentLength?: number;
}

export interface EvidenceObjectStore {
  putObjectFromFile(input: PutObjectFromFileInput): Promise<void>;
  createReadStream(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
}

export interface ExtractedPhotoMetadata {
  capturedAt?: string;
  exifTimestamp?: string;
  gpsLat?: number;
  gpsLng?: number;
  cameraModel?: string;
}

export interface EvidencePhotoMetadataExtractor {
  extract(filePath: string): Promise<ExtractedPhotoMetadata | null>;
}

export interface EvidenceDocumentAnalysisAvailability {
  available: boolean;
  engine: 'tesseract';
  binaryPath: string | null;
  preprocessingAvailable: boolean;
  preprocessingEngine: 'ocrmypdf';
  preprocessingBinaryPath: string | null;
}

export interface EvidenceDocumentTextExtractionOptions {
  languages?: string[];
}

export interface EvidenceDocumentTextExtractionResult {
  engine: 'tesseract';
  text: string;
  preprocessingApplied: boolean;
}

export interface EvidenceDocumentAnalysisProvider {
  getAvailability(): Promise<EvidenceDocumentAnalysisAvailability>;
  extractText(
    filePath: string,
    options?: EvidenceDocumentTextExtractionOptions,
  ): Promise<EvidenceDocumentTextExtractionResult>;
}

export interface EvidenceDocumentClassificationResult {
  analysisStatus: EvidenceArtifactAnalysisStatus;
  documentLabel: string | null;
  documentRole: string | null;
  confidence: string | null;
  summaryText: string;
  extractedFields: Record<string, unknown>;
  missingFieldKeys: string[];
  lowConfidenceFieldKeys: string[];
  fieldCompleteness: EvidenceDocumentFieldCompleteness;
}

export interface EvidenceDocumentClassifier {
  analyze(input: {
    artifactType: EvidenceArtifactType;
    market: string;
    product: string;
    fileName: string;
    mimeType: string;
    metadata: Record<string, unknown> | null;
    ocrText: string;
  }): Promise<EvidenceDocumentClassificationResult>;
}

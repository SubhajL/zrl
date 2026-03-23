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
  uploadedBy: string;
  uploadedAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceGraphNode {
  id: string;
  artifactId: string;
  artifactType: EvidenceArtifactType;
  label: string;
  status: 'COMPLETE' | 'PENDING' | 'FAILED';
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
  listArtifactsForLane(
    laneId: string,
    filters: EvidenceListFilters,
  ): Promise<{ items: EvidenceArtifactRecord[]; total: number }>;
  listArtifactsForEvaluation(laneId: string): Promise<RuleLaneArtifact[]>;
  findArtifactById(id: string): Promise<EvidenceArtifactRecord | null>;
  updateArtifactVerificationStatus(
    id: string,
    status: EvidenceVerificationStatus,
  ): Promise<EvidenceArtifactRecord>;
  findArtifactGraphForLane(laneId: string): Promise<EvidenceArtifactGraph>;
  updateLaneCompletenessScore(laneId: string, score: number): Promise<void>;
  softDeleteArtifact(id: string): Promise<EvidenceArtifactRecord | null>;
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

import type { AuthRole } from '../../common/auth/auth.types';

export const PrivacyConsentType = {
  MARKETING_COMMUNICATIONS: 'MARKETING_COMMUNICATIONS',
} as const;

export type PrivacyConsentType =
  (typeof PrivacyConsentType)[keyof typeof PrivacyConsentType];

export const PrivacyRequestType = {
  ACCESS: 'ACCESS',
  CORRECTION: 'CORRECTION',
  DELETION: 'DELETION',
  OBJECTION: 'OBJECTION',
  PORTABILITY: 'PORTABILITY',
  WITHDRAW_CONSENT: 'WITHDRAW_CONSENT',
} as const;

export type PrivacyRequestType =
  (typeof PrivacyRequestType)[keyof typeof PrivacyRequestType];

export const PrivacyRequestStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;

export type PrivacyRequestStatus =
  (typeof PrivacyRequestStatus)[keyof typeof PrivacyRequestStatus];

export const DataExportStatus = {
  READY: 'READY',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;

export type DataExportStatus =
  (typeof DataExportStatus)[keyof typeof DataExportStatus];

export const SUPPORTED_PRIVACY_REQUEST_TYPES =
  Object.values(PrivacyRequestType);
export const SUPPORTED_PRIVACY_CONSENT_TYPES =
  Object.values(PrivacyConsentType);

export interface PrivacyUserProfileRecord {
  id: string;
  email: string;
  role: AuthRole;
  companyName: string | null;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivacyConsentEventRecord {
  id: string;
  userId: string;
  consentType: PrivacyConsentType;
  granted: boolean;
  source: string;
  createdAt: Date;
}

export interface PrivacyRequestRecord {
  id: string;
  userId: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;
  reason: string | null;
  details: Record<string, unknown> | null;
  dueAt: Date;
  completedAt: Date | null;
  processedByUserId: string | null;
  resolution: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivacyBreachIncidentRecord {
  id: string;
  reportedByUserId: string;
  summary: string;
  description: string;
  affectedUserIds: string[];
  detectedAt: Date;
  occurredAt: Date | null;
  pdpaOfficeNotifiedAt: Date | null;
  dataSubjectsNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataExportRequestRecord {
  id: string;
  userId: string;
  status: DataExportStatus;
  fileName: string;
  contentType: string;
  zipData: Buffer;
  exportedAt: Date;
  expiresAt: Date | null;
}

export interface PrivacyExportLaneRecord {
  id: string;
  laneId: string;
  productType: string;
  destinationMarket: string;
  coldChainMode: string | null;
  coldChainDeviceId: string | null;
  createdAt: string;
  batch?: Record<string, unknown> | null;
  route?: Record<string, unknown> | null;
}

export interface PrivacyExportCheckpointRecord {
  id: string;
  laneId: string;
  sequence: number;
  locationName: string;
  signerName: string | null;
  conditionNotes: string | null;
  createdAt: string;
}

export interface PrivacyExportArtifactRecord {
  id: string;
  laneId: string;
  artifactType: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  issuer: string | null;
  issuedAt: string | null;
  source: string;
  verificationStatus: string;
  metadata: Record<string, unknown> | null;
  uploadedAt: string;
}

export interface PrivacyExportNotificationRecord {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface PrivacyDataExportFootprint {
  profile: PrivacyUserProfileRecord;
  consents: PrivacyConsentEventRecord[];
  requests: PrivacyRequestRecord[];
  lanes: PrivacyExportLaneRecord[];
  checkpoints: PrivacyExportCheckpointRecord[];
  artifacts: PrivacyExportArtifactRecord[];
  notifications: PrivacyExportNotificationRecord[];
}

export interface UpdatePrivacyConsentInput {
  type: PrivacyConsentType;
  granted: boolean;
  source: string;
}

export interface CreatePrivacyRequestInput {
  type: PrivacyRequestType;
  reason?: string | null;
  details?: Record<string, unknown> | null;
}

export interface CreatePrivacyBreachIncidentInput {
  summary: string;
  description: string;
  affectedUserIds: string[];
  detectedAt: string;
  occurredAt?: string | null;
}

export interface PrivacyConsentView {
  type: PrivacyConsentType;
  granted: boolean;
  source: string | null;
  updatedAt: string | null;
}

export interface PrivacyRequestView {
  id: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  reason: string | null;
  details: Record<string, unknown> | null;
  dueAt: string;
  completedAt: string | null;
  processedByUserId: string | null;
  resolution: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyRequestListResult {
  requests: PrivacyRequestView[];
}

export interface PrivacyBreachIncidentView {
  id: string;
  summary: string;
  description: string;
  affectedUserIds: string[];
  detectedAt: string;
  occurredAt: string | null;
  pdpaOfficeNotifiedAt: string | null;
  dataSubjectsNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentPrivacyProfileResult {
  user: {
    id: string;
    email: string;
    role: AuthRole;
    companyName: string | null;
    mfaEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  };
  consent: PrivacyConsentView;
  requests: PrivacyRequestView[];
}

export interface PrivacyConsentResult {
  consent: PrivacyConsentView;
}

export interface PrivacyRequestResult {
  request: PrivacyRequestView;
}

export interface PrivacyBreachIncidentResult {
  incident: PrivacyBreachIncidentView;
}

export interface RequestDataExportResult {
  requestId: string;
  estimatedReady: string;
}

export interface DownloadDataExportResult {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

export interface PrivacyStore {
  getUserProfile(userId: string): Promise<PrivacyUserProfileRecord | null>;
  listUserProfiles(
    userIds: readonly string[],
  ): Promise<PrivacyUserProfileRecord[]>;
  listConsentEvents(userId: string): Promise<PrivacyConsentEventRecord[]>;
  createConsentEvent(input: {
    userId: string;
    consentType: PrivacyConsentType;
    granted: boolean;
    source: string;
    createdAt: Date;
  }): Promise<PrivacyConsentEventRecord>;
  listPrivacyRequests(
    userId: string,
    limit?: number,
  ): Promise<PrivacyRequestRecord[]>;
  listOpenPrivacyRequests(): Promise<PrivacyRequestRecord[]>;
  findPrivacyRequestById(
    requestId: string,
  ): Promise<PrivacyRequestRecord | null>;
  createPrivacyRequest(input: {
    userId: string;
    requestType: PrivacyRequestType;
    reason: string | null;
    details: Record<string, unknown> | null;
    status: PrivacyRequestStatus;
    dueAt: Date;
    createdAt: Date;
  }): Promise<PrivacyRequestRecord>;
  completePrivacyRequest(input: {
    requestId: string;
    status: PrivacyRequestStatus;
    completedAt: Date;
    processedByUserId: string;
    resolution: Record<string, unknown> | null;
  }): Promise<PrivacyRequestRecord>;
  updateUserProfile(
    userId: string,
    input: {
      email?: string;
      companyName?: string | null;
    },
  ): Promise<PrivacyUserProfileRecord>;
  anonymizeUser(
    userId: string,
    deletedAt: Date,
  ): Promise<PrivacyUserProfileRecord>;
  getDataExportFootprint(userId: string): Promise<PrivacyDataExportFootprint>;
  createDataExportRequest(input: {
    userId: string;
    fileName: string;
    contentType: string;
    zipData: Buffer;
    exportedAt: Date;
  }): Promise<DataExportRequestRecord>;
  findDataExportRequestForUser(
    requestId: string,
    userId: string,
  ): Promise<DataExportRequestRecord | null>;
  createBreachIncident(input: {
    reportedByUserId: string;
    summary: string;
    description: string;
    affectedUserIds: readonly string[];
    detectedAt: Date;
    occurredAt: Date | null;
    createdAt: Date;
  }): Promise<PrivacyBreachIncidentRecord>;
  markBreachIncidentNotifications(input: {
    incidentId: string;
    pdpaOfficeNotifiedAt: Date;
    dataSubjectsNotifiedAt: Date;
  }): Promise<PrivacyBreachIncidentRecord>;
}

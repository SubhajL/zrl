export const AuditAction = {
  UPLOAD: 'UPLOAD',
  SIGN: 'SIGN',
  GENERATE: 'GENERATE',
  VERIFY: 'VERIFY',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntityType = {
  LANE: 'LANE',
  ARTIFACT: 'ARTIFACT',
  CHECKPOINT: 'CHECKPOINT',
  PROOF_PACK: 'PROOF_PACK',
  RULE_SET: 'RULE_SET',
  SUBSTANCE: 'SUBSTANCE',
} as const;

export type AuditEntityType =
  (typeof AuditEntityType)[keyof typeof AuditEntityType];

export interface CreateAuditEntryInput {
  actor: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  payloadHash: string;
  timestamp?: Date;
}

export interface AuditEntryRecord {
  id: string;
  timestamp: Date;
  actor: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  payloadHash: string;
  prevHash: string;
  entryHash: string;
}

export type CreateAuditEntryRecord = Omit<AuditEntryRecord, 'id'>;

export interface AuditEntryFilters {
  action?: AuditAction;
  actor?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface LaneAuditVerificationResult {
  valid: boolean;
  entriesChecked: number;
  firstInvalidIndex?: number;
  firstInvalidEntryId?: string;
}

export interface ExportedAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  payloadHash: string;
  prevHash: string;
  entryHash: string;
}

export interface LaneAuditExportPayload {
  laneId: string;
  exportedAt: string;
  entriesCount: number;
  entries: ExportedAuditEntry[];
}

export interface AuditedMetadata {
  action: AuditAction;
  entityType: AuditEntityType;
}

export interface AuditStore {
  runInTransaction<T>(operation: (store: AuditStore) => Promise<T>): Promise<T>;
  lockStream(streamId: string): Promise<void>;
  resolveStreamId(
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<string | null>;
  findLatestForStream(streamId: string): Promise<AuditEntryRecord | null>;
  createEntry(entry: CreateAuditEntryRecord): Promise<AuditEntryRecord>;
  findEntriesForLane(
    laneId: string,
    filters?: AuditEntryFilters,
  ): Promise<AuditEntryRecord[]>;
  findEntriesForEntity(
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<AuditEntryRecord[]>;
}

export function isAuditAction(value: string): value is AuditAction {
  return Object.values(AuditAction).includes(value as AuditAction);
}

export function isAuditEntityType(value: string): value is AuditEntityType {
  return Object.values(AuditEntityType).includes(value as AuditEntityType);
}

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.constants';
import type {
  DataExportRequestRecord,
  PrivacyBreachIncidentRecord,
  PrivacyConsentEventRecord,
  PrivacyDataExportFootprint,
  PrivacyExportArtifactRecord,
  PrivacyExportCheckpointRecord,
  PrivacyExportLaneRecord,
  PrivacyExportNotificationRecord,
  PrivacyRequestRecord,
  PrivacyStore,
  PrivacyUserProfileRecord,
} from './privacy.types';

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  role: PrivacyUserProfileRecord['role'];
  company_name: string | null;
  mfa_enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ConsentEventRow extends QueryResultRow {
  id: string;
  user_id: string;
  consent_type: PrivacyConsentEventRecord['consentType'];
  granted: boolean;
  source: string;
  created_at: Date | string;
}

interface PrivacyRequestRow extends QueryResultRow {
  id: string;
  user_id: string;
  request_type: PrivacyRequestRecord['requestType'];
  status: PrivacyRequestRecord['status'];
  reason: string | null;
  details: Record<string, unknown> | null;
  due_at: Date | string;
  completed_at: Date | string | null;
  processed_by_user_id: string | null;
  resolution: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PrivacyBreachIncidentRow extends QueryResultRow {
  id: string;
  reported_by_user_id: string;
  summary: string;
  description: string;
  affected_user_ids: string[];
  detected_at: Date | string;
  occurred_at: Date | string | null;
  pdpa_office_notified_at: Date | string | null;
  data_subjects_notified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface DataExportRequestRow extends QueryResultRow {
  id: string;
  user_id: string;
  status: DataExportRequestRecord['status'];
  file_name: string;
  content_type: string;
  zip_data: Buffer;
  exported_at: Date | string;
  expires_at: Date | string | null;
}

interface LaneExportRow extends QueryResultRow {
  id: string;
  lane_id: string;
  product_type: string;
  destination_market: string;
  cold_chain_mode: string | null;
  cold_chain_device_id: string | null;
  created_at: Date | string;
  batch_id: string | null;
  quantity_kg: string | null;
  variety: string | null;
  origin_province: string | null;
  harvest_date: Date | string | null;
  grade: string | null;
  transport_mode: string | null;
  carrier: string | null;
  origin_gps: Record<string, unknown> | null;
  destination_gps: Record<string, unknown> | null;
  estimated_transit_hours: number | null;
}

interface CheckpointExportRow extends QueryResultRow {
  id: string;
  lane_id: string;
  sequence: number;
  location_name: string;
  signer_name: string | null;
  condition_notes: string | null;
  created_at: Date | string;
}

interface ArtifactExportRow extends QueryResultRow {
  id: string;
  lane_id: string;
  artifact_type: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  issuer: string | null;
  issued_at: Date | string | null;
  source: string;
  verification_status: string;
  metadata: Record<string, unknown> | null;
  uploaded_at: Date | string;
}

interface NotificationExportRow extends QueryResultRow {
  id: string;
  type: string;
  title: string;
  message: string;
  read_at: Date | string | null;
  created_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return toDate(value).toISOString();
}

@Injectable()
export class PrismaPrivacyStore implements PrivacyStore {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool | undefined,
  ) {}

  async getUserProfile(
    userId: string,
  ): Promise<PrivacyUserProfileRecord | null> {
    const result = await this.requirePool().query<UserRow>(
      `
        SELECT
          id,
          email,
          role,
          company_name,
          mfa_enabled,
          created_at,
          updated_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    return result.rowCount === 0 ? null : this.mapUser(result.rows[0]);
  }

  async listUserProfiles(
    userIds: readonly string[],
  ): Promise<PrivacyUserProfileRecord[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.requirePool().query<UserRow>(
      `
        SELECT
          id,
          email,
          role,
          company_name,
          mfa_enabled,
          created_at,
          updated_at
        FROM users
        WHERE id = ANY($1::text[])
        ORDER BY id ASC
      `,
      [userIds],
    );

    return result.rows.map((row) => this.mapUser(row));
  }

  async listConsentEvents(
    userId: string,
  ): Promise<PrivacyConsentEventRecord[]> {
    const result = await this.requirePool().query<ConsentEventRow>(
      `
        SELECT
          id,
          user_id,
          consent_type,
          granted,
          source,
          created_at
        FROM privacy_consent_events
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
      `,
      [userId],
    );

    return result.rows.map((row) => this.mapConsentEvent(row));
  }

  async createConsentEvent(input: {
    userId: string;
    consentType: PrivacyConsentEventRecord['consentType'];
    granted: boolean;
    source: string;
    createdAt: Date;
  }): Promise<PrivacyConsentEventRecord> {
    const result = await this.requirePool().query<ConsentEventRow>(
      `
        INSERT INTO privacy_consent_events (
          id,
          user_id,
          consent_type,
          granted,
          source,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          user_id,
          consent_type,
          granted,
          source,
          created_at
      `,
      [
        randomUUID(),
        input.userId,
        input.consentType,
        input.granted,
        input.source,
        input.createdAt,
      ],
    );

    return this.mapConsentEvent(result.rows[0]);
  }

  async listPrivacyRequests(
    userId: string,
    limit?: number,
  ): Promise<PrivacyRequestRecord[]> {
    const result =
      limit === undefined
        ? await this.requirePool().query<PrivacyRequestRow>(
            `
              SELECT
                id,
                user_id,
                request_type,
                status,
                reason,
                details,
                due_at,
                completed_at,
                processed_by_user_id,
                resolution,
                created_at,
                updated_at
              FROM privacy_requests
              WHERE user_id = $1
              ORDER BY created_at DESC, id DESC
            `,
            [userId],
          )
        : await this.requirePool().query<PrivacyRequestRow>(
            `
              SELECT
                id,
                user_id,
                request_type,
                status,
                reason,
                details,
                due_at,
                completed_at,
                processed_by_user_id,
                resolution,
                created_at,
                updated_at
              FROM privacy_requests
              WHERE user_id = $1
              ORDER BY created_at DESC, id DESC
              LIMIT $2
            `,
            [userId, limit],
          );

    return result.rows.map((row) => this.mapPrivacyRequest(row));
  }

  async listOpenPrivacyRequests(): Promise<PrivacyRequestRecord[]> {
    const result = await this.requirePool().query<PrivacyRequestRow>(
      `
        SELECT
          id,
          user_id,
          request_type,
          status,
          reason,
          details,
          due_at,
          completed_at,
          processed_by_user_id,
          resolution,
          created_at,
          updated_at
        FROM privacy_requests
        WHERE status IN ('PENDING', 'IN_PROGRESS')
        ORDER BY due_at ASC, created_at ASC, id ASC
      `,
    );

    return result.rows.map((row) => this.mapPrivacyRequest(row));
  }

  async findPrivacyRequestById(
    requestId: string,
  ): Promise<PrivacyRequestRecord | null> {
    const result = await this.requirePool().query<PrivacyRequestRow>(
      `
        SELECT
          id,
          user_id,
          request_type,
          status,
          reason,
          details,
          due_at,
          completed_at,
          processed_by_user_id,
          resolution,
          created_at,
          updated_at
        FROM privacy_requests
        WHERE id = $1
        LIMIT 1
      `,
      [requestId],
    );

    return result.rowCount === 0
      ? null
      : this.mapPrivacyRequest(result.rows[0]);
  }

  async createPrivacyRequest(input: {
    userId: string;
    requestType: PrivacyRequestRecord['requestType'];
    reason: string | null;
    details: Record<string, unknown> | null;
    status: PrivacyRequestRecord['status'];
    dueAt: Date;
    createdAt: Date;
  }): Promise<PrivacyRequestRecord> {
    const result = await this.requirePool().query<PrivacyRequestRow>(
      `
        INSERT INTO privacy_requests (
          id,
          user_id,
          request_type,
          status,
          reason,
          details,
          due_at,
          completed_at,
          processed_by_user_id,
          resolution,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, NULL, $8, $8)
        RETURNING
          id,
          user_id,
          request_type,
          status,
          reason,
          details,
          due_at,
          completed_at,
          processed_by_user_id,
          resolution,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        input.userId,
        input.requestType,
        input.status,
        input.reason,
        input.details,
        input.dueAt,
        input.createdAt,
      ],
    );

    return this.mapPrivacyRequest(result.rows[0]);
  }

  async completePrivacyRequest(input: {
    requestId: string;
    status: PrivacyRequestRecord['status'];
    completedAt: Date;
    processedByUserId: string;
    resolution: Record<string, unknown> | null;
  }): Promise<PrivacyRequestRecord> {
    const result = await this.requirePool().query<PrivacyRequestRow>(
      `
        UPDATE privacy_requests
        SET
          status = $2,
          completed_at = $3,
          processed_by_user_id = $4,
          resolution = $5,
          updated_at = $3
        WHERE id = $1
        RETURNING
          id,
          user_id,
          request_type,
          status,
          reason,
          details,
          due_at,
          completed_at,
          processed_by_user_id,
          resolution,
          created_at,
          updated_at
      `,
      [
        input.requestId,
        input.status,
        input.completedAt,
        input.processedByUserId,
        input.resolution,
      ],
    );

    return this.mapPrivacyRequest(result.rows[0]);
  }

  async updateUserProfile(
    userId: string,
    input: {
      email?: string;
      companyName?: string | null;
    },
  ): Promise<PrivacyUserProfileRecord> {
    const assignments: string[] = [];
    const values: unknown[] = [userId];

    if (input.email !== undefined) {
      assignments.push(`email = $${values.length + 1}`);
      values.push(input.email);
    }
    if (input.companyName !== undefined) {
      assignments.push(`company_name = $${values.length + 1}`);
      values.push(input.companyName);
    }

    if (assignments.length === 0) {
      throw new Error('No profile fields provided for update.');
    }

    const result = await this.requirePool().query<UserRow>(
      `
        UPDATE users
        SET
          ${assignments.join(', ')},
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          email,
          role,
          company_name,
          mfa_enabled,
          created_at,
          updated_at
      `,
      values,
    );

    return this.mapUser(result.rows[0]);
  }

  async anonymizeUser(
    userId: string,
    deletedAt: Date,
  ): Promise<PrivacyUserProfileRecord> {
    const pool = this.requirePool();
    const client = await pool.connect();
    const anonymizedEmail = `deleted+${userId}@privacy.invalid`;

    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM notification_channel_targets WHERE user_id = $1`,
        [userId],
      );
      await client.query(
        `DELETE FROM notification_preferences WHERE user_id = $1`,
        [userId],
      );
      await client.query(`DELETE FROM notifications WHERE user_id = $1`, [
        userId,
      ]);
      await client.query(
        `DELETE FROM data_export_requests WHERE user_id = $1`,
        [userId],
      );
      await client.query(
        `DELETE FROM privacy_consent_events WHERE user_id = $1`,
        [userId],
      );
      await client.query(
        `DELETE FROM password_reset_requests WHERE user_id = $1`,
        [userId],
      );
      await client.query(`DELETE FROM api_keys WHERE user_id = $1`, [userId]);

      const result = await client.query<UserRow>(
        `
          UPDATE users
          SET
            email = $2,
            password_hash = $3,
            company_name = NULL,
            mfa_enabled = false,
            totp_secret = NULL,
            session_version = session_version + 1,
            updated_at = $4
          WHERE id = $1
          RETURNING
            id,
            email,
            role,
            company_name,
            mfa_enabled,
            created_at,
            updated_at
        `,
        [userId, anonymizedEmail, randomUUID(), deletedAt],
      );

      await client.query('COMMIT');
      return this.mapUser(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getDataExportFootprint(
    userId: string,
  ): Promise<PrivacyDataExportFootprint> {
    const profile = await this.getUserProfile(userId);
    if (profile === null) {
      throw new Error('User not found.');
    }

    const [consents, requests, lanes, checkpoints, artifacts, notifications] =
      await Promise.all([
        this.listConsentEvents(userId),
        this.listPrivacyRequests(userId),
        this.listLanes(userId),
        this.listCheckpoints(userId),
        this.listArtifacts(userId),
        this.listNotifications(userId),
      ]);

    return {
      profile,
      consents,
      requests,
      lanes,
      checkpoints,
      artifacts,
      notifications,
    };
  }

  async createDataExportRequest(input: {
    userId: string;
    fileName: string;
    contentType: string;
    zipData: Buffer;
    exportedAt: Date;
  }): Promise<DataExportRequestRecord> {
    const result = await this.requirePool().query<DataExportRequestRow>(
      `
        INSERT INTO data_export_requests (
          id,
          user_id,
          status,
          file_name,
          content_type,
          zip_data,
          exported_at
        )
        VALUES ($1, $2, 'READY', $3, $4, $5, $6)
        RETURNING
          id,
          user_id,
          status,
          file_name,
          content_type,
          zip_data,
          exported_at,
          expires_at
      `,
      [
        randomUUID(),
        input.userId,
        input.fileName,
        input.contentType,
        input.zipData,
        input.exportedAt,
      ],
    );

    return this.mapDataExportRequest(result.rows[0]);
  }

  async findDataExportRequestForUser(
    requestId: string,
    userId: string,
  ): Promise<DataExportRequestRecord | null> {
    const result = await this.requirePool().query<DataExportRequestRow>(
      `
        SELECT
          id,
          user_id,
          status,
          file_name,
          content_type,
          zip_data,
          exported_at,
          expires_at
        FROM data_export_requests
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [requestId, userId],
    );

    return result.rowCount === 0
      ? null
      : this.mapDataExportRequest(result.rows[0]);
  }

  async createBreachIncident(input: {
    reportedByUserId: string;
    summary: string;
    description: string;
    affectedUserIds: readonly string[];
    detectedAt: Date;
    occurredAt: Date | null;
    createdAt: Date;
  }): Promise<PrivacyBreachIncidentRecord> {
    const result = await this.requirePool().query<PrivacyBreachIncidentRow>(
      `
        INSERT INTO privacy_breach_incidents (
          id,
          reported_by_user_id,
          summary,
          description,
          affected_user_ids,
          detected_at,
          occurred_at,
          pdpa_office_notified_at,
          data_subjects_notified_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8, $8)
        RETURNING
          id,
          reported_by_user_id,
          summary,
          description,
          affected_user_ids,
          detected_at,
          occurred_at,
          pdpa_office_notified_at,
          data_subjects_notified_at,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        input.reportedByUserId,
        input.summary,
        input.description,
        input.affectedUserIds,
        input.detectedAt,
        input.occurredAt,
        input.createdAt,
      ],
    );

    return this.mapPrivacyBreachIncident(result.rows[0]);
  }

  async markBreachIncidentNotifications(input: {
    incidentId: string;
    pdpaOfficeNotifiedAt: Date;
    dataSubjectsNotifiedAt: Date;
  }): Promise<PrivacyBreachIncidentRecord> {
    const result = await this.requirePool().query<PrivacyBreachIncidentRow>(
      `
        UPDATE privacy_breach_incidents
        SET
          pdpa_office_notified_at = $2::timestamp,
          data_subjects_notified_at = $3::timestamp,
          updated_at = GREATEST($2::timestamp, $3::timestamp)
        WHERE id = $1
        RETURNING
          id,
          reported_by_user_id,
          summary,
          description,
          affected_user_ids,
          detected_at,
          occurred_at,
          pdpa_office_notified_at,
          data_subjects_notified_at,
          created_at,
          updated_at
      `,
      [
        input.incidentId,
        input.pdpaOfficeNotifiedAt,
        input.dataSubjectsNotifiedAt,
      ],
    );

    return this.mapPrivacyBreachIncident(result.rows[0]);
  }

  private async listLanes(userId: string): Promise<PrivacyExportLaneRecord[]> {
    const result = await this.requirePool().query<LaneExportRow>(
      `
        SELECT
          lanes.id,
          lanes.lane_id,
          lanes.product_type,
          lanes.destination_market,
          lanes.cold_chain_mode,
          lanes.cold_chain_device_id,
          lanes.created_at,
          batches.batch_id,
          batches.quantity_kg,
          batches.variety,
          batches.origin_province,
          batches.harvest_date,
          batches.grade,
          routes.transport_mode,
          routes.carrier,
          routes.origin_gps,
          routes.destination_gps,
          routes.estimated_transit_hours
        FROM lanes
        LEFT JOIN batches
          ON batches.lane_id = lanes.id
        LEFT JOIN routes
          ON routes.lane_id = lanes.id
        WHERE lanes.exporter_id = $1
        ORDER BY lanes.created_at DESC, lanes.id DESC
      `,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      laneId: row.lane_id,
      productType: row.product_type,
      destinationMarket: row.destination_market,
      coldChainMode: row.cold_chain_mode,
      coldChainDeviceId: row.cold_chain_device_id,
      createdAt: toIsoString(row.created_at)!,
      batch:
        row.batch_id === null
          ? null
          : {
              batchId: row.batch_id,
              quantityKg: row.quantity_kg,
              variety: row.variety,
              originProvince: row.origin_province,
              harvestDate: toIsoString(row.harvest_date),
              grade: row.grade,
            },
      route:
        row.transport_mode === null &&
        row.carrier === null &&
        row.origin_gps === null &&
        row.destination_gps === null &&
        row.estimated_transit_hours === null
          ? null
          : {
              transportMode: row.transport_mode,
              carrier: row.carrier,
              originGps: row.origin_gps,
              destinationGps: row.destination_gps,
              estimatedTransitHours: row.estimated_transit_hours,
            },
    }));
  }

  private async listCheckpoints(
    userId: string,
  ): Promise<PrivacyExportCheckpointRecord[]> {
    const result = await this.requirePool().query<CheckpointExportRow>(
      `
        SELECT
          checkpoints.id,
          checkpoints.lane_id,
          checkpoints.sequence,
          checkpoints.location_name,
          checkpoints.signer_name,
          checkpoints.condition_notes,
          COALESCE(checkpoints.timestamp, lanes.created_at) AS created_at
        FROM checkpoints
        INNER JOIN lanes
          ON lanes.id = checkpoints.lane_id
        WHERE lanes.exporter_id = $1
        ORDER BY checkpoints.sequence ASC, checkpoints.id ASC
      `,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      laneId: row.lane_id,
      sequence: row.sequence,
      locationName: row.location_name,
      signerName: row.signer_name,
      conditionNotes: row.condition_notes,
      createdAt: toIsoString(row.created_at)!,
    }));
  }

  private async listArtifacts(
    userId: string,
  ): Promise<PrivacyExportArtifactRecord[]> {
    const result = await this.requirePool().query<ArtifactExportRow>(
      `
        SELECT
          evidence_artifacts.id,
          evidence_artifacts.lane_id,
          evidence_artifacts.artifact_type,
          evidence_artifacts.file_name,
          evidence_artifacts.mime_type,
          evidence_artifacts.file_size_bytes,
          evidence_artifacts.issuer,
          evidence_artifacts.issued_at,
          evidence_artifacts.source,
          evidence_artifacts.verification_status,
          evidence_artifacts.metadata,
          evidence_artifacts.uploaded_at
        FROM evidence_artifacts
        INNER JOIN lanes
          ON lanes.id = evidence_artifacts.lane_id
        WHERE lanes.exporter_id = $1
          AND evidence_artifacts.deleted_at IS NULL
        ORDER BY evidence_artifacts.uploaded_at DESC, evidence_artifacts.id DESC
      `,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      laneId: row.lane_id,
      artifactType: row.artifact_type,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      issuer: row.issuer,
      issuedAt: toIsoString(row.issued_at),
      source: row.source,
      verificationStatus: row.verification_status,
      metadata: row.metadata,
      uploadedAt: toIsoString(row.uploaded_at)!,
    }));
  }

  private async listNotifications(
    userId: string,
  ): Promise<PrivacyExportNotificationRecord[]> {
    const result = await this.requirePool().query<NotificationExportRow>(
      `
        SELECT
          id,
          type,
          title,
          message,
          read_at,
          created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
      `,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      readAt: toIsoString(row.read_at),
      createdAt: toIsoString(row.created_at)!,
    }));
  }

  private mapUser(row: UserRow): PrivacyUserProfileRecord {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      companyName: row.company_name,
      mfaEnabled: row.mfa_enabled,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
    };
  }

  private mapConsentEvent(row: ConsentEventRow): PrivacyConsentEventRecord {
    return {
      id: row.id,
      userId: row.user_id,
      consentType: row.consent_type,
      granted: row.granted,
      source: row.source,
      createdAt: toDate(row.created_at),
    };
  }

  private mapPrivacyRequest(row: PrivacyRequestRow): PrivacyRequestRecord {
    return {
      id: row.id,
      userId: row.user_id,
      requestType: row.request_type,
      status: row.status,
      reason: row.reason,
      details: row.details,
      dueAt: toDate(row.due_at),
      completedAt: row.completed_at === null ? null : toDate(row.completed_at),
      processedByUserId: row.processed_by_user_id,
      resolution: row.resolution,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
    };
  }

  private mapPrivacyBreachIncident(
    row: PrivacyBreachIncidentRow,
  ): PrivacyBreachIncidentRecord {
    return {
      id: row.id,
      reportedByUserId: row.reported_by_user_id,
      summary: row.summary,
      description: row.description,
      affectedUserIds: row.affected_user_ids,
      detectedAt: toDate(row.detected_at),
      occurredAt: row.occurred_at === null ? null : toDate(row.occurred_at),
      pdpaOfficeNotifiedAt:
        row.pdpa_office_notified_at === null
          ? null
          : toDate(row.pdpa_office_notified_at),
      dataSubjectsNotifiedAt:
        row.data_subjects_notified_at === null
          ? null
          : toDate(row.data_subjects_notified_at),
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
    };
  }

  private mapDataExportRequest(
    row: DataExportRequestRow,
  ): DataExportRequestRecord {
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      fileName: row.file_name,
      contentType: row.content_type,
      zipData: row.zip_data,
      exportedAt: toDate(row.exported_at),
      expiresAt: row.expires_at === null ? null : toDate(row.expires_at),
    };
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('Database pool is not configured.');
    }

    return this.pool;
  }
}

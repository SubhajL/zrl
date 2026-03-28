import { Inject, Injectable, Optional } from '@nestjs/common';
import JSZip from 'jszip';
import { NotificationChannels } from '../notifications/notification.channels';
import {
  DATA_EXPORT_CONTENT_TYPE,
  PDPA_REQUEST_SLA_DAYS,
  PRIVACY_PROFILE_REQUEST_LIMIT,
  PRIVACY_STORE,
} from './privacy.constants';
import {
  PrivacyConsentType,
  PrivacyRequestStatus,
  PrivacyRequestType,
  type CreatePrivacyBreachIncidentInput,
  type CreatePrivacyRequestInput,
  type CurrentPrivacyProfileResult,
  type DataExportRequestRecord,
  type DownloadDataExportResult,
  type PrivacyBreachIncidentRecord,
  type PrivacyBreachIncidentResult,
  type PrivacyConsentEventRecord,
  type PrivacyConsentResult,
  type PrivacyConsentView,
  type PrivacyDataExportFootprint,
  type PrivacyRequestListResult,
  type PrivacyRequestRecord,
  type PrivacyRequestResult,
  type PrivacyStore,
  type PrivacyUserProfileRecord,
  type RequestDataExportResult,
  type UpdatePrivacyConsentInput,
} from './privacy.types';

type MandatoryEmailDispatcher = Pick<NotificationChannels, 'sendDirectEmail'>;

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let normalized: string;
  if (typeof value === 'object') {
    normalized = JSON.stringify(value);
  } else if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    normalized = `${value}`;
  } else {
    normalized = '';
  }

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return '';
  }

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const header = columns.join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column])).join(','),
  );

  return [header, ...body].join('\n');
}

function buildExportFileName(userId: string, exportedAt: Date): string {
  return `pdpa-export-${userId}-${exportedAt.toISOString().slice(0, 10)}.zip`;
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseIsoDateString(value: string, context: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context}.`);
  }

  return parsed;
}

@Injectable()
export class PrivacyService {
  constructor(
    @Inject(PRIVACY_STORE)
    private readonly store: PrivacyStore,
    @Optional()
    @Inject(NotificationChannels)
    private readonly mandatoryEmailDispatcher?: MandatoryEmailDispatcher,
  ) {}

  async getCurrentProfile(
    userId: string,
  ): Promise<CurrentPrivacyProfileResult> {
    const profile = await this.requireProfile(userId);
    const consentEvents = await this.store.listConsentEvents(userId);
    const requests = await this.store.listPrivacyRequests(
      userId,
      PRIVACY_PROFILE_REQUEST_LIMIT,
    );

    return {
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        companyName: profile.companyName,
        mfaEnabled: profile.mfaEnabled,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
      consent: this.toConsentView(consentEvents),
      requests: requests.map((request) => this.toRequestView(request)),
    };
  }

  async getCurrentConsent(userId: string): Promise<PrivacyConsentResult> {
    await this.requireProfile(userId);
    return {
      consent: this.toConsentView(await this.store.listConsentEvents(userId)),
    };
  }

  async updateConsent(
    userId: string,
    input: UpdatePrivacyConsentInput,
  ): Promise<PrivacyConsentResult> {
    await this.requireProfile(userId);
    const createdAt = new Date();
    const event = await this.store.createConsentEvent({
      userId,
      consentType: input.type,
      granted: input.granted,
      source: input.source,
      createdAt,
    });

    return {
      consent: this.toConsentView([event]),
    };
  }

  async createRightsRequest(
    userId: string,
    input: CreatePrivacyRequestInput,
  ): Promise<PrivacyRequestResult> {
    await this.requireProfile(userId);
    const createdAt = new Date();
    const dueAt = new Date(createdAt);
    dueAt.setUTCDate(dueAt.getUTCDate() + PDPA_REQUEST_SLA_DAYS);

    const request = await this.store.createPrivacyRequest({
      userId,
      requestType: input.type,
      reason: input.reason?.trim() ?? null,
      details: input.details ?? null,
      status: PrivacyRequestStatus.PENDING,
      dueAt,
      createdAt,
    });

    return {
      request: this.toRequestView(request),
    };
  }

  async listOpenPrivacyRequests(): Promise<PrivacyRequestListResult> {
    return {
      requests: (await this.store.listOpenPrivacyRequests()).map((request) =>
        this.toRequestView(request),
      ),
    };
  }

  async fulfillPrivacyRequest(
    actorUserId: string,
    requestId: string,
  ): Promise<PrivacyRequestResult> {
    const request = await this.store.findPrivacyRequestById(requestId);
    if (request === null) {
      throw new Error('Privacy request not found.');
    }

    if (request.status === PrivacyRequestStatus.COMPLETED) {
      return {
        request: this.toRequestView(request),
      };
    }

    const completedAt = new Date();
    const resolution = await this.executeFulfillment(request, completedAt);
    const completed = await this.store.completePrivacyRequest({
      requestId,
      status: PrivacyRequestStatus.COMPLETED,
      completedAt,
      processedByUserId: actorUserId,
      resolution,
    });

    return {
      request: this.toRequestView(completed),
    };
  }

  async requestDataExport(userId: string): Promise<RequestDataExportResult> {
    await this.requireProfile(userId);
    const request = await this.createDataExportRequest(userId, new Date());

    return {
      requestId: request.id,
      estimatedReady: request.exportedAt.toISOString(),
    };
  }

  async downloadDataExport(
    userId: string,
    requestId: string,
  ): Promise<DownloadDataExportResult> {
    const request = await this.store.findDataExportRequestForUser(
      requestId,
      userId,
    );
    if (request === null) {
      throw new Error('Data export request not found.');
    }

    return {
      fileName: request.fileName,
      contentType: request.contentType,
      buffer: request.zipData,
    };
  }

  async reportBreachIncident(
    actorUserId: string,
    input: CreatePrivacyBreachIncidentInput,
  ): Promise<PrivacyBreachIncidentResult> {
    const pdpaOfficeEmail =
      process.env['PDPA_OFFICE_NOTIFICATION_EMAIL']?.trim() || '';
    if (pdpaOfficeEmail.length === 0) {
      throw new Error('PDPA office notification email is not configured.');
    }

    const affectedUserIds = dedupeStrings(input.affectedUserIds);
    if (affectedUserIds.length === 0) {
      throw new Error('At least one affected user is required.');
    }

    const affectedUsers = await this.store.listUserProfiles(affectedUserIds);
    if (affectedUsers.length !== affectedUserIds.length) {
      throw new Error('Affected users not found.');
    }

    const createdAt = new Date();
    const incident = await this.store.createBreachIncident({
      reportedByUserId: actorUserId,
      summary: input.summary.trim(),
      description: input.description.trim(),
      affectedUserIds,
      detectedAt: parseIsoDateString(input.detectedAt, 'detectedAt'),
      occurredAt:
        input.occurredAt === undefined || input.occurredAt === null
          ? null
          : parseIsoDateString(input.occurredAt, 'occurredAt'),
      createdAt,
    });

    const dispatcher = this.requireMandatoryEmailDispatcher();
    await dispatcher.sendDirectEmail({
      to: pdpaOfficeEmail,
      subject: `PDPA breach notice: ${incident.summary}`,
      message: this.buildPdpaOfficeMessage(incident, affectedUsers),
    });

    await Promise.all(
      affectedUsers.map(async (user) => {
        await dispatcher.sendDirectEmail({
          to: user.email,
          subject: `Important PDPA notice: ${incident.summary}`,
          message: this.buildAffectedUserMessage(incident, user),
        });
      }),
    );

    const notifiedAt = new Date();
    const updated = await this.store.markBreachIncidentNotifications({
      incidentId: incident.id,
      pdpaOfficeNotifiedAt: notifiedAt,
      dataSubjectsNotifiedAt: notifiedAt,
    });

    return {
      incident: this.toBreachIncidentView(updated),
    };
  }

  private async requireProfile(userId: string) {
    const profile = await this.store.getUserProfile(userId);
    if (profile === null) {
      throw new Error('User not found.');
    }

    return profile;
  }

  private requireMandatoryEmailDispatcher(): MandatoryEmailDispatcher {
    if (this.mandatoryEmailDispatcher === undefined) {
      throw new Error('Mandatory email dispatcher is not configured.');
    }

    return this.mandatoryEmailDispatcher;
  }

  private toConsentView(
    events: PrivacyConsentEventRecord[],
  ): PrivacyConsentView {
    const latest = events
      .slice()
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )[0];

    if (latest === undefined) {
      return {
        type: PrivacyConsentType.MARKETING_COMMUNICATIONS,
        granted: false,
        source: null,
        updatedAt: null,
      };
    }

    return {
      type: latest.consentType,
      granted: latest.granted,
      source: latest.source,
      updatedAt: latest.createdAt.toISOString(),
    };
  }

  private toRequestView(request: PrivacyRequestRecord) {
    return {
      id: request.id,
      type: request.requestType,
      status: request.status,
      reason: request.reason,
      details: request.details,
      dueAt: request.dueAt.toISOString(),
      completedAt: toIsoString(request.completedAt),
      processedByUserId: request.processedByUserId,
      resolution: request.resolution,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private toBreachIncidentView(incident: PrivacyBreachIncidentRecord) {
    return {
      id: incident.id,
      summary: incident.summary,
      description: incident.description,
      affectedUserIds: incident.affectedUserIds,
      detectedAt: incident.detectedAt.toISOString(),
      occurredAt: toIsoString(incident.occurredAt),
      pdpaOfficeNotifiedAt: toIsoString(incident.pdpaOfficeNotifiedAt),
      dataSubjectsNotifiedAt: toIsoString(incident.dataSubjectsNotifiedAt),
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
    };
  }

  private async executeFulfillment(
    request: PrivacyRequestRecord,
    completedAt: Date,
  ): Promise<Record<string, unknown>> {
    switch (request.requestType) {
      case PrivacyRequestType.ACCESS:
      case PrivacyRequestType.PORTABILITY: {
        const exportRequest = await this.createDataExportRequest(
          request.userId,
          completedAt,
        );
        return {
          action: 'EXPORT_READY',
          exportRequestId: exportRequest.id,
          exportedAt: exportRequest.exportedAt.toISOString(),
        };
      }
      case PrivacyRequestType.WITHDRAW_CONSENT:
      case PrivacyRequestType.OBJECTION: {
        await this.store.createConsentEvent({
          userId: request.userId,
          consentType: PrivacyConsentType.MARKETING_COMMUNICATIONS,
          granted: false,
          source: `privacy-request:${request.id}`,
          createdAt: completedAt,
        });
        return {
          action: 'CONSENT_WITHDRAWN',
          consentType: PrivacyConsentType.MARKETING_COMMUNICATIONS,
        };
      }
      case PrivacyRequestType.CORRECTION: {
        const updated = await this.store.updateUserProfile(
          request.userId,
          this.parseCorrectionDetails(request.details),
        );
        return {
          action: 'PROFILE_UPDATED',
          email: updated.email,
          companyName: updated.companyName,
        };
      }
      case PrivacyRequestType.DELETION: {
        const anonymized = await this.store.anonymizeUser(
          request.userId,
          completedAt,
        );
        return {
          action: 'ANONYMIZED',
          anonymizedEmail: anonymized.email,
        };
      }
    }
  }

  private parseCorrectionDetails(details: Record<string, unknown> | null): {
    email?: string;
    companyName?: string | null;
  } {
    if (details === null) {
      throw new Error('Correction request details are required.');
    }

    const update: {
      email?: string;
      companyName?: string | null;
    } = {};

    if (typeof details['email'] === 'string' && details['email'].trim()) {
      update.email = details['email'].trim();
    }

    if (details['companyName'] === null) {
      update.companyName = null;
    } else if (
      typeof details['companyName'] === 'string' &&
      details['companyName'].trim()
    ) {
      update.companyName = details['companyName'].trim();
    }

    if (Object.keys(update).length === 0) {
      throw new Error(
        'Correction request details are missing supported fields.',
      );
    }

    return update;
  }

  private buildPdpaOfficeMessage(
    incident: PrivacyBreachIncidentRecord,
    affectedUsers: readonly PrivacyUserProfileRecord[],
  ): string {
    return [
      `Incident ID: ${incident.id}`,
      `Summary: ${incident.summary}`,
      `Description: ${incident.description}`,
      `Detected At: ${incident.detectedAt.toISOString()}`,
      `Occurred At: ${toIsoString(incident.occurredAt) ?? 'unknown'}`,
      `Affected Users: ${affectedUsers
        .map((user) => `${user.id} <${user.email}>`)
        .join(', ')}`,
      'This notification was generated automatically by ZRL.',
    ].join('\n');
  }

  private buildAffectedUserMessage(
    incident: PrivacyBreachIncidentRecord,
    user: PrivacyUserProfileRecord,
  ): string {
    return [
      `Hello ${user.email},`,
      '',
      'We are notifying you of a personal-data incident affecting your ZRL account.',
      `Summary: ${incident.summary}`,
      `Description: ${incident.description}`,
      `Detected At: ${incident.detectedAt.toISOString()}`,
      `Occurred At: ${toIsoString(incident.occurredAt) ?? 'unknown'}`,
      '',
      'Our team has escalated the incident and notified the PDPA Office.',
    ].join('\n');
  }

  private async createDataExportRequest(
    userId: string,
    exportedAt: Date,
  ): Promise<DataExportRequestRecord> {
    await this.requireProfile(userId);
    const footprint = await this.store.getDataExportFootprint(userId);
    const archive = await this.buildExportArchive(footprint);
    return await this.store.createDataExportRequest({
      userId,
      fileName: buildExportFileName(userId, exportedAt),
      contentType: DATA_EXPORT_CONTENT_TYPE,
      zipData: archive,
      exportedAt,
    });
  }

  private async buildExportArchive(
    footprint: PrivacyDataExportFootprint,
  ): Promise<Buffer> {
    const zip = new JSZip();
    zip.file(
      'export.json',
      JSON.stringify(this.serializeFootprint(footprint), null, 2),
    );
    zip.file(
      'lanes.csv',
      rowsToCsv(footprint.lanes.map((lane) => ({ ...lane }))),
    );
    zip.file(
      'checkpoints.csv',
      rowsToCsv(footprint.checkpoints.map((checkpoint) => ({ ...checkpoint }))),
    );
    zip.file(
      'artifacts.csv',
      rowsToCsv(footprint.artifacts.map((artifact) => ({ ...artifact }))),
    );
    zip.file(
      'notifications.csv',
      rowsToCsv(
        footprint.notifications.map((notification) => ({ ...notification })),
      ),
    );
    zip.file(
      'consent-history.csv',
      rowsToCsv(
        footprint.consents.map((consent) => ({
          id: consent.id,
          type: consent.consentType,
          granted: consent.granted,
          source: consent.source,
          createdAt: consent.createdAt.toISOString(),
        })),
      ),
    );
    zip.file(
      'privacy-requests.csv',
      rowsToCsv(
        footprint.requests.map((request) => ({
          id: request.id,
          type: request.requestType,
          status: request.status,
          reason: request.reason,
          details: request.details,
          dueAt: request.dueAt.toISOString(),
          completedAt: toIsoString(request.completedAt),
          processedByUserId: request.processedByUserId,
          resolution: request.resolution,
          createdAt: request.createdAt.toISOString(),
          updatedAt: request.updatedAt.toISOString(),
        })),
      ),
    );

    return await zip.generateAsync({ type: 'nodebuffer' });
  }

  private serializeFootprint(footprint: PrivacyDataExportFootprint) {
    return {
      profile: {
        ...footprint.profile,
        createdAt: footprint.profile.createdAt.toISOString(),
        updatedAt: footprint.profile.updatedAt.toISOString(),
      },
      consents: footprint.consents.map((consent) => ({
        id: consent.id,
        userId: consent.userId,
        consentType: consent.consentType,
        granted: consent.granted,
        source: consent.source,
        createdAt: consent.createdAt.toISOString(),
      })),
      requests: footprint.requests.map((request) => ({
        id: request.id,
        userId: request.userId,
        requestType: request.requestType,
        status: request.status,
        reason: request.reason,
        details: request.details,
        dueAt: request.dueAt.toISOString(),
        completedAt: toIsoString(request.completedAt),
        processedByUserId: request.processedByUserId,
        resolution: request.resolution,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      })),
      lanes: footprint.lanes,
      checkpoints: footprint.checkpoints,
      artifacts: footprint.artifacts,
      notifications: footprint.notifications,
    };
  }
}

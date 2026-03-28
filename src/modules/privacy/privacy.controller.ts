import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/auth/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/auth/auth.guards';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { PrivacyService } from './privacy.service';
import {
  PrivacyConsentType,
  PrivacyRequestType,
  SUPPORTED_PRIVACY_CONSENT_TYPES,
  SUPPORTED_PRIVACY_REQUEST_TYPES,
  type CreatePrivacyBreachIncidentInput,
  type CreatePrivacyRequestInput,
  type UpdatePrivacyConsentInput,
} from './privacy.types';

function requireUserId(request: AuthPrincipalRequest): string {
  const userId = request.user?.id ?? request.auth?.user.id;
  if (userId === undefined) {
    throw new BadRequestException('Authentication context missing.');
  }

  return userId;
}

function assertObject(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value as Record<string, unknown>;
}

function assertString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value.trim();
}

function assertStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value.map((entry) => assertString(entry, context));
}

function assertIsoDateString(value: unknown, context: string): string {
  const normalized = assertString(value, context);
  if (Number.isNaN(new Date(normalized).getTime())) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return normalized;
}

function parseConsentType(value: unknown): PrivacyConsentType {
  const normalized = assertString(value, 'consent type').toUpperCase();
  if (
    !SUPPORTED_PRIVACY_CONSENT_TYPES.includes(normalized as PrivacyConsentType)
  ) {
    throw new BadRequestException('Unsupported consent type.');
  }

  return normalized as PrivacyConsentType;
}

function parsePrivacyRequestType(value: unknown): PrivacyRequestType {
  const normalized = assertString(value, 'request type').toUpperCase();
  if (
    !SUPPORTED_PRIVACY_REQUEST_TYPES.includes(normalized as PrivacyRequestType)
  ) {
    throw new BadRequestException('Unsupported privacy request type.');
  }

  return normalized as PrivacyRequestType;
}

function parseConsentBody(body: unknown): UpdatePrivacyConsentInput {
  const record = assertObject(body, 'consent payload');
  if (typeof record['granted'] !== 'boolean') {
    throw new BadRequestException('Invalid granted flag.');
  }

  return {
    type: parseConsentType(record['type']),
    granted: record['granted'],
    source: assertString(record['source'], 'consent source'),
  };
}

function parsePrivacyRequestBody(body: unknown): CreatePrivacyRequestInput {
  const record = assertObject(body, 'privacy request payload');
  const details =
    record['details'] === undefined
      ? null
      : assertObject(record['details'], 'privacy request details');

  return {
    type: parsePrivacyRequestType(record['type']),
    reason:
      record['reason'] === undefined
        ? null
        : assertString(record['reason'], 'privacy request reason'),
    details,
  };
}

function parseBreachIncidentBody(
  body: unknown,
): CreatePrivacyBreachIncidentInput {
  const record = assertObject(body, 'breach incident payload');

  return {
    summary: assertString(record['summary'], 'breach summary'),
    description: assertString(record['description'], 'breach description'),
    affectedUserIds: assertStringArray(
      record['affectedUserIds'],
      'affected user ids',
    ),
    detectedAt: assertIsoDateString(record['detectedAt'], 'detectedAt'),
    occurredAt:
      record['occurredAt'] === undefined || record['occurredAt'] === null
        ? null
        : assertIsoDateString(record['occurredAt'], 'occurredAt'),
  };
}

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get()
  async getCurrentProfile(@Req() request: AuthPrincipalRequest) {
    return await this.privacyService.getCurrentProfile(requireUserId(request));
  }

  @Get('consent')
  async getCurrentConsent(@Req() request: AuthPrincipalRequest) {
    return await this.privacyService.getCurrentConsent(requireUserId(request));
  }

  @Post('consent')
  async updateConsent(
    @Req() request: AuthPrincipalRequest,
    @Body() body: unknown,
  ) {
    return await this.privacyService.updateConsent(
      requireUserId(request),
      parseConsentBody(body),
    );
  }

  @Post('privacy-requests')
  async createRightsRequest(
    @Req() request: AuthPrincipalRequest,
    @Body() body: unknown,
  ) {
    return await this.privacyService.createRightsRequest(
      requireUserId(request),
      parsePrivacyRequestBody(body),
    );
  }

  @Post('data-export')
  async requestDataExport(@Req() request: AuthPrincipalRequest) {
    return await this.privacyService.requestDataExport(requireUserId(request));
  }

  @Get('data-export/:requestId')
  async downloadDataExport(
    @Req() request: AuthPrincipalRequest,
    @Param('requestId') requestId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.privacyService.downloadDataExport(
      requireUserId(request),
      requestId,
    );
    response.setHeader('Content-Type', download.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${download.fileName}"`,
    );

    return new StreamableFile(download.buffer);
  }
}

@Controller('privacy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PrivacyAdminController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('requests')
  async listOpenPrivacyRequests() {
    return await this.privacyService.listOpenPrivacyRequests();
  }

  @Post('requests/:requestId/fulfill')
  async fulfillPrivacyRequest(
    @Req() request: AuthPrincipalRequest,
    @Param('requestId') requestId: string,
  ) {
    return await this.privacyService.fulfillPrivacyRequest(
      requireUserId(request),
      requestId,
    );
  }

  @Post('breach-incidents')
  async reportBreachIncident(
    @Req() request: AuthPrincipalRequest,
    @Body() body: unknown,
  ) {
    return await this.privacyService.reportBreachIncident(
      requireUserId(request),
      parseBreachIncidentBody(body),
    );
  }
}

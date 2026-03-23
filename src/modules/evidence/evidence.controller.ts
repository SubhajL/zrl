import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { extname } from 'node:path';
import {
  ApiKeyAuthGuard,
  AuditorReadOnlyGuard,
  JwtAuthGuard,
  LaneOwnerGuard,
} from '../../common/auth/auth.guards';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { ArtifactSource, type EvidenceArtifactType } from './evidence.types';
import { EvidenceService } from './evidence.service';

const FILE_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;

interface UploadedMultipartFile {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

type DiskStorageFactory = (options: {
  destination: string;
  filename: (
    request: unknown,
    file: { originalname: string },
    callback: (error: Error | null, filename: string) => void,
  ) => void;
}) => unknown;

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

function assertOptionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Expected string.');
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function parseArtifactType(value: unknown): EvidenceArtifactType {
  const normalized = assertString(value, 'artifactType').toUpperCase();
  const allowed = [
    'MRL_TEST',
    'VHT_CERT',
    'PHYTO_CERT',
    'CHECKPOINT_PHOTO',
    'TEMP_DATA',
    'HANDOFF_SIGNATURE',
    'INVOICE',
    'GAP_CERT',
  ];

  if (!allowed.includes(normalized)) {
    throw new BadRequestException('Unsupported artifact type.');
  }

  return normalized as EvidenceArtifactType;
}

function parseSource(value: unknown): ArtifactSource {
  if (value === undefined) {
    return ArtifactSource.UPLOAD;
  }

  const normalized = assertString(value, 'source').toUpperCase();
  if (!Object.values(ArtifactSource).includes(normalized as ArtifactSource)) {
    throw new BadRequestException('Unsupported artifact source.');
  }

  return normalized as ArtifactSource;
}

function parseInteger(value: unknown, context: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return numeric;
}

function parseJsonObject(
  value: unknown,
  context: string,
): Record<string, unknown> | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  try {
    return assertObject(JSON.parse(value), context);
  } catch {
    throw new BadRequestException(`Invalid ${context}.`);
  }
}

function parseLinks(
  value: unknown,
): Array<{ targetArtifactId: string; relationshipType: string }> {
  if (value === undefined) {
    return [];
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Invalid links.');
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected array.');
    }

    return parsed.map((entry) => {
      const record = assertObject(entry, 'links entry');
      return {
        targetArtifactId: assertString(
          record['targetArtifactId'],
          'links.targetArtifactId',
        ),
        relationshipType: assertString(
          record['relationshipType'],
          'links.relationshipType',
        ),
      };
    });
  } catch {
    throw new BadRequestException('Invalid links.');
  }
}

function createUploadInterceptor() {
  const typedDiskStorage = diskStorage as DiskStorageFactory;

  return FileInterceptor('file', {
    storage: typedDiskStorage({
      destination: tmpdir(),
      filename: (
        _request: unknown,
        file: { originalname: string },
        callback: (error: Error | null, filename: string) => void,
      ) => {
        callback(null, `${randomUUID()}${extname(file.originalname)}`);
      },
    }),
    limits: {
      fileSize: FILE_SIZE_LIMIT_BYTES,
    },
  });
}

@Controller()
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get('lanes/:id/evidence')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  async listLaneEvidence(
    @Param('id') laneId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return await this.evidenceService.listLaneArtifacts(laneId, {
      type:
        query['type'] === undefined
          ? undefined
          : parseArtifactType(query['type']),
      status:
        query['status'] === undefined
          ? undefined
          : (assertString(query['status'], 'status').toUpperCase() as
              | 'PENDING'
              | 'VERIFIED'
              | 'FAILED'),
      page: parseInteger(query['page'], 'page'),
      limit: parseInteger(query['limit'], 'limit'),
    });
  }

  @Post('lanes/:id/evidence')
  @UseGuards(JwtAuthGuard, AuditorReadOnlyGuard, LaneOwnerGuard)
  @UseInterceptors(createUploadInterceptor())
  async uploadLaneEvidence(
    @Param('id') laneId: string,
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthPrincipalRequest,
  ) {
    if (file === undefined) {
      throw new BadRequestException('File upload is required.');
    }

    return await this.evidenceService.uploadArtifact(
      {
        laneId,
        artifactType: parseArtifactType(body['artifactType']),
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        tempFilePath: file.path,
        source: parseSource(body['source']),
        checkpointId: assertOptionalString(body['checkpointId']) ?? null,
        metadata: parseJsonObject(body['metadata'], 'metadata'),
        links: parseLinks(body['links']),
      },
      request.user!,
    );
  }

  @Get('lanes/:id/evidence/graph')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  async getLaneEvidenceGraph(@Param('id') laneId: string) {
    return await this.evidenceService.getLaneGraph(laneId);
  }

  @Get('evidence/:id')
  @UseGuards(JwtAuthGuard)
  async getArtifact(
    @Param('id') artifactId: string,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.evidenceService.getArtifact(artifactId, request.user!);
  }

  @Get('evidence/:id/verify')
  @UseGuards(JwtAuthGuard)
  async verifyArtifact(
    @Param('id') artifactId: string,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.evidenceService.verifyArtifact(artifactId, request.user!);
  }

  @Delete('evidence/:id')
  @UseGuards(JwtAuthGuard, AuditorReadOnlyGuard)
  async deleteArtifact(
    @Param('id') artifactId: string,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.evidenceService.deleteArtifact(artifactId, request.user!);
  }

  @Post('partner/lab/results')
  @UseGuards(ApiKeyAuthGuard)
  async createPartnerLabArtifact(
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const payload = parsePartnerArtifactBody(body);
    assertPartnerLaneScope(request, payload.laneId);

    return await this.evidenceService.createPartnerLabArtifact(
      payload,
      request.auth!.user,
    );
  }

  @Post('partner/logistics/temperature')
  @UseGuards(ApiKeyAuthGuard)
  async createPartnerTemperatureArtifact(
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const payload = parsePartnerArtifactBody(body);
    assertPartnerLaneScope(request, payload.laneId);

    return await this.evidenceService.createPartnerTemperatureArtifact(
      payload,
      request.auth!.user,
    );
  }
}

function parsePartnerArtifactBody(body: unknown) {
  const record = assertObject(body, 'partner payload');

  return {
    laneId: assertString(record['laneId'], 'laneId'),
    issuer: assertOptionalString(record['issuer']),
    issuedAt: assertOptionalString(record['issuedAt']),
    payload: record,
  };
}

function assertPartnerLaneScope(
  request: AuthPrincipalRequest,
  laneId: string,
): void {
  if (request.auth?.kind !== 'api-key') {
    throw new ForbiddenException('Partner API key required.');
  }

  const scopes = request.auth.apiKey.scopes.map((scope) =>
    scope.trim().toLowerCase(),
  );
  const allowed =
    scopes.includes('*') ||
    scopes.includes('lane:*') ||
    scopes.includes('lane:write') ||
    scopes.includes(`lane:${laneId.toLowerCase()}`);

  if (!allowed) {
    throw new ForbiddenException('Partner scope required.');
  }
}

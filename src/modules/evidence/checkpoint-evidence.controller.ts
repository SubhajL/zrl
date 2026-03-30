import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { JwtAuthGuard, LaneOwnerGuard } from '../../common/auth/auth.guards';
import { ArtifactSource } from './evidence.types';
import { EvidenceService } from './evidence.service';
import { LaneService } from '../lane/lane.service';
import type { CreateCheckpointInput } from '../lane/lane.types';

const CHECKPOINT_FILE_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;

interface UploadedMultipartFile {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

interface UploadedCheckpointFiles {
  photo?: UploadedMultipartFile[];
  signature?: UploadedMultipartFile[];
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

function parseNumberLike(value: unknown, context: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  throw new BadRequestException(`Invalid ${context}.`);
}

function parseOptionalNumberLike(
  value: unknown,
  context: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseNumberLike(value, context);
}

function parsePositiveIntegerLike(value: unknown, context: string): number {
  const numeric = parseNumberLike(value, context);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return numeric;
}

function parseDate(value: unknown, context: string): Date {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return parsed;
}

function parseCreateCheckpointInput(body: unknown): {
  sequence: number;
  locationName?: string;
  timestamp?: Date;
  temperature: number;
  gpsLat?: number;
  gpsLng?: number;
  signerName: string;
  conditionNotes?: string;
} {
  const record = assertObject(body, 'checkpoint create payload');

  return {
    sequence: parsePositiveIntegerLike(record['sequence'], 'sequence'),
    locationName: assertOptionalString(record['locationName']),
    timestamp:
      record['timestamp'] === undefined
        ? undefined
        : parseDate(record['timestamp'], 'timestamp'),
    temperature: parseNumberLike(record['temperature'], 'temperature'),
    gpsLat: parseOptionalNumberLike(record['gpsLat'], 'gpsLat'),
    gpsLng: parseOptionalNumberLike(record['gpsLng'], 'gpsLng'),
    signerName: assertString(record['signerName'], 'signerName'),
    conditionNotes: assertOptionalString(record['conditionNotes']),
  };
}

function getMetadataNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getMetadataDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function createCheckpointUploadInterceptor() {
  const typedDiskStorage = diskStorage as DiskStorageFactory;

  return FileFieldsInterceptor(
    [
      { name: 'photo', maxCount: 1 },
      { name: 'signature', maxCount: 1 },
    ],
    {
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
        fileSize: CHECKPOINT_FILE_SIZE_LIMIT_BYTES,
        files: 2,
      },
    },
  );
}

@Controller('lanes')
@UseGuards(JwtAuthGuard)
export class CheckpointEvidenceController {
  constructor(
    private readonly laneService: LaneService,
    private readonly evidenceService: EvidenceService,
  ) {}

  @Post(':id/checkpoints')
  @UseGuards(LaneOwnerGuard)
  @UseInterceptors(createCheckpointUploadInterceptor())
  async createCheckpoint(
    @Param('id') laneId: string,
    @UploadedFiles() files: UploadedCheckpointFiles | undefined,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const input = parseCreateCheckpointInput(body);
    const photo = files?.photo?.[0];
    const signature = files?.signature?.[0];

    if (photo === undefined) {
      throw new BadRequestException('Checkpoint photo upload is required.');
    }

    if (signature === undefined) {
      throw new BadRequestException('Checkpoint signature upload is required.');
    }

    let checkpoint = (await this.laneService.getCheckpoints(laneId)).find(
      (entry) => entry.sequence === input.sequence,
    );

    if (checkpoint === undefined) {
      if (input.locationName === undefined) {
        throw new BadRequestException(
          'locationName is required when checkpoint sequence is not preconfigured.',
        );
      }

      checkpoint = await this.laneService.createCheckpoint(
        laneId,
        {
          sequence: input.sequence,
          locationName: input.locationName,
        } satisfies CreateCheckpointInput,
        request.user!,
      );
    }

    try {
      const photoArtifact = await this.evidenceService.uploadArtifact(
        {
          laneId,
          artifactType: 'CHECKPOINT_PHOTO',
          fileName: photo.originalname,
          mimeType: photo.mimetype,
          fileSizeBytes: photo.size,
          tempFilePath: photo.path,
          source: ArtifactSource.CAMERA,
          checkpointId: checkpoint.id,
          metadata: {
            sequence: input.sequence,
            locationName: checkpoint.locationName,
            signerName: input.signerName,
            conditionNotes: input.conditionNotes ?? null,
          },
          links: [],
        },
        request.user!,
      );
      const signatureArtifact = await this.evidenceService.uploadArtifact(
        {
          laneId,
          artifactType: 'HANDOFF_SIGNATURE',
          fileName: signature.originalname,
          mimeType: signature.mimetype,
          fileSizeBytes: signature.size,
          tempFilePath: signature.path,
          source: ArtifactSource.UPLOAD,
          checkpointId: checkpoint.id,
          metadata: {
            sequence: input.sequence,
            locationName: checkpoint.locationName,
            signerName: input.signerName,
          },
          links: [],
        },
        request.user!,
      );
      const photoMetadata = photoArtifact.artifact.metadata ?? {};

      return {
        checkpoint: await this.laneService.updateCheckpoint(
          laneId,
          checkpoint.id,
          {
            status: 'COMPLETED',
            timestamp:
              input.timestamp ??
              getMetadataDate(photoMetadata['capturedAt']) ??
              getMetadataDate(photoMetadata['exifTimestamp']) ??
              new Date(),
            temperature: input.temperature,
            gpsLat: input.gpsLat ?? getMetadataNumber(photoMetadata['gpsLat']),
            gpsLng: input.gpsLng ?? getMetadataNumber(photoMetadata['gpsLng']),
            signatureHash: signatureArtifact.artifact.contentHash,
            signerName: input.signerName,
            conditionNotes: input.conditionNotes,
          },
          request.user!,
        ),
      };
    } finally {
      await Promise.all(
        [photo.path, signature.path].map(async (filePath) => {
          await rm(filePath, { force: true }).catch(() => undefined);
        }),
      );
    }
  }
}

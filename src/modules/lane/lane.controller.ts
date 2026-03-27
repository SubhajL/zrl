import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import {
  CheckpointOwnerGuard,
  JwtAuthGuard,
  LaneOwnerGuard,
} from '../../common/auth/auth.guards';
import { ArtifactSource } from '../evidence/evidence.types';
import { EvidenceService } from '../evidence/evidence.service';
import { LaneService } from './lane.service';
import type {
  CreateCheckpointInput,
  CreateLaneInput,
  LaneListQuery,
  LaneColdChainConfigInput,
  LaneMarket,
  LaneColdChainMode,
  LaneProduct,
  LaneStatus,
  LaneTransportMode,
  TransitionLaneInput,
  UpdateCheckpointInput,
  UpdateLaneInput,
} from './lane.types';

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

function assertNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value;
}

function assertOptionalNumber(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException('Expected numeric value.');
  }

  return value;
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

function parseTransportMode(value: unknown): LaneTransportMode {
  const normalized = assertString(value, 'route.transportMode').toUpperCase();
  if (!['AIR', 'SEA', 'TRUCK'].includes(normalized)) {
    throw new BadRequestException('Unsupported transport mode.');
  }

  return normalized as LaneTransportMode;
}

function parseMarket(value: unknown): LaneMarket {
  const normalized = assertString(value, 'destination.market').toUpperCase();
  if (!['JAPAN', 'CHINA', 'KOREA', 'EU'].includes(normalized)) {
    throw new BadRequestException('Unsupported destination market.');
  }

  return normalized as LaneMarket;
}

function parseProduct(value: unknown): LaneProduct {
  const normalized = assertString(value, 'product').toUpperCase();
  if (!['MANGO', 'DURIAN', 'MANGOSTEEN', 'LONGAN'].includes(normalized)) {
    throw new BadRequestException('Unsupported product.');
  }

  return normalized as LaneProduct;
}

function parseColdChainMode(value: unknown): LaneColdChainMode {
  const normalized = assertString(value, 'coldChainMode').toUpperCase();
  if (!['MANUAL', 'LOGGER', 'TELEMETRY'].includes(normalized)) {
    throw new BadRequestException('Unsupported cold-chain mode.');
  }

  return normalized as Exclude<LaneColdChainMode, null>;
}

function parseStatus(value: unknown): LaneStatus {
  const normalized = assertString(value, 'status').toUpperCase();
  if (
    ![
      'CREATED',
      'EVIDENCE_COLLECTING',
      'VALIDATED',
      'PACKED',
      'CLOSED',
      'INCOMPLETE',
      'CLAIM_DEFENSE',
      'DISPUTE_RESOLVED',
      'ARCHIVED',
    ].includes(normalized)
  ) {
    throw new BadRequestException('Unsupported lane status.');
  }

  return normalized as LaneStatus;
}

function parseGpsPoint(value: unknown, context: string) {
  const record = assertObject(value, context);
  return {
    lat: assertNumber(record['lat'], `${context}.lat`),
    lng: assertNumber(record['lng'], `${context}.lng`),
  };
}

function parseColdChainConfig(
  value: unknown,
  context: string,
): LaneColdChainConfigInput {
  const record = assertObject(value, context);

  return {
    mode: parseColdChainMode(record['mode']) as Exclude<
      LaneColdChainMode,
      null
    >,
    deviceId: assertOptionalString(record['deviceId']),
    dataFrequencySeconds: assertOptionalNumber(record['dataFrequencySeconds']),
  };
}

function parseCreateLaneInput(body: unknown): CreateLaneInput {
  const record = assertObject(body, 'lane payload');
  const batch = assertObject(record['batch'], 'batch');
  const destination = assertObject(record['destination'], 'destination');
  const route = assertObject(record['route'], 'route');
  const coldChainMode =
    record['coldChainMode'] === undefined
      ? undefined
      : parseColdChainMode(record['coldChainMode']);
  const coldChainConfig =
    record['coldChainConfig'] === undefined
      ? undefined
      : parseColdChainConfig(record['coldChainConfig'], 'coldChainConfig');

  if (
    coldChainMode !== undefined &&
    coldChainConfig !== undefined &&
    coldChainMode !== coldChainConfig.mode
  ) {
    throw new BadRequestException(
      'coldChainMode must match coldChainConfig.mode when both are provided.',
    );
  }

  return {
    product: parseProduct(record['product']),
    batch: {
      variety: assertOptionalString(batch['variety']),
      quantityKg: assertNumber(batch['quantityKg'], 'batch.quantityKg'),
      originProvince: assertString(
        batch['originProvince'],
        'batch.originProvince',
      ),
      harvestDate: parseDate(batch['harvestDate'], 'batch.harvestDate'),
      grade: assertString(batch['grade'], 'batch.grade').toUpperCase() as
        | 'PREMIUM'
        | 'A'
        | 'B',
    },
    destination: {
      market: parseMarket(destination['market']),
    },
    route: {
      transportMode: parseTransportMode(route['transportMode']),
      carrier: assertOptionalString(route['carrier']),
      originGps:
        route['originGps'] === undefined
          ? undefined
          : parseGpsPoint(route['originGps'], 'route.originGps'),
      destinationGps:
        route['destinationGps'] === undefined
          ? undefined
          : parseGpsPoint(route['destinationGps'], 'route.destinationGps'),
      estimatedTransitHours: assertOptionalNumber(
        route['estimatedTransitHours'],
      ),
    },
    coldChainMode,
    coldChainConfig,
  };
}

function parseUpdateLaneInput(body: unknown): UpdateLaneInput {
  const record = assertObject(body, 'lane update payload');
  const result: UpdateLaneInput = {};

  if (record['coldChainMode'] !== undefined) {
    result.coldChainMode =
      record['coldChainMode'] === null
        ? null
        : parseColdChainMode(record['coldChainMode']);
  }

  if (record['coldChainConfig'] !== undefined) {
    result.coldChainConfig = parseColdChainConfig(
      record['coldChainConfig'],
      'coldChainConfig',
    );
  }

  if (
    result.coldChainMode !== undefined &&
    result.coldChainMode !== null &&
    result.coldChainConfig !== undefined &&
    result.coldChainMode !== result.coldChainConfig.mode
  ) {
    throw new BadRequestException(
      'coldChainMode must match coldChainConfig.mode when both are provided.',
    );
  }

  if (record['batch'] !== undefined) {
    const batch = assertObject(record['batch'], 'batch');
    result.batch = {
      variety: assertOptionalString(batch['variety']),
      quantityKg: assertOptionalNumber(batch['quantityKg']),
      originProvince: assertOptionalString(batch['originProvince']),
      harvestDate:
        batch['harvestDate'] === undefined
          ? undefined
          : parseDate(batch['harvestDate'], 'batch.harvestDate'),
      grade:
        batch['grade'] === undefined
          ? undefined
          : (assertString(batch['grade'], 'batch.grade').toUpperCase() as
              | 'PREMIUM'
              | 'A'
              | 'B'),
    };
  }

  if (record['route'] !== undefined) {
    const route = assertObject(record['route'], 'route');
    result.route = {
      transportMode:
        route['transportMode'] === undefined
          ? undefined
          : parseTransportMode(route['transportMode']),
      carrier: assertOptionalString(route['carrier']),
      originGps:
        route['originGps'] === undefined
          ? undefined
          : parseGpsPoint(route['originGps'], 'route.originGps'),
      destinationGps:
        route['destinationGps'] === undefined
          ? undefined
          : parseGpsPoint(route['destinationGps'], 'route.destinationGps'),
      estimatedTransitHours: assertOptionalNumber(
        route['estimatedTransitHours'],
      ),
    };
  }

  return result;
}

function parseListQuery(query: Record<string, unknown>): LaneListQuery {
  const parsed: LaneListQuery = {};

  if (query['page'] !== undefined) {
    const page = Number(query['page']);
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Invalid page.');
    }
    parsed.page = page;
  }

  if (query['limit'] !== undefined) {
    const limit = Number(query['limit']);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Invalid limit.');
    }
    parsed.limit = limit;
  }

  if (query['status'] !== undefined) {
    parsed.status = parseStatus(query['status']);
  }

  if (query['product'] !== undefined) {
    parsed.product = parseProduct(query['product']);
  }

  if (query['market'] !== undefined) {
    parsed.market = parseMarket(query['market']);
  }

  return parsed;
}

function parseTransitionLaneInput(body: unknown): TransitionLaneInput {
  const record = assertObject(body, 'lane transition payload');

  return {
    targetStatus: parseStatus(record['targetStatus']),
  };
}

function parseCheckpointStatus(
  value: unknown,
): 'PENDING' | 'COMPLETED' | 'OVERDUE' {
  const normalized = assertString(value, 'status').toUpperCase();
  if (!['PENDING', 'COMPLETED', 'OVERDUE'].includes(normalized)) {
    throw new BadRequestException('Unsupported checkpoint status.');
  }

  return normalized as 'PENDING' | 'COMPLETED' | 'OVERDUE';
}

function parseUpdateCheckpointInput(body: unknown): UpdateCheckpointInput {
  const record = assertObject(body, 'checkpoint update payload');
  const result: UpdateCheckpointInput = {};

  if (record['status'] !== undefined) {
    result.status = parseCheckpointStatus(record['status']);
  }

  if (record['timestamp'] !== undefined) {
    result.timestamp = parseDate(record['timestamp'], 'timestamp');
  }

  if (record['temperature'] !== undefined) {
    result.temperature = assertNumber(record['temperature'], 'temperature');
  }

  if (record['gpsLat'] !== undefined) {
    result.gpsLat = assertNumber(record['gpsLat'], 'gpsLat');
  }

  if (record['gpsLng'] !== undefined) {
    result.gpsLng = assertNumber(record['gpsLng'], 'gpsLng');
  }

  if (record['signatureHash'] !== undefined) {
    result.signatureHash = assertOptionalString(record['signatureHash']);
  }

  if (record['signerName'] !== undefined) {
    result.signerName = assertOptionalString(record['signerName']);
  }

  if (record['conditionNotes'] !== undefined) {
    result.conditionNotes = assertOptionalString(record['conditionNotes']);
  }

  return result;
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

@Controller('lanes')
@UseGuards(JwtAuthGuard)
export class LaneController {
  constructor(
    private readonly laneService: LaneService,
    private readonly evidenceService: EvidenceService,
  ) {}

  @Post()
  async create(@Body() body: unknown, @Req() request: AuthPrincipalRequest) {
    return await this.laneService.create(
      parseCreateLaneInput(body),
      request.user!,
    );
  }

  @Get()
  async findAll(
    @Query() query: Record<string, unknown>,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.laneService.findAll(parseListQuery(query), request.user!);
  }

  @Get(':id')
  @UseGuards(LaneOwnerGuard)
  async findById(@Param('id') id: string) {
    return await this.laneService.findById(id);
  }

  @Patch(':id')
  @UseGuards(LaneOwnerGuard)
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.laneService.update(
      id,
      parseUpdateLaneInput(body),
      request.user!,
    );
  }

  @Post(':id/transition')
  @UseGuards(LaneOwnerGuard)
  async transition(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.laneService.transition(
      id,
      parseTransitionLaneInput(body),
      request.user!,
    );
  }

  @Get(':id/completeness')
  @UseGuards(LaneOwnerGuard)
  async getCompleteness(@Param('id') id: string) {
    return await this.laneService.getCompleteness(id);
  }

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

  @Get(':id/checkpoints')
  @UseGuards(LaneOwnerGuard)
  async getCheckpoints(@Param('id') laneId: string) {
    return { checkpoints: await this.laneService.getCheckpoints(laneId) };
  }

  @Patch(':id/checkpoints/:checkpointId')
  @UseGuards(LaneOwnerGuard)
  async updateCheckpoint(
    @Param('id') laneId: string,
    @Param('checkpointId') checkpointId: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    return {
      checkpoint: await this.laneService.updateCheckpoint(
        laneId,
        checkpointId,
        parseUpdateCheckpointInput(body),
        request.user!,
      ),
    };
  }

  @Get(':id/timeline')
  @UseGuards(LaneOwnerGuard)
  async getTimeline(@Param('id') laneId: string) {
    return { events: await this.laneService.getTimeline(laneId) };
  }
}

@Controller('checkpoints')
export class CheckpointController {
  constructor(private readonly laneService: LaneService) {}

  @Get(':cpId')
  @UseGuards(JwtAuthGuard, CheckpointOwnerGuard)
  async getCheckpoint(@Param('cpId') checkpointId: string) {
    return {
      checkpoint: await this.laneService.getCheckpointById(checkpointId),
    };
  }
}

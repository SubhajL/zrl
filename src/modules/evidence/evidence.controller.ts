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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
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
  PackOwnerGuard,
  RolesGuard,
} from '../../common/auth/auth.guards';
import { Roles } from '../../common/auth/auth.decorators';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { LaneService } from '../lane/lane.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { ArtifactSource, type EvidenceArtifactType } from './evidence.types';
import { EvidenceService } from './evidence.service';
import { ProofPackService } from './proof-pack.service';
import { ProofPackWorkerService } from './proof-pack.worker';
import type { ProofPackTemplateData, ProofPackType } from './proof-pack.types';

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

const VALID_PACK_TYPES: readonly ProofPackType[] = [
  'REGULATOR',
  'BUYER',
  'DEFENSE',
];

function parsePackType(value: unknown): ProofPackType {
  const normalized = assertString(value, 'packType').toUpperCase();
  if (!VALID_PACK_TYPES.includes(normalized as ProofPackType)) {
    throw new BadRequestException(
      'Invalid packType. Must be REGULATOR, BUYER, or DEFENSE.',
    );
  }

  return normalized as ProofPackType;
}

@Controller()
export class EvidenceController {
  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly proofPackService: ProofPackService,
    private readonly proofPackWorkerService: ProofPackWorkerService,
    private readonly laneService: LaneService,
    private readonly rulesEngineService: RulesEngineService,
    private readonly auditService: AuditService,
  ) {}

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

  @Post('lanes/:id/evidence/graph/verify')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  async verifyLaneEvidenceGraph(
    @Param('id') laneId: string,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.evidenceService.verifyLaneGraph(laneId, request.user!);
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

  @Post('lanes/:id/packs/generate')
  @UseGuards(JwtAuthGuard, AuditorReadOnlyGuard, LaneOwnerGuard)
  async generatePack(
    @Param('id') laneId: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.enqueuePackGeneration(laneId, body, request);
  }

  @Post('lanes/:id/packs')
  @UseGuards(JwtAuthGuard, AuditorReadOnlyGuard, LaneOwnerGuard)
  async generatePackLegacy(
    @Param('id') laneId: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.enqueuePackGeneration(laneId, body, request);
  }

  private async enqueuePackGeneration(
    laneId: string,
    body: unknown,
    request: AuthPrincipalRequest,
  ) {
    const payload = assertObject(body, 'pack generation payload');
    const packType = parsePackType(payload['packType']);

    const { lane } = await this.laneService.findById(laneId);

    // C1 fix: Enforce completeness ≥ 95% before pack generation
    if (lane.completenessScore < 95) {
      throw new BadRequestException(
        `Lane completeness must be at least 95% to generate proof packs. Current: ${lane.completenessScore}%`,
      );
    }

    const artifacts = await this.evidenceService.listLaneArtifacts(laneId, {});

    let checklistItems: ProofPackTemplateData['checklistItems'] = [];
    let labResults: ProofPackTemplateData['labResults'] = null;

    if (lane.ruleSnapshot !== null) {
      const artifactsForEval = artifacts.artifacts.map((a) => ({
        id: a.id,
        artifactType: a.artifactType,
        fileName: a.fileName,
        metadata: a.metadata,
      }));
      const evaluation = this.rulesEngineService.evaluateLane(
        {
          market: lane.ruleSnapshot.market,
          product: lane.ruleSnapshot.product,
          version: lane.ruleSnapshot.version,
          effectiveDate: new Date(),
          sourcePath: lane.ruleSnapshot.rules.sourcePath ?? '',
          requiredDocuments: lane.ruleSnapshot.rules.requiredDocuments ?? [],
          completenessWeights: lane.ruleSnapshot.rules.completenessWeights ?? {
            regulatory: 0.4,
            quality: 0.25,
            coldChain: 0.2,
            chainOfCustody: 0.15,
          },
          substances: lane.ruleSnapshot.rules.substances ?? [],
        },
        artifactsForEval,
      );

      checklistItems = evaluation.checklist.map((item) => ({
        label: item.label,
        category: item.category,
        status: item.status,
      }));

      if (evaluation.labValidation !== null) {
        // H2 fix: Look up thaiMrl from rule snapshot substances
        const substanceMap = new Map(
          (lane.ruleSnapshot?.rules?.substances ?? []).map((s) => [
            s.name.toLowerCase(),
            s.thaiMrl,
          ]),
        );
        labResults = evaluation.labValidation.results.map((result) => ({
          substance: result.substance,
          thaiMrl: substanceMap.get(result.substance.toLowerCase()) ?? 0,
          destinationMrl: result.limitMgKg,
          measuredValue: result.valueMgKg,
          status: result.status,
        }));
      }
    }

    const checkpoints: ProofPackTemplateData['checkpoints'] =
      lane.checkpoints.map((cp) => ({
        sequence: cp.sequence,
        location: cp.locationName,
        status: cp.status,
        timestamp: cp.timestamp !== null ? cp.timestamp.toISOString() : null,
        temperature: cp.temperature,
        signer: cp.signerName,
      }));

    let auditEntries: ProofPackTemplateData['auditEntries'] | undefined;
    if (packType === 'REGULATOR' || packType === 'DEFENSE') {
      const entries = await this.auditService.getEntriesForLane(laneId);
      auditEntries = entries.map((entry) => ({
        timestamp: entry.timestamp.toISOString(),
        actor: entry.actor,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entryHash: entry.entryHash,
      }));
    }

    const templateData: ProofPackTemplateData = {
      laneId: lane.laneId,
      batchId: lane.batch?.batchId ?? '',
      product: lane.productType,
      market: lane.destinationMarket,
      variety: lane.batch?.variety ?? null,
      quantity: lane.batch?.quantityKg ?? 0,
      grade: lane.batch?.grade ?? '',
      origin: lane.batch?.originProvince ?? '',
      harvestDate: lane.batch?.harvestDate?.toISOString().split('T')[0] ?? '',
      transportMode: lane.route?.transportMode ?? '',
      carrier: lane.route?.carrier ?? null,
      completeness: lane.completenessScore,
      status: lane.status,
      checklistItems,
      labResults,
      checkpoints,
      auditEntries,
      generatedAt: new Date().toISOString(),
      packType,
    };

    const pack = await this.proofPackService.generatePack(
      {
        laneId: lane.id,
        packType,
        generatedBy: request.user!.id,
      },
      templateData,
    );

    return { pack };
  }

  @Get('lanes/:id/packs')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  async listPacks(@Param('id') laneId: string) {
    return { packs: await this.proofPackService.listPacks(laneId) };
  }

  @Get('packs/jobs/metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AUDITOR')
  async getPackJobMetrics() {
    return { metrics: await this.proofPackWorkerService.getJobMetrics() };
  }

  @Get('packs/:id')
  @UseGuards(JwtAuthGuard, PackOwnerGuard)
  async getPack(@Param('id') packId: string) {
    return { pack: await this.proofPackService.getPackById(packId) };
  }

  @Get('packs/:id/verify')
  async verifyPack(@Param('id') packId: string) {
    return await this.proofPackService.verifyPack(packId);
  }

  @Get('packs/:id/download')
  @UseGuards(JwtAuthGuard, PackOwnerGuard)
  async downloadPack(
    @Param('id') packId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { pack, stream } =
      await this.proofPackService.getPackDownload(packId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="proof-pack-${pack.id}.pdf"`,
    );

    return new StreamableFile(stream);
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

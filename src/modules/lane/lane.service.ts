import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import { AuditService } from '../../common/audit/audit.service';
import { HashingService } from '../../common/hashing/hashing.service';
import { ColdChainService } from '../cold-chain/cold-chain.service';
import { RealtimeEventsService } from '../notifications/realtime-events.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import type { RuleLaneArtifact } from '../rules-engine/rules-engine.types';
import {
  DEFAULT_LANE_LIMIT,
  DEFAULT_LANE_PAGE,
  MAX_LANE_LIMIT,
} from './lane.constants';
import {
  validateTransitionGraph,
  validateTransitionGuards,
  getAutomaticTransitionTarget,
  type TransitionViolation,
} from './lane.transition-policy';
import type {
  CreateCheckpointInput,
  CreateLaneInput,
  LaneReconciler,
  LaneStatus,
  LaneColdChainMode,
  LaneListQuery,
  LaneListResult,
  LaneRequestUser,
  LaneRuleSnapshotResolver,
  LaneStore,
  LaneDetail,
  LaneTimelineEvent,
  LaneTimelineEventMetadata,
  TransitionLaneInput,
  UpdateCheckpointInput,
  UpdateLaneInput,
} from './lane.types';

function padSequence(sequence: number): string {
  return String(sequence).padStart(3, '0');
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  UPLOAD: 'Uploaded',
  SIGN: 'Signed',
  GENERATE: 'Generated',
  VERIFY: 'Verified',
};
const ENTITY_LABELS: Record<string, string> = {
  LANE: 'lane',
  ARTIFACT: 'evidence artifact',
  CHECKPOINT: 'checkpoint',
  PROOF_PACK: 'proof pack',
  RULE_SET: 'rule set',
  SUBSTANCE: 'substance',
};

function describeAuditEntry(action: string, entityType: string): string {
  return `${ACTION_LABELS[action] ?? action} ${ENTITY_LABELS[entityType] ?? entityType}`;
}

function productCode(product: CreateLaneInput['product']): string {
  switch (product) {
    case 'MANGO':
      return 'MNG';
    case 'DURIAN':
      return 'DUR';
    case 'MANGOSTEEN':
      return 'MGS';
    case 'LONGAN':
      return 'LNG';
  }
}

function marketCode(market: CreateLaneInput['destination']['market']): string {
  switch (market) {
    case 'JAPAN':
      return 'JPN';
    case 'CHINA':
      return 'CHN';
    case 'KOREA':
      return 'KOR';
    case 'EU':
      return 'EUR';
  }
}

function formatDatePart(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

@Injectable()
export class LaneService implements LaneReconciler {
  constructor(
    private readonly laneStore: LaneStore,
    private readonly hashingService: HashingService,
    private readonly auditService: AuditService,
    private readonly ruleSnapshotResolver: LaneRuleSnapshotResolver,
    private readonly coldChainService: ColdChainService,
    private readonly rulesEngineService: RulesEngineService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async create(input: CreateLaneInput, actor: LaneRequestUser) {
    const now = new Date();
    const coldChainConfig = this.normalizeCreateColdChainConfig(input);
    const lane = await this.laneStore.runInTransaction(
      async (transactional) => {
        const latestLaneId = await transactional.findLatestLaneIdByYear(
          now.getUTCFullYear(),
        );
        const generatedLaneId = this.generateLaneId(now, latestLaneId);
        const batchPrefix = this.buildBatchPrefix(
          input.product,
          input.destination.market,
          input.batch.harvestDate,
        );
        const latestBatchId =
          await transactional.findLatestBatchIdByPrefix(batchPrefix);
        const generatedBatchId = this.generateBatchId(
          batchPrefix,
          latestBatchId,
        );
        const ruleSnapshot = await this.ruleSnapshotResolver.resolve(
          input.destination.market,
          input.product,
        );

        if (ruleSnapshot === null) {
          throw new Error(
            'No rules are available for the selected market/product.',
          );
        }

        return await transactional.createLaneBundle({
          exporterId: actor.id,
          laneId: generatedLaneId,
          status: 'EVIDENCE_COLLECTING',
          productType: input.product,
          destinationMarket: input.destination.market,
          completenessScore: 0,
          coldChainMode: coldChainConfig.mode,
          coldChainDeviceId: coldChainConfig.deviceId,
          coldChainDataFrequencySeconds: coldChainConfig.dataFrequencySeconds,
          batchId: generatedBatchId,
          batch: input.batch,
          route: input.route,
          checkpoints: input.checkpoints ?? [],
          ruleSnapshot,
        });
      },
    );

    await this.appendAuditEntry(actor.id, AuditAction.CREATE, lane);
    return { lane };
  }

  async findAll(
    query: LaneListQuery,
    actor: LaneRequestUser,
  ): Promise<LaneListResult> {
    const page = query.page ?? DEFAULT_LANE_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LANE_LIMIT, MAX_LANE_LIMIT);
    const result = await this.laneStore.findLanes({
      exporterId: actor.role === 'EXPORTER' ? actor.id : undefined,
      page,
      limit,
      status: query.status,
      product: query.product,
      market: query.market,
    });

    return {
      data: result.items,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / limit),
      },
    };
  }

  async findById(id: string) {
    const lane = await this.laneStore.findLaneById(id);
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }

    return { lane };
  }

  async update(id: string, input: UpdateLaneInput, actor: LaneRequestUser) {
    const existingLane = await this.laneStore.findLaneById(id);
    if (existingLane === null) {
      throw new NotFoundException('Lane not found.');
    }

    if (actor.role === 'EXPORTER' && existingLane.exporterId !== actor.id) {
      throw new ForbiddenException('Lane ownership required.');
    }

    const lane = await this.laneStore.updateLaneBundle(
      id,
      this.normalizeUpdateColdChainConfig(input),
    );
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }

    await this.appendAuditEntry(actor.id, AuditAction.UPDATE, lane);
    return { lane };
  }

  private throwIfViolation(violation: TransitionViolation | null): void {
    if (violation === null) return;
    if (violation.code === 'INVALID_TRANSITION') {
      throw new ConflictException(violation.message);
    }
    throw new UnprocessableEntityException(violation.message);
  }

  private normalizeCreateColdChainConfig(input: CreateLaneInput): {
    mode: LaneColdChainMode;
    deviceId: string | null;
    dataFrequencySeconds: number | null;
  } {
    if (input.coldChainConfig !== undefined) {
      return this.coldChainService.validateLaneConfiguration(
        input.coldChainConfig,
      );
    }

    if (input.coldChainMode === undefined || input.coldChainMode === null) {
      return {
        mode: null,
        deviceId: null,
        dataFrequencySeconds: null,
      };
    }

    return this.coldChainService.validateLaneConfiguration({
      mode: input.coldChainMode,
    });
  }

  private normalizeUpdateColdChainConfig(
    input: UpdateLaneInput,
  ): UpdateLaneInput {
    if (input.coldChainConfig !== undefined) {
      const config = this.coldChainService.validateLaneConfiguration(
        input.coldChainConfig,
      );

      return {
        ...input,
        coldChainMode: config.mode,
        coldChainConfig: {
          mode: config.mode,
          deviceId: config.deviceId ?? undefined,
          dataFrequencySeconds: config.dataFrequencySeconds ?? undefined,
        },
      };
    }

    if (input.coldChainMode === undefined) {
      return input;
    }

    if (input.coldChainMode === null) {
      return {
        ...input,
        coldChainMode: null,
      };
    }

    if (input.coldChainConfig !== undefined) {
      throw new BadRequestException('Conflicting cold-chain configuration.');
    }

    const config = this.coldChainService.validateLaneConfiguration({
      mode: input.coldChainMode,
    });

    return {
      ...input,
      coldChainMode: config.mode,
      coldChainConfig: {
        mode: config.mode,
        deviceId: config.deviceId ?? undefined,
        dataFrequencySeconds: config.dataFrequencySeconds ?? undefined,
      },
    };
  }

  async getCompleteness(id: string) {
    const lane = await this.laneStore.findLaneById(id);
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }
    const artifacts = await this.laneStore.listEvidenceArtifactsForLane(id);

    return this.rulesEngineService.evaluateLane(
      lane.ruleSnapshot === null
        ? null
        : {
            market: lane.ruleSnapshot.market,
            product: lane.ruleSnapshot.product,
            version: lane.ruleSnapshot.version,
            effectiveDate: lane.ruleSnapshot.effectiveDate,
            sourcePath: lane.ruleSnapshot.rules.sourcePath ?? '',
            requiredDocuments: lane.ruleSnapshot.rules.requiredDocuments ?? [],
            completenessWeights: lane.ruleSnapshot.rules
              .completenessWeights ?? {
              regulatory: 0.4,
              quality: 0.25,
              coldChain: 0.2,
              chainOfCustody: 0.15,
            },
            substances: lane.ruleSnapshot.rules.substances ?? [],
          },
      artifacts,
    );
  }

  async transition(
    id: string,
    input: TransitionLaneInput,
    actor: LaneRequestUser,
  ) {
    const existingLane = await this.laneStore.findLaneById(id);
    if (existingLane === null) {
      throw new NotFoundException('Lane not found.');
    }

    if (actor.role === 'EXPORTER' && existingLane.exporterId !== actor.id) {
      throw new ForbiddenException('Lane ownership required.');
    }

    this.throwIfViolation(
      validateTransitionGraph(existingLane.status, input.targetStatus),
    );
    const proofPackCount =
      input.targetStatus === 'PACKED'
        ? await this.laneStore.countProofPacksForLane(id)
        : 0;
    this.throwIfViolation(
      validateTransitionGuards(existingLane, input.targetStatus, {
        proofPackCount,
      }),
    );

    const transitionedAt = new Date();
    const lane = await this.laneStore.transitionLaneStatus(
      id,
      input.targetStatus,
      transitionedAt,
    );
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }

    await this.appendTransitionAuditEntry(
      actor.id,
      existingLane,
      lane,
      input.targetStatus,
    );
    await this.realtimeEvents.publishLaneStatusChanged({
      laneId: lane.id,
      oldStatus: existingLane.status,
      newStatus: lane.status,
    });
    return { lane };
  }

  async getCheckpoints(laneId: string): Promise<LaneDetail['checkpoints']> {
    const lane = await this.laneStore.findLaneById(laneId);
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }

    return this.laneStore.findCheckpointsForLane(laneId);
  }

  async getCheckpointById(
    checkpointId: string,
  ): Promise<LaneDetail['checkpoints'][number]> {
    const checkpoint = await this.laneStore.findCheckpointById(checkpointId);
    if (checkpoint === null) {
      throw new NotFoundException('Checkpoint not found.');
    }

    return checkpoint;
  }

  async createCheckpoint(
    laneId: string,
    input: CreateCheckpointInput,
    actor: LaneRequestUser,
  ): Promise<LaneDetail['checkpoints'][number]> {
    const lane = await this.laneStore.findLaneById(laneId);
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }

    const checkpoint = await this.laneStore.createCheckpoint(laneId, input);
    const payloadHash = await this.hashingService.hashString(
      this.buildCheckpointAuditPayload(lane.laneId, checkpoint),
    );

    await this.auditService.createEntry({
      actor: actor.id,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.CHECKPOINT,
      entityId: checkpoint.id,
      payloadHash,
      payloadSnapshot: this.buildCheckpointAuditSnapshot(checkpoint),
    });
    await this.realtimeEvents.publishCheckpointRecorded({
      laneId: checkpoint.laneId,
      checkpointId: checkpoint.id,
      sequence: checkpoint.sequence,
    });

    return checkpoint;
  }

  async updateCheckpoint(
    laneId: string,
    checkpointId: string,
    input: UpdateCheckpointInput,
    actor: LaneRequestUser,
  ): Promise<LaneDetail['checkpoints'][number]> {
    const lane = await this.laneStore.findLaneById(laneId);
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }

    const checkpoint = await this.laneStore.updateCheckpoint(
      laneId,
      checkpointId,
      input,
    );
    if (checkpoint === null) {
      throw new NotFoundException('Checkpoint not found.');
    }

    const payloadHash = await this.hashingService.hashString(
      this.buildCheckpointAuditPayload(lane.laneId, checkpoint),
    );

    await this.auditService.createEntry({
      actor: actor.id,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.CHECKPOINT,
      entityId: checkpointId,
      payloadHash,
      payloadSnapshot: this.buildCheckpointAuditSnapshot(checkpoint),
    });
    await this.realtimeEvents.publishCheckpointRecorded({
      laneId: checkpoint.laneId,
      checkpointId: checkpoint.id,
      sequence: checkpoint.sequence,
    });

    return checkpoint;
  }

  async getTimeline(laneId: string): Promise<LaneTimelineEvent[]> {
    const lane = await this.laneStore.findLaneById(laneId);
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }
    const [entries, artifacts] = await Promise.all([
      this.auditService.getEntriesForLane(laneId),
      this.laneStore.listEvidenceArtifactsForLane(laneId),
    ]);
    const artifactsById = new Map(
      (artifacts ?? []).map((artifact) => [artifact.id, artifact]),
    );
    const checkpointsById = new Map(
      (lane.checkpoints ?? []).map((checkpoint) => [checkpoint.id, checkpoint]),
    );

    return await Promise.all(
      entries.map(async (entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        actor: entry.actor,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        description: describeAuditEntry(entry.action, entry.entityType),
        metadata: await this.buildTimelineMetadata(
          entry,
          lane,
          artifactsById,
          checkpointsById,
        ),
      })),
    );
  }

  async reconcileAutomaticTransitions(laneId: string, actorId: string) {
    const existingLane = await this.laneStore.findLaneById(laneId);
    if (existingLane === null) {
      throw new NotFoundException('Lane not found.');
    }

    let lane = existingLane;
    const transitions: LaneStatus[] = [];

    while (true) {
      const proofPackCount = await this.laneStore.countProofPacksForLane(
        lane.id,
      );
      const targetStatus = getAutomaticTransitionTarget(lane, {
        proofPackCount,
      });
      if (targetStatus === null) {
        break;
      }

      this.throwIfViolation(validateTransitionGraph(lane.status, targetStatus));
      this.throwIfViolation(
        validateTransitionGuards(lane, targetStatus, {
          proofPackCount: targetStatus === 'PACKED' ? proofPackCount : 0,
        }),
      );

      const transitionedAt = new Date();
      const transitionedLane = await this.laneStore.transitionLaneStatus(
        lane.id,
        targetStatus,
        transitionedAt,
      );
      if (transitionedLane === null) {
        throw new NotFoundException('Lane not found.');
      }

      await this.appendTransitionAuditEntry(
        actorId,
        lane,
        transitionedLane,
        targetStatus,
      );
      await this.realtimeEvents.publishLaneStatusChanged({
        laneId: transitionedLane.id,
        oldStatus: lane.status,
        newStatus: transitionedLane.status,
      });
      transitions.push(targetStatus);
      lane = transitionedLane;
    }

    return { lane, transitions };
  }

  async reconcileAfterEvidenceChange(laneId: string, actorId: string) {
    return await this.reconcileAutomaticTransitions(laneId, actorId);
  }

  private generateLaneId(now: Date, latestLaneId: string | null): string {
    const year = now.getUTCFullYear();
    const latestSequence =
      latestLaneId === null ? 0 : Number(latestLaneId.split('-').at(-1) ?? '0');

    return `LN-${year}-${padSequence(latestSequence + 1)}`;
  }

  private buildBatchPrefix(
    product: CreateLaneInput['product'],
    market: CreateLaneInput['destination']['market'],
    harvestDate: Date,
  ): string {
    return `${productCode(product)}-${marketCode(market)}-${formatDatePart(
      harvestDate,
    )}`;
  }

  private generateBatchId(
    prefix: string,
    latestBatchId: string | null,
  ): string {
    const latestSequence =
      latestBatchId === null
        ? 0
        : Number(latestBatchId.split('-').at(-1) ?? '0');

    return `${prefix}-${padSequence(latestSequence + 1)}`;
  }

  private buildCheckpointAuditPayload(
    lanePublicId: string,
    checkpoint: LaneDetail['checkpoints'][number],
  ): string {
    return JSON.stringify({
      laneId: lanePublicId,
      checkpoint,
    });
  }

  private async buildTimelineMetadata(
    entry: {
      entityType: AuditEntityType;
      entityId: string;
      payloadSnapshot?: Record<string, unknown> | null;
    },
    lane: LaneDetail,
    artifactsById: Map<string, RuleLaneArtifact>,
    checkpointsById: Map<string, LaneDetail['checkpoints'][number]>,
  ): Promise<LaneTimelineEventMetadata | undefined> {
    if (entry.payloadSnapshot?.['kind'] === 'lane') {
      return {
        kind: 'lane',
        status: entry.payloadSnapshot['status'] as LaneStatus,
        completenessScore: Number(entry.payloadSnapshot['completenessScore']),
        productType: entry.payloadSnapshot[
          'productType'
        ] as CreateLaneInput['product'],
        destinationMarket: entry.payloadSnapshot[
          'destinationMarket'
        ] as CreateLaneInput['destination']['market'],
        statusChangedAt: new Date(
          String(entry.payloadSnapshot['statusChangedAt']),
        ),
      };
    }

    if (entry.payloadSnapshot?.['kind'] === 'checkpoint') {
      const checkpointTimestamp = entry.payloadSnapshot['timestamp'];

      return {
        kind: 'checkpoint',
        sequence: Number(entry.payloadSnapshot['sequence']),
        locationName: String(entry.payloadSnapshot['locationName']),
        status: entry.payloadSnapshot['status'] as
          | 'PENDING'
          | 'COMPLETED'
          | 'OVERDUE',
        timestamp:
          checkpointTimestamp === null
            ? null
            : typeof checkpointTimestamp === 'string'
              ? new Date(checkpointTimestamp)
              : null,
        temperature:
          entry.payloadSnapshot['temperature'] === null
            ? null
            : Number(entry.payloadSnapshot['temperature']),
        signerName:
          typeof entry.payloadSnapshot['signerName'] === 'string'
            ? entry.payloadSnapshot['signerName']
            : null,
        conditionNotes:
          typeof entry.payloadSnapshot['conditionNotes'] === 'string'
            ? entry.payloadSnapshot['conditionNotes']
            : null,
      };
    }

    if (entry.payloadSnapshot?.['kind'] === 'artifact') {
      return {
        kind: 'artifact',
        artifactType: String(entry.payloadSnapshot['artifactType']),
        fileName: String(entry.payloadSnapshot['fileName']),
        metadata:
          (entry.payloadSnapshot['metadata'] as Record<
            string,
            unknown
          > | null) ?? null,
      };
    }

    if (entry.payloadSnapshot?.['kind'] === 'proofPack') {
      return {
        kind: 'proofPack',
        packType: String(entry.payloadSnapshot['packType']),
        version: Number(entry.payloadSnapshot['version']),
        status: entry.payloadSnapshot['status'] as
          | 'GENERATING'
          | 'READY'
          | 'FAILED',
        contentHash:
          typeof entry.payloadSnapshot['contentHash'] === 'string'
            ? entry.payloadSnapshot['contentHash']
            : null,
        generatedAt: new Date(String(entry.payloadSnapshot['generatedAt'])),
        errorMessage:
          typeof entry.payloadSnapshot['errorMessage'] === 'string'
            ? entry.payloadSnapshot['errorMessage']
            : null,
      };
    }

    if (entry.entityType === AuditEntityType.LANE) {
      return {
        kind: 'lane',
        status: lane.status,
        completenessScore: lane.completenessScore,
        productType: lane.productType,
        destinationMarket: lane.destinationMarket,
        statusChangedAt: lane.statusChangedAt,
      };
    }

    if (entry.entityType === AuditEntityType.CHECKPOINT) {
      const checkpoint = checkpointsById.get(entry.entityId);
      if (checkpoint === undefined) {
        return undefined;
      }

      return {
        kind: 'checkpoint',
        sequence: checkpoint.sequence,
        locationName: checkpoint.locationName,
        status: checkpoint.status,
        timestamp: checkpoint.timestamp,
        temperature: checkpoint.temperature,
        signerName: checkpoint.signerName,
        conditionNotes: checkpoint.conditionNotes,
      };
    }

    if (entry.entityType === AuditEntityType.ARTIFACT) {
      const artifact = artifactsById.get(entry.entityId);
      if (artifact === undefined) {
        return undefined;
      }

      return {
        kind: 'artifact',
        artifactType: artifact.artifactType,
        fileName: artifact.fileName,
        metadata: artifact.metadata,
      };
    }

    if (entry.entityType === AuditEntityType.PROOF_PACK) {
      try {
        const pack = await this.laneStore.findProofPackSummaryById(
          entry.entityId,
        );
        if (pack === null) {
          return undefined;
        }

        return {
          kind: 'proofPack' as const,
          packType: pack.packType,
          version: pack.version,
          status: pack.status as 'GENERATING' | 'READY' | 'FAILED',
          contentHash: null,
          generatedAt: pack.generatedAt,
          errorMessage: null,
        };
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private async appendAuditEntry(
    actorId: string,
    action: AuditAction,
    lane: LaneDetail,
  ): Promise<void> {
    const payloadSnapshot = this.buildLaneAuditSnapshot(lane);
    const payloadHash = await this.hashingService.hashString(
      JSON.stringify({
        laneId: lane.laneId,
        exporterId: lane.exporterId,
        status: lane.status,
        productType: lane.productType,
        destinationMarket: lane.destinationMarket,
        completenessScore: lane.completenessScore,
      }),
    );

    await this.auditService.createEntry({
      actor: actorId,
      action,
      entityType: AuditEntityType.LANE,
      entityId: lane.id,
      payloadHash,
      payloadSnapshot,
    });
  }

  private async appendTransitionAuditEntry(
    actorId: string,
    previousLane: LaneDetail,
    lane: LaneDetail,
    targetStatus: LaneStatus,
  ): Promise<void> {
    const payloadSnapshot = this.buildLaneAuditSnapshot(lane);
    const payloadHash = await this.hashingService.hashString(
      JSON.stringify({
        laneId: lane.laneId,
        exporterId: lane.exporterId,
        previousStatus: previousLane.status,
        nextStatus: targetStatus,
        productType: lane.productType,
        destinationMarket: lane.destinationMarket,
        completenessScore: lane.completenessScore,
      }),
    );

    await this.auditService.createEntry({
      actor: actorId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.LANE,
      entityId: lane.id,
      payloadHash,
      payloadSnapshot,
    });
  }

  private buildLaneAuditSnapshot(lane: LaneDetail): Record<string, unknown> {
    return {
      kind: 'lane',
      status: lane.status,
      completenessScore: lane.completenessScore,
      productType: lane.productType,
      destinationMarket: lane.destinationMarket,
      statusChangedAt: lane.statusChangedAt.toISOString(),
    };
  }

  private buildCheckpointAuditSnapshot(
    checkpoint: LaneDetail['checkpoints'][number],
  ): Record<string, unknown> {
    return {
      kind: 'checkpoint',
      sequence: checkpoint.sequence,
      locationName: checkpoint.locationName,
      status: checkpoint.status,
      timestamp: checkpoint.timestamp?.toISOString() ?? null,
      temperature: checkpoint.temperature,
      signerName: checkpoint.signerName,
      conditionNotes: checkpoint.conditionNotes,
      signatureHash: checkpoint.signatureHash,
      gpsLat: checkpoint.gpsLat,
      gpsLng: checkpoint.gpsLng,
    };
  }
}

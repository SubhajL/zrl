import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import { AuditService } from '../../common/audit/audit.service';
import { HashingService } from '../../common/hashing/hashing.service';
import { ColdChainService } from '../cold-chain/cold-chain.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import {
  DEFAULT_LANE_LIMIT,
  DEFAULT_LANE_PAGE,
  LANE_ARCHIVE_RETENTION_YEARS,
  LANE_VALIDATION_COMPLETENESS_THRESHOLD,
  MAX_LANE_LIMIT,
} from './lane.constants';
import type {
  CreateLaneInput,
  LaneStatus,
  LaneColdChainMode,
  LaneListQuery,
  LaneListResult,
  LaneRequestUser,
  LaneRuleSnapshotResolver,
  LaneStore,
  LaneDetail,
  TransitionLaneInput,
  UpdateLaneInput,
} from './lane.types';

function padSequence(sequence: number): string {
  return String(sequence).padStart(3, '0');
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

const ALLOWED_LANE_TRANSITIONS: Record<LaneStatus, LaneStatus[]> = {
  CREATED: ['EVIDENCE_COLLECTING'],
  EVIDENCE_COLLECTING: ['VALIDATED'],
  VALIDATED: ['PACKED', 'INCOMPLETE'],
  PACKED: ['CLOSED'],
  CLOSED: ['CLAIM_DEFENSE', 'ARCHIVED'],
  INCOMPLETE: ['EVIDENCE_COLLECTING'],
  CLAIM_DEFENSE: ['DISPUTE_RESOLVED'],
  DISPUTE_RESOLVED: [],
  ARCHIVED: [],
};

@Injectable()
export class LaneService {
  constructor(
    private readonly laneStore: LaneStore,
    private readonly hashingService: HashingService,
    private readonly auditService: AuditService,
    private readonly ruleSnapshotResolver: LaneRuleSnapshotResolver,
    private readonly coldChainService: ColdChainService,
    private readonly rulesEngineService: RulesEngineService,
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

    this.assertTransitionGraph(existingLane.status, input.targetStatus);
    await this.assertTransitionGuards(existingLane, input.targetStatus);

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
    return { lane };
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

  private assertTransitionGraph(
    currentStatus: LaneStatus,
    targetStatus: LaneStatus,
  ): void {
    const allowedTargets = ALLOWED_LANE_TRANSITIONS[currentStatus] ?? [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new ConflictException(
        `Invalid lane transition from ${currentStatus} to ${targetStatus}.`,
      );
    }
  }

  private async assertTransitionGuards(
    lane: LaneDetail,
    targetStatus: LaneStatus,
  ): Promise<void> {
    if (
      targetStatus === 'VALIDATED' &&
      lane.completenessScore < LANE_VALIDATION_COMPLETENESS_THRESHOLD
    ) {
      throw new UnprocessableEntityException(
        'Lane completeness must be at least 95% before validation.',
      );
    }

    if (targetStatus === 'PACKED') {
      const proofPackCount = await this.laneStore.countProofPacksForLane(
        lane.id,
      );
      if (proofPackCount < 1) {
        throw new UnprocessableEntityException(
          'At least one proof pack is required before packing.',
        );
      }
    }

    if (targetStatus === 'ARCHIVED') {
      const archiveEligibleAt = new Date(lane.statusChangedAt);
      archiveEligibleAt.setUTCFullYear(
        archiveEligibleAt.getUTCFullYear() + LANE_ARCHIVE_RETENTION_YEARS,
      );

      if (archiveEligibleAt.getTime() > Date.now()) {
        throw new UnprocessableEntityException(
          'Lane cannot be archived before the retention period ends.',
        );
      }
    }
  }

  private async appendAuditEntry(
    actorId: string,
    action: AuditAction,
    lane: LaneDetail,
  ): Promise<void> {
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
    });
  }

  private async appendTransitionAuditEntry(
    actorId: string,
    previousLane: LaneDetail,
    lane: LaneDetail,
    targetStatus: LaneStatus,
  ): Promise<void> {
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
    });
  }
}

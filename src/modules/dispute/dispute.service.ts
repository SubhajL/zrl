import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthSessionUser } from '../../common/auth/auth.types';
import { HashingService } from '../../common/hashing/hashing.service';
import { LaneService } from '../lane/lane.service';
import { ProofPackService } from '../evidence/proof-pack.service';
import type { ProofPackTemplateData } from '../evidence/proof-pack.types';
import { DISPUTE_STORE } from './dispute.constants';
import type {
  CreateDisputeInput,
  DisputeRecord,
  DisputeStore,
  UpdateDisputeInput,
} from './dispute.types';

type DisputeActor = AuthSessionUser;

const VALID_LANE_STATUSES_FOR_DISPUTE = new Set(['CLOSED', 'CLAIM_DEFENSE']);

@Injectable()
export class DisputeService {
  constructor(
    @Inject(DISPUTE_STORE) private readonly store: DisputeStore,
    private readonly laneService: LaneService,
    private readonly proofPackService: ProofPackService,
    private readonly auditService: AuditService,
    private readonly hashingService: HashingService,
  ) {}

  async createDispute(
    laneId: string,
    input: CreateDisputeInput,
    actor: DisputeActor,
  ): Promise<DisputeRecord> {
    const { lane } = await this.laneService.findById(laneId);

    if (!VALID_LANE_STATUSES_FOR_DISPUTE.has(lane.status)) {
      throw new BadRequestException(
        `Cannot create dispute for lane in status ${lane.status}. Lane must be CLOSED or CLAIM_DEFENSE.`,
      );
    }

    const dispute = await this.store.createDispute(lane.id, input);

    // Transition lane to CLAIM_DEFENSE if not already there
    if (lane.status === 'CLOSED') {
      await this.laneService.transition(
        lane.id,
        { targetStatus: 'CLAIM_DEFENSE' },
        actor,
      );
    }

    const payloadHash = await this.hashingService.hashString(
      JSON.stringify({
        disputeId: dispute.id,
        laneId: lane.id,
        type: dispute.type,
        claimant: dispute.claimant,
        financialImpact: dispute.financialImpact,
      }),
    );

    await this.auditService.createEntry({
      actor: actor.id,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.LANE,
      entityId: lane.id,
      payloadHash,
      payloadSnapshot: {
        kind: 'dispute',
        disputeId: dispute.id,
        type: dispute.type,
        claimant: dispute.claimant,
        status: dispute.status,
      },
    });

    return dispute;
  }

  async getDispute(id: string, actor?: DisputeActor): Promise<DisputeRecord> {
    const dispute = await this.store.findDisputeById(id);
    if (dispute === null) {
      throw new NotFoundException('Dispute not found.');
    }

    if (actor !== undefined) {
      const { lane } = await this.laneService.findById(dispute.laneId);
      if (actor.role === 'EXPORTER' && lane.exporterId !== actor.id) {
        throw new NotFoundException('Dispute not found.');
      }
    }

    return dispute;
  }

  async listDisputesForLane(laneId: string): Promise<DisputeRecord[]> {
    const { lane } = await this.laneService.findById(laneId);
    return await this.store.findDisputesForLane(lane.id);
  }

  async generateDefensePack(
    disputeId: string,
    actor: DisputeActor,
  ): Promise<DisputeRecord> {
    const dispute = await this.getDispute(disputeId);
    const { lane } = await this.laneService.findById(dispute.laneId);

    const [auditEntries, checkpoints, completeness, excursionCount] =
      await Promise.all([
        this.auditService.getEntriesForLane(lane.id),
        this.laneService.getCheckpoints(lane.id),
        this.laneService.getCompleteness(lane.id),
        this.store.countExcursionsForLane(lane.id),
      ]);

    const checkpointData: ProofPackTemplateData['checkpoints'] =
      checkpoints.map((cp) => ({
        sequence: cp.sequence,
        location: cp.locationName,
        status: cp.status,
        timestamp: cp.timestamp !== null ? cp.timestamp.toISOString() : null,
        temperature: cp.temperature,
        signer: cp.signerName,
      }));

    const auditEntryData: ProofPackTemplateData['auditEntries'] =
      auditEntries.map((entry) => ({
        timestamp: entry.timestamp.toISOString(),
        actor: entry.actor,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entryHash: entry.entryHash,
      }));

    const checklistItems = completeness.checklist.map((item) => ({
      label: item.label,
      category: item.category,
      status: item.status,
    }));

    const labResults =
      completeness.labValidation !== null
        ? completeness.labValidation.results.map((r) => ({
            substance: r.substance,
            thaiMrl: r.limitMgKg,
            destinationMrl: r.limitMgKg,
            measuredValue: r.valueMgKg,
            status: r.status,
          }))
        : null;

    const slaStatus = excursionCount === 0 ? 'PASS' : 'FAIL';

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
      checkpoints: checkpointData,
      auditEntries: auditEntryData,
      slaStatus,
      excursionCount,
      generatedAt: new Date().toISOString(),
      packType: 'DEFENSE',
    };

    const pack = await this.proofPackService.generatePack(
      {
        laneId: lane.id,
        packType: 'DEFENSE',
        generatedBy: actor.id,
      },
      templateData,
    );

    const linkedDispute = await this.store.linkDefensePack(dispute.id, pack.id);
    if (linkedDispute === null) {
      throw new NotFoundException('Dispute not found after linking pack.');
    }

    const payloadHash = await this.hashingService.hashString(
      JSON.stringify({
        disputeId: dispute.id,
        defensePackId: pack.id,
        laneId: lane.id,
      }),
    );

    await this.auditService.createEntry({
      actor: actor.id,
      action: AuditAction.GENERATE,
      entityType: AuditEntityType.PROOF_PACK,
      entityId: pack.id,
      payloadHash,
      payloadSnapshot: {
        kind: 'dispute-defense',
        disputeId: dispute.id,
        packType: 'DEFENSE',
        packId: pack.id,
      },
    });

    return linkedDispute;
  }

  async updateDispute(
    id: string,
    input: UpdateDisputeInput,
    actor: DisputeActor,
  ): Promise<DisputeRecord> {
    const updated = await this.store.updateDispute(id, input);
    if (updated === null) {
      throw new NotFoundException('Dispute not found.');
    }

    const payloadHash = await this.hashingService.hashString(
      JSON.stringify({
        disputeId: updated.id,
        laneId: updated.laneId,
        status: updated.status,
        resolutionNotes: updated.resolutionNotes,
      }),
    );

    await this.auditService.createEntry({
      actor: actor.id,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.LANE,
      entityId: updated.laneId,
      payloadHash,
      payloadSnapshot: {
        kind: 'dispute-update',
        disputeId: updated.id,
        status: updated.status,
        resolutionNotes: updated.resolutionNotes,
      },
    });

    return updated;
  }
}

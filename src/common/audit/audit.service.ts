import { Inject, Injectable, Optional } from '@nestjs/common';
import { getGenesisHash } from '../hashing/hashing.utils';
import { HashingService } from '../hashing/hashing.service';
import { AUDIT_ENTRY_STORE } from './audit.constants';
import type {
  AuditEntryFilters,
  AuditEntityType,
  AuditStore,
  CreateAuditEntryInput,
  LaneAuditExportPayload,
  LaneAuditVerificationResult,
} from './audit.types';

@Injectable()
export class AuditService {
  constructor(
    private readonly hashingService: HashingService,
    @Optional()
    @Inject(AUDIT_ENTRY_STORE)
    private readonly auditStore?: AuditStore,
  ) {}

  async createEntry(input: CreateAuditEntryInput) {
    return await this.createEntryWithStore(this.requireStore(), input);
  }

  async createEntryWithStore(store: AuditStore, input: CreateAuditEntryInput) {
    return await store.runInTransaction(async (transactionalStore) => {
      const streamId = await transactionalStore.resolveStreamId(
        input.entityType,
        input.entityId,
      );

      if (streamId === null) {
        throw new Error('Unable to resolve audit stream for audit entry.');
      }

      await transactionalStore.lockStream(streamId);
      const latestEntry =
        await transactionalStore.findLatestForStream(streamId);
      const timestamp = input.timestamp ?? new Date();
      const prevHash = latestEntry?.entryHash ?? getGenesisHash();
      const entryHash = this.hashingService.computeEntryHash({
        timestamp,
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        payloadHash: input.payloadHash,
        prevHash,
      });

      return await transactionalStore.createEntry({
        timestamp,
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        payloadHash: input.payloadHash,
        payloadSnapshot: input.payloadSnapshot,
        prevHash,
        entryHash,
      });
    });
  }

  async getEntriesForLane(laneId: string, filters?: AuditEntryFilters) {
    return await this.requireStore().findEntriesForLane(laneId, filters);
  }

  async getEntriesForEntity(entityType: AuditEntityType, entityId: string) {
    return await this.requireStore().findEntriesForEntity(entityType, entityId);
  }

  async verifyChainForLane(
    laneId: string,
  ): Promise<LaneAuditVerificationResult> {
    const entries = await this.requireStore().findEntriesForLane(laneId);
    const verification = this.hashingService.verifyChain(entries);

    if (verification.valid) {
      return {
        valid: true,
        entriesChecked: entries.length,
      };
    }

    return {
      valid: false,
      entriesChecked: entries.length,
      firstInvalidIndex: verification.firstInvalidIndex,
      firstInvalidEntryId: entries[verification.firstInvalidIndex]?.id,
    };
  }

  async exportForLane(laneId: string): Promise<LaneAuditExportPayload> {
    const entries = await this.requireStore().findEntriesForLane(laneId);

    return {
      laneId,
      exportedAt: new Date().toISOString(),
      entriesCount: entries.length,
      entries: entries.map((entry) => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      })),
    };
  }

  private requireStore(): AuditStore {
    if (this.auditStore === undefined) {
      throw new Error('Audit store is not configured.');
    }

    return this.auditStore;
  }
}

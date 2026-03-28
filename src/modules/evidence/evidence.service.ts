import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { tmpdir } from 'node:os';
import { extname } from 'node:path';
import { AuditService } from '../../common/audit/audit.service';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import { HashingService } from '../../common/hashing/hashing.service';
import { LaneService } from '../lane/lane.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import {
  DEFAULT_EVIDENCE_LIMIT,
  DEFAULT_EVIDENCE_PAGE,
  MAX_EVIDENCE_LIMIT,
} from './evidence.constants';
import type {
  EvidenceArtifactRecord,
  EvidenceArtifactGraph,
  EvidenceArtifactResponse,
  EvidenceGraphVerificationResult,
  EvidenceArtifactStore,
  EvidenceListFilters,
  EvidenceObjectStore,
  EvidencePhotoMetadataExtractor,
  EvidenceRequestUser,
  UploadArtifactInput,
} from './evidence.types';

function buildObjectKey(
  lanePublicId: string,
  artifactType: string,
  contentHash: string,
  fileName: string,
): string {
  const extension = extname(fileName).replace('.', '').trim().toLowerCase();
  const normalizedExtension = extension.length === 0 ? 'bin' : extension;
  return `evidence/${lanePublicId}/${artifactType}/${contentHash}.${normalizedExtension}`;
}

function buildAuditPayload(artifact: {
  id: string;
  laneId: string;
  artifactType: string;
  contentHash: string;
  filePath: string;
  verificationStatus: string;
}): string {
  return JSON.stringify({
    id: artifact.id,
    laneId: artifact.laneId,
    artifactType: artifact.artifactType,
    contentHash: artifact.contentHash,
    filePath: artifact.filePath,
    verificationStatus: artifact.verificationStatus,
  });
}

function buildArtifactAuditSnapshot(artifact: {
  artifactType: string;
  fileName: string;
  metadata: Record<string, unknown> | null;
  verificationStatus: string;
  contentHash: string;
}): Record<string, unknown> {
  return {
    kind: 'artifact',
    artifactType: artifact.artifactType,
    fileName: artifact.fileName,
    metadata: artifact.metadata,
    verificationStatus: artifact.verificationStatus,
    contentHash: artifact.contentHash,
  };
}

function hasCheckpointCaptureMetadata(
  metadata: Record<string, unknown>,
): boolean {
  return (
    typeof metadata['capturedAt'] === 'string' &&
    typeof metadata['gpsLat'] === 'number' &&
    typeof metadata['gpsLng'] === 'number'
  );
}

function normalizePartnerMetadata(
  artifactType: 'MRL_TEST' | 'TEMP_DATA',
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (artifactType === 'MRL_TEST') {
    const results =
      payload['results'] ?? payload['substances'] ?? payload['labResults'];
    if (Array.isArray(results)) {
      metadata['results'] = results;
    }
  }

  return metadata;
}

function mergeLinks(
  explicitLinks: Array<{ targetArtifactId: string; relationshipType: string }>,
  automaticLinks: Array<{ targetArtifactId: string; relationshipType: string }>,
) {
  const deduped = new Map<
    string,
    { targetArtifactId: string; relationshipType: string }
  >();

  for (const link of [...explicitLinks, ...automaticLinks]) {
    deduped.set(`${link.targetArtifactId}:${link.relationshipType}`, link);
  }

  return [...deduped.values()];
}

function findCycleNodeIds(graph: EvidenceArtifactGraph): string[] {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (adjacency.has(edge.sourceArtifactId)) {
      adjacency.get(edge.sourceArtifactId)!.push(edge.targetArtifactId);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleNodeIds = new Set<string>();
  const path: string[] = [];

  const visit = (nodeId: string) => {
    visiting.add(nodeId);
    path.push(nodeId);

    for (const neighborId of adjacency.get(nodeId) ?? []) {
      if (!adjacency.has(neighborId)) {
        continue;
      }

      if (visiting.has(neighborId)) {
        const cycleStartIndex = path.indexOf(neighborId);
        for (const cycleNodeId of path.slice(cycleStartIndex)) {
          cycleNodeIds.add(cycleNodeId);
        }
        cycleNodeIds.add(neighborId);
        continue;
      }

      if (!visited.has(neighborId)) {
        visit(neighborId);
      }
    }

    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const nodeId of adjacency.keys()) {
    if (!visited.has(nodeId)) {
      visit(nodeId);
    }
  }

  return [...cycleNodeIds];
}

function isCertificationArtifactType(
  artifactType: string,
): artifactType is 'PHYTO_CERT' | 'VHT_CERT' | 'GAP_CERT' {
  return (
    artifactType === 'PHYTO_CERT' ||
    artifactType === 'VHT_CERT' ||
    artifactType === 'GAP_CERT'
  );
}

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly store: EvidenceArtifactStore,
    private readonly objectStore: EvidenceObjectStore,
    private readonly hashingService: HashingService,
    private readonly auditService: AuditService,
    private readonly photoMetadataExtractor: EvidencePhotoMetadataExtractor,
    private readonly rulesEngineService: RulesEngineService,
    private readonly laneService: LaneService,
  ) {}

  async uploadArtifact(input: UploadArtifactInput, actor: EvidenceRequestUser) {
    return await this.persistArtifact(input, actor, false);
  }

  async listLaneArtifacts(laneId: string, filters: EvidenceListFilters = {}) {
    const page = filters.page ?? DEFAULT_EVIDENCE_PAGE;
    const limit = Math.min(
      filters.limit ?? DEFAULT_EVIDENCE_LIMIT,
      MAX_EVIDENCE_LIMIT,
    );
    const result = await this.store.listArtifactsForLane(laneId, {
      ...filters,
      page,
      limit,
    });

    return {
      artifacts: result.items.map((artifact) => this.mapArtifact(artifact)),
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / limit),
      },
    };
  }

  async getArtifact(id: string, actor: EvidenceRequestUser) {
    const artifact = await this.requireArtifact(id);
    this.assertLaneAccess(artifact.exporterId, actor);
    return { artifact: this.mapArtifact(artifact) };
  }

  async verifyArtifact(id: string, actor: EvidenceRequestUser) {
    const artifact = await this.requireArtifact(id);
    this.assertLaneAccess(artifact.exporterId, actor);

    const storedObject = await this.objectStore.createReadStream(
      artifact.filePath,
    );
    const computedHash = await this.hashingService.hashFile(storedObject);
    const status =
      computedHash === artifact.contentHash ? 'VERIFIED' : 'FAILED';

    await this.store.runInTransaction(async (transactional) => {
      const updated = await transactional.updateArtifactVerificationStatus(
        artifact.id,
        status,
      );
      const payloadHash = await this.hashingService.hashString(
        buildAuditPayload(updated),
      );
      await this.auditService.createEntryWithStore(
        transactional.asAuditStore(),
        {
          actor: actor.id,
          action: AuditAction.VERIFY,
          entityType: AuditEntityType.ARTIFACT,
          entityId: updated.id,
          payloadHash,
          payloadSnapshot: buildArtifactAuditSnapshot(updated),
        },
      );
    });

    return {
      artifactId: artifact.id,
      valid: status === 'VERIFIED',
      storedHash: artifact.contentHash,
      computedHash,
    };
  }

  async deleteArtifact(id: string, actor: EvidenceRequestUser) {
    const artifact = await this.requireArtifact(id);
    this.assertLaneAccess(artifact.exporterId, actor);

    await this.store.runInTransaction(async (transactional) => {
      const deletedArtifact = await transactional.softDeleteArtifact(id);
      if (deletedArtifact === null) {
        throw new NotFoundException('Artifact not found.');
      }

      const payloadHash = await this.hashingService.hashString(
        buildAuditPayload(deletedArtifact),
      );
      await this.auditService.createEntryWithStore(
        transactional.asAuditStore(),
        {
          actor: actor.id,
          action: AuditAction.DELETE,
          entityType: AuditEntityType.ARTIFACT,
          entityId: deletedArtifact.id,
          payloadHash,
          payloadSnapshot: buildArtifactAuditSnapshot(deletedArtifact),
        },
      );
    });

    return { success: true as const };
  }

  async getLaneGraph(laneId: string) {
    return await this.store.findArtifactGraphForLane(laneId);
  }

  async verifyLaneGraph(
    laneId: string,
    actor: EvidenceRequestUser,
  ): Promise<EvidenceGraphVerificationResult> {
    const lane = await this.store.findLaneById(laneId);
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }

    this.assertLaneAccess(lane.exporterId, actor);

    const [artifacts, graph] = await Promise.all([
      this.store.listArtifactsForIntegrityCheck(laneId),
      this.store.findArtifactGraphForLane(laneId),
    ]);
    const structurallyInvalidNodeIds = new Set(findCycleNodeIds(graph));
    const verificationResults: Array<{
      artifactId: string;
      status: 'VERIFIED' | 'FAILED';
    }> = [];

    for (const artifact of artifacts) {
      try {
        const storedObject = await this.objectStore.createReadStream(
          artifact.filePath,
        );
        const computedHash = await this.hashingService.hashFile(storedObject);
        verificationResults.push({
          artifactId: artifact.id,
          status:
            computedHash === artifact.contentHash &&
            !structurallyInvalidNodeIds.has(artifact.id)
              ? 'VERIFIED'
              : 'FAILED',
        });
      } catch {
        verificationResults.push({
          artifactId: artifact.id,
          status: 'FAILED',
        });
      }
    }

    const result: EvidenceGraphVerificationResult = {
      valid: verificationResults.every(
        (verification) => verification.status === 'VERIFIED',
      ),
      invalidNodeIds: verificationResults
        .filter((verification) => verification.status === 'FAILED')
        .map((verification) => verification.artifactId),
      checkedCount: verificationResults.length,
    };

    await this.store.runInTransaction(async (transactional) => {
      for (const verification of verificationResults) {
        await transactional.updateArtifactVerificationStatus(
          verification.artifactId,
          verification.status,
        );
      }

      const payloadHash = await this.hashingService.hashString(
        JSON.stringify({
          laneId,
          ...result,
        }),
      );
      await this.auditService.createEntryWithStore(
        transactional.asAuditStore(),
        {
          actor: actor.id,
          action: AuditAction.VERIFY,
          entityType: AuditEntityType.LANE,
          entityId: laneId,
          payloadHash,
        },
      );
    });

    return result;
  }

  async createPartnerLabArtifact(
    input: {
      laneId: string;
      issuer?: string;
      issuedAt?: string;
      payload: Record<string, unknown>;
    },
    actor: EvidenceRequestUser,
  ) {
    return await this.createPartnerArtifact(
      {
        ...input,
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
      },
      actor,
    );
  }

  async createPartnerTemperatureArtifact(
    input: {
      laneId: string;
      issuer?: string;
      issuedAt?: string;
      payload: Record<string, unknown>;
    },
    actor: EvidenceRequestUser,
  ) {
    return await this.createPartnerArtifact(
      {
        ...input,
        artifactType: 'TEMP_DATA',
        fileName: 'temperature-data.json',
      },
      actor,
    );
  }

  private async persistArtifact(
    input: UploadArtifactInput,
    actor: EvidenceRequestUser,
    skipLaneAccessCheck: boolean,
  ) {
    const lane = await this.store.findLaneById(input.laneId);
    if (lane === null) {
      throw new NotFoundException('Lane not found.');
    }

    if (!skipLaneAccessCheck) {
      this.assertLaneAccess(lane.exporterId, actor);
    }

    const contentHash = await this.hashingService.hashFile(
      createReadStream(input.tempFilePath),
    );
    const filePath = buildObjectKey(
      lane.laneId,
      input.artifactType,
      contentHash,
      input.fileName,
    );
    const metadata = await this.buildArtifactMetadata(input);

    await this.objectStore.putObjectFromFile({
      key: filePath,
      filePath: input.tempFilePath,
      contentType: input.mimeType,
      contentLength: input.fileSizeBytes,
    });

    try {
      const artifact = await this.store.runInTransaction(
        async (transactional) => {
          const latestLaneArtifact =
            await transactional.findLatestArtifactForLane(lane.id);
          const latestCheckpointArtifact =
            input.checkpointId === null
              ? null
              : await transactional.findLatestArtifactForCheckpoint(
                  input.checkpointId,
                );
          const created = await transactional.createArtifact({
            laneId: lane.id,
            artifactType: input.artifactType,
            fileName: input.fileName,
            mimeType: input.mimeType,
            fileSizeBytes: input.fileSizeBytes,
            filePath,
            contentHash,
            source: input.source,
            checkpointId: input.checkpointId,
            verificationStatus: 'PENDING',
            metadata,
            uploadedBy: actor.id,
          });

          const automaticLinks = this.buildAutomaticLinks(
            latestLaneArtifact,
            latestCheckpointArtifact,
          );
          const links = mergeLinks(input.links, automaticLinks);

          for (const link of links) {
            const targetArtifact = await transactional.findArtifactById(
              link.targetArtifactId,
            );
            if (targetArtifact === null || targetArtifact.laneId !== lane.id) {
              throw new BadRequestException(
                'Artifact links must target existing artifacts in the same lane.',
              );
            }

            const createsCycle = await transactional.linkCreatesCycle(
              created.id,
              link.targetArtifactId,
            );
            if (createsCycle) {
              throw new BadRequestException(
                'Artifact link would create a cycle.',
              );
            }
          }

          if (links.length > 0) {
            await transactional.createArtifactLinks(created.id, links);
          }

          const payloadHash = await this.hashingService.hashString(
            buildAuditPayload(created),
          );
          await this.auditService.createEntryWithStore(
            transactional.asAuditStore(),
            {
              actor: actor.id,
              action: AuditAction.UPLOAD,
              entityType: AuditEntityType.ARTIFACT,
              entityId: created.id,
              payloadHash,
              payloadSnapshot: buildArtifactAuditSnapshot(created),
            },
          );

          if (lane.ruleSnapshot !== null && lane.ruleSnapshot !== undefined) {
            const artifacts = await transactional.listArtifactsForEvaluation(
              lane.id,
            );
            const evaluation = this.rulesEngineService.evaluateLane(
              lane.ruleSnapshot,
              artifacts,
            );
            await transactional.updateLaneCompletenessScore(
              lane.id,
              evaluation.score,
            );
          }

          return created;
        },
      );

      await this.notifyCertificationAlertAfterUpload(lane, artifact);

      await this.reconcileLaneTransitionsAfterUpload(lane, actor.id);

      return { artifact: this.mapArtifact(artifact) };
    } catch (error) {
      await Promise.resolve(this.objectStore.deleteObject(filePath)).catch(
        () => undefined,
      );
      throw error;
    } finally {
      await rm(input.tempFilePath, { force: true }).catch(() => undefined);
    }
  }

  private async reconcileLaneTransitionsAfterUpload(
    lane: {
      id: string;
      ruleSnapshot?: unknown;
    },
    actorId: string,
  ) {
    if (lane.ruleSnapshot === null || lane.ruleSnapshot === undefined) {
      return;
    }

    try {
      await this.laneService.reconcileAutomaticTransitions(lane.id, actorId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown reconciliation error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Automatic lane transition reconciliation failed for lane ${lane.id}: ${message}`,
        stack,
      );
    }
  }

  private async notifyCertificationAlertAfterUpload(
    lane: {
      id: string;
      laneId: string;
    },
    artifact: EvidenceArtifactRecord,
  ) {
    if (!isCertificationArtifactType(artifact.artifactType)) {
      return;
    }

    try {
      await this.rulesEngineService.notifyCertificationAlertForArtifact({
        laneId: lane.id,
        lanePublicId: lane.laneId,
        artifact: {
          id: artifact.id,
          artifactType: artifact.artifactType,
          fileName: artifact.fileName,
          metadata: artifact.metadata,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown certification alert error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Certification alert notification failed for artifact ${artifact.id}: ${message}`,
        stack,
      );
    }
  }

  private async requireArtifact(id: string) {
    const artifact = await this.store.findArtifactById(id);
    if (artifact === null) {
      throw new NotFoundException('Artifact not found.');
    }

    return artifact;
  }

  private buildAutomaticLinks(
    latestLaneArtifact: EvidenceArtifactRecord | null | undefined,
    latestCheckpointArtifact: EvidenceArtifactRecord | null | undefined,
  ): Array<{ targetArtifactId: string; relationshipType: string }> {
    const automaticLinks: Array<{
      targetArtifactId: string;
      relationshipType: string;
    }> = [];

    if (latestCheckpointArtifact != null) {
      automaticLinks.push({
        targetArtifactId: latestCheckpointArtifact.id,
        relationshipType: 'CHECKPOINT_PREDECESSOR',
      });
    }

    if (
      latestLaneArtifact != null &&
      latestLaneArtifact.id !== latestCheckpointArtifact?.id
    ) {
      automaticLinks.push({
        targetArtifactId: latestLaneArtifact.id,
        relationshipType: 'LANE_PREDECESSOR',
      });
    }

    return automaticLinks;
  }

  private assertLaneAccess(exporterId: string, actor: EvidenceRequestUser) {
    if (actor.role === 'ADMIN' || actor.role === 'AUDITOR') {
      return;
    }

    if (actor.role === 'EXPORTER' && exporterId === actor.id) {
      return;
    }

    throw new ForbiddenException('Lane ownership required.');
  }

  private async buildArtifactMetadata(
    input: UploadArtifactInput,
  ): Promise<Record<string, unknown> | null> {
    const metadata: Record<string, unknown> =
      input.metadata === null ? {} : { ...input.metadata };

    if (input.artifactType === 'CHECKPOINT_PHOTO') {
      const extracted = await this.photoMetadataExtractor.extract(
        input.tempFilePath,
      );

      if (extracted === null) {
        throw new BadRequestException(
          'Checkpoint photos must include EXIF timestamp and GPS metadata.',
        );
      }

      Object.assign(metadata, extracted);
      if (!hasCheckpointCaptureMetadata(metadata)) {
        throw new BadRequestException(
          'Checkpoint photos must include EXIF timestamp and GPS metadata.',
        );
      }
    }

    if (input.artifactType === 'MRL_TEST') {
      const results =
        metadata['results'] ?? metadata['substances'] ?? metadata['labResults'];
      if (Array.isArray(results)) {
        metadata['results'] = results;
      }
    }

    return Object.keys(metadata).length === 0 ? null : metadata;
  }

  private mapArtifact(artifact: {
    id: string;
    laneId: string;
    artifactType: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    contentHash: string;
    filePath: string;
    verificationStatus: string;
    source: string;
    checkpointId: string | null;
    metadata: Record<string, unknown> | null;
    uploadedAt: Date;
    updatedAt: Date;
  }): EvidenceArtifactResponse {
    return {
      id: artifact.id,
      laneId: artifact.laneId,
      artifactType:
        artifact.artifactType as EvidenceArtifactResponse['artifactType'],
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      fileSizeBytes: artifact.fileSizeBytes,
      contentHash: artifact.contentHash,
      contentHashPreview: artifact.contentHash.slice(0, 8),
      storagePath: artifact.filePath,
      verificationStatus:
        artifact.verificationStatus as EvidenceArtifactResponse['verificationStatus'],
      source: artifact.source as EvidenceArtifactResponse['source'],
      checkpointId: artifact.checkpointId,
      metadata: artifact.metadata,
      createdAt: artifact.uploadedAt.toISOString(),
      updatedAt: artifact.updatedAt.toISOString(),
    };
  }

  private async createPartnerArtifact(
    input: {
      laneId: string;
      artifactType: 'MRL_TEST' | 'TEMP_DATA';
      fileName: string;
      issuer?: string;
      issuedAt?: string;
      payload: Record<string, unknown>;
    },
    actor: EvidenceRequestUser,
  ) {
    const directory = await mkdtemp(`${tmpdir()}/zrl-evidence-partner-`);
    const filePath = `${directory}/${input.fileName}`;

    try {
      await writeFile(filePath, JSON.stringify(input.payload));
      return await this.persistArtifact(
        {
          laneId: input.laneId,
          artifactType: input.artifactType,
          fileName: input.fileName,
          mimeType: 'application/json',
          fileSizeBytes: Buffer.byteLength(JSON.stringify(input.payload)),
          tempFilePath: filePath,
          source: 'PARTNER_API',
          checkpointId: null,
          metadata: {
            issuer: input.issuer ?? null,
            issuedAt: input.issuedAt ?? null,
            payloadType: input.artifactType,
            ...normalizePartnerMetadata(input.artifactType, input.payload),
          },
          links: [],
        },
        actor,
        true,
      );
    } finally {
      await rm(directory, { force: true, recursive: true }).catch(
        () => undefined,
      );
    }
  }
}

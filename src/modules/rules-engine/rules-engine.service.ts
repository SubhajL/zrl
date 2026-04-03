import { Injectable, Logger } from '@nestjs/common';
import { AuditAction } from '../../common/audit/audit.types';
import { HashingService } from '../../common/hashing/hashing.service';
import { NotificationService } from '../notifications/notification.service';
import {
  buildRuleSnapshotPayload,
  classifyRiskLevel,
  computeStringencyRatio,
  normalizeRuleMarket,
  normalizeRuleProduct,
} from './rules-engine.utils';
import { RuleChecklistCategory } from './rules-engine.types';
import type {
  RuleLoaderPort,
  RuleLaneArtifact,
  RuleLaneEvaluation,
  RuleChecklistCategorySummary,
  RuleChecklistItem,
  RuleMarket,
  RuleCertificationAlert,
  RuleCertificationArtifact,
  RuleCertificationAlertDeliveryClaimInput,
  RuleCertificationScanArtifact,
  RuleCertificationScanResult,
  RuleCertificationUploadAlertInput,
  RuleLabValidationResult,
  RuleLabValidationResultItem,
  RuleReloadResult,
  RuleSetRecord,
  RuleSnapshotPayload,
  RuleStore,
  RuleSubstanceInput,
  RuleSubstanceRecord,
  RuleVersionFilter,
  RuleVersionRecord,
} from './rules-engine.types';

const DOCUMENT_CATEGORY_FALLBACK: Record<string, RuleChecklistCategory> = {
  'phytosanitary certificate': RuleChecklistCategory.REGULATORY,
  'vht certificate': RuleChecklistCategory.REGULATORY,
  'mrl test results': RuleChecklistCategory.REGULATORY,
  'export license': RuleChecklistCategory.REGULATORY,
  'gap certificate': RuleChecklistCategory.REGULATORY,
  'grading report': RuleChecklistCategory.QUALITY,
  'product photos': RuleChecklistCategory.QUALITY,
  'temperature log': RuleChecklistCategory.COLD_CHAIN,
  'sla summary': RuleChecklistCategory.COLD_CHAIN,
  'excursion report': RuleChecklistCategory.COLD_CHAIN,
  'commercial invoice': RuleChecklistCategory.CHAIN_OF_CUSTODY,
  'packing list': RuleChecklistCategory.CHAIN_OF_CUSTODY,
  'handoff signatures': RuleChecklistCategory.CHAIN_OF_CUSTODY,
  'transport document': RuleChecklistCategory.CHAIN_OF_CUSTODY,
  'delivery note': RuleChecklistCategory.CHAIN_OF_CUSTODY,
};

const CATEGORY_WEIGHT_KEYS: Record<
  RuleChecklistCategory,
  keyof RuleSnapshotPayload['completenessWeights']
> = {
  REGULATORY: 'regulatory',
  QUALITY: 'quality',
  COLD_CHAIN: 'coldChain',
  CHAIN_OF_CUSTODY: 'chainOfCustody',
};

const CERTIFICATION_ARTIFACT_TYPES = [
  'PHYTO_CERT',
  'VHT_CERT',
  'GAP_CERT',
] as const;
const CERTIFICATION_WARNING_DAYS = [7, 14, 30] as const;
const DAY_MS = 24 * 60 * 60_000;

interface CertificationAlertCandidate {
  laneId: string;
  lanePublicId: string;
  artifactId: string;
  artifactType: 'PHYTO_CERT' | 'VHT_CERT' | 'GAP_CERT';
  alertCode: 'EXPIRED' | 'WARNING_30' | 'WARNING_14' | 'WARNING_7';
  warningDays: number | null;
  expiresAt: Date | null;
  title: string;
  message: string;
  data: Record<string, unknown>;
}

interface ParsedLabResult {
  substance: string;
  cas: string | null;
  valueMgKg: number;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseDateString(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(
    private readonly loader: RuleLoaderPort,
    private readonly store: RuleStore,
    private readonly hashingService: HashingService,
    private readonly notificationService?: NotificationService,
  ) {}

  async reloadRules(): Promise<RuleReloadResult> {
    const definitions = await this.loader.reload();

    const ruleSets = await this.store.runInTransaction(
      async (transactional) => {
        const synced: RuleSetRecord[] = [];

        for (const definition of definitions) {
          synced.push(await transactional.syncRuleDefinition(definition));
        }

        return synced;
      },
    );

    return {
      loaded: definitions.length,
      ruleSets,
    };
  }

  async getRuleSnapshot(
    market: string,
    product: string,
  ): Promise<RuleSnapshotPayload | null> {
    const normalizedMarket = normalizeRuleMarket(market);
    const normalizedProduct = normalizeRuleProduct(product);
    const definition = await this.loader.getRuleDefinition(
      normalizedMarket,
      normalizedProduct,
    );
    const latest = await this.store.findLatestRuleSet(
      normalizedMarket,
      normalizedProduct,
    );

    if (definition === null && latest === null) {
      return null;
    }

    const payload = latest?.payload ?? definition;
    if (payload === null || payload === undefined) {
      return null;
    }

    return buildRuleSnapshotPayload({
      ...payload,
      version: latest?.version ?? payload.version,
      effectiveDate: latest?.effectiveDate ?? payload.effectiveDate,
      sourcePath: latest?.sourcePath ?? payload.sourcePath,
    });
  }

  async listMarkets(): Promise<RuleMarket[]> {
    return await this.store.listMarkets();
  }

  async listSubstances(market?: string): Promise<RuleSubstanceRecord[]> {
    if (market === undefined) {
      return await this.store.listSubstances();
    }

    return await this.store.listSubstances(normalizeRuleMarket(market));
  }

  async createSubstance(
    market: string,
    input: RuleSubstanceInput,
    actorId: string,
  ): Promise<RuleSubstanceRecord> {
    const normalizedMarket = normalizeRuleMarket(market);
    const substance = await this.store.runInTransaction(
      async (transactional) => {
        const substance = await transactional.createSubstance(
          normalizedMarket,
          input,
        );

        await transactional.bumpRuleVersionsForMarket(
          normalizedMarket,
          `Substance created: ${substance.name}`,
        );

        await transactional.appendSubstanceAuditEntry({
          actor: actorId,
          action: AuditAction.CREATE,
          substanceId: substance.id,
          payloadHash: await this.buildSubstancePayloadHash(substance),
        });

        return substance;
      },
    );
    await this.notifyRuleChange(normalizedMarket, substance, 'CREATED');
    return substance;
  }

  async updateSubstance(
    substanceId: string,
    input: Partial<RuleSubstanceInput>,
    actorId: string,
  ): Promise<RuleSubstanceRecord> {
    const substance = await this.store.runInTransaction(
      async (transactional) => {
        const substance = await transactional.updateSubstance(
          substanceId,
          input,
        );

        await transactional.bumpRuleVersionsForMarket(
          substance.market,
          `Substance updated: ${substance.name}`,
        );

        await transactional.appendSubstanceAuditEntry({
          actor: actorId,
          action: AuditAction.UPDATE,
          substanceId: substance.id,
          payloadHash: await this.buildSubstancePayloadHash(substance),
        });

        return substance;
      },
    );
    await this.notifyRuleChange(substance.market, substance, 'UPDATED');
    return substance;
  }

  async listRuleVersions(
    filter?: RuleVersionFilter,
  ): Promise<RuleVersionRecord[]> {
    return await this.store.listRuleVersions(
      filter === undefined
        ? undefined
        : {
            market:
              filter.market === undefined
                ? undefined
                : normalizeRuleMarket(filter.market),
            product:
              filter.product === undefined
                ? undefined
                : normalizeRuleProduct(filter.product),
          },
    );
  }

  async getChecklist(
    market: string,
    product: string,
  ): Promise<{ checklist: RuleChecklistItem[] }> {
    const snapshot = await this.getRuleSnapshot(market, product);
    if (snapshot === null) {
      return { checklist: [] };
    }

    return {
      checklist: this.buildChecklist(snapshot, []),
    };
  }

  evaluateLane(
    snapshot: RuleSnapshotPayload | null,
    artifacts: RuleLaneArtifact[],
  ): RuleLaneEvaluation {
    if (snapshot === null) {
      return {
        score: 0,
        required: 0,
        present: 0,
        missing: [],
        checklist: [],
        categories: [],
        labValidation: null,
        certificationAlerts: [],
      };
    }

    const checklist = this.buildChecklist(snapshot, artifacts);
    const categories = this.buildCategorySummary(
      snapshot.completenessWeights,
      checklist,
    );
    const score = Math.round(
      categories.reduce(
        (sum, category) => sum + category.score * category.weight,
        0,
      ) * 100,
    );
    const labValidation = this.buildLabValidation(snapshot, artifacts);
    const certificationAlerts = this.detectCertificationAlerts(artifacts);

    return {
      score,
      required: checklist.length,
      present: checklist.filter((item) => item.status === 'PRESENT').length,
      missing: checklist
        .filter((item) => item.status !== 'PRESENT')
        .map((item) => item.label),
      checklist,
      categories,
      labValidation,
      certificationAlerts,
    };
  }

  buildDerivedSubstanceFields(input: RuleSubstanceInput) {
    const stringencyRatio = computeStringencyRatio(
      input.thaiMrl,
      input.destinationMrl,
    );

    return {
      ...input,
      stringencyRatio,
      riskLevel: classifyRiskLevel(stringencyRatio),
    };
  }

  async notifyCertificationAlertForArtifact(
    input: RuleCertificationUploadAlertInput,
    now = new Date(),
  ): Promise<void> {
    const candidate = this.buildImmediateCertificationAlertCandidate(
      input.laneId,
      input.lanePublicId,
      input.artifact,
      now,
    );
    if (candidate === null) {
      return;
    }

    await this.dispatchCertificationAlertCandidate(candidate, now);
  }

  async scanCertificationExpirations(
    now = new Date(),
  ): Promise<RuleCertificationScanResult> {
    const artifacts = await this.store.listLatestActiveCertificationArtifacts();
    let notified = 0;
    let skipped = 0;

    for (const artifact of artifacts) {
      const candidate = this.buildScheduledCertificationAlertCandidate(
        artifact,
        now,
      );
      if (candidate === null) {
        skipped += 1;
        continue;
      }

      try {
        const dispatched = await this.dispatchCertificationAlertCandidate(
          candidate,
          now,
        );
        if (dispatched) {
          notified += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        skipped += 1;
        this.logger.error(
          `Certification expiry scan failed for artifact ${artifact.artifactId}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return {
      processed: artifacts.length,
      notified,
      skipped,
    };
  }

  private async buildSubstancePayloadHash(
    substance: RuleSubstanceRecord,
  ): Promise<string> {
    return await this.hashingService.hashString(
      JSON.stringify({
        market: substance.market,
        name: substance.name,
        cas: substance.cas,
        thaiMrl: substance.thaiMrl,
        destinationMrl: substance.destinationMrl,
        stringencyRatio: substance.stringencyRatio,
        riskLevel: substance.riskLevel,
      }),
    );
  }

  private async notifyRuleChange(
    market: RuleMarket,
    substance: RuleSubstanceRecord,
    changeType: 'CREATED' | 'UPDATED',
  ): Promise<void> {
    await this.notificationService?.notifyMarketAudience(market, {
      laneId: null,
      type: 'RULE_CHANGE',
      title: 'Rule update published',
      message: `${this.formatMarketLabel(market)} market rules were updated for ${substance.name}.`,
      data: {
        market,
        substanceId: substance.id,
        substanceName: substance.name,
        changeType,
      },
    });
  }

  private formatMarketLabel(market: RuleMarket): string {
    return market.charAt(0) + market.slice(1).toLowerCase();
  }

  private async dispatchCertificationAlertCandidate(
    candidate: CertificationAlertCandidate,
    now: Date,
  ): Promise<boolean> {
    const claim = await this.store.claimCertificationAlertDelivery({
      laneId: candidate.laneId,
      artifactId: candidate.artifactId,
      artifactType: candidate.artifactType,
      alertCode: candidate.alertCode,
      warningDays: candidate.warningDays,
      expiresAt: candidate.expiresAt,
      claimedAt: now,
    } satisfies RuleCertificationAlertDeliveryClaimInput);
    if (claim === null) {
      return false;
    }

    try {
      const notifications =
        (await this.notificationService?.notifyLaneOwner(candidate.laneId, {
          type: 'CERTIFICATION_EXPIRY',
          title: candidate.title,
          message: candidate.message,
          data: candidate.data,
        })) ?? [];
      await this.store.completeCertificationAlertDelivery(claim.id, {
        notificationId: notifications[0]?.id ?? null,
        deliveryStatus: notifications.length > 0 ? 'DELIVERED' : 'SKIPPED',
        deliveredAt: now,
      });
      return notifications.length > 0;
    } catch (error) {
      await this.store.releaseCertificationAlertDelivery(claim.id);
      throw error;
    }
  }

  private buildImmediateCertificationAlertCandidate(
    laneId: string,
    lanePublicId: string,
    artifact: RuleCertificationArtifact,
    now: Date,
  ): CertificationAlertCandidate | null {
    const expiryStatus = this.readCertificationExpiryStatus(artifact, now);
    if (expiryStatus.status === 'VALID') {
      return null;
    }

    return {
      laneId,
      lanePublicId,
      artifactId: artifact.id,
      artifactType: artifact.artifactType,
      alertCode: 'EXPIRED',
      warningDays: null,
      expiresAt: expiryStatus.expiresAt,
      title:
        expiryStatus.reason === 'MISSING_EXPIRY'
          ? 'Certification expiry metadata missing'
          : 'Certification expired',
      message:
        expiryStatus.reason === 'MISSING_EXPIRY'
          ? `Lane ${lanePublicId} ${this.formatCertificationLabel(artifact.artifactType)} is missing expiry metadata.`
          : `Lane ${lanePublicId} ${this.formatCertificationLabel(artifact.artifactType)} has expired.`,
      data: {
        laneId,
        lanePublicId,
        artifactId: artifact.id,
        artifactType: artifact.artifactType,
        alertCode: 'EXPIRED',
        expiresAt: expiryStatus.expiresAt?.toISOString() ?? null,
        issue:
          expiryStatus.reason === 'MISSING_EXPIRY'
            ? 'MISSING_EXPIRY'
            : 'EXPIRED',
      },
    };
  }

  private buildScheduledCertificationAlertCandidate(
    artifact: RuleCertificationScanArtifact,
    now: Date,
  ): CertificationAlertCandidate | null {
    const certificationArtifact: RuleCertificationArtifact = {
      id: artifact.artifactId,
      artifactType: artifact.artifactType,
      fileName: artifact.fileName,
      metadata: artifact.metadata,
    };
    const expiryStatus = this.readCertificationExpiryStatus(
      certificationArtifact,
      now,
    );
    if (expiryStatus.status === 'EXPIRED') {
      return this.buildImmediateCertificationAlertCandidate(
        artifact.laneId,
        artifact.lanePublicId,
        certificationArtifact,
        now,
      );
    }

    if (expiryStatus.expiresAt === null) {
      return null;
    }

    const warningDays = this.resolveWarningDays(expiryStatus.expiresAt, now);
    if (warningDays === null) {
      return null;
    }

    return {
      laneId: artifact.laneId,
      lanePublicId: artifact.lanePublicId,
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      alertCode: `WARNING_${warningDays}` as
        | 'WARNING_30'
        | 'WARNING_14'
        | 'WARNING_7',
      warningDays,
      expiresAt: expiryStatus.expiresAt,
      title: `Certification expires in ${warningDays} days`,
      message: `Lane ${artifact.lanePublicId} ${this.formatCertificationLabel(artifact.artifactType)} expires in ${warningDays} days.`,
      data: {
        laneId: artifact.laneId,
        lanePublicId: artifact.lanePublicId,
        artifactId: artifact.artifactId,
        artifactType: artifact.artifactType,
        alertCode: `WARNING_${warningDays}`,
        warningDays,
        expiresAt: expiryStatus.expiresAt.toISOString(),
      },
    };
  }

  private readCertificationExpiryStatus(
    artifact: RuleCertificationArtifact,
    now: Date,
  ): {
    status: 'VALID' | 'EXPIRED';
    reason: 'VALID' | 'EXPIRED' | 'MISSING_EXPIRY';
    expiresAt: Date | null;
  } {
    const expiresAtValue = this.readExpiryDate(artifact.metadata);
    if (expiresAtValue === null) {
      return {
        status: 'EXPIRED',
        reason: 'MISSING_EXPIRY',
        expiresAt: null,
      };
    }

    const expiresAt = new Date(expiresAtValue);
    if (expiresAt.getTime() <= now.getTime()) {
      return {
        status: 'EXPIRED',
        reason: 'EXPIRED',
        expiresAt,
      };
    }

    return {
      status: 'VALID',
      reason: 'VALID',
      expiresAt,
    };
  }

  private resolveWarningDays(expiresAt: Date, now: Date): number | null {
    const daysUntilExpiry = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / DAY_MS,
    );
    if (daysUntilExpiry <= 0) {
      return null;
    }

    if (daysUntilExpiry <= CERTIFICATION_WARNING_DAYS[0]) {
      return CERTIFICATION_WARNING_DAYS[0];
    }
    if (daysUntilExpiry <= CERTIFICATION_WARNING_DAYS[1]) {
      return CERTIFICATION_WARNING_DAYS[1];
    }
    if (daysUntilExpiry <= CERTIFICATION_WARNING_DAYS[2]) {
      return CERTIFICATION_WARNING_DAYS[2];
    }

    return null;
  }

  private formatCertificationLabel(
    artifactType: RuleCertificationArtifact['artifactType'],
  ): string {
    switch (artifactType) {
      case 'PHYTO_CERT':
        return 'phytosanitary certificate';
      case 'VHT_CERT':
        return 'VHT certificate';
      case 'GAP_CERT':
        return 'GAP certificate';
    }
  }

  private buildChecklist(
    snapshot: RuleSnapshotPayload,
    artifacts: RuleLaneArtifact[],
  ): RuleChecklistItem[] {
    return snapshot.requiredDocuments.map((documentLabel) => {
      const category = this.resolveDocumentCategory(documentLabel);
      const matchingArtifacts = artifacts.filter((artifact) =>
        this.artifactSatisfiesDocument(documentLabel, artifact),
      );
      const certificationStatus = this.resolveCertificationDocumentStatus(
        documentLabel,
        matchingArtifacts,
      );
      const status =
        certificationStatus ??
        (matchingArtifacts.length > 0 ? 'PRESENT' : 'MISSING');
      const weight =
        snapshot.completenessWeights[CATEGORY_WEIGHT_KEYS[category]];

      return {
        key: slugify(documentLabel),
        label: documentLabel,
        category,
        weight,
        required: true,
        present: status === 'PRESENT',
        status,
        artifactIds: matchingArtifacts.map((artifact) => artifact.id),
      };
    });
  }

  private buildCategorySummary(
    weights: RuleSnapshotPayload['completenessWeights'],
    checklist: RuleChecklistItem[],
  ): RuleChecklistCategorySummary[] {
    return Object.values(RuleChecklistCategory).map((category) => {
      const items = checklist.filter((item) => item.category === category);
      const present = items.filter((item) => item.status === 'PRESENT').length;
      const required = items.length;

      return {
        category,
        weight: weights[CATEGORY_WEIGHT_KEYS[category]],
        required,
        present,
        score: required === 0 ? 1 : present / required,
      };
    });
  }

  private buildLabValidation(
    snapshot: RuleSnapshotPayload,
    artifacts: RuleLaneArtifact[],
  ): RuleLabValidationResult | null {
    const enforcementMode = snapshot.labPolicy?.enforcementMode;
    const latestLabArtifact = [...artifacts]
      .reverse()
      .find((artifact) => artifact.artifactType === 'MRL_TEST');

    if (latestLabArtifact === undefined) {
      if (enforcementMode === 'FULL_PESTICIDE') {
        return {
          status: 'BLOCKED',
          valid: false,
          hasUnknowns: false,
          blockingReasons: ['MRL_TEST_REQUIRED'],
          results: [],
        };
      }

      return null;
    }

    const results = this.parseLabResults(latestLabArtifact.metadata);
    const blockingReasons: string[] = [];
    if (enforcementMode === 'FULL_PESTICIDE' && results.length === 0) {
      blockingReasons.push('MRL_RESULTS_REQUIRED');
    }

    const resultByKey = new Map<string, ParsedLabResult>();
    for (const result of results) {
      resultByKey.set(normalizeKey(result.substance), result);
      if (result.cas !== null) {
        resultByKey.set(normalizeKey(result.cas), result);
      }
    }

    const matchedMeasuredKeys = new Set<string>();
    const validationResults: RuleLabValidationResultItem[] = [];
    const pushMeasuredKeys = (result: ParsedLabResult) => {
      matchedMeasuredKeys.add(normalizeKey(result.substance));
      if (result.cas !== null) {
        matchedMeasuredKeys.add(normalizeKey(result.cas));
      }
    };

    for (const substance of snapshot.substances) {
      const measured = this.findMeasuredResult(resultByKey, substance);
      if (measured === null) {
        validationResults.push({
          substance: substance.name,
          cas: substance.cas,
          valueMgKg: null,
          limitMgKg: substance.destinationMrl,
          passed: false,
          status: 'UNKNOWN',
          riskLevel: substance.riskLevel,
          limitSource: 'SPECIFIC',
        });
        continue;
      }

      pushMeasuredKeys(measured);
      const passed = measured.valueMgKg <= substance.destinationMrl;
      validationResults.push({
        substance: substance.name,
        cas: substance.cas,
        valueMgKg: measured.valueMgKg,
        limitMgKg: substance.destinationMrl,
        passed,
        status: passed ? 'PASS' : 'FAIL',
        riskLevel: substance.riskLevel,
        limitSource: 'SPECIFIC',
      });
    }

    const defaultDestinationMrlMgKg =
      snapshot.labPolicy?.defaultDestinationMrlMgKg ?? null;
    for (const measured of results) {
      const measuredKeys = [
        normalizeKey(measured.substance),
        measured.cas === null ? null : normalizeKey(measured.cas),
      ].filter((value): value is string => value !== null);
      if (measuredKeys.some((key) => matchedMeasuredKeys.has(key))) {
        continue;
      }

      if (defaultDestinationMrlMgKg === null) {
        validationResults.push({
          substance: measured.substance,
          cas: measured.cas,
          valueMgKg: measured.valueMgKg,
          limitMgKg: null,
          passed: false,
          status: 'UNKNOWN',
          riskLevel: null,
          limitSource: 'DEFAULT_FALLBACK',
        });
        continue;
      }

      const passed = measured.valueMgKg <= defaultDestinationMrlMgKg;
      validationResults.push({
        substance: measured.substance,
        cas: measured.cas,
        valueMgKg: measured.valueMgKg,
        limitMgKg: defaultDestinationMrlMgKg,
        passed,
        status: passed ? 'PASS' : 'FAIL',
        riskLevel: null,
        limitSource: 'DEFAULT_FALLBACK',
      });
    }

    const hasUnknowns = validationResults.some(
      (result) => result.status === 'UNKNOWN',
    );
    const hasFailures = validationResults.some(
      (result) => result.status === 'FAIL',
    );

    if (blockingReasons.length > 0) {
      return {
        status: 'BLOCKED',
        valid: false,
        hasUnknowns,
        blockingReasons,
        results: validationResults,
      };
    }

    return {
      status: hasFailures ? 'FAIL' : 'PASS',
      valid: !hasFailures,
      hasUnknowns,
      blockingReasons: [],
      results: validationResults,
    };
  }

  private findMeasuredResult(
    resultByKey: Map<string, ParsedLabResult>,
    substance: RuleSnapshotPayload['substances'][number],
  ): ParsedLabResult | null {
    const keys = [
      normalizeKey(substance.name),
      ...(substance.cas === null ? [] : [normalizeKey(substance.cas)]),
      ...substance.aliases.map((alias) => normalizeKey(alias)),
    ];
    for (const key of keys) {
      const result = resultByKey.get(key);
      if (result !== undefined) {
        return result;
      }
    }

    return null;
  }

  private detectCertificationAlerts(
    artifacts: RuleLaneArtifact[],
  ): RuleCertificationAlert[] {
    return CERTIFICATION_ARTIFACT_TYPES.map((artifactType) => {
      const matchingArtifacts = artifacts.filter(
        (artifact) => artifact.artifactType === artifactType,
      );
      if (matchingArtifacts.length === 0) {
        return {
          artifactType,
          status: 'MISSING',
          expiresAt: null,
          artifactId: null,
          message: `${artifactType} is missing.`,
        };
      }

      const latestArtifact = matchingArtifacts[matchingArtifacts.length - 1];
      const expiresAt = this.readExpiryDate(latestArtifact.metadata);
      if (expiresAt === null) {
        return {
          artifactType,
          status: 'EXPIRED',
          expiresAt: null,
          artifactId: latestArtifact.id,
          message: `${artifactType} is missing expiry metadata.`,
        };
      }

      return new Date(expiresAt).getTime() <= Date.now()
        ? {
            artifactType,
            status: 'EXPIRED',
            expiresAt,
            artifactId: latestArtifact.id,
            message: `${artifactType} is expired.`,
          }
        : {
            artifactType,
            status: 'VALID',
            expiresAt,
            artifactId: latestArtifact.id,
            message: `${artifactType} is valid.`,
          };
    });
  }

  private resolveDocumentCategory(label: string): RuleChecklistCategory {
    return (
      DOCUMENT_CATEGORY_FALLBACK[normalizeKey(label)] ??
      RuleChecklistCategory.REGULATORY
    );
  }

  private artifactSatisfiesDocument(
    documentLabel: string,
    artifact: RuleLaneArtifact,
  ): boolean {
    const documentKey = normalizeKey(documentLabel);
    const metadata = artifact.metadata ?? {};
    const metadataDocumentType =
      readString(metadata, 'documentType') ??
      readString(metadata, 'documentName');
    const fileName = normalizeKey(artifact.fileName);

    if (
      metadataDocumentType !== null &&
      normalizeKey(metadataDocumentType) === documentKey
    ) {
      return true;
    }

    switch (documentKey) {
      case 'phytosanitary certificate':
        return artifact.artifactType === 'PHYTO_CERT';
      case 'vht certificate':
        return artifact.artifactType === 'VHT_CERT';
      case 'mrl test results':
        return artifact.artifactType === 'MRL_TEST';
      case 'gap certificate':
        return artifact.artifactType === 'GAP_CERT';
      case 'product photos':
      case 'grading report':
        return artifact.artifactType === 'CHECKPOINT_PHOTO';
      case 'temperature log':
      case 'sla summary':
      case 'excursion report':
        return artifact.artifactType === 'TEMP_DATA';
      case 'handoff signatures':
        return artifact.artifactType === 'HANDOFF_SIGNATURE';
      case 'commercial invoice':
      case 'packing list':
      case 'transport document':
      case 'delivery note':
      case 'export license':
        return (
          artifact.artifactType === 'INVOICE' || fileName.includes(documentKey)
        );
      default:
        return fileName.includes(documentKey);
    }
  }

  private resolveCertificationDocumentStatus(
    documentLabel: string,
    artifacts: RuleLaneArtifact[],
  ): RuleChecklistItem['status'] | null {
    const certificationType =
      normalizeKey(documentLabel) === 'phytosanitary certificate'
        ? 'PHYTO_CERT'
        : normalizeKey(documentLabel) === 'vht certificate'
          ? 'VHT_CERT'
          : normalizeKey(documentLabel) === 'gap certificate'
            ? 'GAP_CERT'
            : null;

    if (certificationType === null) {
      return null;
    }

    if (artifacts.length === 0) {
      return 'MISSING';
    }

    const latestArtifact = artifacts[artifacts.length - 1];
    const expiresAt = this.readExpiryDate(latestArtifact.metadata);
    if (expiresAt === null) {
      return 'EXPIRED';
    }

    return new Date(expiresAt).getTime() <= Date.now() ? 'EXPIRED' : 'PRESENT';
  }

  private readExpiryDate(
    metadata: Record<string, unknown> | null,
  ): string | null {
    if (metadata === null) {
      return null;
    }

    return (
      parseDateString(metadata['expiresAt']) ??
      parseDateString(metadata['expiryDate']) ??
      parseDateString(metadata['expirationDate'])
    );
  }

  private parseLabResults(
    metadata: Record<string, unknown> | null,
  ): ParsedLabResult[] {
    if (metadata === null) {
      return [];
    }

    const resultsValue =
      metadata['results'] ?? metadata['substances'] ?? metadata['labResults'];
    if (!Array.isArray(resultsValue)) {
      return [];
    }

    return resultsValue.flatMap((entry) => {
      const record = asRecord(entry);
      if (record === null) {
        return [];
      }

      const substance =
        readString(record, 'substance') ?? readString(record, 'name');
      const valueMgKg =
        readNumber(record, 'valueMgKg') ??
        readNumber(record, 'value_mg_kg') ??
        readNumber(record, 'value');

      if (substance === null || valueMgKg === null) {
        return [];
      }

      return [
        {
          substance,
          cas: readString(record, 'cas'),
          valueMgKg,
        },
      ];
    });
  }
}

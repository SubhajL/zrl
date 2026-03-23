import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../common/audit/audit.types';
import { HashingService } from '../../common/hashing/hashing.service';
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
  constructor(
    private readonly loader: RuleLoaderPort,
    private readonly store: RuleStore,
    private readonly hashingService: HashingService,
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

    return await this.store.runInTransaction(async (transactional) => {
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
    });
  }

  async updateSubstance(
    substanceId: string,
    input: Partial<RuleSubstanceInput>,
    actorId: string,
  ): Promise<RuleSubstanceRecord> {
    return await this.store.runInTransaction(async (transactional) => {
      const substance = await transactional.updateSubstance(substanceId, input);

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
    });
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
    const latestLabArtifact = [...artifacts]
      .reverse()
      .find((artifact) => artifact.artifactType === 'MRL_TEST');

    if (latestLabArtifact === undefined) {
      return null;
    }

    const results = this.parseLabResults(latestLabArtifact.metadata);
    const resultByKey = new Map(
      results.flatMap((result) => {
        const keys = [normalizeKey(result.substance)];
        if (result.cas !== null) {
          keys.push(normalizeKey(result.cas));
        }

        return keys.map((key) => [key, result] as const);
      }),
    );

    const validationResults: RuleLabValidationResultItem[] =
      snapshot.substances.map((substance) => {
        const measured =
          resultByKey.get(normalizeKey(substance.name)) ??
          resultByKey.get(normalizeKey(substance.cas));
        if (measured === undefined) {
          return {
            substance: substance.name,
            cas: substance.cas,
            valueMgKg: null,
            limitMgKg: substance.destinationMrl,
            passed: false,
            status: 'UNKNOWN',
            riskLevel: substance.riskLevel,
          };
        }

        const passed = measured.valueMgKg <= substance.destinationMrl;
        return {
          substance: substance.name,
          cas: substance.cas,
          valueMgKg: measured.valueMgKg,
          limitMgKg: substance.destinationMrl,
          passed,
          status: passed ? 'PASS' : 'FAIL',
          riskLevel: substance.riskLevel,
        };
      });

    return {
      valid: validationResults.every((result) => result.status !== 'FAIL'),
      hasUnknowns: validationResults.some(
        (result) => result.status === 'UNKNOWN',
      ),
      results: validationResults,
    };
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
  ): Array<{ substance: string; cas: string | null; valueMgKg: number }> {
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

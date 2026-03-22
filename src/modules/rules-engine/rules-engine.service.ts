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
import type {
  RuleLoaderPort,
  RuleMarket,
  RuleReloadResult,
  RuleSetRecord,
  RuleSnapshotPayload,
  RuleStore,
  RuleSubstanceInput,
  RuleSubstanceRecord,
  RuleVersionFilter,
  RuleVersionRecord,
} from './rules-engine.types';

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
}

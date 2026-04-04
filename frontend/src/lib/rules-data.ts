import { AppApiError, requestAppJson } from './app-api';
import type {
  DestinationMarket,
  MrlSubstance,
  ProductType,
  RuleSnapshot,
} from './types';

const RULE_PRODUCTS: readonly ProductType[] = [
  'MANGO',
  'DURIAN',
  'MANGOSTEEN',
  'LONGAN',
];

interface RuleVersionRecord {
  readonly market: DestinationMarket;
  readonly version: number;
  readonly changesSummary: string;
  readonly changedAt: string;
}

interface RuleSubstanceRecord {
  readonly id: string;
  readonly name: string;
  readonly cas: string;
  readonly thaiMrl: number;
  readonly destinationMrl: number;
  readonly stringencyRatio: number;
  readonly riskLevel: MrlSubstance['riskLevel'];
  readonly updatedAt: string;
}

export interface RulesAdminData {
  readonly markets: DestinationMarket[];
  readonly versions: RuleVersionRecord[];
  readonly rulesetsByMarket: Partial<Record<DestinationMarket, RuleSnapshot[]>>;
  readonly substancesByMarket: Partial<Record<DestinationMarket, MrlSubstance[]>>;
}

function mapSubstance(record: RuleSubstanceRecord): MrlSubstance {
  return {
    id: record.id,
    name: record.name,
    casNumber: record.cas,
    thaiMrl: record.thaiMrl,
    destinationMrl: record.destinationMrl,
    stringencyRatio: record.stringencyRatio,
    riskLevel: record.riskLevel,
    updatedAt: record.updatedAt,
  };
}

export async function loadRulesAdminData(): Promise<RulesAdminData> {
  const markets = await requestAppJson<DestinationMarket[]>('/api/zrl/rules/markets');
  const versions = await requestAppJson<RuleVersionRecord[]>(
    '/api/zrl/rules/versions',
  );
  const rulesetEntries = await Promise.all(
    markets.map(async (market) => {
      const rulesets = (
        await Promise.all(
          RULE_PRODUCTS.map(async (product) => {
            try {
              return await requestAppJson<RuleSnapshot>(
                `/api/zrl/rules/markets/${market}/products/${product}/ruleset`,
              );
            } catch (error) {
              if (
                error instanceof AppApiError &&
                (error.status === 400 || error.status === 404)
              ) {
                return null;
              }

              throw error;
            }
          }),
        )
      ).filter((ruleset): ruleset is RuleSnapshot => ruleset !== null);

      return [market, rulesets] as const;
    }),
  );
  const substancesEntries = await Promise.all(
    markets.map(async (market) => {
      const substances = await requestAppJson<RuleSubstanceRecord[]>(
        `/api/zrl/rules/markets/${market}/substances`,
      );
      return [market, substances.map(mapSubstance)] as const;
    }),
  );

  return {
    markets,
    versions,
    rulesetsByMarket: Object.fromEntries(rulesetEntries),
    substancesByMarket: Object.fromEntries(substancesEntries),
  };
}

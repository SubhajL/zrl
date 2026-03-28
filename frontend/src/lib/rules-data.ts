import { requestAppJson } from './app-api';
import type { DestinationMarket, MrlSubstance } from './types';

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
    substancesByMarket: Object.fromEntries(substancesEntries),
  };
}

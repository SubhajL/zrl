import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { DestinationMarket, ProductType } from '../types';

export type WizardTransportMode = 'Air' | 'Sea' | 'Truck';
export type WizardColdChainMode = 'Manual' | 'Logger' | 'Telemetry';

export interface LaneCreationScenario {
  readonly name: string;
  readonly product: ProductType;
  readonly market: DestinationMarket;
  readonly variety: string;
  readonly quantityKg: string;
  readonly harvestDate: string;
  readonly originProvince: string;
  readonly transportMode: WizardTransportMode;
  readonly carrier: string;
  readonly coldChainMode: WizardColdChainMode;
  readonly deviceId: string | null;
  readonly dataFrequencySeconds: string | null;
}

const RULES_DIRECTORY_CANDIDATES = [
  resolve(process.cwd(), 'rules'),
  resolve(process.cwd(), '..', 'rules'),
];

function resolveRulesDirectory(): string | null {
  return (
    RULES_DIRECTORY_CANDIDATES.find((directory) => existsSync(directory)) ??
    null
  );
}

const RULES_DIRECTORY = resolveRulesDirectory();

function hasLiveRuleSupport(
  market: DestinationMarket,
  product: ProductType,
): boolean {
  if (RULES_DIRECTORY === null) {
    return false;
  }

  return existsSync(
    resolve(
      RULES_DIRECTORY,
      market.toLowerCase(),
      `${product.toLowerCase()}.yaml`,
    ),
  );
}

export const LANE_CREATION_SCENARIOS: readonly LaneCreationScenario[] = [
  {
    name: 'mango-japan-air',
    product: 'MANGO',
    market: 'JAPAN',
    variety: 'Nam Doc Mai',
    quantityKg: '5000',
    harvestDate: '2026-03-29',
    originProvince: 'Chachoengsao',
    transportMode: 'Air',
    carrier: 'Thai Airways Cargo',
    coldChainMode: 'Logger',
    deviceId: 'logger-mango-jp-01',
    dataFrequencySeconds: '600',
  },
  {
    name: 'mango-china-sea',
    product: 'MANGO',
    market: 'CHINA',
    variety: 'Keo Savoy',
    quantityKg: '4200',
    harvestDate: '2026-03-30',
    originProvince: 'Rayong',
    transportMode: 'Sea',
    carrier: 'Maersk Reefer Thailand',
    coldChainMode: 'Telemetry',
    deviceId: 'telemetry-mango-cn-01',
    dataFrequencySeconds: '30',
  },
  {
    name: 'mango-korea-truck',
    product: 'MANGO',
    market: 'KOREA',
    variety: 'Mahachanok',
    quantityKg: '3800',
    harvestDate: '2026-03-31',
    originProvince: 'Nakhon Ratchasima',
    transportMode: 'Truck',
    carrier: 'Kerry Cold Chain',
    coldChainMode: 'Manual',
    deviceId: null,
    dataFrequencySeconds: null,
  },
  {
    name: 'mango-eu-air',
    product: 'MANGO',
    market: 'EU',
    variety: 'R2E2',
    quantityKg: '4600',
    harvestDate: '2026-04-01',
    originProvince: 'Phetchabun',
    transportMode: 'Air',
    carrier: 'Lufthansa Cargo',
    coldChainMode: 'Logger',
    deviceId: 'logger-mango-eu-01',
    dataFrequencySeconds: '900',
  },
  {
    name: 'durian-japan-sea',
    product: 'DURIAN',
    market: 'JAPAN',
    variety: 'Monthong',
    quantityKg: '2400',
    harvestDate: '2026-04-02',
    originProvince: 'Chanthaburi',
    transportMode: 'Sea',
    carrier: 'Evergreen Reefer',
    coldChainMode: 'Telemetry',
    deviceId: 'telemetry-durian-jp-01',
    dataFrequencySeconds: '45',
  },
  {
    name: 'durian-china-truck',
    product: 'DURIAN',
    market: 'CHINA',
    variety: 'Monthong',
    quantityKg: '3100',
    harvestDate: '2026-04-03',
    originProvince: 'Trat',
    transportMode: 'Truck',
    carrier: 'Kerry Thailand Linehaul',
    coldChainMode: 'Logger',
    deviceId: 'logger-durian-cn-01',
    dataFrequencySeconds: '300',
  },
  {
    name: 'durian-korea-air',
    product: 'DURIAN',
    market: 'KOREA',
    variety: 'Chanee',
    quantityKg: '2600',
    harvestDate: '2026-04-04',
    originProvince: 'Chumphon',
    transportMode: 'Air',
    carrier: 'Korean Air Cargo',
    coldChainMode: 'Logger',
    deviceId: 'logger-durian-kr-01',
    dataFrequencySeconds: '600',
  },
  {
    name: 'durian-eu-sea',
    product: 'DURIAN',
    market: 'EU',
    variety: 'Kradumthong',
    quantityKg: '2800',
    harvestDate: '2026-04-05',
    originProvince: 'Surat Thani',
    transportMode: 'Sea',
    carrier: 'MSC Reefer Export',
    coldChainMode: 'Telemetry',
    deviceId: 'telemetry-durian-eu-01',
    dataFrequencySeconds: '60',
  },
  {
    name: 'mangosteen-japan-truck',
    product: 'MANGOSTEEN',
    market: 'JAPAN',
    variety: 'Export Premium',
    quantityKg: '1800',
    harvestDate: '2026-04-06',
    originProvince: 'Nakhon Si Thammarat',
    transportMode: 'Truck',
    carrier: 'SCG Inter Logistics',
    coldChainMode: 'Manual',
    deviceId: null,
    dataFrequencySeconds: null,
  },
  {
    name: 'mangosteen-china-air',
    product: 'MANGOSTEEN',
    market: 'CHINA',
    variety: 'Chanthaburi Select',
    quantityKg: '2200',
    harvestDate: '2026-04-07',
    originProvince: 'Chanthaburi',
    transportMode: 'Air',
    carrier: 'Thai Airways Cargo',
    coldChainMode: 'Logger',
    deviceId: 'logger-mangosteen-cn-01',
    dataFrequencySeconds: '600',
  },
  {
    name: 'mangosteen-korea-sea',
    product: 'MANGOSTEEN',
    market: 'KOREA',
    variety: 'Ruby Crown',
    quantityKg: '2100',
    harvestDate: '2026-04-08',
    originProvince: 'Yala',
    transportMode: 'Sea',
    carrier: 'ONE Cold Chain',
    coldChainMode: 'Telemetry',
    deviceId: 'telemetry-mangosteen-kr-01',
    dataFrequencySeconds: '15',
  },
  {
    name: 'mangosteen-eu-truck',
    product: 'MANGOSTEEN',
    market: 'EU',
    variety: 'Southern Orchard',
    quantityKg: '1900',
    harvestDate: '2026-04-09',
    originProvince: 'Phatthalung',
    transportMode: 'Truck',
    carrier: 'DHL Supply Chain Road',
    coldChainMode: 'Manual',
    deviceId: null,
    dataFrequencySeconds: null,
  },
  {
    name: 'longan-japan-air',
    product: 'LONGAN',
    market: 'JAPAN',
    variety: 'E-Daw',
    quantityKg: '3300',
    harvestDate: '2026-04-10',
    originProvince: 'Lamphun',
    transportMode: 'Air',
    carrier: 'Japan Airlines Cargo',
    coldChainMode: 'Logger',
    deviceId: 'logger-longan-jp-01',
    dataFrequencySeconds: '300',
  },
  {
    name: 'longan-china-sea',
    product: 'LONGAN',
    market: 'CHINA',
    variety: 'Biew Kiew',
    quantityKg: '3600',
    harvestDate: '2026-04-11',
    originProvince: 'Chiang Mai',
    transportMode: 'Sea',
    carrier: 'COSCO Reefer',
    coldChainMode: 'Telemetry',
    deviceId: 'telemetry-longan-cn-01',
    dataFrequencySeconds: '30',
  },
  {
    name: 'longan-korea-truck',
    product: 'LONGAN',
    market: 'KOREA',
    variety: 'Diamond River',
    quantityKg: '3400',
    harvestDate: '2026-04-12',
    originProvince: 'Chiang Rai',
    transportMode: 'Truck',
    carrier: 'Kerry Cold Chain Express',
    coldChainMode: 'Manual',
    deviceId: null,
    dataFrequencySeconds: null,
  },
  {
    name: 'longan-eu-air',
    product: 'LONGAN',
    market: 'EU',
    variety: 'Golden Cluster',
    quantityKg: '3200',
    harvestDate: '2026-04-13',
    originProvince: 'Phayao',
    transportMode: 'Air',
    carrier: 'Qatar Airways Cargo',
    coldChainMode: 'Logger',
    deviceId: 'logger-longan-eu-01',
    dataFrequencySeconds: '900',
  },
] as const;

export const LIVE_LANE_CREATION_SCENARIOS = LANE_CREATION_SCENARIOS.filter(
  (scenario) => hasLiveRuleSupport(scenario.market, scenario.product),
);

export const UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS =
  LANE_CREATION_SCENARIOS.filter(
    (scenario) => !hasLiveRuleSupport(scenario.market, scenario.product),
  );

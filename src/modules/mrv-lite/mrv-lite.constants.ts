import type { EmissionFactor } from './mrv-lite.types';

export const MRV_LITE_STORE = Symbol('MRV_LITE_STORE');

// PRD carbon benchmarks — CO2e per kg for Thai export routes
export const DEFAULT_EMISSION_FACTORS: readonly EmissionFactor[] = [
  {
    product: 'MANGO',
    market: 'JAPAN',
    transportMode: 'AIR',
    co2ePerKg: 2.3,
    source: 'PRD benchmark',
    lastUpdated: '2026-03-21',
  },
  {
    product: 'MANGO',
    market: 'JAPAN',
    transportMode: 'SEA',
    co2ePerKg: 1.1,
    source: 'PRD benchmark',
    lastUpdated: '2026-03-21',
  },
  {
    product: 'DURIAN',
    market: 'CHINA',
    transportMode: 'TRUCK',
    co2ePerKg: 0.8,
    source: 'PRD benchmark',
    lastUpdated: '2026-03-21',
  },
  {
    product: 'DURIAN',
    market: 'CHINA',
    transportMode: 'SEA',
    co2ePerKg: 0.5,
    source: 'PRD benchmark',
    lastUpdated: '2026-03-21',
  },
  {
    product: 'MANGOSTEEN',
    market: 'JAPAN',
    transportMode: 'AIR',
    co2ePerKg: 2.1,
    source: 'PRD benchmark',
    lastUpdated: '2026-03-21',
  },
  // Default factors for unmatched routes
  {
    product: 'LONGAN',
    market: 'JAPAN',
    transportMode: 'AIR',
    co2ePerKg: 2.0,
    source: 'seed default',
    lastUpdated: '2026-03-21',
  },
  {
    product: 'LONGAN',
    market: 'CHINA',
    transportMode: 'TRUCK',
    co2ePerKg: 0.7,
    source: 'seed default',
    lastUpdated: '2026-03-21',
  },
  {
    product: 'MANGO',
    market: 'CHINA',
    transportMode: 'AIR',
    co2ePerKg: 2.0,
    source: 'seed default',
    lastUpdated: '2026-03-21',
  },
  {
    product: 'MANGO',
    market: 'KOREA',
    transportMode: 'AIR',
    co2ePerKg: 2.2,
    source: 'seed default',
    lastUpdated: '2026-03-21',
  },
  {
    product: 'MANGO',
    market: 'EU',
    transportMode: 'AIR',
    co2ePerKg: 3.5,
    source: 'seed default',
    lastUpdated: '2026-03-21',
  },
];

const DEFAULT_CO2E_PER_KG = 1.5;

export function findEmissionFactor(
  factors: readonly EmissionFactor[],
  product: string,
  market: string,
  transportMode: string,
): number {
  const factor = factors.find(
    (f) =>
      f.product === product &&
      f.market === market &&
      f.transportMode === transportMode,
  );
  return factor?.co2ePerKg ?? DEFAULT_CO2E_PER_KG;
}

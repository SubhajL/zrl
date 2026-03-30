import type { EmissionFactor } from './mrv-lite.types';

export const MRV_LITE_STORE = Symbol('MRV_LITE_STORE');

// PRD carbon benchmarks — CO₂e per kg for Thai export routes
export const EMISSION_FACTORS: readonly EmissionFactor[] = [
  { product: 'MANGO', market: 'JAPAN', transportMode: 'AIR', co2ePerKg: 2.3 },
  { product: 'MANGO', market: 'JAPAN', transportMode: 'SEA', co2ePerKg: 1.1 },
  {
    product: 'DURIAN',
    market: 'CHINA',
    transportMode: 'TRUCK',
    co2ePerKg: 0.8,
  },
  { product: 'DURIAN', market: 'CHINA', transportMode: 'SEA', co2ePerKg: 0.5 },
  {
    product: 'MANGOSTEEN',
    market: 'JAPAN',
    transportMode: 'AIR',
    co2ePerKg: 2.1,
  },
  // Default factors for unmatched routes
  { product: 'LONGAN', market: 'JAPAN', transportMode: 'AIR', co2ePerKg: 2.0 },
  {
    product: 'LONGAN',
    market: 'CHINA',
    transportMode: 'TRUCK',
    co2ePerKg: 0.7,
  },
  { product: 'MANGO', market: 'CHINA', transportMode: 'AIR', co2ePerKg: 2.0 },
  { product: 'MANGO', market: 'KOREA', transportMode: 'AIR', co2ePerKg: 2.2 },
  { product: 'MANGO', market: 'EU', transportMode: 'AIR', co2ePerKg: 3.5 },
];

const DEFAULT_CO2E_PER_KG = 1.5;

export function findEmissionFactor(
  product: string,
  market: string,
  transportMode: string,
): number {
  const factor = EMISSION_FACTORS.find(
    (f) =>
      f.product === product &&
      f.market === market &&
      f.transportMode === transportMode,
  );
  return factor?.co2ePerKg ?? DEFAULT_CO2E_PER_KG;
}

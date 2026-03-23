import type { LaneColdChainMode, LaneProduct } from '../lane/lane.types';

export interface FruitProfile {
  id: string;
  productType: LaneProduct;
  optimalMinC: number;
  optimalMaxC: number;
  chillingThresholdC: number | null;
  heatThresholdC: number;
  shelfLifeMinDays: number;
  shelfLifeMaxDays: number;
}

export interface TemperatureClassification {
  productType: LaneProduct;
  temperatureC: number;
  status: 'OPTIMAL' | 'CHILLING_INJURY' | 'HEAT_DAMAGE';
  isExcursion: boolean;
}

export interface LaneColdChainConfigPayload {
  mode: Exclude<LaneColdChainMode, null>;
  deviceId: string | null;
  dataFrequencySeconds: number | null;
}

export interface ColdChainStore {
  listProfiles(): Promise<FruitProfile[]>;
  findProfileByProduct(productType: LaneProduct): Promise<FruitProfile | null>;
}

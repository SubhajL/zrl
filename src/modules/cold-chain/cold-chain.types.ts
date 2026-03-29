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

export type TemperatureResolution = 'raw' | '5m' | '15m' | '1h';

export interface TemperatureReadingInput {
  timestamp: Date;
  temperatureC: number;
  deviceId: string | null;
}

export interface TemperatureReading {
  id: string;
  laneId: string;
  timestamp: Date;
  temperatureC: number;
  deviceId: string | null;
}

export type ExcursionSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
export type ExcursionDirection = 'LOW' | 'HIGH';
export type ExcursionType = 'CHILLING' | 'HEAT';

export interface TemperatureExcursion {
  id: string;
  laneId: string;
  startedAt: Date;
  endedAt: Date | null;
  ongoing: boolean;
  durationMinutes: number;
  severity: ExcursionSeverity;
  direction: ExcursionDirection;
  type: ExcursionType;
  thresholdC: number;
  minObservedC: number;
  maxObservedC: number;
  maxDeviationC: number;
  shelfLifeImpactPercent: number;
}

export interface NewTemperatureExcursion {
  laneId: string;
  startedAt: Date;
  endedAt: Date | null;
  ongoing: boolean;
  durationMinutes: number;
  severity: ExcursionSeverity;
  direction: ExcursionDirection;
  type: ExcursionType;
  thresholdC: number;
  minObservedC: number;
  maxObservedC: number;
  maxDeviationC: number;
  shelfLifeImpactPercent: number;
}

export interface TemperatureSlaReport {
  status: 'PASS' | 'CONDITIONAL' | 'FAIL';
  defensibilityScore: number;
  shelfLifeImpactPercent: number;
  remainingShelfLifeDays: number;
  excursionCount: number;
  totalExcursionMinutes: number;
  maxDeviationC: number;
}

export interface TemperatureCheckpointMarker {
  checkpointId: string;
  laneId: string;
  sequence: number;
  locationName: string;
  timestamp: Date | null;
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE';
}

export interface TemperatureChartCheckpointMarker extends TemperatureCheckpointMarker {
  label: string;
}

export interface TemperatureChartReadingPoint {
  timestamp: Date;
  temperatureC: number;
}

export interface TemperatureExcursionZone {
  excursionId: string;
  severity: ExcursionSeverity;
  type: ExcursionType;
  direction: ExcursionDirection;
  start: Date;
  end: Date;
  color: string;
}

export interface TemperatureChartData {
  readings: TemperatureChartReadingPoint[];
  optimalBand: {
    minC: number;
    maxC: number;
  };
  checkpoints: TemperatureChartCheckpointMarker[];
  excursionZones: TemperatureExcursionZone[];
}

export interface LaneTemperatureContext {
  laneId: string;
  productType: LaneProduct;
  coldChainMode: LaneColdChainMode;
  coldChainDeviceId: string | null;
  coldChainDataFrequencySeconds: number | null;
  profile: FruitProfile;
}

export interface IngestLaneReadingsInput {
  readings: TemperatureReadingInput[];
}

export interface LaneTemperatureQuery {
  from?: Date;
  to?: Date;
  resolution?: TemperatureResolution;
}

export interface IngestLaneReadingsResult {
  count: number;
  excursionsDetected: number;
  sla: TemperatureSlaReport;
}

export interface LaneTemperatureDataResult {
  readings: TemperatureReading[];
  excursions: TemperatureExcursion[];
  sla: TemperatureSlaReport;
  meta: {
    resolution: TemperatureResolution;
    from: Date | null;
    to: Date | null;
    totalReadings: number;
  };
}

export interface TemperatureSlaReportResult extends TemperatureSlaReport {
  excursions: TemperatureExcursion[];
  chartData: TemperatureChartData;
  meta: {
    resolution: TemperatureResolution;
    from: Date | null;
    to: Date | null;
    totalReadings: number;
  };
}

export interface ColdChainStore {
  listProfiles(): Promise<FruitProfile[]>;
  findProfileByProduct(productType: LaneProduct): Promise<FruitProfile | null>;
  findLaneTemperatureContext(
    laneId: string,
  ): Promise<LaneTemperatureContext | null>;
  createTemperatureReadings(
    laneId: string,
    readings: TemperatureReadingInput[],
  ): Promise<void>;
  listTemperatureReadings(
    laneId: string,
    query?: { from?: Date; to?: Date },
  ): Promise<TemperatureReading[]>;
  replaceExcursions(
    laneId: string,
    excursions: NewTemperatureExcursion[],
  ): Promise<TemperatureExcursion[]>;
  listLaneExcursions(
    laneId: string,
    query?: { from?: Date; to?: Date },
  ): Promise<TemperatureExcursion[]>;
  listLaneCheckpointMarkers(
    laneId: string,
  ): Promise<TemperatureCheckpointMarker[]>;
}

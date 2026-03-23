import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  LaneColdChainConfigPayload,
  ColdChainStore,
  FruitProfile,
} from './cold-chain.types';
import type { LaneColdChainConfigInput, LaneProduct } from '../lane/lane.types';

interface FruitTemperatureProfile {
  fruit: LaneProduct;
  optimalMinC: number;
  optimalMaxC: number;
  chillingThresholdC: number | null;
  heatThresholdC: number;
  baseShelfLifeDays: number;
  minShelfLifeDays: number;
}

interface TemperatureReadingInput {
  timestamp: Date;
  temperatureC: number;
}

interface TemperatureExcursion {
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  direction: 'LOW' | 'HIGH';
  thresholdC: number;
  observedC: number;
  durationMinutes: number;
}

interface TemperatureReport {
  status: 'PASS' | 'CONDITIONAL' | 'FAIL';
  defensibilityScore: number;
  shelfLifeImpactPercent: number;
  remainingShelfLifeDays: number;
}

const CANONICAL_PROFILES: FruitTemperatureProfile[] = [
  {
    fruit: 'MANGO',
    optimalMinC: 10,
    optimalMaxC: 13,
    chillingThresholdC: 10,
    heatThresholdC: 15,
    baseShelfLifeDays: 21,
    minShelfLifeDays: 14,
  },
  {
    fruit: 'DURIAN',
    optimalMinC: 12,
    optimalMaxC: 15,
    chillingThresholdC: 10,
    heatThresholdC: 18,
    baseShelfLifeDays: 14,
    minShelfLifeDays: 7,
  },
  {
    fruit: 'MANGOSTEEN',
    optimalMinC: 10,
    optimalMaxC: 13,
    chillingThresholdC: 8,
    heatThresholdC: 15,
    baseShelfLifeDays: 21,
    minShelfLifeDays: 14,
  },
  {
    fruit: 'LONGAN',
    optimalMinC: 2,
    optimalMaxC: 5,
    chillingThresholdC: null,
    heatThresholdC: 8,
    baseShelfLifeDays: 30,
    minShelfLifeDays: 21,
  },
];

@Injectable()
export class ColdChainService {
  constructor(private readonly coldChainStore?: ColdChainStore) {}

  listFruitProfiles(): FruitTemperatureProfile[] {
    return [...CANONICAL_PROFILES];
  }

  getFruitProfile(productType: LaneProduct): FruitTemperatureProfile {
    const profile = CANONICAL_PROFILES.find(
      ({ fruit }) => fruit === productType,
    );
    if (profile === undefined) {
      throw new BadRequestException('Unsupported product.');
    }

    return profile;
  }

  evaluateReadings(
    productType: LaneProduct,
    readings: TemperatureReadingInput[],
  ): {
    profile: FruitTemperatureProfile;
    excursions: TemperatureExcursion[];
    report: TemperatureReport;
  } {
    if (readings.length === 0) {
      throw new BadRequestException(
        'At least one temperature reading is required.',
      );
    }

    const profile = this.getFruitProfile(productType);
    const excursions = readings
      .map((reading, index) =>
        this.classifyReading(
          profile,
          reading,
          this.resolveDurationMinutes(readings, index),
        ),
      )
      .filter(
        (excursion): excursion is TemperatureExcursion => excursion !== null,
      );

    const report = this.buildReport(profile, excursions);

    return {
      profile,
      excursions,
      report,
    };
  }

  async listProfiles(): Promise<FruitProfile[]> {
    if (this.coldChainStore !== undefined) {
      return await this.coldChainStore.listProfiles();
    }

    return CANONICAL_PROFILES.map((profile, index) =>
      this.mapCanonicalProfile(profile, `canonical-${index + 1}`),
    );
  }

  async getProfile(productType: LaneProduct): Promise<FruitProfile> {
    if (this.coldChainStore !== undefined) {
      const profile =
        await this.coldChainStore.findProfileByProduct(productType);
      if (profile === null) {
        throw new NotFoundException('Fruit profile not found.');
      }

      return profile;
    }

    return this.mapCanonicalProfile(
      this.getFruitProfile(productType),
      `canonical-${productType.toLowerCase()}`,
    );
  }

  classifyTemperature(
    productType: LaneProduct,
    temperatureC: number,
  ): Promise<{
    productType: LaneProduct;
    temperatureC: number;
    status: 'OPTIMAL' | 'CHILLING_INJURY' | 'HEAT_DAMAGE';
    isExcursion: boolean;
  }> {
    const profile = this.getFruitProfile(productType);

    if (
      profile.chillingThresholdC !== null &&
      temperatureC < profile.chillingThresholdC
    ) {
      return Promise.resolve({
        productType,
        temperatureC,
        status: 'CHILLING_INJURY',
        isExcursion: true,
      });
    }

    if (temperatureC > profile.heatThresholdC) {
      return Promise.resolve({
        productType,
        temperatureC,
        status: 'HEAT_DAMAGE',
        isExcursion: true,
      });
    }

    return Promise.resolve({
      productType,
      temperatureC,
      status: 'OPTIMAL',
      isExcursion: false,
    });
  }

  validateLaneConfiguration(
    input: LaneColdChainConfigInput,
  ): LaneColdChainConfigPayload {
    const normalizedDeviceId = input.deviceId?.trim() || null;
    const normalizedFrequency = input.dataFrequencySeconds ?? null;

    if (input.mode === 'MANUAL') {
      return {
        mode: 'MANUAL',
        deviceId: null,
        dataFrequencySeconds: null,
      };
    }

    if (normalizedDeviceId === null) {
      throw new BadRequestException(
        'Device ID is required for logger and telemetry modes.',
      );
    }

    if (normalizedFrequency === null) {
      throw new BadRequestException(
        'Data frequency is required for logger and telemetry modes.',
      );
    }

    if (!Number.isInteger(normalizedFrequency) || normalizedFrequency <= 0) {
      throw new BadRequestException(
        'Data frequency must be a positive integer in seconds.',
      );
    }

    if (
      input.mode === 'LOGGER' &&
      (normalizedFrequency < 300 || normalizedFrequency > 900)
    ) {
      throw new BadRequestException(
        'Logger mode frequency must be between 300 and 900 seconds.',
      );
    }

    if (input.mode === 'TELEMETRY' && normalizedFrequency > 60) {
      throw new BadRequestException(
        'Telemetry mode frequency must be 60 seconds or less.',
      );
    }

    return {
      mode: input.mode,
      deviceId: normalizedDeviceId,
      dataFrequencySeconds: normalizedFrequency,
    };
  }

  private classifyReading(
    profile: FruitTemperatureProfile,
    reading: TemperatureReadingInput,
    durationMinutes: number,
  ): TemperatureExcursion | null {
    if (
      profile.chillingThresholdC !== null &&
      reading.temperatureC < profile.chillingThresholdC
    ) {
      return {
        severity: 'CRITICAL',
        direction: 'LOW',
        thresholdC: profile.chillingThresholdC,
        observedC: reading.temperatureC,
        durationMinutes,
      };
    }

    if (reading.temperatureC > profile.heatThresholdC) {
      return {
        severity: this.resolveSeverity(
          reading.temperatureC - profile.optimalMaxC,
          durationMinutes,
        ),
        direction: 'HIGH',
        thresholdC: profile.heatThresholdC,
        observedC: reading.temperatureC,
        durationMinutes,
      };
    }

    if (reading.temperatureC < profile.optimalMinC) {
      return {
        severity: this.resolveSeverity(
          profile.optimalMinC - reading.temperatureC,
          durationMinutes,
        ),
        direction: 'LOW',
        thresholdC: profile.optimalMinC,
        observedC: reading.temperatureC,
        durationMinutes,
      };
    }

    return null;
  }

  private resolveDurationMinutes(
    readings: TemperatureReadingInput[],
    index: number,
  ): number {
    const current = readings[index];
    const next = readings[index + 1];

    if (next === undefined) {
      return index === 0
        ? 0
        : Math.round(
            (current.timestamp.getTime() -
              readings[index - 1].timestamp.getTime()) /
              60000,
          );
    }

    return Math.round(
      (next.timestamp.getTime() - current.timestamp.getTime()) / 60000,
    );
  }

  private resolveSeverity(
    deviationC: number,
    durationMinutes: number,
  ): TemperatureExcursion['severity'] {
    if (deviationC >= 3 || durationMinutes > 120) {
      return 'SEVERE';
    }

    if (deviationC >= 2 || durationMinutes > 30) {
      return 'MODERATE';
    }

    return 'MINOR';
  }

  private buildReport(
    profile: FruitTemperatureProfile,
    excursions: TemperatureExcursion[],
  ): TemperatureReport {
    if (excursions.length === 0) {
      return {
        status: 'PASS',
        defensibilityScore: 100,
        shelfLifeImpactPercent: 0,
        remainingShelfLifeDays: profile.baseShelfLifeDays,
      };
    }

    const impactPercent = Math.max(
      ...excursions.map((excursion) =>
        this.shelfLifeImpact(excursion.severity),
      ),
    );
    const worstSeverity = excursions.reduce(
      (worst, current) =>
        this.shelfLifeImpact(current.severity) > this.shelfLifeImpact(worst)
          ? current.severity
          : worst,
      excursions[0].severity,
    );

    return {
      status:
        worstSeverity === 'SEVERE' || worstSeverity === 'CRITICAL'
          ? 'FAIL'
          : 'CONDITIONAL',
      defensibilityScore:
        worstSeverity === 'CRITICAL' ? 0 : 100 - impactPercent,
      shelfLifeImpactPercent: impactPercent,
      remainingShelfLifeDays:
        worstSeverity === 'CRITICAL'
          ? profile.minShelfLifeDays
          : Math.max(
              profile.minShelfLifeDays,
              Math.round(profile.baseShelfLifeDays * (1 - impactPercent / 100)),
            ),
    };
  }

  private shelfLifeImpact(severity: TemperatureExcursion['severity']): number {
    switch (severity) {
      case 'MINOR':
        return 5;
      case 'MODERATE':
        return 15;
      case 'SEVERE':
        return 30;
      case 'CRITICAL':
        return 100;
    }
  }

  private mapCanonicalProfile(
    profile: FruitTemperatureProfile,
    id: string,
  ): FruitProfile {
    return {
      id,
      productType: profile.fruit,
      optimalMinC: profile.optimalMinC,
      optimalMaxC: profile.optimalMaxC,
      chillingThresholdC: profile.chillingThresholdC,
      heatThresholdC: profile.heatThresholdC,
      shelfLifeMinDays: profile.minShelfLifeDays,
      shelfLifeMaxDays: profile.baseShelfLifeDays,
    };
  }
}

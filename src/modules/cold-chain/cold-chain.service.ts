import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from '../notifications/notification.service';
import type {
  ColdChainStore,
  FruitProfile,
  IngestLaneReadingsInput,
  IngestLaneReadingsResult,
  LaneColdChainConfigPayload,
  LaneTemperatureContext,
  LaneTemperatureDataResult,
  LaneTemperatureQuery,
  NewTemperatureExcursion,
  TemperatureChartCheckpointMarker,
  TemperatureChartData,
  TemperatureCheckpointMarker,
  TemperatureClassification,
  TemperatureExcursion,
  TemperatureExcursionZone,
  TemperatureReading,
  TemperatureReadingInput,
  TemperatureSlaReport,
  TemperatureSlaReportResult,
} from './cold-chain.types';
import type { LaneColdChainConfigInput, LaneProduct } from '../lane/lane.types';

const CANONICAL_PROFILES: FruitProfile[] = [
  {
    id: 'canonical-mango',
    productType: 'MANGO',
    optimalMinC: 10,
    optimalMaxC: 13,
    chillingThresholdC: 10,
    heatThresholdC: 15,
    shelfLifeMinDays: 14,
    shelfLifeMaxDays: 21,
  },
  {
    id: 'canonical-durian',
    productType: 'DURIAN',
    optimalMinC: 12,
    optimalMaxC: 15,
    chillingThresholdC: 10,
    heatThresholdC: 18,
    shelfLifeMinDays: 7,
    shelfLifeMaxDays: 14,
  },
  {
    id: 'canonical-mangosteen',
    productType: 'MANGOSTEEN',
    optimalMinC: 10,
    optimalMaxC: 13,
    chillingThresholdC: 8,
    heatThresholdC: 15,
    shelfLifeMinDays: 14,
    shelfLifeMaxDays: 21,
  },
  {
    id: 'canonical-longan',
    productType: 'LONGAN',
    optimalMinC: 2,
    optimalMaxC: 5,
    chillingThresholdC: null,
    heatThresholdC: 8,
    shelfLifeMinDays: 21,
    shelfLifeMaxDays: 30,
  },
];

const SHELF_LIFE_IMPACT_BY_SEVERITY: Record<
  TemperatureExcursion['severity'],
  number
> = {
  MINOR: 5,
  MODERATE: 12,
  SEVERE: 25,
  CRITICAL: 100,
};

const EXCURSION_ZONE_COLOR_BY_SEVERITY: Record<
  TemperatureExcursion['severity'],
  string
> = {
  MINOR: '#38bdf8',
  MODERATE: '#f59e0b',
  SEVERE: '#f97316',
  CRITICAL: '#dc2626',
};

interface ClassifiedReading {
  direction: TemperatureExcursion['direction'];
  type: TemperatureExcursion['type'];
  thresholdC: number;
  observedC: number;
  deviationC: number;
  critical: boolean;
}

interface ExcursionAccumulator {
  startedAt: Date;
  laneId: string;
  direction: TemperatureExcursion['direction'];
  type: TemperatureExcursion['type'];
  thresholdC: number;
  minObservedC: number;
  maxObservedC: number;
  maxDeviationC: number;
  durationMinutes: number;
  critical: boolean;
  lastTimestamp: Date;
  lastDurationMinutes: number;
}

@Injectable()
export class ColdChainService {
  private readonly logger = new Logger(ColdChainService.name);

  constructor(
    private readonly coldChainStore?: ColdChainStore,
    private readonly notificationService?: NotificationService,
  ) {}

  listFruitProfiles(): FruitProfile[] {
    return [...CANONICAL_PROFILES];
  }

  getFruitProfile(productType: LaneProduct): FruitProfile {
    const profile = CANONICAL_PROFILES.find(
      (entry) => entry.productType === productType,
    );
    if (profile === undefined) {
      throw new BadRequestException('Unsupported product.');
    }

    return profile;
  }

  evaluateReadings(
    productType: LaneProduct,
    readings: Array<{ timestamp: Date; temperatureC: number }>,
  ): {
    profile: FruitProfile;
    excursions: NewTemperatureExcursion[];
    report: TemperatureSlaReport;
  } {
    if (readings.length === 0) {
      throw new BadRequestException(
        'At least one temperature reading is required.',
      );
    }

    const profile = this.getFruitProfile(productType);
    const normalized = this.normalizeReadings(
      readings.map((reading) => ({
        ...reading,
        deviceId: null,
      })),
    ).map((reading, index) => ({
      ...reading,
      id: `memory-${index + 1}`,
      laneId: 'memory-lane',
    }));
    const excursions = this.detectExcursionsSync(profile, normalized, null);
    const report = this.calculateShelfLifeImpactSync(profile, excursions);

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

    return this.listFruitProfiles();
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

    return this.getFruitProfile(productType);
  }

  classifyTemperature(
    productType: LaneProduct,
    temperatureC: number,
  ): Promise<TemperatureClassification> {
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

  async ingestLaneReadings(
    laneId: string,
    input: IngestLaneReadingsInput,
  ): Promise<IngestLaneReadingsResult> {
    if (input.readings.length === 0) {
      throw new BadRequestException(
        'At least one temperature reading is required.',
      );
    }

    const context = await this.requireLaneTemperatureContext(laneId);
    const normalized = this.normalizeReadings(input.readings);

    if (this.coldChainStore === undefined) {
      throw new Error('Cold-chain store is not configured.');
    }

    const resolvedLaneId = context.laneId;
    const previousExcursions =
      await this.coldChainStore.listLaneExcursions(resolvedLaneId);
    await this.coldChainStore.createTemperatureReadings(
      resolvedLaneId,
      normalized,
    );
    const readings =
      await this.coldChainStore.listTemperatureReadings(resolvedLaneId);
    const excursions = await this.detectExcursions(
      context.profile,
      readings,
      this.resolveCadenceMinutes(context),
    );
    const storedExcursions = await this.coldChainStore.replaceExcursions(
      resolvedLaneId,
      excursions,
    );
    await this.notifyAboutNewExcursions(
      resolvedLaneId,
      previousExcursions,
      storedExcursions,
    );
    const sla = await this.calculateShelfLifeImpact(
      context.profile,
      storedExcursions,
    );

    return {
      count: normalized.length,
      excursionsDetected: storedExcursions.length,
      sla,
    };
  }

  async listLaneTemperatureData(
    laneId: string,
    query: LaneTemperatureQuery,
  ): Promise<LaneTemperatureDataResult> {
    const context = await this.requireLaneTemperatureContext(laneId);
    if (this.coldChainStore === undefined) {
      throw new Error('Cold-chain store is not configured.');
    }

    const resolvedLaneId = context.laneId;
    const readings = await this.coldChainStore.listTemperatureReadings(
      resolvedLaneId,
      {
        from: query.from,
        to: query.to,
      },
    );
    const excursions = await this.coldChainStore.listLaneExcursions(
      resolvedLaneId,
      {
        from: query.from,
        to: query.to,
      },
    );

    const resolution = query.resolution ?? 'raw';

    return {
      readings: this.downsampleReadings(readings, resolution),
      excursions,
      sla: await this.calculateShelfLifeImpact(context.profile, excursions),
      meta: {
        resolution,
        from: query.from ?? null,
        to: query.to ?? null,
        totalReadings: readings.length,
      },
    };
  }

  async getLaneTemperatureSlaReport(
    laneId: string,
    query: LaneTemperatureQuery,
  ): Promise<TemperatureSlaReportResult> {
    const context = await this.requireLaneTemperatureContext(laneId);
    if (this.coldChainStore === undefined) {
      throw new Error('Cold-chain store is not configured.');
    }

    const resolvedLaneId = context.laneId;
    const readings = await this.coldChainStore.listTemperatureReadings(
      resolvedLaneId,
      {
        from: query.from,
        to: query.to,
      },
    );
    const excursions = await this.coldChainStore.listLaneExcursions(
      resolvedLaneId,
      {
        from: query.from,
        to: query.to,
      },
    );
    const checkpoints =
      await this.coldChainStore.listLaneCheckpointMarkers(resolvedLaneId);
    const resolution = this.resolveSlaResolution(query, readings);
    const sla = await this.calculateShelfLifeImpact(
      context.profile,
      excursions,
    );

    return {
      ...sla,
      excursions,
      chartData: this.buildTemperatureChartData(
        context.profile,
        readings,
        checkpoints,
        excursions,
        resolution,
        query,
      ),
      meta: {
        resolution,
        from: query.from ?? null,
        to: query.to ?? null,
        totalReadings: readings.length,
      },
    };
  }

  detectExcursions(
    profile: FruitProfile,
    readings: TemperatureReading[],
    cadenceMinutes: number | null,
  ): Promise<NewTemperatureExcursion[]> {
    return Promise.resolve(
      this.detectExcursionsSync(profile, readings, cadenceMinutes),
    );
  }

  private detectExcursionsSync(
    profile: FruitProfile,
    readings: TemperatureReading[],
    cadenceMinutes: number | null,
  ): NewTemperatureExcursion[] {
    if (readings.length === 0) {
      return [];
    }

    const sortedReadings = [...readings].sort(
      (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
    );
    const excursions: NewTemperatureExcursion[] = [];
    let current: ExcursionAccumulator | null = null;

    for (let index = 0; index < sortedReadings.length; index += 1) {
      const reading = sortedReadings[index];
      const classified = this.classifyExcursionReading(profile, reading);
      const durationMinutes = this.resolveSampleDurationMinutes(
        sortedReadings,
        index,
        cadenceMinutes,
      );

      if (classified === null) {
        if (current !== null) {
          excursions.push(
            this.finalizeExcursion(
              current,
              false,
              this.addMinutes(
                current.lastTimestamp,
                current.lastDurationMinutes,
              ),
            ),
          );
          current = null;
        }
        continue;
      }

      if (
        current === null ||
        current.direction !== classified.direction ||
        current.type !== classified.type
      ) {
        if (current !== null) {
          excursions.push(
            this.finalizeExcursion(
              current,
              false,
              this.addMinutes(
                current.lastTimestamp,
                current.lastDurationMinutes,
              ),
            ),
          );
        }

        current = {
          laneId: reading.laneId,
          startedAt: reading.timestamp,
          direction: classified.direction,
          type: classified.type,
          thresholdC: classified.thresholdC,
          minObservedC: reading.temperatureC,
          maxObservedC: reading.temperatureC,
          maxDeviationC: classified.deviationC,
          durationMinutes,
          critical: classified.critical,
          lastTimestamp: reading.timestamp,
          lastDurationMinutes: durationMinutes,
        };
        continue;
      }

      current.durationMinutes += durationMinutes;
      current.maxDeviationC = Math.max(
        current.maxDeviationC,
        classified.deviationC,
      );
      current.minObservedC = Math.min(
        current.minObservedC,
        reading.temperatureC,
      );
      current.maxObservedC = Math.max(
        current.maxObservedC,
        reading.temperatureC,
      );
      current.critical = current.critical || classified.critical;
      if (classified.critical) {
        current.thresholdC = classified.thresholdC;
      }
      current.lastTimestamp = reading.timestamp;
      current.lastDurationMinutes = durationMinutes;
    }

    if (current !== null) {
      excursions.push(this.finalizeExcursion(current, true, null));
    }

    return excursions;
  }

  calculateShelfLifeImpact(
    profile: FruitProfile,
    excursions: Array<
      Pick<
        TemperatureExcursion,
        | 'severity'
        | 'durationMinutes'
        | 'maxDeviationC'
        | 'shelfLifeImpactPercent'
      >
    >,
  ): Promise<TemperatureSlaReport> {
    return Promise.resolve(
      this.calculateShelfLifeImpactSync(profile, excursions),
    );
  }

  private calculateShelfLifeImpactSync(
    profile: FruitProfile,
    excursions: Array<
      Pick<
        TemperatureExcursion,
        | 'severity'
        | 'durationMinutes'
        | 'maxDeviationC'
        | 'shelfLifeImpactPercent'
      >
    >,
  ): TemperatureSlaReport {
    if (excursions.length === 0) {
      return {
        status: 'PASS',
        defensibilityScore: 100,
        shelfLifeImpactPercent: 0,
        remainingShelfLifeDays: profile.shelfLifeMaxDays,
        excursionCount: 0,
        totalExcursionMinutes: 0,
        maxDeviationC: 0,
      };
    }

    const impactPercent = Math.min(
      100,
      excursions.reduce(
        (total, excursion) =>
          total +
          (excursion.shelfLifeImpactPercent ||
            SHELF_LIFE_IMPACT_BY_SEVERITY[excursion.severity]),
        0,
      ),
    );
    const totalExcursionMinutes = excursions.reduce(
      (total, excursion) => total + excursion.durationMinutes,
      0,
    );
    const maxDeviationC = Math.max(
      ...excursions.map((excursion) => excursion.maxDeviationC),
    );
    const worstSeverity = excursions.reduce<TemperatureExcursion['severity']>(
      (worst, current) => {
        const currentImpact = SHELF_LIFE_IMPACT_BY_SEVERITY[current.severity];
        const worstImpact = SHELF_LIFE_IMPACT_BY_SEVERITY[worst];
        return currentImpact > worstImpact ? current.severity : worst;
      },
      excursions[0].severity,
    );

    return {
      status:
        worstSeverity === 'SEVERE' || worstSeverity === 'CRITICAL'
          ? 'FAIL'
          : 'CONDITIONAL',
      defensibilityScore: Math.max(0, 100 - impactPercent),
      shelfLifeImpactPercent: impactPercent,
      remainingShelfLifeDays: Math.max(
        0,
        Math.round(profile.shelfLifeMaxDays * (1 - impactPercent / 100)),
      ),
      excursionCount: excursions.length,
      totalExcursionMinutes,
      maxDeviationC,
    };
  }

  private async notifyAboutNewExcursions(
    laneId: string,
    previousExcursions: TemperatureExcursion[],
    currentExcursions: TemperatureExcursion[],
  ): Promise<void> {
    if (this.notificationService === undefined) {
      return;
    }

    const existingKeys = new Set(
      previousExcursions.map((excursion) => this.excursionKey(excursion)),
    );
    const newExcursions = currentExcursions.filter(
      (excursion) => !existingKeys.has(this.excursionKey(excursion)),
    );
    if (newExcursions.length === 0) {
      return;
    }

    const highestSeverity = newExcursions.reduce<
      TemperatureExcursion['severity']
    >(
      (highest, excursion) =>
        this.compareSeverity(excursion.severity, highest) > 0
          ? excursion.severity
          : highest,
      newExcursions[0].severity,
    );

    this.logExcursionAlert(laneId, highestSeverity, newExcursions.length);

    await this.notificationService.notifyLaneOwnerAboutTemperatureExcursions(
      laneId,
      {
        excursionCount: newExcursions.length,
        highestSeverity,
        slaBreached: highestSeverity === 'CRITICAL',
        excursions: newExcursions.map((excursion) => ({
          severity: excursion.severity,
          startedAt: excursion.startedAt,
          endedAt: excursion.endedAt,
          type: excursion.type,
          direction: excursion.direction,
          durationMinutes: excursion.durationMinutes,
        })),
      },
    );
  }

  private logExcursionAlert(
    laneId: string,
    severity: TemperatureExcursion['severity'],
    excursionCount: number,
  ): void {
    const message = `Lane ${laneId} has ${excursionCount} new temperature excursion alert(s) at ${severity} severity.`;
    if (severity === 'MINOR') {
      this.logger.log(message);
      return;
    }

    if (severity === 'CRITICAL') {
      this.logger.error(message);
      return;
    }

    this.logger.warn(message);
  }

  private compareSeverity(
    left: TemperatureExcursion['severity'],
    right: TemperatureExcursion['severity'],
  ): number {
    const order: Record<TemperatureExcursion['severity'], number> = {
      MINOR: 0,
      MODERATE: 1,
      SEVERE: 2,
      CRITICAL: 3,
    };
    return order[left] - order[right];
  }

  private excursionKey(
    excursion: Pick<
      TemperatureExcursion,
      'startedAt' | 'endedAt' | 'severity' | 'direction' | 'type'
    >,
  ): string {
    return [
      excursion.startedAt.toISOString(),
      excursion.endedAt?.toISOString() ?? 'ongoing',
      excursion.severity,
      excursion.direction,
      excursion.type,
    ].join('|');
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

  private async requireLaneTemperatureContext(
    laneId: string,
  ): Promise<LaneTemperatureContext> {
    if (this.coldChainStore === undefined) {
      throw new Error('Cold-chain store is not configured.');
    }

    const context =
      await this.coldChainStore.findLaneTemperatureContext(laneId);
    if (context === null) {
      throw new NotFoundException('Lane or fruit profile not found.');
    }

    return context;
  }

  private normalizeReadings(
    readings: TemperatureReadingInput[],
  ): TemperatureReadingInput[] {
    return [...readings]
      .map((reading) => ({
        timestamp: new Date(reading.timestamp),
        temperatureC: Number(reading.temperatureC),
        deviceId: reading.deviceId?.trim() || null,
      }))
      .map((reading) => {
        if (Number.isNaN(reading.timestamp.getTime())) {
          throw new BadRequestException(
            'Invalid temperature reading timestamp.',
          );
        }

        if (!Number.isFinite(reading.temperatureC)) {
          throw new BadRequestException('Invalid temperature reading value.');
        }

        return reading;
      })
      .sort(
        (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
      );
  }

  private resolveCadenceMinutes(
    context: LaneTemperatureContext,
  ): number | null {
    if (context.coldChainDataFrequencySeconds === null) {
      return null;
    }

    return Math.max(1, Math.round(context.coldChainDataFrequencySeconds / 60));
  }

  private classifyExcursionReading(
    profile: FruitProfile,
    reading: Pick<TemperatureReading, 'temperatureC'>,
  ): ClassifiedReading | null {
    if (reading.temperatureC > profile.optimalMaxC) {
      return {
        direction: 'HIGH',
        type: 'HEAT',
        thresholdC: profile.optimalMaxC,
        observedC: reading.temperatureC,
        deviationC: reading.temperatureC - profile.optimalMaxC,
        critical: false,
      };
    }

    if (reading.temperatureC < profile.optimalMinC) {
      const critical =
        profile.chillingThresholdC !== null &&
        reading.temperatureC < profile.chillingThresholdC;

      return {
        direction: 'LOW',
        type: 'CHILLING',
        thresholdC: critical
          ? (profile.chillingThresholdC as number)
          : profile.optimalMinC,
        observedC: reading.temperatureC,
        deviationC: profile.optimalMinC - reading.temperatureC,
        critical,
      };
    }

    return null;
  }

  private resolveSampleDurationMinutes(
    readings: TemperatureReading[],
    index: number,
    cadenceMinutes: number | null,
  ): number {
    const current = readings[index];
    const next = readings[index + 1];

    if (next !== undefined) {
      return Math.max(
        0,
        Math.round(
          (next.timestamp.getTime() - current.timestamp.getTime()) / 60000,
        ),
      );
    }

    if (cadenceMinutes !== null) {
      return cadenceMinutes;
    }

    const previous = readings[index - 1];
    if (previous === undefined) {
      return 0;
    }

    return Math.max(
      0,
      Math.round(
        (current.timestamp.getTime() - previous.timestamp.getTime()) / 60000,
      ),
    );
  }

  private finalizeExcursion(
    accumulator: ExcursionAccumulator,
    ongoing: boolean,
    endedAt: Date | null,
  ): NewTemperatureExcursion {
    const severity = accumulator.critical
      ? 'CRITICAL'
      : this.resolveSeverity(
          accumulator.maxDeviationC,
          accumulator.durationMinutes,
        );

    return {
      laneId: accumulator.laneId,
      startedAt: accumulator.startedAt,
      endedAt,
      ongoing,
      durationMinutes: accumulator.durationMinutes,
      severity,
      direction: accumulator.direction,
      type: accumulator.type,
      thresholdC: accumulator.thresholdC,
      minObservedC: accumulator.minObservedC,
      maxObservedC: accumulator.maxObservedC,
      maxDeviationC: accumulator.maxDeviationC,
      shelfLifeImpactPercent: SHELF_LIFE_IMPACT_BY_SEVERITY[severity],
    };
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

  private downsampleReadings(
    readings: TemperatureReading[],
    resolution: LaneTemperatureDataResult['meta']['resolution'],
  ): TemperatureReading[] {
    if (resolution === 'raw') {
      return readings;
    }

    const bucketMinutes = this.getResolutionMinutes(resolution);
    const bucketMs = bucketMinutes * 60000;
    const buckets = new Map<
      number,
      {
        laneId: string;
        sum: number;
        count: number;
        deviceIds: Set<string>;
      }
    >();

    for (const reading of readings) {
      const bucketStart =
        Math.floor(reading.timestamp.getTime() / bucketMs) * bucketMs;
      const existing = buckets.get(bucketStart);
      if (existing === undefined) {
        buckets.set(bucketStart, {
          laneId: reading.laneId,
          sum: reading.temperatureC,
          count: 1,
          deviceIds: new Set(
            reading.deviceId === null ? [] : [reading.deviceId],
          ),
        });
        continue;
      }

      existing.sum += reading.temperatureC;
      existing.count += 1;
      if (reading.deviceId !== null) {
        existing.deviceIds.add(reading.deviceId);
      }
    }

    return [...buckets.entries()]
      .sort(([left], [right]) => left - right)
      .map(([timestamp, bucket], index) => ({
        id: `bucket-${index + 1}`,
        laneId: bucket.laneId,
        timestamp: new Date(timestamp),
        temperatureC: Number((bucket.sum / bucket.count).toFixed(2)),
        deviceId: bucket.deviceIds.size === 1 ? [...bucket.deviceIds][0] : null,
      }));
  }

  private resolveSlaResolution(
    query: LaneTemperatureQuery,
    readings: TemperatureReading[],
  ): LaneTemperatureDataResult['meta']['resolution'] {
    if (query.resolution !== undefined) {
      return query.resolution;
    }

    if (readings.length < 2) {
      return 'raw';
    }

    const startedAt = readings[0]?.timestamp;
    const endedAt = readings.at(-1)?.timestamp;
    if (startedAt === undefined || endedAt === undefined) {
      return 'raw';
    }

    return endedAt.getTime() - startedAt.getTime() > 24 * 60 * 60 * 1000
      ? '1h'
      : 'raw';
  }

  private buildTemperatureChartData(
    profile: FruitProfile,
    readings: TemperatureReading[],
    checkpoints: TemperatureCheckpointMarker[],
    excursions: TemperatureExcursion[],
    resolution: LaneTemperatureDataResult['meta']['resolution'],
    query: LaneTemperatureQuery,
  ): TemperatureChartData {
    const chartReadings = this.downsampleReadings(readings, resolution).map(
      (reading) => ({
        timestamp: reading.timestamp,
        temperatureC: reading.temperatureC,
      }),
    );

    return {
      readings: chartReadings,
      optimalBand: {
        minC: profile.optimalMinC,
        maxC: profile.optimalMaxC,
      },
      checkpoints: this.filterCheckpointMarkers(checkpoints, query),
      excursionZones: this.buildExcursionZones(excursions, readings, query),
    };
  }

  private filterCheckpointMarkers(
    checkpoints: TemperatureCheckpointMarker[],
    query: LaneTemperatureQuery,
  ): TemperatureChartCheckpointMarker[] {
    return checkpoints
      .filter(
        (checkpoint) =>
          checkpoint.timestamp !== null &&
          (query.from === undefined ||
            checkpoint.timestamp.getTime() >= query.from.getTime()) &&
          (query.to === undefined ||
            checkpoint.timestamp.getTime() <= query.to.getTime()),
      )
      .map((checkpoint) => ({
        ...checkpoint,
        timestamp: checkpoint.timestamp as Date,
        label: `CP${checkpoint.sequence} • ${checkpoint.locationName}`,
      }));
  }

  private buildExcursionZones(
    excursions: TemperatureExcursion[],
    readings: TemperatureReading[],
    query: LaneTemperatureQuery,
  ): TemperatureExcursionZone[] {
    const latestReadingTimestamp = readings.at(-1)?.timestamp ?? null;

    return excursions.map((excursion) => ({
      excursionId: excursion.id,
      severity: excursion.severity,
      type: excursion.type,
      direction: excursion.direction,
      start: excursion.startedAt,
      end:
        excursion.endedAt ??
        latestReadingTimestamp ??
        query.to ??
        excursion.startedAt,
      color: EXCURSION_ZONE_COLOR_BY_SEVERITY[excursion.severity],
    }));
  }

  private getResolutionMinutes(
    resolution: LaneTemperatureDataResult['meta']['resolution'],
  ): number {
    switch (resolution) {
      case '5m':
        return 5;
      case '15m':
        return 15;
      case '1h':
        return 60;
      case 'raw':
        return 0;
    }
  }

  private addMinutes(timestamp: Date, minutes: number): Date {
    return new Date(timestamp.getTime() + minutes * 60000);
  }
}

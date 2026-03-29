import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ColdChainService } from './cold-chain.service';
import type { ColdChainStore, FruitProfile } from './cold-chain.types';

function buildProfile(overrides: Partial<FruitProfile> = {}): FruitProfile {
  return {
    id: 'fruit-1',
    productType: 'MANGO',
    optimalMinC: 10,
    optimalMaxC: 13,
    chillingThresholdC: 10,
    heatThresholdC: 15,
    shelfLifeMinDays: 14,
    shelfLifeMaxDays: 21,
    ...overrides,
  };
}

describe('ColdChainService', () => {
  let listProfilesMock: jest.Mock;
  let findProfileByProductMock: jest.Mock;
  let findLaneTemperatureContextMock: jest.Mock;
  let createTemperatureReadingsMock: jest.Mock;
  let listTemperatureReadingsMock: jest.Mock;
  let replaceExcursionsMock: jest.Mock;
  let listLaneExcursionsMock: jest.Mock;
  let listLaneCheckpointMarkersMock: jest.Mock;
  let notificationService: {
    notifyLaneOwner: jest.Mock;
    notifyLaneOwnerAboutTemperatureExcursions: jest.Mock;
  };
  let service: ColdChainService;

  beforeEach(() => {
    listProfilesMock = jest.fn().mockResolvedValue([
      buildProfile(),
      buildProfile({
        id: 'fruit-2',
        productType: 'DURIAN',
        optimalMinC: 12,
        optimalMaxC: 15,
        chillingThresholdC: 10,
        heatThresholdC: 18,
        shelfLifeMinDays: 7,
        shelfLifeMaxDays: 14,
      }),
      buildProfile({
        id: 'fruit-3',
        productType: 'MANGOSTEEN',
        optimalMinC: 10,
        optimalMaxC: 13,
        chillingThresholdC: 8,
        heatThresholdC: 15,
        shelfLifeMinDays: 14,
        shelfLifeMaxDays: 21,
      }),
      buildProfile({
        id: 'fruit-4',
        productType: 'LONGAN',
        optimalMinC: 2,
        optimalMaxC: 5,
        chillingThresholdC: null,
        heatThresholdC: 8,
        shelfLifeMinDays: 21,
        shelfLifeMaxDays: 30,
      }),
    ]);
    findProfileByProductMock = jest.fn().mockResolvedValue(buildProfile());
    findLaneTemperatureContextMock = jest.fn().mockResolvedValue({
      laneId: 'lane-db-1',
      productType: 'MANGO',
      coldChainMode: 'LOGGER',
      coldChainDeviceId: 'logger-1',
      coldChainDataFrequencySeconds: 300,
      profile: buildProfile(),
    });
    createTemperatureReadingsMock = jest.fn().mockResolvedValue(undefined);
    listTemperatureReadingsMock = jest.fn().mockResolvedValue([]);
    replaceExcursionsMock = jest.fn().mockResolvedValue([]);
    listLaneExcursionsMock = jest.fn().mockResolvedValue([]);
    listLaneCheckpointMarkersMock = jest.fn().mockResolvedValue([]);
    notificationService = {
      notifyLaneOwner: jest.fn().mockResolvedValue([]),
      notifyLaneOwnerAboutTemperatureExcursions: jest
        .fn()
        .mockResolvedValue([]),
    };

    const store = {
      listProfiles: listProfilesMock,
      findProfileByProduct: findProfileByProductMock,
      findLaneTemperatureContext: findLaneTemperatureContextMock,
      createTemperatureReadings: createTemperatureReadingsMock,
      listTemperatureReadings: listTemperatureReadingsMock,
      replaceExcursions: replaceExcursionsMock,
      listLaneExcursions: listLaneExcursionsMock,
      listLaneCheckpointMarkers: listLaneCheckpointMarkersMock,
    } as unknown as ColdChainStore;

    findProfileByProductMock.mockImplementation((productType: string) => {
      if (productType === 'DURIAN') {
        return Promise.resolve(
          buildProfile({
            id: 'fruit-2',
            productType: 'DURIAN',
            optimalMinC: 12,
            optimalMaxC: 15,
            chillingThresholdC: 10,
            heatThresholdC: 18,
            shelfLifeMinDays: 7,
            shelfLifeMaxDays: 14,
          }),
        );
      }

      if (productType === 'MANGOSTEEN') {
        return Promise.resolve(
          buildProfile({
            id: 'fruit-3',
            productType: 'MANGOSTEEN',
            optimalMinC: 10,
            optimalMaxC: 13,
            chillingThresholdC: 8,
            heatThresholdC: 15,
            shelfLifeMinDays: 14,
            shelfLifeMaxDays: 21,
          }),
        );
      }

      if (productType === 'LONGAN') {
        return Promise.resolve(
          buildProfile({
            id: 'fruit-4',
            productType: 'LONGAN',
            optimalMinC: 2,
            optimalMaxC: 5,
            chillingThresholdC: null,
            heatThresholdC: 8,
            shelfLifeMinDays: 21,
            shelfLifeMaxDays: 30,
          }),
        );
      }

      return Promise.resolve(buildProfile());
    });

    service = new ColdChainService(store, notificationService as never);
  });

  it('lists fruit profiles from the store', async () => {
    await expect(service.listProfiles()).resolves.toHaveLength(4);
    expect(listProfilesMock).toHaveBeenCalledTimes(1);
  });

  it('returns a fruit profile by product', async () => {
    await expect(service.getProfile('MANGO')).resolves.toMatchObject({
      productType: 'MANGO',
      chillingThresholdC: 10,
      heatThresholdC: 15,
    });
    expect(findProfileByProductMock).toHaveBeenCalledWith('MANGO');
  });

  it('fails closed when a fruit profile is missing', async () => {
    findProfileByProductMock.mockResolvedValueOnce(null);

    await expect(service.getProfile('MANGO')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('classifies mango temperatures using fruit-specific thresholds', async () => {
    await expect(service.classifyTemperature('MANGO', 9)).resolves.toEqual({
      productType: 'MANGO',
      temperatureC: 9,
      status: 'CHILLING_INJURY',
      isExcursion: true,
    });

    await expect(service.classifyTemperature('MANGO', 16)).resolves.toEqual({
      productType: 'MANGO',
      temperatureC: 16,
      status: 'HEAT_DAMAGE',
      isExcursion: true,
    });

    await expect(service.classifyTemperature('LONGAN', 4)).resolves.toEqual({
      productType: 'LONGAN',
      temperatureC: 4,
      status: 'OPTIMAL',
      isExcursion: false,
    });
  });

  it('validates lane cold-chain configuration for manual mode', () => {
    expect(
      service.validateLaneConfiguration({
        mode: 'MANUAL',
      }),
    ).toEqual({
      mode: 'MANUAL',
      deviceId: null,
      dataFrequencySeconds: null,
    });
  });

  it('requires a device id and frequency for logger mode', () => {
    expect(() =>
      service.validateLaneConfiguration({
        mode: 'LOGGER',
      }),
    ).toThrow(BadRequestException);

    expect(
      service.validateLaneConfiguration({
        mode: 'LOGGER',
        deviceId: 'logger-1',
        dataFrequencySeconds: 300,
      }),
    ).toEqual({
      mode: 'LOGGER',
      deviceId: 'logger-1',
      dataFrequencySeconds: 300,
    });
  });

  it('rejects invalid telemetry cadence', () => {
    expect(() =>
      service.validateLaneConfiguration({
        mode: 'TELEMETRY',
        deviceId: 'sensor-1',
        dataFrequencySeconds: 120,
      }),
    ).toThrow(BadRequestException);
  });

  it('ingestLaneReadings stores sorted readings and returns recomputed excursions', async () => {
    listTemperatureReadingsMock.mockResolvedValue([
      {
        id: 'reading-1',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:00:00.000Z'),
        temperatureC: 9,
        deviceId: 'logger-1',
      },
      {
        id: 'reading-2',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:05:00.000Z'),
        temperatureC: 9,
        deviceId: 'logger-1',
      },
    ]);
    replaceExcursionsMock.mockResolvedValue([
      {
        id: 'exc-1',
        laneId: 'lane-db-1',
        startedAt: new Date('2026-03-24T00:00:00.000Z'),
        endedAt: new Date('2026-03-24T00:10:00.000Z'),
        ongoing: false,
        durationMinutes: 10,
        severity: 'MINOR',
        direction: 'LOW',
        type: 'CHILLING',
        thresholdC: 10,
        minObservedC: 9,
        maxObservedC: 9,
        maxDeviationC: 1,
        shelfLifeImpactPercent: 5,
      },
    ]);

    const result = await service.ingestLaneReadings('lane-db-1', {
      readings: [
        {
          timestamp: new Date('2026-03-24T00:05:00.000Z'),
          temperatureC: 9,
          deviceId: 'logger-1',
        },
        {
          timestamp: new Date('2026-03-24T00:00:00.000Z'),
          temperatureC: 9,
          deviceId: 'logger-1',
        },
      ],
    });

    expect(result.count).toBe(2);
    expect(result.excursionsDetected).toBe(1);
    expect(result.sla.status).toBe('CONDITIONAL');
    expect(result.sla.shelfLifeImpactPercent).toBe(5);

    expect(createTemperatureReadingsMock).toHaveBeenCalledWith('lane-db-1', [
      expect.objectContaining({
        timestamp: new Date('2026-03-24T00:00:00.000Z'),
      }),
      expect.objectContaining({
        timestamp: new Date('2026-03-24T00:05:00.000Z'),
      }),
    ]);
    expect(replaceExcursionsMock).toHaveBeenCalled();
    expect(
      notificationService.notifyLaneOwnerAboutTemperatureExcursions,
    ).toHaveBeenCalledWith('lane-db-1', {
      excursionCount: 1,
      highestSeverity: 'MINOR',
      slaBreached: false,
      excursions: [
        expect.objectContaining({
          direction: 'LOW',
          durationMinutes: 10,
          endedAt: new Date('2026-03-24T00:10:00.000Z'),
          severity: 'MINOR',
          startedAt: new Date('2026-03-24T00:00:00.000Z'),
          type: 'CHILLING',
        }),
      ],
    });
  });

  it('ingestLaneReadings uses the resolved internal lane id after public lookup', async () => {
    await service.ingestLaneReadings('LN-2026-001', {
      readings: [
        {
          timestamp: new Date('2026-03-24T00:00:00.000Z'),
          temperatureC: 11,
          deviceId: 'logger-1',
        },
      ],
    });

    expect(findLaneTemperatureContextMock).toHaveBeenCalledWith('LN-2026-001');
    expect(listLaneExcursionsMock).toHaveBeenCalledWith('lane-db-1');
    expect(createTemperatureReadingsMock).toHaveBeenCalledWith('lane-db-1', [
      expect.objectContaining({
        temperatureC: 11,
      }),
    ]);
    expect(listTemperatureReadingsMock).toHaveBeenCalledWith('lane-db-1');
    expect(replaceExcursionsMock).toHaveBeenCalledWith('lane-db-1', []);
  });

  it('detectExcursions classifies minor, moderate, severe, and critical boundaries', async () => {
    const profile = buildProfile();

    await expect(
      service.detectExcursions(
        profile,
        [
          {
            id: 'reading-1',
            laneId: 'lane-db-1',
            timestamp: new Date('2026-03-24T00:00:00.000Z'),
            temperatureC: 14,
            deviceId: 'logger-1',
          },
          {
            id: 'reading-2',
            laneId: 'lane-db-1',
            timestamp: new Date('2026-03-24T00:05:00.000Z'),
            temperatureC: 11,
            deviceId: 'logger-1',
          },
          {
            id: 'reading-3',
            laneId: 'lane-db-1',
            timestamp: new Date('2026-03-24T00:10:00.000Z'),
            temperatureC: 15,
            deviceId: 'logger-1',
          },
          {
            id: 'reading-4',
            laneId: 'lane-db-1',
            timestamp: new Date('2026-03-24T00:50:00.000Z'),
            temperatureC: 11,
            deviceId: 'logger-1',
          },
          {
            id: 'reading-5',
            laneId: 'lane-db-1',
            timestamp: new Date('2026-03-24T01:00:00.000Z'),
            temperatureC: 9,
            deviceId: 'logger-1',
          },
          {
            id: 'reading-6',
            laneId: 'lane-db-1',
            timestamp: new Date('2026-03-24T01:05:00.000Z'),
            temperatureC: 11,
            deviceId: 'logger-1',
          },
          {
            id: 'reading-7',
            laneId: 'lane-db-1',
            timestamp: new Date('2026-03-24T01:10:00.000Z'),
            temperatureC: 16,
            deviceId: 'logger-1',
          },
        ],
        5,
      ),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'MINOR' }),
        expect.objectContaining({ severity: 'MODERATE' }),
        expect.objectContaining({ severity: 'CRITICAL' }),
        expect.objectContaining({ severity: 'SEVERE' }),
      ]),
    );
  });

  it('suppresses duplicate alerts for unchanged ongoing excursions', async () => {
    listLaneExcursionsMock.mockResolvedValue([
      {
        id: 'exc-existing',
        laneId: 'lane-db-1',
        startedAt: new Date('2026-03-24T00:00:00.000Z'),
        endedAt: null,
        ongoing: true,
        durationMinutes: 10,
        severity: 'CRITICAL',
        direction: 'LOW',
        type: 'CHILLING',
        thresholdC: 10,
        minObservedC: 9,
        maxObservedC: 9,
        maxDeviationC: 1,
        shelfLifeImpactPercent: 100,
      },
    ]);
    listTemperatureReadingsMock.mockResolvedValue([
      {
        id: 'reading-1',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:00:00.000Z'),
        temperatureC: 9,
        deviceId: 'logger-1',
      },
      {
        id: 'reading-2',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:05:00.000Z'),
        temperatureC: 9,
        deviceId: 'logger-1',
      },
    ]);
    replaceExcursionsMock.mockResolvedValue([
      {
        id: 'exc-existing',
        laneId: 'lane-db-1',
        startedAt: new Date('2026-03-24T00:00:00.000Z'),
        endedAt: null,
        ongoing: true,
        durationMinutes: 10,
        severity: 'CRITICAL',
        direction: 'LOW',
        type: 'CHILLING',
        thresholdC: 10,
        minObservedC: 9,
        maxObservedC: 9,
        maxDeviationC: 1,
        shelfLifeImpactPercent: 100,
      },
    ]);

    await service.ingestLaneReadings('lane-db-1', {
      readings: [
        {
          timestamp: new Date('2026-03-24T00:05:00.000Z'),
          temperatureC: 9,
          deviceId: 'logger-1',
        },
      ],
    });

    expect(
      notificationService.notifyLaneOwnerAboutTemperatureExcursions,
    ).not.toHaveBeenCalled();
  });

  it('listLaneTemperatureData downsamples readings by requested resolution', async () => {
    listTemperatureReadingsMock.mockResolvedValue([
      {
        id: 'reading-1',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:00:00.000Z'),
        temperatureC: 10,
        deviceId: 'logger-1',
      },
      {
        id: 'reading-2',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:04:00.000Z'),
        temperatureC: 12,
        deviceId: 'logger-1',
      },
      {
        id: 'reading-3',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:16:00.000Z'),
        temperatureC: 13,
        deviceId: 'logger-1',
      },
    ]);

    await expect(
      service.listLaneTemperatureData('lane-db-1', {
        resolution: '15m',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        readings: [
          expect.objectContaining({
            timestamp: new Date('2026-03-24T00:00:00.000Z'),
            temperatureC: 11,
          }),
          expect.objectContaining({
            timestamp: new Date('2026-03-24T00:15:00.000Z'),
            temperatureC: 13,
          }),
        ],
      }),
    );
  });

  it('listLaneTemperatureData uses the resolved internal lane id after public lookup', async () => {
    listTemperatureReadingsMock.mockResolvedValue([]);
    listLaneExcursionsMock.mockResolvedValue([]);

    await service.listLaneTemperatureData('LN-2026-001', {
      resolution: 'raw',
    });

    expect(findLaneTemperatureContextMock).toHaveBeenCalledWith('LN-2026-001');
    expect(listTemperatureReadingsMock).toHaveBeenCalledWith('lane-db-1', {
      from: undefined,
      to: undefined,
    });
    expect(listLaneExcursionsMock).toHaveBeenCalledWith('lane-db-1', {
      from: undefined,
      to: undefined,
    });
  });

  it('getLaneTemperatureSlaReport returns chart-ready SLA data with checkpoint markers', async () => {
    listTemperatureReadingsMock.mockResolvedValue([
      {
        id: 'reading-1',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:00:00.000Z'),
        temperatureC: 11,
        deviceId: 'logger-1',
      },
      {
        id: 'reading-2',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:10:00.000Z'),
        temperatureC: 16,
        deviceId: 'logger-1',
      },
      {
        id: 'reading-3',
        laneId: 'lane-db-1',
        timestamp: new Date('2026-03-24T00:20:00.000Z'),
        temperatureC: 12,
        deviceId: 'logger-1',
      },
    ]);
    listLaneExcursionsMock.mockResolvedValue([
      {
        id: 'exc-1',
        laneId: 'lane-db-1',
        startedAt: new Date('2026-03-24T00:10:00.000Z'),
        endedAt: new Date('2026-03-24T00:20:00.000Z'),
        ongoing: false,
        durationMinutes: 10,
        severity: 'MODERATE',
        direction: 'HIGH',
        type: 'HEAT',
        thresholdC: 13,
        minObservedC: 16,
        maxObservedC: 16,
        maxDeviationC: 3,
        shelfLifeImpactPercent: 12,
      },
    ]);
    listLaneCheckpointMarkersMock.mockResolvedValue([
      {
        checkpointId: 'cp-1',
        laneId: 'lane-db-1',
        sequence: 1,
        locationName: 'Packing House',
        timestamp: new Date('2026-03-24T00:15:00.000Z'),
        status: 'COMPLETED',
      },
      {
        checkpointId: 'cp-2',
        laneId: 'lane-db-1',
        sequence: 2,
        locationName: 'Airport',
        timestamp: null,
        status: 'PENDING',
      },
    ]);

    await expect(
      service.getLaneTemperatureSlaReport('LN-2026-001', {}),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'CONDITIONAL',
        totalExcursionMinutes: 10,
        maxDeviationC: 3,
        chartData: {
          readings: [
            expect.objectContaining({
              timestamp: new Date('2026-03-24T00:00:00.000Z'),
              temperatureC: 11,
            }),
            expect.objectContaining({
              timestamp: new Date('2026-03-24T00:10:00.000Z'),
              temperatureC: 16,
            }),
            expect.objectContaining({
              timestamp: new Date('2026-03-24T00:20:00.000Z'),
              temperatureC: 12,
            }),
          ],
          optimalBand: {
            minC: 10,
            maxC: 13,
          },
          checkpoints: [
            expect.objectContaining({
              checkpointId: 'cp-1',
              sequence: 1,
              label: 'CP1 • Packing House',
              timestamp: new Date('2026-03-24T00:15:00.000Z'),
            }),
          ],
          excursionZones: [
            expect.objectContaining({
              start: new Date('2026-03-24T00:10:00.000Z'),
              end: new Date('2026-03-24T00:20:00.000Z'),
              severity: 'MODERATE',
              color: '#f59e0b',
            }),
          ],
        },
      }),
    );

    expect(findLaneTemperatureContextMock).toHaveBeenCalledWith('LN-2026-001');
    expect(listLaneCheckpointMarkersMock).toHaveBeenCalledWith('lane-db-1');
  });

  it('calculateShelfLifeImpact caps cumulative reduction at one hundred percent', async () => {
    const profile = buildProfile({
      shelfLifeMinDays: 14,
      shelfLifeMaxDays: 21,
    });

    await expect(
      service.calculateShelfLifeImpact(profile, [
        {
          id: 'exc-1',
          laneId: 'lane-db-1',
          startedAt: new Date('2026-03-24T00:00:00.000Z'),
          endedAt: new Date('2026-03-24T01:00:00.000Z'),
          ongoing: false,
          durationMinutes: 60,
          severity: 'CRITICAL',
          direction: 'LOW',
          type: 'CHILLING',
          thresholdC: 10,
          minObservedC: 6,
          maxObservedC: 6,
          maxDeviationC: 4,
          shelfLifeImpactPercent: 100,
        },
        {
          id: 'exc-2',
          laneId: 'lane-db-1',
          startedAt: new Date('2026-03-24T02:00:00.000Z'),
          endedAt: new Date('2026-03-24T03:00:00.000Z'),
          ongoing: false,
          durationMinutes: 60,
          severity: 'SEVERE',
          direction: 'HIGH',
          type: 'HEAT',
          thresholdC: 13,
          minObservedC: 17,
          maxObservedC: 17,
          maxDeviationC: 4,
          shelfLifeImpactPercent: 25,
        },
      ]),
    ).resolves.toEqual(
      expect.objectContaining({
        shelfLifeImpactPercent: 100,
        remainingShelfLifeDays: 0,
        status: 'FAIL',
      }),
    );
  });
});

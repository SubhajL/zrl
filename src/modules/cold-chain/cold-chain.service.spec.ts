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

    const store: ColdChainStore = {
      listProfiles: listProfilesMock,
      findProfileByProduct: findProfileByProductMock,
    };

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

    service = new ColdChainService(store);
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
});

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MRV_LITE_STORE,
  EMISSION_FACTORS,
  findEmissionFactor,
} from './mrv-lite.constants';
import type {
  EmissionFactor,
  ExporterEsgReport,
  LaneEsgCard,
  MrvLiteStore,
  PlatformEsgReport,
} from './mrv-lite.types';

@Injectable()
export class MrvLiteService {
  constructor(@Inject(MRV_LITE_STORE) private readonly store: MrvLiteStore) {}

  async getLaneEsgCard(laneId: string): Promise<LaneEsgCard> {
    const data = await this.store.getLaneEsgData(laneId);

    if (data === null) {
      throw new NotFoundException('Lane not found');
    }

    const transportMode = data.transportMode ?? 'UNKNOWN';
    const co2ePerKg = findEmissionFactor(
      data.productType,
      data.destinationMarket,
      transportMode,
    );
    const co2eTotalKg = Math.round(co2ePerKg * data.quantityKg * 100) / 100;

    return {
      carbon: {
        co2eTotalKg,
        co2ePerKg,
        transportMode,
        quantityKg: data.quantityKg,
      },
      waste: {
        laneStatus: data.status,
        isRejected: data.status === 'INCOMPLETE',
      },
      social: {
        originProvince: data.originProvince,
        product: data.productType,
      },
      governance: {
        completenessScore: data.completenessScore,
        evidenceCount: data.evidenceCount,
        auditEntryCount: data.auditEntryCount,
      },
    };
  }

  async getExporterReport(
    exporterId: string,
    quarter: number,
    year: number,
  ): Promise<ExporterEsgReport> {
    const data = await this.store.getExporterEsgData(exporterId, quarter, year);

    return {
      exporterId,
      period: { quarter, year },
      environmental: {
        totalCo2eKg: data.totalCo2eKg,
        avgCo2ePerKg: data.avgCo2ePerKg,
        laneCount: data.laneCount,
      },
      social: {
        distinctProvinces: data.distinctProvinces,
        distinctProducts: data.distinctProducts,
      },
      governance: {
        avgCompleteness: data.avgCompleteness,
        totalEvidenceCount: data.totalEvidenceCount,
      },
    };
  }

  async getPlatformReport(year: number): Promise<PlatformEsgReport> {
    const data = await this.store.getPlatformEsgData(year);

    return {
      year,
      environmental: {
        totalCo2eKg: data.totalCo2eKg,
        avgCo2ePerKg: data.avgCo2ePerKg,
        laneCount: data.laneCount,
      },
      social: {
        distinctExporters: data.distinctExporters,
        distinctProvinces: data.distinctProvinces,
        distinctProducts: data.distinctProducts,
      },
      governance: {
        avgCompleteness: data.avgCompleteness,
        totalEvidenceCount: data.totalEvidenceCount,
        totalAuditEntries: data.totalAuditEntries,
      },
    };
  }

  getEmissionFactors(): EmissionFactor[] {
    return [...EMISSION_FACTORS];
  }
}

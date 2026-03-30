import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MRV_LITE_STORE,
  EMISSION_FACTORS,
  findEmissionFactor,
} from './mrv-lite.constants';
import type {
  EmissionFactor,
  ExporterEsgReport,
  LaneCarbonRow,
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
    const rows = await this.store.getExporterLaneCarbonRows(
      exporterId,
      quarter,
      year,
    );
    const carbon = this.aggregateCarbonRows(rows);

    return {
      exporterId,
      period: { quarter, year },
      environmental: {
        totalCo2eKg: carbon.totalCo2eKg,
        avgCo2ePerKg: carbon.avgCo2ePerKg,
        laneCount: rows.length,
      },
      social: {
        distinctProvinces: this.countDistinct(
          rows.map((r) => r.originProvince),
        ),
        distinctProducts: this.countDistinct(rows.map((r) => r.productType)),
      },
      governance: {
        avgCompleteness:
          rows.length > 0
            ? Math.round(
                rows.reduce((s, r) => s + r.completenessScore, 0) / rows.length,
              )
            : 0,
        totalEvidenceCount: rows.reduce((s, r) => s + r.evidenceCount, 0),
      },
    };
  }

  async getPlatformReport(year: number): Promise<PlatformEsgReport> {
    const rows = await this.store.getPlatformLaneCarbonRows(year);
    const carbon = this.aggregateCarbonRows(rows);

    return {
      year,
      environmental: {
        totalCo2eKg: carbon.totalCo2eKg,
        avgCo2ePerKg: carbon.avgCo2ePerKg,
        laneCount: rows.length,
      },
      social: {
        distinctExporters: this.countDistinct(rows.map((r) => r.exporterId)),
        distinctProvinces: this.countDistinct(
          rows.map((r) => r.originProvince),
        ),
        distinctProducts: this.countDistinct(rows.map((r) => r.productType)),
      },
      governance: {
        avgCompleteness:
          rows.length > 0
            ? Math.round(
                rows.reduce((s, r) => s + r.completenessScore, 0) / rows.length,
              )
            : 0,
        totalEvidenceCount: rows.reduce((s, r) => s + r.evidenceCount, 0),
        totalAuditEntries: rows.reduce((s, r) => s + r.auditEntryCount, 0),
      },
    };
  }

  private aggregateCarbonRows(rows: LaneCarbonRow[]): {
    totalCo2eKg: number;
    avgCo2ePerKg: number;
  } {
    if (rows.length === 0) {
      return { totalCo2eKg: 0, avgCo2ePerKg: 0 };
    }

    let totalCo2e = 0;
    let totalQuantity = 0;

    for (const row of rows) {
      const transportMode = row.transportMode ?? 'UNKNOWN';
      const factor = findEmissionFactor(
        row.productType,
        row.destinationMarket,
        transportMode,
      );
      totalCo2e += factor * row.quantityKg;
      totalQuantity += row.quantityKg;
    }

    return {
      totalCo2eKg: Math.round(totalCo2e * 100) / 100,
      avgCo2ePerKg:
        totalQuantity > 0
          ? Math.round((totalCo2e / totalQuantity) * 100) / 100
          : 0,
    };
  }

  private countDistinct(values: (string | undefined)[]): number {
    return new Set(values.filter((v) => v !== undefined && v !== '')).size;
  }

  getEmissionFactors(): EmissionFactor[] {
    return [...EMISSION_FACTORS];
  }
}

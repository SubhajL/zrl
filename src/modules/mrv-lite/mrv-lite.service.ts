import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MRV_LITE_STORE,
  DEFAULT_EMISSION_FACTORS,
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
    const [data, factors] = await Promise.all([
      this.store.getLaneEsgData(laneId),
      this.resolveEmissionFactors(),
    ]);

    if (data === null) {
      throw new NotFoundException('Lane not found');
    }

    const transportMode = data.transportMode ?? 'UNKNOWN';
    const co2ePerKg = findEmissionFactor(
      factors,
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
        disputeCount: data.disputeCount,
        resolvedDisputeCount: data.resolvedDisputeCount,
        gradeDowngradeCount: data.downgradedDisputeCount,
        damageClaimCount: data.damagedDisputeCount,
        estimatedWasteEvents: this.estimateWasteEvents(data),
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
    const [rows, factors] = await Promise.all([
      this.store.getExporterLaneCarbonRows(exporterId, quarter, year),
      this.resolveEmissionFactors(),
    ]);
    const carbon = this.aggregateCarbonRows(rows, factors);
    const waste = this.aggregateWasteRows(rows);

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
      waste,
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
    const [rows, factors] = await Promise.all([
      this.store.getPlatformLaneCarbonRows(year),
      this.resolveEmissionFactors(),
    ]);
    const carbon = this.aggregateCarbonRows(rows, factors);
    const waste = this.aggregateWasteRows(rows);

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
      waste,
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

  private aggregateCarbonRows(
    rows: LaneCarbonRow[],
    factors: readonly EmissionFactor[],
  ): {
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
        factors,
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

  private aggregateWasteRows(rows: LaneCarbonRow[]): {
    totalRejectedLanes: number;
    totalDisputes: number;
    totalGradeDowngrades: number;
    totalDamageClaims: number;
    estimatedWasteEvents: number;
  } {
    return {
      totalRejectedLanes: rows.filter((row) => row.status === 'INCOMPLETE')
        .length,
      totalDisputes: rows.reduce((sum, row) => sum + row.disputeCount, 0),
      totalGradeDowngrades: rows.reduce(
        (sum, row) => sum + row.downgradedDisputeCount,
        0,
      ),
      totalDamageClaims: rows.reduce(
        (sum, row) => sum + row.damagedDisputeCount,
        0,
      ),
      estimatedWasteEvents: rows.reduce(
        (sum, row) => sum + this.estimateWasteEvents(row),
        0,
      ),
    };
  }

  private estimateWasteEvents(row: {
    status: string;
    disputeCount: number;
    resolvedDisputeCount: number;
    downgradedDisputeCount: number;
    damagedDisputeCount: number;
  }): number {
    const rejectionCount = row.status === 'INCOMPLETE' ? 1 : 0;
    const unresolvedDisputes = Math.max(
      0,
      row.disputeCount - row.resolvedDisputeCount,
    );
    const categorizedWaste =
      row.downgradedDisputeCount + row.damagedDisputeCount;

    return rejectionCount + Math.max(unresolvedDisputes, categorizedWaste);
  }

  private countDistinct(values: (string | undefined)[]): number {
    return new Set(values.filter((v) => v !== undefined && v !== '')).size;
  }

  async getEmissionFactors(): Promise<EmissionFactor[]> {
    return [...(await this.resolveEmissionFactors())];
  }

  private async resolveEmissionFactors(): Promise<readonly EmissionFactor[]> {
    const stored = await this.store.listEmissionFactors();
    if (stored.length > 0) {
      return stored;
    }

    return DEFAULT_EMISSION_FACTORS;
  }
}

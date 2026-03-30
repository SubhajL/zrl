export interface EmissionFactor {
  readonly product: string;
  readonly market: string;
  readonly transportMode: string;
  readonly co2ePerKg: number;
}

export interface LaneEsgCard {
  readonly carbon: {
    readonly co2eTotalKg: number;
    readonly co2ePerKg: number;
    readonly transportMode: string;
    readonly quantityKg: number;
  };
  readonly waste: {
    readonly laneStatus: string;
    readonly isRejected: boolean;
  };
  readonly social: {
    readonly originProvince: string;
    readonly product: string;
  };
  readonly governance: {
    readonly completenessScore: number;
    readonly evidenceCount: number;
    readonly auditEntryCount: number;
  };
}

export interface ExporterEsgReport {
  readonly exporterId: string;
  readonly period: { readonly quarter: number; readonly year: number };
  readonly environmental: {
    readonly totalCo2eKg: number;
    readonly avgCo2ePerKg: number;
    readonly laneCount: number;
  };
  readonly social: {
    readonly distinctProvinces: number;
    readonly distinctProducts: number;
  };
  readonly governance: {
    readonly avgCompleteness: number;
    readonly totalEvidenceCount: number;
  };
}

export interface PlatformEsgReport {
  readonly year: number;
  readonly environmental: {
    readonly totalCo2eKg: number;
    readonly avgCo2ePerKg: number;
    readonly laneCount: number;
  };
  readonly social: {
    readonly distinctExporters: number;
    readonly distinctProvinces: number;
    readonly distinctProducts: number;
  };
  readonly governance: {
    readonly avgCompleteness: number;
    readonly totalEvidenceCount: number;
    readonly totalAuditEntries: number;
  };
}

export interface MrvLiteStore {
  getExporterEsgData(
    exporterId: string,
    quarter: number,
    year: number,
  ): Promise<{
    totalCo2eKg: number;
    avgCo2ePerKg: number;
    laneCount: number;
    avgCompleteness: number;
    totalEvidenceCount: number;
    distinctProvinces: number;
    distinctProducts: number;
  }>;
  getPlatformEsgData(year: number): Promise<{
    totalCo2eKg: number;
    avgCo2ePerKg: number;
    laneCount: number;
    avgCompleteness: number;
    totalEvidenceCount: number;
    totalAuditEntries: number;
    distinctExporters: number;
    distinctProvinces: number;
    distinctProducts: number;
  }>;
  getLaneEsgData(laneId: string): Promise<{
    productType: string;
    destinationMarket: string;
    transportMode: string | null;
    quantityKg: number;
    completenessScore: number;
    status: string;
    originProvince: string;
    evidenceCount: number;
    auditEntryCount: number;
  } | null>;
}

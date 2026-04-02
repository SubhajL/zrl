export interface EmissionFactor {
  readonly product: string;
  readonly market: string;
  readonly transportMode: string;
  readonly co2ePerKg: number;
  readonly source: string;
  readonly lastUpdated: string;
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
    readonly disputeCount: number;
    readonly resolvedDisputeCount: number;
    readonly gradeDowngradeCount: number;
    readonly damageClaimCount: number;
    readonly estimatedWasteEvents: number;
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
  readonly waste: {
    readonly totalRejectedLanes: number;
    readonly totalDisputes: number;
    readonly totalGradeDowngrades: number;
    readonly totalDamageClaims: number;
    readonly estimatedWasteEvents: number;
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
  readonly waste: {
    readonly totalRejectedLanes: number;
    readonly totalDisputes: number;
    readonly totalGradeDowngrades: number;
    readonly totalDamageClaims: number;
    readonly estimatedWasteEvents: number;
  };
  readonly governance: {
    readonly avgCompleteness: number;
    readonly totalEvidenceCount: number;
    readonly totalAuditEntries: number;
  };
}

export interface LaneCarbonRow {
  readonly status: string;
  readonly productType: string;
  readonly destinationMarket: string;
  readonly transportMode: string | null;
  readonly quantityKg: number;
  readonly completenessScore: number;
  readonly originProvince: string;
  readonly evidenceCount: number;
  readonly auditEntryCount: number;
  readonly disputeCount: number;
  readonly resolvedDisputeCount: number;
  readonly downgradedDisputeCount: number;
  readonly damagedDisputeCount: number;
  readonly exporterId?: string;
}

export interface MrvLiteStore {
  listEmissionFactors(): Promise<EmissionFactor[]>;
  getExporterLaneCarbonRows(
    exporterId: string,
    quarter: number,
    year: number,
  ): Promise<LaneCarbonRow[]>;
  getPlatformLaneCarbonRows(year: number): Promise<LaneCarbonRow[]>;
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
    disputeCount: number;
    resolvedDisputeCount: number;
    downgradedDisputeCount: number;
    damagedDisputeCount: number;
  } | null>;
}

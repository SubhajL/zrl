export type ProofPackType = 'REGULATOR' | 'BUYER' | 'DEFENSE';

export interface ProofPackRecord {
  readonly id: string;
  readonly laneId: string;
  readonly packType: ProofPackType;
  readonly version: number;
  readonly contentHash: string;
  readonly filePath: string;
  readonly generatedAt: Date;
  readonly generatedBy: string;
  readonly recipient: string | null;
}

export interface ProofPackGenerationInput {
  readonly laneId: string;
  readonly packType: ProofPackType;
  readonly generatedBy: string;
}

export interface ProofPackTemplateData {
  readonly laneId: string;
  readonly batchId: string;
  readonly product: string;
  readonly market: string;
  readonly variety: string | null;
  readonly quantity: number;
  readonly grade: string;
  readonly origin: string;
  readonly harvestDate: string;
  readonly transportMode: string;
  readonly carrier: string | null;
  readonly completeness: number;
  readonly status: string;
  readonly checklistItems: ReadonlyArray<{
    readonly label: string;
    readonly category: string;
    readonly status: string;
  }>;
  readonly labResults: ReadonlyArray<{
    readonly substance: string;
    readonly thaiMrl: number;
    readonly destinationMrl: number;
    readonly measuredValue: number | null;
    readonly status: string;
  }> | null;
  readonly checkpoints: ReadonlyArray<{
    readonly sequence: number;
    readonly location: string;
    readonly status: string;
    readonly timestamp: string | null;
    readonly temperature: number | null;
    readonly signer: string | null;
  }>;
  readonly auditEntries?: ReadonlyArray<{
    readonly timestamp: string;
    readonly actor: string;
    readonly action: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly entryHash: string;
  }>;
  readonly slaStatus?: string;
  readonly excursionCount?: number;
  readonly qrCodeDataUrl: string;
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly packType: ProofPackType;
}

export interface ProofPackStore {
  createPack(record: Omit<ProofPackRecord, 'id'>): Promise<ProofPackRecord>;
  findPacksForLane(laneId: string): Promise<ProofPackRecord[]>;
  getLatestVersion(laneId: string, packType: ProofPackType): Promise<number>;
}

export const PROOF_PACK_STORE = Symbol('PROOF_PACK_STORE');

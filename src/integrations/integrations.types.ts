import type {
  EvidenceArtifactResponse,
  EvidenceRequestUser,
} from '../modules/evidence/evidence.types';
import type { IngestLaneReadingsResult } from '../modules/cold-chain/cold-chain.types';

export const LAB_PROVIDERS = ['central-lab-thai', 'sgs-thailand'] as const;
export type LabProvider = (typeof LAB_PROVIDERS)[number];

export const TEMPERATURE_PROVIDERS = ['thai-airways', 'kerry'] as const;
export type TemperatureProvider = (typeof TEMPERATURE_PROVIDERS)[number];

export interface LabImportReferenceInput {
  reportId: string;
}

export interface TemperatureImportReferenceInput {
  shipmentId: string;
}

export interface AcfsImportInput {
  certificateNumber: string;
}

export interface NormalizedLabResult {
  substance: string;
  valueMgKg: number;
  method: string | null;
  detectionLimitMgKg: number | null;
}

export interface NormalizedTemperatureReading {
  timestamp: string;
  temperatureC: number;
  deviceId: string | null;
  location: string | null;
}

export interface AcfsCertificateLookup {
  provider: 'acfs';
  certificateNumber: string;
  valid: boolean;
  expiryDate: string | null;
  holderName: string | null;
  scope: string[];
  checkedAt: string;
}

export interface PartnerLabImportResult {
  provider: LabProvider;
  artifact: EvidenceArtifactResponse;
}

export interface PartnerTemperatureImportResult {
  provider: TemperatureProvider;
  artifact: EvidenceArtifactResponse;
  ingestion?: IngestLaneReadingsResult;
}

export interface PartnerAcfsImportResult extends AcfsCertificateLookup {
  artifact: EvidenceArtifactResponse;
}

export interface PartnerIntegrationEvidencePort {
  createPartnerLabArtifact(
    input: {
      laneId: string;
      issuer?: string;
      issuedAt?: string;
      payload: Record<string, unknown>;
    },
    actor: EvidenceRequestUser,
  ): Promise<{ artifact: EvidenceArtifactResponse }>;
  createPartnerTemperatureArtifact(
    input: {
      laneId: string;
      issuer?: string;
      issuedAt?: string;
      payload: Record<string, unknown>;
    },
    actor: EvidenceRequestUser,
  ): Promise<{
    artifact: EvidenceArtifactResponse;
    ingestion?: IngestLaneReadingsResult;
  }>;
  createPartnerCertificationArtifact(
    input: {
      laneId: string;
      issuer?: string;
      issuedAt?: string;
      payload: Record<string, unknown>;
    },
    actor: EvidenceRequestUser,
  ): Promise<{ artifact: EvidenceArtifactResponse }>;
}

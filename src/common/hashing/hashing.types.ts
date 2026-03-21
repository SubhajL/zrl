import type { Readable } from 'node:stream';

export interface HashChainEntryInput {
  timestamp: Date | string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  payloadHash: string;
  prevHash: string;
}

export interface HashChainEntry extends HashChainEntryInput {
  entryHash: string;
}

export type HashChainVerificationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      firstInvalidIndex: number;
    };

export interface ArtifactContentReader {
  openArtifactStream(artifactId: string): Promise<Readable>;
}

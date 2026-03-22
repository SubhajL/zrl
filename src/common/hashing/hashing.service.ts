/**
 * SHA-256 hashing service — core to ZRL evidence integrity.
 * @module HashingService
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Readable } from 'node:stream';
import type {
  ArtifactContentReader,
  HashChainEntry,
  HashChainEntryInput,
  HashChainVerificationResult,
} from './hashing.types';
import { HASH_ARTIFACT_CONTENT_READER } from './hashing.constants';
import {
  computeHashChainEntry,
  hashBufferHex,
  hashReadableStream,
  hashUtf8String,
  verifyArtifactDigest,
  verifyHashChain,
} from './hashing.utils';

@Injectable()
export class HashingService {
  constructor(
    @Optional()
    @Inject(HASH_ARTIFACT_CONTENT_READER)
    private readonly artifactContentReader?: ArtifactContentReader,
  ) {}

  hashBuffer(buffer: Buffer): string {
    return hashBufferHex(buffer);
  }

  hashString(content: string): Promise<string> {
    return Promise.resolve(hashUtf8String(content));
  }

  async hashFile(stream: Readable): Promise<string> {
    return await hashReadableStream(stream);
  }

  computeEntryHash(entry: HashChainEntryInput): string {
    return computeHashChainEntry(entry);
  }

  async verifyArtifactHash(
    artifactId: string,
    storedHash: string,
  ): Promise<boolean> {
    if (this.artifactContentReader === undefined) {
      throw new Error('Artifact content reader is not configured.');
    }

    const stream =
      await this.artifactContentReader.openArtifactStream(artifactId);

    return await verifyArtifactDigest(stream, storedHash);
  }

  verifyChain(entries: readonly HashChainEntry[]): HashChainVerificationResult {
    return verifyHashChain(entries);
  }
}

import { createHash } from 'node:crypto';
import type { BinaryLike } from 'node:crypto';
import type { Readable } from 'node:stream';
import { HASH_ALGORITHM, HASH_CHAIN_GENESIS_SEED } from './hashing.constants';
import type {
  HashChainEntry,
  HashChainEntryInput,
  HashChainVerificationResult,
} from './hashing.types';

function toHashableChunk(chunk: unknown): BinaryLike {
  if (typeof chunk === 'string') {
    return Buffer.from(chunk);
  }

  if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
    return chunk;
  }

  throw new TypeError('Unsupported stream chunk type.');
}

function normalizeTimestamp(timestamp: Date | string): string {
  return timestamp instanceof Date ? timestamp.toISOString() : timestamp;
}

export function hashBufferHex(buffer: Buffer): string {
  return createHash(HASH_ALGORITHM).update(buffer).digest('hex');
}

export function hashUtf8String(content: string): string {
  return hashBufferHex(Buffer.from(content, 'utf8'));
}

export function getGenesisHash(): string {
  return hashUtf8String(HASH_CHAIN_GENESIS_SEED);
}

export async function hashReadableStream(stream: Readable): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const hash = createHash(HASH_ALGORITHM);
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    stream.on('data', (chunk: unknown) => {
      try {
        hash.update(toHashableChunk(chunk));
      } catch (error) {
        fail(error);
        stream.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    stream.once('error', fail);
    stream.once('end', () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(hash.digest('hex'));
    });
  });
}

export function computeHashChainEntry(entry: HashChainEntryInput): string {
  const canonicalPayload = `${normalizeTimestamp(entry.timestamp)}${entry.actor}${entry.action}${entry.entityType}${entry.entityId}${entry.payloadHash}${entry.prevHash}`;

  return hashUtf8String(canonicalPayload);
}

export async function verifyArtifactDigest(
  stream: Readable,
  storedHash: string,
): Promise<boolean> {
  const computedHash = await hashReadableStream(stream);

  return computedHash === storedHash;
}

export function verifyHashChain(
  entries: readonly HashChainEntry[],
): HashChainVerificationResult {
  for (const [index, entry] of entries.entries()) {
    const expectedPrevHash =
      index === 0 ? getGenesisHash() : entries[index - 1].entryHash;

    if (entry.prevHash !== expectedPrevHash) {
      return { valid: false, firstInvalidIndex: index };
    }

    if (computeHashChainEntry(entry) !== entry.entryHash) {
      return { valid: false, firstInvalidIndex: index };
    }
  }

  return { valid: true };
}

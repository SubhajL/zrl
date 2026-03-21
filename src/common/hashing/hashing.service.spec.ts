import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { HASH_CHAIN_GENESIS_SEED } from './hashing.constants';
import { HashingService } from './hashing.service';
import type { ArtifactContentReader, HashChainEntry } from './hashing.types';

function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

function buildValidChain(): HashChainEntry[] {
  const genesisHash = sha256Hex(HASH_CHAIN_GENESIS_SEED);
  const entry1PayloadHash = sha256Hex('lane-created');
  const entry1Hash = sha256Hex(
    `2026-03-16T07:00:00.000Zactor-1CREATELANElane-1${entry1PayloadHash}${genesisHash}`,
  );
  const entry2PayloadHash = sha256Hex('checkpoint-signed');
  const entry2Hash = sha256Hex(
    `2026-03-16T08:00:00.000Zactor-1SIGNCHECKPOINTlane-1${entry2PayloadHash}${entry1Hash}`,
  );

  return [
    {
      timestamp: new Date('2026-03-16T07:00:00.000Z'),
      actor: 'actor-1',
      action: 'CREATE',
      entityType: 'LANE',
      entityId: 'lane-1',
      payloadHash: entry1PayloadHash,
      prevHash: genesisHash,
      entryHash: entry1Hash,
    },
    {
      timestamp: new Date('2026-03-16T08:00:00.000Z'),
      actor: 'actor-1',
      action: 'SIGN',
      entityType: 'CHECKPOINT',
      entityId: 'lane-1',
      payloadHash: entry2PayloadHash,
      prevHash: entry1Hash,
      entryHash: entry2Hash,
    },
  ];
}

describe('HashingService', () => {
  let service: HashingService;

  beforeEach(() => {
    service = new HashingService();
  });

  it('hashBuffer returns a deterministic lowercase sha256 digest', () => {
    const payload = Buffer.from('thai-mango');
    const expectedDigest = sha256Hex(payload);

    expect(service.hashBuffer(payload)).toBe(expectedDigest);
    expect(service.hashBuffer(payload)).toBe(expectedDigest);
  });

  it('hashString hashes unicode content consistently', async () => {
    const payload = 'มะม่วง Nam Doc Mai';
    const expectedDigest = sha256Hex(payload);

    await expect(service.hashString(payload)).resolves.toBe(expectedDigest);
  });

  it('hashFile matches hashBuffer for the same content', async () => {
    const payload = Buffer.from('checkpoint-photo-binary');
    const stream = Readable.from(payload);

    await expect(service.hashFile(stream)).resolves.toBe(
      service.hashBuffer(payload),
    );
  });

  it('hashFile hashes an empty stream', async () => {
    const payload = Buffer.alloc(0);
    const stream = Readable.from(payload);

    await expect(service.hashFile(stream)).resolves.toBe(sha256Hex(payload));
  });

  it('hashFile rejects when the source stream errors', async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error('stream failed'));
      },
    });

    await expect(service.hashFile(stream)).rejects.toThrow('stream failed');
  });

  it('computeEntryHash matches the canonical audit concatenation', () => {
    const payloadHash = sha256Hex('lane-created');
    const prevHash = sha256Hex(HASH_CHAIN_GENESIS_SEED);

    expect(
      service.computeEntryHash({
        timestamp: new Date('2026-03-16T07:00:00.000Z'),
        actor: 'actor-1',
        action: 'CREATE',
        entityType: 'LANE',
        entityId: 'lane-1',
        payloadHash,
        prevHash,
      }),
    ).toBe(
      sha256Hex(
        `2026-03-16T07:00:00.000Zactor-1CREATELANElane-1${payloadHash}${prevHash}`,
      ),
    );
  });

  it('verifyArtifactHash returns true for a matching stream digest', async () => {
    const payload = Buffer.from('artifact-bytes');
    const reader: ArtifactContentReader = {
      openArtifactStream(): Promise<Readable> {
        return Promise.resolve(Readable.from(payload));
      },
    };
    const serviceWithReader = new HashingService(reader);

    await expect(
      serviceWithReader.verifyArtifactHash('artifact-1', sha256Hex(payload)),
    ).resolves.toBe(true);
  });

  it('verifyArtifactHash returns false for a mismatched stream digest', async () => {
    const payload = Buffer.from('artifact-bytes');
    const reader: ArtifactContentReader = {
      openArtifactStream(): Promise<Readable> {
        return Promise.resolve(Readable.from(payload));
      },
    };
    const serviceWithReader = new HashingService(reader);

    await expect(
      serviceWithReader.verifyArtifactHash('artifact-1', sha256Hex('wrong')),
    ).resolves.toBe(false);
  });

  it('verifyArtifactHash fails when no artifact reader is configured', async () => {
    await expect(
      service.verifyArtifactHash('artifact-1', sha256Hex('artifact-bytes')),
    ).rejects.toThrow('Artifact content reader is not configured.');
  });

  it('verifyChain succeeds for a valid chain', () => {
    expect(service.verifyChain(buildValidChain())).toEqual({ valid: true });
  });

  it('verifyChain reports the first invalid entry hash', () => {
    const chain = buildValidChain();
    chain[1] = {
      ...chain[1],
      entryHash: sha256Hex('tampered-entry-hash'),
    };

    expect(service.verifyChain(chain)).toEqual({
      valid: false,
      firstInvalidIndex: 1,
    });
  });

  it('verifyChain reports the first broken prevHash linkage', () => {
    const chain = buildValidChain();
    chain[1] = {
      ...chain[1],
      prevHash: sha256Hex('wrong-prev-hash'),
    };

    expect(service.verifyChain(chain)).toEqual({
      valid: false,
      firstInvalidIndex: 1,
    });
  });
});

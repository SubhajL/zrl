import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import {
  createEvidenceObjectStoreFromEnv,
  LocalEvidenceObjectStore,
  S3EvidenceObjectStore,
} from './evidence.storage';

type StreamChunk = string | Buffer | Uint8Array;
type CommandLike = {
  constructor: { name: string };
  input: Record<string, unknown>;
};

function toBuffer(chunk: StreamChunk): Buffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }

  return typeof chunk === 'string'
    ? Buffer.from(chunk, 'utf8')
    : Buffer.from(chunk);
}

describe('Evidence object storage', () => {
  it('keeps local storage as the default adapter', () => {
    const localStore = new LocalEvidenceObjectStore();

    expect(
      createEvidenceObjectStoreFromEnv(localStore, {
        EVIDENCE_OBJECT_STORE_BACKEND: 'local',
      }),
    ).toBe(localStore);
  });

  it('selects the S3 adapter when S3 env is configured', () => {
    const localStore = new LocalEvidenceObjectStore();

    const store = createEvidenceObjectStoreFromEnv(localStore, {
      AWS_REGION: 'ap-southeast-1',
      EVIDENCE_S3_BUCKET: 'zrl-evidence',
    });

    expect(store).toBeInstanceOf(S3EvidenceObjectStore);
  });

  it('stores, reads, and deletes files in local mode', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'zrl-evidence-storage-'));
    process.env['EVIDENCE_STORAGE_ROOT'] = directory;
    const store = new LocalEvidenceObjectStore();
    const uploadFilePath = join(directory, 'upload.txt');
    writeFileSync(uploadFilePath, 'evidence');

    await store.putObjectFromFile({
      key: 'evidence/LN-2026-001/PHYTO_CERT/hash.txt',
      filePath: uploadFilePath,
      contentType: 'text/plain',
      contentLength: 8,
    });

    const storedStream = await store.createReadStream(
      'evidence/LN-2026-001/PHYTO_CERT/hash.txt',
    );
    const chunks: Buffer[] = [];
    for await (const chunk of storedStream as AsyncIterable<StreamChunk>) {
      chunks.push(toBuffer(chunk));
    }

    expect(Buffer.concat(chunks).toString('utf8')).toBe('evidence');

    await store.deleteObject('evidence/LN-2026-001/PHYTO_CERT/hash.txt');
    expect(() =>
      readFileSync(join(directory, 'evidence/LN-2026-001/PHYTO_CERT/hash.txt')),
    ).toThrow();
    delete process.env['EVIDENCE_STORAGE_ROOT'];
  });

  it('sends S3 commands through the AWS client', async () => {
    const client = {
      send: jest.fn(() =>
        Promise.resolve({
          Body: Readable.from(['artifact-body']),
        }),
      ),
    };
    const directory = mkdtempSync(join(tmpdir(), 'zrl-evidence-s3-'));
    const uploadFilePath = join(directory, 'artifact.txt');
    writeFileSync(uploadFilePath, 'artifact-body');
    const store = new S3EvidenceObjectStore(client, {
      AWS_REGION: 'ap-southeast-1',
      EVIDENCE_S3_BUCKET: 'zrl-evidence',
      EVIDENCE_S3_PREFIX: 'prod',
    });

    await store.putObjectFromFile({
      key: 'evidence/key.txt',
      filePath: uploadFilePath,
      contentType: 'text/plain',
      contentLength: 13,
    });
    const responseStream = await store.createReadStream('evidence/key.txt');
    await store.deleteObject('evidence/key.txt');

    const responseChunks: Buffer[] = [];
    for await (const chunk of responseStream as AsyncIterable<StreamChunk>) {
      responseChunks.push(toBuffer(chunk));
    }

    const sentCommands = (client.send.mock.calls as Array<[CommandLike]>).map(
      ([command]) => ({
        name: command.constructor.name,
        input: command.input,
      }),
    );

    expect(sentCommands[0]?.name).toBe('PutObjectCommand');
    expect(sentCommands[0]?.input).toMatchObject({
      Bucket: 'zrl-evidence',
      Key: 'prod/evidence/key.txt',
      ContentType: 'text/plain',
      ContentLength: 13,
    });
    expect(sentCommands[1]?.name).toBe('GetObjectCommand');
    expect(sentCommands[1]?.input).toMatchObject({
      Bucket: 'zrl-evidence',
      Key: 'prod/evidence/key.txt',
    });
    expect(sentCommands[2]?.name).toBe('DeleteObjectCommand');
    expect(sentCommands[2]?.input).toMatchObject({
      Bucket: 'zrl-evidence',
      Key: 'prod/evidence/key.txt',
    });
    expect(Buffer.concat(responseChunks).toString('utf8')).toBe(
      'artifact-body',
    );
    expect(client.send).toHaveBeenCalledTimes(3);
  });
});

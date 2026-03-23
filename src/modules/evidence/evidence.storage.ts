import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import type {
  EvidenceObjectStore,
  PutObjectFromFileInput,
} from './evidence.types';

type S3Body =
  | Readable
  | { transformToWebStream(): ReadableStream<Uint8Array> }
  | undefined;

interface S3ClientLike {
  send(command: unknown): Promise<unknown>;
}

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function resolveReadable(body: S3Body): Readable {
  if (body instanceof Readable) {
    return body;
  }

  if (body !== undefined && 'transformToWebStream' in body) {
    return Readable.fromWeb(body.transformToWebStream());
  }

  throw new Error('S3 object body did not include a readable stream.');
}

@Injectable()
export class LocalEvidenceObjectStore implements EvidenceObjectStore {
  private readonly rootDirectory: string;

  constructor() {
    this.rootDirectory =
      process.env['EVIDENCE_STORAGE_ROOT'] ??
      join(process.cwd(), '.local', 'evidence-store');
  }

  async putObjectFromFile(input: PutObjectFromFileInput): Promise<void> {
    const destination = this.resolvePath(input.key);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(input.filePath, destination);
  }

  createReadStream(key: string): Promise<ReadStream> {
    return Promise.resolve(createReadStream(this.resolvePath(key)));
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  private resolvePath(key: string): string {
    return join(this.rootDirectory, key);
  }
}

@Injectable()
export class S3EvidenceObjectStore implements EvidenceObjectStore {
  private readonly client: S3ClientLike;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor(client?: S3ClientLike, env: NodeJS.ProcessEnv = process.env) {
    const region = env['AWS_REGION'] ?? env['AWS_DEFAULT_REGION'];
    const bucket = env['EVIDENCE_S3_BUCKET'];

    if (!hasValue(region) || !hasValue(bucket)) {
      throw new Error(
        'S3 evidence storage requires AWS_REGION and EVIDENCE_S3_BUCKET.',
      );
    }

    this.client =
      client ??
      new S3Client({
        region,
        endpoint: env['AWS_ENDPOINT'],
        forcePathStyle: env['AWS_S3_FORCE_PATH_STYLE'] === 'true',
      });
    this.bucket = bucket;
    this.keyPrefix = (env['EVIDENCE_S3_PREFIX'] ?? '').replace(/\/+$/u, '');
  }

  async putObjectFromFile(input: PutObjectFromFileInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.resolveKey(input.key),
        Body: createReadStream(input.filePath),
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
    );
  }

  async createReadStream(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.resolveKey(key),
      }),
    );

    return resolveReadable((response as { Body?: S3Body }).Body);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.resolveKey(key),
      }),
    );
  }

  private resolveKey(key: string): string {
    return this.keyPrefix.length === 0 ? key : `${this.keyPrefix}/${key}`;
  }
}

export function createEvidenceObjectStoreFromEnv(
  localStore: LocalEvidenceObjectStore,
  env: NodeJS.ProcessEnv = process.env,
): EvidenceObjectStore {
  const backend = env['EVIDENCE_OBJECT_STORE_BACKEND']?.trim().toLowerCase();
  const shouldUseS3 =
    backend === 's3' ||
    (backend === undefined &&
      hasValue(env['EVIDENCE_S3_BUCKET']) &&
      hasValue(env['AWS_REGION'] ?? env['AWS_DEFAULT_REGION']));

  if (!shouldUseS3) {
    return localStore;
  }

  return new S3EvidenceObjectStore(undefined, env);
}

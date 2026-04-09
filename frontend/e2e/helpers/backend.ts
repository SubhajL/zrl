import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface BackendEvidenceSeedResult {
  readonly completenessScore: number;
}

export interface BackendPackReadyResult {
  readonly packId: string;
}

export interface BackendArtifactAnalysisReadyResult {
  readonly artifactId: string;
  readonly documentLabel: string | null;
  readonly fieldCompleteness: {
    readonly supported: boolean;
    readonly expectedFieldKeys: readonly string[];
    readonly presentFieldKeys: readonly string[];
    readonly missingFieldKeys: readonly string[];
    readonly lowConfidenceFieldKeys: readonly string[];
    readonly unsupportedFieldKeys: readonly string[];
  };
}

export interface AuthenticatedBackendHelper {
  seedRequiredEvidenceForLane(
    laneId: string,
  ): Promise<BackendEvidenceSeedResult>;
  waitForArtifactIdByFileName(
    laneId: string,
    fileName: string,
  ): Promise<string>;
  waitForArtifactAnalysisReady(
    artifactId: string,
  ): Promise<BackendArtifactAnalysisReadyResult>;
  generateAndWaitForReadyPack(
    laneId: string,
    packType: 'REGULATOR' | 'BUYER' | 'DEFENSE',
  ): Promise<BackendPackReadyResult>;
  resolveFirstCheckpointId(laneId: string): Promise<string>;
  dispose(): Promise<void>;
}

interface CompletenessResponse {
  readonly score: number;
}

interface PacksResponse {
  readonly packs: Array<{
    readonly id: string;
    readonly packType: 'REGULATOR' | 'BUYER' | 'DEFENSE';
    readonly status: 'GENERATING' | 'READY' | 'FAILED';
    readonly errorMessage: string | null;
  }>;
}

interface CheckpointsResponse {
  readonly checkpoints: Array<{
    readonly id: string;
  }>;
}

interface ArtifactDetailResponse {
  readonly artifact: {
    readonly id: string;
    readonly latestAnalysis: {
      readonly documentLabel: string | null;
      readonly fieldCompleteness:
        | BackendArtifactAnalysisReadyResult['fieldCompleteness']
        | null;
    } | null;
  };
}

const DEFAULT_EXPORTER_EMAIL =
  process.env['PLAYWRIGHT_EXPORTER_EMAIL']?.trim() || 'exporter@zrl-dev.test';
const DEFAULT_EXPORTER_PASSWORD =
  process.env['PLAYWRIGHT_EXPORTER_PASSWORD']?.trim() || 'ZrlDev2026!';
const COMPLETENESS_TIMEOUT_MS = 30_000;
const ARTIFACT_ANALYSIS_TIMEOUT_MS = 30_000;
const PACK_READY_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 1_000;

type UploadDefinition = {
  readonly artifactType:
    | 'MRL_TEST'
    | 'VHT_CERT'
    | 'PHYTO_CERT'
    | 'GAP_CERT'
    | 'TEMP_DATA'
    | 'CHECKPOINT_PHOTO'
    | 'HANDOFF_SIGNATURE'
    | 'INVOICE';
  readonly fileName: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
  readonly metadata?: Record<string, unknown>;
  readonly checkpointId?: string;
};

type MultipartFile = {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
};

type MultipartValue = string | number | boolean | MultipartFile;
type MultipartPayload = Record<string, MultipartValue>;

class FrontendBackendHelper implements AuthenticatedBackendHelper {
  constructor(private readonly api: APIRequestContext) {}

  async seedRequiredEvidenceForLane(
    laneId: string,
  ): Promise<BackendEvidenceSeedResult> {
    const uploads: readonly UploadDefinition[] = [
      {
        artifactType: 'MRL_TEST',
        fileName: 'mrl-test-report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('mrl-test-report'),
        metadata: {
          documentType: 'MRL Test Results',
          results: [
            {
              substance: 'Carbendazim',
              cas: '10605-21-7',
              valueMgKg: 0.1,
            },
          ],
        },
      },
      {
        artifactType: 'VHT_CERT',
        fileName: 'vht-certificate.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('vht-certificate'),
        metadata: {
          documentType: 'VHT Certificate',
          expiresAt: '2026-12-31',
        },
      },
      {
        artifactType: 'PHYTO_CERT',
        fileName: 'phytosanitary-certificate.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('phytosanitary-certificate'),
        metadata: {
          documentType: 'Phytosanitary Certificate',
          expiresAt: '2026-12-31',
        },
      },
      {
        artifactType: 'GAP_CERT',
        fileName: 'gap-certificate.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('gap-certificate'),
        metadata: {
          documentType: 'GAP Certificate',
          expiresAt: '2026-12-31',
        },
      },
      {
        artifactType: 'TEMP_DATA',
        fileName: 'temperature-log.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          'timestamp,temperatureC\n2026-03-29T02:00:00.000Z,12.0\n2026-03-29T03:00:00.000Z,12.2\n',
        ),
        metadata: {
          documentType: 'Temperature Log',
        },
      },
      {
        artifactType: 'INVOICE',
        fileName: 'export-license.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('export-license'),
        metadata: {
          documentType: 'Export License',
        },
      },
      {
        artifactType: 'INVOICE',
        fileName: 'commercial-invoice.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('commercial-invoice'),
        metadata: {
          documentType: 'Commercial Invoice',
        },
      },
      {
        artifactType: 'INVOICE',
        fileName: 'grading-report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('grading-report'),
        metadata: {
          documentType: 'Grading Report',
        },
      },
      {
        artifactType: 'INVOICE',
        fileName: 'product-photos.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('product-photos'),
        metadata: {
          documentType: 'Product Photos',
        },
      },
      {
        artifactType: 'INVOICE',
        fileName: 'packing-list.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('packing-list'),
        metadata: {
          documentType: 'Packing List',
        },
      },
      {
        artifactType: 'TEMP_DATA',
        fileName: 'sla-summary.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            slaPass: true,
            averageTemperatureC: 12.1,
          }),
        ),
        metadata: {
          documentType: 'SLA Summary',
        },
      },
      {
        artifactType: 'TEMP_DATA',
        fileName: 'excursion-report.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            excursionCount: 0,
            highestSeverity: 'NONE',
          }),
        ),
        metadata: {
          documentType: 'Excursion Report',
        },
      },
      {
        artifactType: 'HANDOFF_SIGNATURE',
        fileName: 'handoff-signatures.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('handoff-signatures'),
        metadata: {
          documentType: 'Handoff Signatures',
        },
      },
      {
        artifactType: 'INVOICE',
        fileName: 'transport-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('transport-document'),
        metadata: {
          documentType: 'Transport Document',
        },
      },
      {
        artifactType: 'INVOICE',
        fileName: 'delivery-note.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('delivery-note'),
        metadata: {
          documentType: 'Delivery Note',
        },
      },
    ];

    for (const upload of uploads) {
      const multipart: MultipartPayload = {
        artifactType: upload.artifactType,
        source:
          upload.artifactType === 'CHECKPOINT_PHOTO' ? 'CAMERA' : 'UPLOAD',
        file: {
          name: upload.fileName,
          mimeType: upload.mimeType,
          buffer: upload.buffer,
        },
      };

      if (upload.metadata !== undefined) {
        multipart['metadata'] = JSON.stringify(upload.metadata);
      }
      if (upload.checkpointId !== undefined) {
        multipart['checkpointId'] = upload.checkpointId;
      }

      const response = await this.api.post(
        `/api/zrl/lanes/${encodeURIComponent(laneId)}/evidence`,
        {
          multipart,
        },
      );
      await assertJsonOk(
        response,
        `upload ${upload.artifactType} for lane ${laneId}`,
      );
    }

    const completeness = await this.waitForLaneCompleteness(laneId, 95);
    return {
      completenessScore: completeness.score,
    };
  }

  async waitForArtifactAnalysisReady(
    artifactId: string,
  ): Promise<BackendArtifactAnalysisReadyResult> {
    const deadline = Date.now() + ARTIFACT_ANALYSIS_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const response = await this.api.get(
        `/api/zrl/evidence/${encodeURIComponent(artifactId)}`,
      );
      const body = (await assertJsonOk(
        response,
        `fetch artifact ${artifactId}`,
      )) as ArtifactDetailResponse;
      const fieldCompleteness = body.artifact.latestAnalysis?.fieldCompleteness;

      if (fieldCompleteness !== null && fieldCompleteness !== undefined) {
        return {
          artifactId: body.artifact.id,
          documentLabel: body.artifact.latestAnalysis?.documentLabel ?? null,
          fieldCompleteness,
        };
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Artifact ${artifactId} did not receive OCR analysis within ${ARTIFACT_ANALYSIS_TIMEOUT_MS}ms.`,
    );
  }

  async waitForArtifactIdByFileName(
    laneId: string,
    fileName: string,
  ): Promise<string> {
    const deadline = Date.now() + ARTIFACT_ANALYSIS_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const response = await this.api.get(
        `/api/zrl/lanes/${encodeURIComponent(laneId)}/evidence`,
      );
      const body = (await assertJsonOk(
        response,
        `list evidence for lane ${laneId}`,
      )) as {
        artifacts: Array<{
          id: string;
          fileName: string;
        }>;
      };
      const artifactId = body.artifacts.find(
        (artifact) => artifact.fileName === fileName,
      )?.id;

      if (artifactId) {
        return artifactId;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Artifact ${fileName} did not appear in lane ${laneId} within ${ARTIFACT_ANALYSIS_TIMEOUT_MS}ms.`,
    );
  }

  async generateAndWaitForReadyPack(
    laneId: string,
    packType: 'REGULATOR' | 'BUYER' | 'DEFENSE',
  ): Promise<BackendPackReadyResult> {
    const response = await this.api.post(
      `/api/zrl/lanes/${encodeURIComponent(laneId)}/packs/generate`,
      {
        data: { packType },
      },
    );
    const created = (await assertJsonOk(
      response,
      `generate ${packType} pack`,
    )) as {
      pack: { id: string };
    };

    const deadline = Date.now() + PACK_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const packsResponse = await this.api.get(
        `/api/zrl/lanes/${encodeURIComponent(laneId)}/packs`,
      );
      const packs = (await assertJsonOk(
        packsResponse,
        `list packs for ${laneId}`,
      )) as PacksResponse;
      const matchingPack = packs.packs.find(
        (pack) => pack.id === created.pack.id,
      );
      if (matchingPack?.status === 'READY') {
        return { packId: matchingPack.id };
      }
      if (matchingPack?.status === 'FAILED') {
        throw new Error(
          matchingPack.errorMessage ??
            `Pack ${matchingPack.id} failed before reaching READY.`,
        );
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Pack ${created.pack.id} did not reach READY within ${PACK_READY_TIMEOUT_MS}ms.`,
    );
  }

  async resolveFirstCheckpointId(laneId: string): Promise<string> {
    const response = await this.api.get(
      `/api/zrl/lanes/${encodeURIComponent(laneId)}/checkpoints`,
    );
    const body = (await assertJsonOk(
      response,
      `list checkpoints for lane ${laneId}`,
    )) as CheckpointsResponse;
    const checkpointId = body.checkpoints[0]?.id;
    if (!checkpointId) {
      throw new Error(`Lane ${laneId} has no checkpoints.`);
    }

    return checkpointId;
  }

  async dispose(): Promise<void> {
    await this.api.dispose();
  }

  private async waitForLaneCompleteness(
    laneId: string,
    minimumScore: number,
  ): Promise<CompletenessResponse> {
    const deadline = Date.now() + COMPLETENESS_TIMEOUT_MS;
    let lastScore = 0;

    while (Date.now() < deadline) {
      const response = await this.api.get(
        `/api/zrl/lanes/${encodeURIComponent(laneId)}/completeness`,
      );
      const body = (await assertJsonOk(
        response,
        `fetch completeness for lane ${laneId}`,
      )) as CompletenessResponse;
      lastScore = body.score;
      if (body.score >= minimumScore) {
        return body;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Lane ${laneId} completeness stayed at ${lastScore}, below required ${minimumScore}.`,
    );
  }
}

async function assertJsonOk(
  response: APIResponse,
  context: string,
): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }

  if (response.ok()) {
    return body;
  }

  throw new Error(
    `${context} failed with ${response.status()}: ${JSON.stringify(body)}`,
  );
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function createAuthenticatedBackendHelper(
  api: APIRequestContext,
): Promise<AuthenticatedBackendHelper> {
  const loginResponse = await api.post('/api/session/login', {
    data: {
      email: DEFAULT_EXPORTER_EMAIL,
      password: DEFAULT_EXPORTER_PASSWORD,
    },
  });
  const body = (await assertJsonOk(
    loginResponse,
    'frontend session login',
  )) as {
    requireMfa: boolean;
  };

  if (body.requireMfa) {
    throw new Error(
      'The exporter Playwright account unexpectedly requires MFA.',
    );
  }

  return new FrontendBackendHelper(api);
}

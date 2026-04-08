import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import type { AuditStore } from '../../common/audit/audit.types';
import type { HashingService } from '../../common/hashing/hashing.service';
import type { ColdChainService } from '../cold-chain/cold-chain.service';
import { RealtimeEventsService } from '../notifications/realtime-events.service';
import type { EvidenceDocumentClassifier } from './evidence.types';
import type { EvidenceDocumentAnalysisProvider } from './evidence.types';
import { EvidenceService } from './evidence.service';
import {
  ArtifactSource,
  type EvidenceArtifactGraph,
  type EvidenceArtifactRecord,
  type EvidenceArtifactStore,
  type EvidenceGraphVerificationResult,
  type EvidenceListFilters,
  type EvidenceObjectStore,
} from './evidence.types';

function buildArtifact(
  overrides: Partial<EvidenceArtifactRecord> = {},
): EvidenceArtifactRecord {
  return {
    id: 'artifact-1',
    laneId: 'lane-db-1',
    lanePublicId: 'LN-2026-001',
    exporterId: 'exporter-1',
    artifactType: 'PHYTO_CERT',
    fileName: 'phyto.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 2048,
    filePath:
      'evidence/LN-2026-001/PHYTO_CERT/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf',
    contentHash:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    source: ArtifactSource.UPLOAD,
    checkpointId: null,
    verificationStatus: 'PENDING',
    metadata: null,
    latestAnalysis: null,
    uploadedBy: 'exporter-1',
    uploadedAt: new Date('2026-03-22T10:00:00.000Z'),
    updatedAt: new Date('2026-03-22T10:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('EvidenceService', () => {
  let auditStore: AuditStore;
  let objectStore: EvidenceObjectStore;
  let store: EvidenceArtifactStore;
  let hashingService: HashingService;
  let auditService: {
    createEntryWithStore: jest.Mock;
  };
  let photoMetadataExtractor: {
    extract: jest.Mock;
  };
  let service: EvidenceService;
  let tempDirectory: string;
  let uploadFilePath: string;
  let putObjectFromFileMock: jest.Mock;
  let createReadStreamMock: jest.Mock;
  let deleteObjectMock: jest.Mock;
  let findLaneByIdMock: jest.Mock;
  let createArtifactMock: jest.Mock;
  let createArtifactLinksMock: jest.Mock;
  let findLatestArtifactForLaneMock: jest.Mock;
  let findLatestArtifactForCheckpointMock: jest.Mock;
  let linkCreatesCycleMock: jest.Mock;
  let listArtifactsForLaneMock: jest.Mock;
  let listArtifactsForEvaluationMock: jest.Mock;
  let listArtifactsForIntegrityCheckMock: jest.Mock;
  let findArtifactByIdMock: jest.Mock;
  let updateArtifactVerificationStatusMock: jest.Mock;
  let findArtifactGraphForLaneMock: jest.Mock;
  let updateLaneCompletenessScoreMock: jest.Mock;
  let softDeleteArtifactMock: jest.Mock;
  let createArtifactAnalysisMock: jest.Mock;
  let rulesEngineService: {
    evaluateLane: jest.Mock;
    notifyCertificationAlertForArtifact: jest.Mock;
  };
  let laneReconciler: { reconcileAfterEvidenceChange: jest.Mock };
  let realtimeEvents: Pick<RealtimeEventsService, 'publishEvidenceUploaded'>;
  let coldChainService: Pick<ColdChainService, 'ingestLaneReadings'>;
  let documentAnalysisProvider: EvidenceDocumentAnalysisProvider;
  let documentClassifier: EvidenceDocumentClassifier;
  let extractTextMock: jest.Mock;
  let analyzeDocumentMock: jest.Mock;

  beforeEach(() => {
    auditStore = {
      runInTransaction: jest.fn(),
      resolveStreamId: jest.fn(),
      lockStream: jest.fn(),
      findLatestForStream: jest.fn(),
      createEntry: jest.fn(),
      findEntriesForLane: jest.fn(),
      findEntriesForEntity: jest.fn(),
    } as unknown as AuditStore;
    putObjectFromFileMock = jest.fn();
    createReadStreamMock = jest.fn();
    deleteObjectMock = jest.fn();
    objectStore = {
      putObjectFromFile: putObjectFromFileMock,
      createReadStream: createReadStreamMock,
      deleteObject: deleteObjectMock,
    };
    findLaneByIdMock = jest.fn();
    createArtifactMock = jest.fn();
    createArtifactLinksMock = jest.fn();
    findLatestArtifactForLaneMock = jest.fn();
    findLatestArtifactForCheckpointMock = jest.fn();
    linkCreatesCycleMock = jest.fn().mockResolvedValue(false);
    listArtifactsForLaneMock = jest.fn();
    listArtifactsForIntegrityCheckMock = jest.fn();
    findArtifactByIdMock = jest.fn();
    updateArtifactVerificationStatusMock = jest.fn();
    findArtifactGraphForLaneMock = jest.fn();
    listArtifactsForEvaluationMock = jest.fn();
    updateLaneCompletenessScoreMock = jest.fn();
    softDeleteArtifactMock = jest.fn();
    createArtifactAnalysisMock = jest.fn();
    const transactionalStore = {} as EvidenceArtifactStore;
    Object.assign(transactionalStore, {
      runInTransaction: jest.fn(
        <T>(operation: (nestedStore: EvidenceArtifactStore) => Promise<T>) =>
          operation(transactionalStore),
      ),
      asAuditStore: jest.fn().mockReturnValue(auditStore),
      findLaneById: findLaneByIdMock,
      createArtifact: createArtifactMock,
      createArtifactLinks: createArtifactLinksMock,
      findLatestArtifactForLane: findLatestArtifactForLaneMock,
      findLatestArtifactForCheckpoint: findLatestArtifactForCheckpointMock,
      linkCreatesCycle: linkCreatesCycleMock,
      listArtifactsForLane: listArtifactsForLaneMock,
      listArtifactsForEvaluation: listArtifactsForEvaluationMock,
      listArtifactsForIntegrityCheck: listArtifactsForIntegrityCheckMock,
      findArtifactById: findArtifactByIdMock,
      updateArtifactVerificationStatus: updateArtifactVerificationStatusMock,
      findArtifactGraphForLane: findArtifactGraphForLaneMock,
      updateLaneCompletenessScore: updateLaneCompletenessScoreMock,
      softDeleteArtifact: softDeleteArtifactMock,
      createArtifactAnalysis: createArtifactAnalysisMock,
    });
    store = transactionalStore;
    hashingService = {
      hashFile: jest.fn(),
      hashString: jest.fn(),
    } as unknown as HashingService;
    auditService = {
      createEntryWithStore: jest.fn(),
    };
    photoMetadataExtractor = {
      extract: jest.fn().mockResolvedValue(null),
    };
    rulesEngineService = {
      evaluateLane: jest.fn().mockReturnValue({
        score: 0,
        required: 0,
        present: 0,
        missing: [],
        checklist: [],
        categories: [],
        labValidation: null,
        certificationAlerts: [],
      }),
      notifyCertificationAlertForArtifact: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    laneReconciler = {
      reconcileAfterEvidenceChange: jest.fn().mockResolvedValue({
        lane: null,
        transitions: [],
      }),
    };
    realtimeEvents = {
      publishEvidenceUploaded: jest.fn().mockResolvedValue(undefined),
    };
    coldChainService = {
      ingestLaneReadings: jest.fn().mockResolvedValue({
        count: 2,
        excursionsDetected: 0,
        sla: {
          status: 'PASS',
          defensibilityScore: 100,
          shelfLifeImpactPercent: 0,
          remainingShelfLifeDays: 14,
          excursionCount: 0,
          totalExcursionMinutes: 0,
          maxDeviationC: 0,
        },
      }),
    };
    extractTextMock = jest.fn().mockResolvedValue({
      engine: 'tesseract',
      text: 'PHYTOSANITARY CERTIFICATE\nCertificate No. PC-2026-0001',
      preprocessingApplied: false,
    });
    documentAnalysisProvider = {
      getAvailability: jest.fn().mockResolvedValue({
        available: true,
        engine: 'tesseract',
        binaryPath: '/opt/homebrew/bin/tesseract',
        preprocessingAvailable: false,
        preprocessingEngine: 'ocrmypdf',
        preprocessingBinaryPath: null,
      }),
      extractText: extractTextMock,
    };
    analyzeDocumentMock = jest.fn().mockResolvedValue({
      analysisStatus: 'COMPLETED',
      documentLabel: 'Phytosanitary Certificate',
      documentRole: 'THAILAND_NPPO_EXPORT_CERTIFICATE',
      confidence: 'HIGH',
      summaryText:
        'Matched Phytosanitary Certificate using matrix-driven rules.',
      extractedFields: {
        certificateNumber: 'PC-2026-0001',
      },
      missingFieldKeys: [],
      lowConfidenceFieldKeys: [],
      fieldCompleteness: {
        supported: true,
        documentMatrixVersion: 1,
        expectedFieldKeys: ['certificateNumber'],
        presentFieldKeys: ['certificateNumber'],
        missingFieldKeys: [],
        lowConfidenceFieldKeys: [],
        unsupportedFieldKeys: [],
      },
    });
    documentClassifier = {
      analyze: analyzeDocumentMock,
    };
    service = new EvidenceService(
      store,
      objectStore,
      hashingService,
      auditService as never,
      photoMetadataExtractor as never,
      documentAnalysisProvider,
      documentClassifier,
      rulesEngineService as never,
      laneReconciler as never,
      realtimeEvents as never,
      coldChainService as never,
    );
    tempDirectory = mkdtempSync(join(tmpdir(), 'zrl-evidence-'));
    uploadFilePath = join(tempDirectory, 'phyto.pdf');
    writeFileSync(uploadFilePath, 'phyto-certificate');
    findArtifactGraphForLaneMock.mockResolvedValue({
      nodes: [],
      edges: [],
    });
    listArtifactsForIntegrityCheckMock.mockResolvedValue([]);
    findArtifactByIdMock.mockImplementation((id: string) =>
      Promise.resolve(buildArtifact({ id })),
    );
    updateArtifactVerificationStatusMock.mockImplementation(
      (id: string, status: 'PENDING' | 'VERIFIED' | 'FAILED') =>
        Promise.resolve(buildArtifact({ id, verificationStatus: status })),
    );
    createReadStreamMock.mockResolvedValue('artifact-stream');
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  it('uploadArtifact hashes content, stores the object, and appends audit', async () => {
    const createdArtifact = buildArtifact();
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: {
        market: 'JAPAN',
        product: 'MANGO',
      },
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);

    const result = await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.UPLOAD,
        checkpointId: null,
        metadata: null,
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(putObjectFromFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'evidence/LN-2026-001/PHYTO_CERT/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf',
        filePath: uploadFilePath,
        contentType: 'application/pdf',
      }),
    );
    expect(createArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: 'lane-db-1',
        fileName: 'phyto.pdf',
        source: ArtifactSource.UPLOAD,
      }),
    );
    expect(auditService.createEntryWithStore).toHaveBeenCalledWith(
      auditStore,
      expect.objectContaining({
        actor: 'exporter-1',
        action: AuditAction.UPLOAD,
        entityType: AuditEntityType.ARTIFACT,
        entityId: 'artifact-1',
      }),
    );
    expect(result.artifact).toMatchObject({
      id: createdArtifact.id,
      laneId: createdArtifact.laneId,
      artifactType: createdArtifact.artifactType,
      fileName: createdArtifact.fileName,
      mimeType: createdArtifact.mimeType,
      fileSizeBytes: createdArtifact.fileSizeBytes,
      storagePath: createdArtifact.filePath,
      contentHash: createdArtifact.contentHash,
      contentHashPreview: createdArtifact.contentHash.slice(0, 8),
      source: createdArtifact.source,
      checkpointId: createdArtifact.checkpointId,
      verificationStatus: createdArtifact.verificationStatus,
      metadata: createdArtifact.metadata,
      latestAnalysis: null,
      createdAt: createdArtifact.uploadedAt.toISOString(),
      updatedAt: createdArtifact.updatedAt.toISOString(),
    });
    expect(createArtifactAnalysisMock).toHaveBeenCalledTimes(1);
    const createArtifactAnalysisCalls = createArtifactAnalysisMock.mock
      .calls as Array<
      [
        {
          artifactId: string;
          laneId: string;
          analyzerVersion: string;
          analysisStatus: string;
          documentLabel: string | null;
          extractedFields: Record<string, unknown> | null;
          fieldCompleteness: {
            supported: boolean;
            presentFieldKeys: string[];
          } | null;
        },
      ]
    >;
    const createArtifactAnalysisCall = createArtifactAnalysisCalls[0]?.[0] as {
      artifactId: string;
      laneId: string;
      analyzerVersion: string;
      analysisStatus: string;
      documentLabel: string | null;
      extractedFields: Record<string, unknown> | null;
      fieldCompleteness: {
        supported: boolean;
        presentFieldKeys: string[];
      } | null;
    };
    expect(createArtifactAnalysisCall.artifactId).toBe('artifact-1');
    expect(createArtifactAnalysisCall.laneId).toBe('lane-db-1');
    expect(createArtifactAnalysisCall.analyzerVersion).toBe('tesseract');
    expect(createArtifactAnalysisCall.analysisStatus).toBe('COMPLETED');
    expect(createArtifactAnalysisCall.documentLabel).toBe(
      'Phytosanitary Certificate',
    );
    expect(createArtifactAnalysisCall.extractedFields).toEqual({
      certificateNumber: 'PC-2026-0001',
    });
    expect(createArtifactAnalysisCall.fieldCompleteness).toMatchObject({
      supported: true,
      presentFieldKeys: ['certificateNumber'],
    });
    expect(realtimeEvents.publishEvidenceUploaded).toHaveBeenCalledWith({
      laneId: 'lane-db-1',
      artifactId: 'artifact-1',
      type: 'PHYTO_CERT',
      completeness: 0,
    });
  });

  it('createPartnerTemperatureArtifact persists the artifact and ingests normalized readings into cold-chain', async () => {
    const createdArtifact = buildArtifact({
      id: 'artifact-temp-1',
      artifactType: 'TEMP_DATA',
      fileName: 'temperature-data.json',
      mimeType: 'application/json',
      source: ArtifactSource.PARTNER_API,
      metadata: {
        readings: [
          {
            timestamp: '2026-04-02T12:00:00.000Z',
            temperatureC: 11.4,
            deviceId: 'sensor-1',
          },
          {
            timestamp: '2026-04-02T12:05:00.000Z',
            temperatureC: 11.6,
            deviceId: 'sensor-1',
          },
        ],
      },
    });
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: null,
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);

    const result = await service.createPartnerTemperatureArtifact(
      {
        laneId: 'lane-db-1',
        issuer: 'Thai Airways Cargo',
        issuedAt: '2026-04-02T12:00:00.000Z',
        payload: {
          provider: 'thai-airways',
          shipmentId: 'TG-100',
          readings: [
            {
              timestamp: '2026-04-02T12:00:00.000Z',
              temperatureC: 11.4,
              deviceId: 'sensor-1',
            },
            {
              timestamp: '2026-04-02T12:05:00.000Z',
              temperatureC: 11.6,
              deviceId: 'sensor-1',
            },
          ],
        },
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(coldChainService.ingestLaneReadings).toHaveBeenCalledWith(
      'lane-db-1',
      {
        readings: [
          {
            timestamp: new Date('2026-04-02T12:00:00.000Z'),
            temperatureC: 11.4,
            deviceId: 'sensor-1',
          },
          {
            timestamp: new Date('2026-04-02T12:05:00.000Z'),
            temperatureC: 11.6,
            deviceId: 'sensor-1',
          },
        ],
      },
    );
    expect(result.artifact.artifactType).toBe('TEMP_DATA');
    expect(result.ingestion?.count).toBe(2);
  });

  it('createPartnerCertificationArtifact persists GAP certificate metadata', async () => {
    const createdArtifact = buildArtifact({
      id: 'artifact-gap-1',
      artifactType: 'GAP_CERT',
      fileName: 'gap-certificate.json',
      mimeType: 'application/json',
      source: ArtifactSource.PARTNER_API,
      metadata: {
        certificateNumber: 'GAP-100',
        valid: true,
        holderName: 'Exporter Co',
      },
    });
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: null,
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);

    const result = await service.createPartnerCertificationArtifact(
      {
        laneId: 'lane-db-1',
        issuer: 'ACFS Thailand',
        issuedAt: '2026-04-02T12:00:00.000Z',
        payload: {
          provider: 'acfs',
          certificateNumber: 'GAP-100',
          valid: true,
          holderName: 'Exporter Co',
          scope: ['Mango'],
        },
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    const [createArtifactInput] = createArtifactMock.mock.calls[0] as [
      {
        artifactType: string;
        source: string;
        metadata: Record<string, unknown> | null;
      },
    ];
    expect(createArtifactInput.artifactType).toBe('GAP_CERT');
    expect(createArtifactInput.source).toBe(ArtifactSource.PARTNER_API);
    expect(createArtifactInput.metadata).toMatchObject({
      certificateNumber: 'GAP-100',
      valid: true,
      holderName: 'Exporter Co',
    });
    expect(result.artifact.artifactType).toBe('GAP_CERT');
  });

  it('uploadArtifact auto-links a checkpoint artifact to prior lane and checkpoint parents', async () => {
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
    });
    findLatestArtifactForLaneMock.mockResolvedValue(
      buildArtifact({ id: 'artifact-lane-parent', checkpointId: null }),
    );
    findLatestArtifactForCheckpointMock.mockResolvedValue(
      buildArtifact({
        id: 'artifact-checkpoint-parent',
        checkpointId: 'checkpoint-1',
      }),
    );
    findArtifactByIdMock.mockImplementation((id: string) => {
      if (id === 'artifact-lane-parent') {
        return buildArtifact({
          id: 'artifact-lane-parent',
          checkpointId: null,
        });
      }

      if (id === 'artifact-checkpoint-parent') {
        return buildArtifact({
          id: 'artifact-checkpoint-parent',
          checkpointId: 'checkpoint-1',
        });
      }

      return null;
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(
      buildArtifact({
        id: 'artifact-new',
        checkpointId: 'checkpoint-1',
        contentHash:
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        filePath:
          'evidence/LN-2026-001/CHECKPOINT_PHOTO/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.jpg',
        fileName: 'checkpoint.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 4096,
        artifactType: 'CHECKPOINT_PHOTO',
      }),
    );
    photoMetadataExtractor.extract.mockResolvedValue({
      cameraModel: 'iPhone 15 Pro',
      exifTimestamp: '2026-03-22T11:02:03.000Z',
      capturedAt: '2026-03-22T11:02:03.000Z',
      gpsLat: 13.6904,
      gpsLng: 101.0779,
    });

    await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'CHECKPOINT_PHOTO',
        fileName: 'checkpoint.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 4096,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.CAMERA,
        checkpointId: 'checkpoint-1',
        metadata: null,
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(createArtifactLinksMock).toHaveBeenCalledWith(
      'artifact-new',
      expect.arrayContaining([
        {
          targetArtifactId: 'artifact-lane-parent',
          relationshipType: 'LANE_PREDECESSOR',
        },
        {
          targetArtifactId: 'artifact-checkpoint-parent',
          relationshipType: 'CHECKPOINT_PREDECESSOR',
        },
      ]),
    );
  });

  it('uploadArtifact rejects links that would introduce a graph cycle', async () => {
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
    });
    findLatestArtifactForLaneMock.mockResolvedValue(null);
    findLatestArtifactForCheckpointMock.mockResolvedValue(null);
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    createArtifactMock.mockResolvedValue(buildArtifact({ id: 'artifact-new' }));
    findArtifactByIdMock.mockResolvedValue(
      buildArtifact({ id: 'artifact-parent', laneId: 'lane-db-1' }),
    );
    linkCreatesCycleMock.mockResolvedValue(true);

    await expect(
      service.uploadArtifact(
        {
          laneId: 'lane-db-1',
          artifactType: 'PHYTO_CERT',
          fileName: 'phyto.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 2048,
          tempFilePath: uploadFilePath,
          source: ArtifactSource.UPLOAD,
          checkpointId: null,
          metadata: null,
          links: [
            {
              targetArtifactId: 'artifact-parent',
              relationshipType: 'SUPPORTS',
            },
          ],
        },
        {
          id: 'exporter-1',
          email: 'exporter@example.com',
          role: 'EXPORTER',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createArtifactLinksMock).not.toHaveBeenCalled();
  });

  it('uploadArtifact rejects links to artifacts outside the lane', async () => {
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
    });
    findLatestArtifactForLaneMock.mockResolvedValue(null);
    findLatestArtifactForCheckpointMock.mockResolvedValue(null);
    findArtifactByIdMock.mockResolvedValue(
      buildArtifact({
        id: 'artifact-other-lane',
        laneId: 'lane-db-2',
        lanePublicId: 'LN-2026-002',
      }),
    );
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    createArtifactMock.mockResolvedValue(buildArtifact({ id: 'artifact-new' }));

    await expect(
      service.uploadArtifact(
        {
          laneId: 'lane-db-1',
          artifactType: 'PHYTO_CERT',
          fileName: 'phyto.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 2048,
          tempFilePath: uploadFilePath,
          source: ArtifactSource.UPLOAD,
          checkpointId: null,
          metadata: null,
          links: [
            {
              targetArtifactId: 'artifact-other-lane',
              relationshipType: 'SUPPORTS',
            },
          ],
        },
        {
          id: 'exporter-1',
          email: 'exporter@example.com',
          role: 'EXPORTER',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createArtifactLinksMock).not.toHaveBeenCalled();
  });

  it('uploadArtifact rejects uploads for unknown lanes', async () => {
    findLaneByIdMock.mockResolvedValue(null);

    await expect(
      service.uploadArtifact(
        {
          laneId: 'missing-lane',
          artifactType: 'PHYTO_CERT',
          fileName: 'phyto.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 2048,
          tempFilePath: uploadFilePath,
          source: ArtifactSource.UPLOAD,
          checkpointId: null,
          metadata: null,
          links: [],
        },
        {
          id: 'exporter-1',
          email: 'exporter@example.com',
          role: 'EXPORTER',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(realtimeEvents.publishEvidenceUploaded).not.toHaveBeenCalled();
  });

  it('uploadArtifact recalculates lane completeness after evidence persistence', async () => {
    const createdArtifact = buildArtifact({ artifactType: 'MRL_TEST' });
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: {
        market: 'JAPAN',
        product: 'MANGO',
        version: 1,
        effectiveDate: new Date('2026-03-01T00:00:00.000Z'),
        sourcePath: '/rules/japan/mango.yaml',
        requiredDocuments: ['MRL Test Results'],
        completenessWeights: {
          regulatory: 0.4,
          quality: 0.25,
          coldChain: 0.2,
          chainOfCustody: 0.15,
        },
        substances: [],
      },
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);
    listArtifactsForEvaluationMock.mockResolvedValue([
      {
        id: 'artifact-1',
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
        metadata: {
          results: [{ substance: 'Chlorpyrifos', valueMgKg: 0.01 }],
        },
      },
    ]);
    rulesEngineService.evaluateLane.mockReturnValue({
      score: 40,
      required: 1,
      present: 1,
      missing: [],
      checklist: [],
      categories: [],
      labValidation: {
        valid: true,
        hasUnknowns: false,
        results: [],
      },
      certificationAlerts: [],
    });

    await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
        mimeType: 'application/json',
        fileSizeBytes: 2048,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.PARTNER_API,
        checkpointId: null,
        metadata: {
          results: [{ substance: 'Chlorpyrifos', valueMgKg: 0.01 }],
        },
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(listArtifactsForEvaluationMock).toHaveBeenCalledWith('lane-db-1');
    expect(rulesEngineService.evaluateLane).toHaveBeenCalledWith(
      expect.objectContaining({
        market: 'JAPAN',
        product: 'MANGO',
      }),
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'MRL_TEST',
        }),
      ]),
    );
    expect(updateLaneCompletenessScoreMock).toHaveBeenCalledWith(
      'lane-db-1',
      40,
    );
    expect(realtimeEvents.publishEvidenceUploaded).toHaveBeenCalledWith({
      laneId: 'lane-db-1',
      artifactId: 'artifact-1',
      type: 'MRL_TEST',
      completeness: 40,
    });
    expect(laneReconciler.reconcileAfterEvidenceChange).toHaveBeenCalledWith(
      'lane-db-1',
      'exporter-1',
    );
  });

  it('uploadArtifact normalizes structured mrl test rows to canonical valueMgKg metadata', async () => {
    const createdArtifact = buildArtifact({ artifactType: 'MRL_TEST' });
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: null,
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);

    await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
        mimeType: 'application/json',
        fileSizeBytes: 2048,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.UPLOAD,
        checkpointId: null,
        metadata: {
          results: [
            {
              substance: 'Acetamiprid',
              value: 0.2,
              unit: 'ppm',
              reportingLimit: 0.01,
            },
          ],
        },
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(createArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          results: [
            expect.objectContaining({
              substance: 'Acetamiprid',
              valueMgKg: 0.2,
              originalValue: 0.2,
              originalUnit: 'ppm',
              reportingLimitMgKg: 0.01,
            }),
          ],
        },
      }),
    );
  });

  it('uploadArtifact rejects mrl test rows with unsupported units', async () => {
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: null,
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    await expect(
      service.uploadArtifact(
        {
          laneId: 'lane-db-1',
          artifactType: 'MRL_TEST',
          fileName: 'lab-results.json',
          mimeType: 'application/json',
          fileSizeBytes: 2048,
          tempFilePath: uploadFilePath,
          source: ArtifactSource.UPLOAD,
          checkpointId: null,
          metadata: {
            results: [
              {
                substance: 'Acetamiprid',
                value: 200,
                unit: 'ppb',
              },
            ],
          },
          links: [],
        },
        {
          id: 'exporter-1',
          email: 'exporter@example.com',
          role: 'EXPORTER',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createArtifactMock).not.toHaveBeenCalled();
  });

  it('uploadArtifact does not trigger automatic lane transitions when no rule snapshot exists', async () => {
    const createdArtifact = buildArtifact();
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: null,
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);

    await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.UPLOAD,
        checkpointId: null,
        metadata: null,
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(updateLaneCompletenessScoreMock).not.toHaveBeenCalled();
    expect(laneReconciler.reconcileAfterEvidenceChange).not.toHaveBeenCalled();
  });

  it('uploadArtifact notifies on expired certification artifacts after persistence', async () => {
    const createdArtifact = buildArtifact({
      id: 'artifact-expired',
      artifactType: 'PHYTO_CERT',
      metadata: {
        expiresAt: '2026-03-01T00:00:00.000Z',
      },
    });
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: null,
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);

    await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.UPLOAD,
        checkpointId: null,
        metadata: {
          expiresAt: '2026-03-01T00:00:00.000Z',
        },
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    const certificationAlertCalls = rulesEngineService
      .notifyCertificationAlertForArtifact.mock.calls as Array<
      [
        {
          laneId: string;
          lanePublicId: string;
          artifact: {
            id: string;
            artifactType: string;
            metadata: Record<string, unknown> | null;
          };
        },
      ]
    >;
    const certificationAlertInput = certificationAlertCalls[0]?.[0] ?? null;
    expect(certificationAlertInput).toMatchObject({
      laneId: 'lane-db-1',
      lanePublicId: 'LN-2026-001',
      artifact: {
        id: 'artifact-expired',
        artifactType: 'PHYTO_CERT',
        metadata: {
          expiresAt: '2026-03-01T00:00:00.000Z',
        },
      },
    });
  });

  it('uploadArtifact does not notify on non-certification artifacts', async () => {
    const createdArtifact = buildArtifact({
      id: 'artifact-temp',
      artifactType: 'TEMP_DATA',
      fileName: 'temperature.json',
      mimeType: 'application/json',
      metadata: {
        recordedAt: '2026-03-22T10:00:00.000Z',
      },
    });
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: null,
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);

    await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'TEMP_DATA',
        fileName: 'temperature.json',
        mimeType: 'application/json',
        fileSizeBytes: 512,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.PARTNER_API,
        checkpointId: null,
        metadata: {
          recordedAt: '2026-03-22T10:00:00.000Z',
        },
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(
      rulesEngineService.notifyCertificationAlertForArtifact,
    ).not.toHaveBeenCalled();
  });

  it('uploadArtifact preserves the committed artifact when automatic lane reconciliation fails', async () => {
    const createdArtifact = buildArtifact();
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: {
        version: '2026-03-22',
        market: 'JAPAN',
        product: 'MANGO',
        requiredDocuments: [],
        completenessWeights: {
          regulatory: 0.4,
          quality: 0.25,
          coldChain: 0.2,
          chainOfCustody: 0.15,
        },
      },
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    createArtifactMock.mockResolvedValue(createdArtifact);
    listArtifactsForEvaluationMock.mockResolvedValue([]);
    rulesEngineService.evaluateLane.mockReturnValue({
      score: 100,
      required: 1,
      present: 1,
      missing: [],
      checklist: [],
      categories: [],
      labValidation: null,
      certificationAlerts: [],
    });
    laneReconciler.reconcileAfterEvidenceChange = jest
      .fn()
      .mockRejectedValue(new Error('transition store unavailable'));
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const result = await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.UPLOAD,
        checkpointId: null,
        metadata: null,
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(result.artifact.id).toBe(createdArtifact.id);
    expect(deleteObjectMock).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalled();
    loggerErrorSpy.mockRestore();
  });

  it('listLaneArtifacts applies filters through the store', async () => {
    const filters: EvidenceListFilters = {
      type: 'PHYTO_CERT',
      status: 'VERIFIED',
      page: 2,
      limit: 5,
    };
    listArtifactsForLaneMock.mockResolvedValue({
      items: [buildArtifact({ verificationStatus: 'VERIFIED' })],
      total: 1,
    });

    const result = await service.listLaneArtifacts('lane-db-1', filters);

    expect(listArtifactsForLaneMock).toHaveBeenCalledWith('lane-db-1', filters);
    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        storagePath:
          'evidence/LN-2026-001/PHYTO_CERT/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf',
        contentHashPreview: 'aaaaaaaa',
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1,
    });
  });

  it('listLaneArtifacts returns the latest derived analysis when present', async () => {
    listArtifactsForLaneMock.mockResolvedValue({
      items: [
        buildArtifact({
          latestAnalysis: {
            id: 'analysis-1',
            artifactId: 'artifact-1',
            analyzerVersion: 'ocr-local-v1',
            analysisStatus: 'COMPLETED',
            documentLabel: 'Phytosanitary Certificate',
            documentRole: 'THAILAND_NPPO_EXPORT_CERTIFICATE',
            confidence: 'HIGH',
            summaryText: 'Detected phytosanitary certificate fields.',
            extractedFields: {
              certificateNumber: 'PC-2026-0001',
            },
            missingFieldKeys: [],
            lowConfidenceFieldKeys: [],
            fieldCompleteness: {
              supported: true,
              documentMatrixVersion: 1,
              expectedFieldKeys: ['certificateNumber'],
              presentFieldKeys: ['certificateNumber'],
              missingFieldKeys: [],
              lowConfidenceFieldKeys: [],
              unsupportedFieldKeys: [],
            },
            completedAt: new Date('2026-04-07T06:40:00.000Z'),
            createdAt: new Date('2026-04-07T06:39:00.000Z'),
            updatedAt: new Date('2026-04-07T06:40:00.000Z'),
          },
        }),
      ],
      total: 1,
    });

    const result = await service.listLaneArtifacts('lane-db-1');
    const latestAnalysis = result.artifacts[0]?.latestAnalysis;

    expect(latestAnalysis?.id).toBe('analysis-1');
    expect(latestAnalysis?.artifactId).toBe('artifact-1');
    expect(latestAnalysis?.analyzerVersion).toBe('ocr-local-v1');
    expect(latestAnalysis?.analysisStatus).toBe('COMPLETED');
    expect(latestAnalysis?.confidence).toBe('HIGH');
    expect(latestAnalysis?.extractedFields).toEqual({
      certificateNumber: 'PC-2026-0001',
    });
    expect(latestAnalysis?.fieldCompleteness).toMatchObject({
      supported: true,
      presentFieldKeys: ['certificateNumber'],
    });
  });

  it('verifyArtifact re-hashes the stored object and marks the artifact verified', async () => {
    const artifact = buildArtifact();
    findArtifactByIdMock.mockResolvedValue(artifact);
    createReadStreamMock.mockResolvedValue('artifact-stream');
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      artifact.contentHash,
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    );
    updateArtifactVerificationStatusMock.mockResolvedValue(
      buildArtifact({ verificationStatus: 'VERIFIED' }),
    );

    const result = await service.verifyArtifact('artifact-1', {
      id: 'exporter-1',
      email: 'exporter@example.com',
      role: 'EXPORTER',
      companyName: 'Exporter Co',
      mfaEnabled: false,
      sessionVersion: 0,
    });

    expect(createReadStreamMock).toHaveBeenCalledWith(artifact.filePath);
    expect(updateArtifactVerificationStatusMock).toHaveBeenCalledWith(
      'artifact-1',
      'VERIFIED',
    );
    expect(result).toEqual({
      artifactId: 'artifact-1',
      valid: true,
      storedHash: artifact.contentHash,
      computedHash: artifact.contentHash,
    });
  });

  it('verifyArtifact marks the artifact failed when the stored object cannot be read', async () => {
    const artifact = buildArtifact();
    findArtifactByIdMock.mockResolvedValue(artifact);
    createReadStreamMock.mockRejectedValue(new Error('missing object'));
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    );
    updateArtifactVerificationStatusMock.mockResolvedValue(
      buildArtifact({ verificationStatus: 'FAILED' }),
    );

    const result = await service.verifyArtifact('artifact-1', {
      id: 'exporter-1',
      email: 'exporter@example.com',
      role: 'EXPORTER',
      companyName: 'Exporter Co',
      mfaEnabled: false,
      sessionVersion: 0,
    });

    expect(updateArtifactVerificationStatusMock).toHaveBeenCalledWith(
      'artifact-1',
      'FAILED',
    );
    expect(result).toEqual({
      artifactId: 'artifact-1',
      valid: false,
      storedHash: artifact.contentHash,
      computedHash: null,
    });
  });

  it('reanalyzes one artifact on demand and stores a fresh derived analysis row', async () => {
    findArtifactByIdMock.mockResolvedValue(
      buildArtifact({
        artifactType: 'PHYTO_CERT',
        metadata: { issuer: 'Department of Agriculture' },
      }),
    );
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
      completenessScore: 0,
      ruleSnapshot: {
        market: 'JAPAN',
        product: 'MANGO',
      },
    });
    createReadStreamMock.mockResolvedValue('artifact-stream');

    await service.reanalyzeArtifact('artifact-1', {
      id: 'exporter-1',
      email: 'exporter@example.com',
      role: 'EXPORTER',
      companyName: 'Exporter Co',
      mfaEnabled: false,
      sessionVersion: 0,
    });

    expect(extractTextMock).toHaveBeenCalledTimes(1);
    expect(analyzeDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactType: 'PHYTO_CERT',
        market: 'JAPAN',
        product: 'MANGO',
      }),
    );
    expect(createArtifactAnalysisMock).toHaveBeenCalledTimes(1);
    const reanalysisCalls = createArtifactAnalysisMock.mock.calls as Array<
      [
        {
          artifactId: string;
          analysisStatus: string;
          fieldCompleteness: {
            supported: boolean;
            presentFieldKeys: string[];
          } | null;
        },
      ]
    >;
    const reanalysisCall = reanalysisCalls[0]?.[0] as {
      artifactId: string;
      analysisStatus: string;
      fieldCompleteness: {
        supported: boolean;
        presentFieldKeys: string[];
      } | null;
    };
    expect(reanalysisCall.artifactId).toBe('artifact-1');
    expect(reanalysisCall.analysisStatus).toBe('COMPLETED');
    expect(reanalysisCall.fieldCompleteness).toMatchObject({
      supported: true,
      presentFieldKeys: ['certificateNumber'],
    });
  });

  it('getArtifact rejects exporters who do not own the lane', async () => {
    findArtifactByIdMock.mockResolvedValue(
      buildArtifact({ exporterId: 'other-exporter' }),
    );

    await expect(
      service.getArtifact('artifact-1', {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getLaneGraph returns graph nodes and edges for a lane', async () => {
    const graph: EvidenceArtifactGraph = {
      nodes: [
        {
          id: 'node-1',
          artifactId: 'artifact-1',
          artifactType: 'PHYTO_CERT',
          label: 'Phyto Certificate',
          status: 'PENDING',
          hashPreview: 'aaaaaaaa',
        },
      ],
      edges: [
        {
          id: 'edge-1',
          sourceArtifactId: 'artifact-1',
          targetArtifactId: 'artifact-2',
          relationshipType: 'SUPPORTS',
        },
      ],
    };
    findArtifactGraphForLaneMock.mockResolvedValue(graph);

    await expect(service.getLaneGraph('lane-db-1')).resolves.toEqual(graph);
    expect(findArtifactGraphForLaneMock).toHaveBeenCalledWith('lane-db-1');
  });

  it('verifyLaneGraph flags invalid nodes and appends a lane audit entry', async () => {
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
    });
    findArtifactGraphForLaneMock.mockResolvedValue({
      nodes: [
        {
          id: 'artifact-1',
          artifactId: 'artifact-1',
          artifactType: 'PHYTO_CERT',
          label: 'Phyto Certificate',
          status: 'PENDING',
          hashPreview: 'aaaaaaaa',
        },
        {
          id: 'artifact-2',
          artifactId: 'artifact-2',
          artifactType: 'MRL_TEST',
          label: 'MRL Test',
          status: 'PENDING',
          hashPreview: 'bbbbbbbb',
        },
      ],
      edges: [],
    });
    listArtifactsForIntegrityCheckMock.mockResolvedValue([
      buildArtifact({ id: 'artifact-1', filePath: 'object-1' }),
      buildArtifact({
        id: 'artifact-2',
        filePath: 'object-2',
        contentHash:
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    ]);
    createReadStreamMock
      .mockResolvedValueOnce('object-stream-1')
      .mockResolvedValueOnce('object-stream-2');
    (hashingService.hashFile as jest.Mock)
      .mockResolvedValueOnce(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      )
      .mockResolvedValueOnce(
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      );
    updateArtifactVerificationStatusMock
      .mockResolvedValueOnce(
        buildArtifact({ id: 'artifact-1', verificationStatus: 'VERIFIED' }),
      )
      .mockResolvedValueOnce(
        buildArtifact({
          id: 'artifact-2',
          verificationStatus: 'FAILED',
          contentHash:
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        }),
      );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    );

    const result = await service.verifyLaneGraph('lane-db-1', {
      id: 'exporter-1',
      email: 'exporter@example.com',
      role: 'EXPORTER',
      companyName: 'Exporter Co',
      mfaEnabled: false,
      sessionVersion: 0,
    });

    expect(result).toEqual<EvidenceGraphVerificationResult>({
      valid: false,
      invalidNodeIds: ['artifact-2'],
      checkedCount: 2,
    });
    expect(updateArtifactVerificationStatusMock).toHaveBeenNthCalledWith(
      1,
      'artifact-1',
      'VERIFIED',
    );
    expect(updateArtifactVerificationStatusMock).toHaveBeenNthCalledWith(
      2,
      'artifact-2',
      'FAILED',
    );
    expect(auditService.createEntryWithStore).toHaveBeenCalledWith(
      auditStore,
      expect.objectContaining({
        actor: 'exporter-1',
        action: AuditAction.VERIFY,
        entityType: AuditEntityType.LANE,
        entityId: 'lane-db-1',
      }),
    );
  });

  it('verifyLaneGraph fails when the persisted graph contains a cycle', async () => {
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
    });
    listArtifactsForIntegrityCheckMock.mockResolvedValue([
      buildArtifact({ id: 'artifact-1', filePath: 'object-1' }),
      buildArtifact({ id: 'artifact-2', filePath: 'object-2' }),
    ]);
    findArtifactGraphForLaneMock.mockResolvedValue({
      nodes: [
        {
          id: 'artifact-1',
          artifactId: 'artifact-1',
          artifactType: 'PHYTO_CERT',
          label: 'Phyto Certificate',
          status: 'PENDING',
          hashPreview: 'aaaaaaaa',
        },
        {
          id: 'artifact-2',
          artifactId: 'artifact-2',
          artifactType: 'MRL_TEST',
          label: 'MRL Test',
          status: 'PENDING',
          hashPreview: 'bbbbbbbb',
        },
      ],
      edges: [
        {
          id: 'edge-1',
          sourceArtifactId: 'artifact-1',
          targetArtifactId: 'artifact-2',
          relationshipType: 'SUPPORTS',
        },
        {
          id: 'edge-2',
          sourceArtifactId: 'artifact-2',
          targetArtifactId: 'artifact-1',
          relationshipType: 'SUPPORTS',
        },
      ],
    });
    createReadStreamMock
      .mockResolvedValueOnce('object-stream-1')
      .mockResolvedValueOnce('object-stream-2');
    (hashingService.hashFile as jest.Mock)
      .mockResolvedValueOnce(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      )
      .mockResolvedValueOnce(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
    updateArtifactVerificationStatusMock
      .mockResolvedValueOnce(
        buildArtifact({ id: 'artifact-1', verificationStatus: 'FAILED' }),
      )
      .mockResolvedValueOnce(
        buildArtifact({ id: 'artifact-2', verificationStatus: 'FAILED' }),
      );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    );

    const result = await service.verifyLaneGraph('lane-db-1', {
      id: 'exporter-1',
      email: 'exporter@example.com',
      role: 'EXPORTER',
      companyName: 'Exporter Co',
      mfaEnabled: false,
      sessionVersion: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.checkedCount).toBe(2);
    expect(result.invalidNodeIds).toEqual(
      expect.arrayContaining(['artifact-1', 'artifact-2']),
    );
    expect(updateArtifactVerificationStatusMock).toHaveBeenNthCalledWith(
      1,
      'artifact-1',
      'FAILED',
    );
    expect(updateArtifactVerificationStatusMock).toHaveBeenNthCalledWith(
      2,
      'artifact-2',
      'FAILED',
    );
  });

  it('uploadArtifact enriches checkpoint photos with extracted EXIF metadata', async () => {
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    photoMetadataExtractor.extract.mockResolvedValue({
      cameraModel: 'iPhone 15 Pro',
      exifTimestamp: '2026-03-22T11:02:03.000Z',
      capturedAt: '2026-03-22T11:02:03.000Z',
      gpsLat: 13.6904,
      gpsLng: 101.0779,
    });
    createArtifactMock.mockResolvedValue(
      buildArtifact({
        artifactType: 'CHECKPOINT_PHOTO',
        fileName: 'checkpoint.jpg',
        mimeType: 'image/jpeg',
        metadata: {
          cameraModel: 'iPhone 15 Pro',
          exifTimestamp: '2026-03-22T11:02:03.000Z',
          capturedAt: '2026-03-22T11:02:03.000Z',
          gpsLat: 13.6904,
          gpsLng: 101.0779,
        },
      }),
    );

    await service.uploadArtifact(
      {
        laneId: 'lane-db-1',
        artifactType: 'CHECKPOINT_PHOTO',
        fileName: 'checkpoint.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 4096,
        tempFilePath: uploadFilePath,
        source: ArtifactSource.CAMERA,
        checkpointId: 'checkpoint-1',
        metadata: { note: 'handoff' },
        links: [],
      },
      {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
    );

    expect(photoMetadataExtractor.extract).toHaveBeenCalledWith(uploadFilePath);
    expect(createArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          note: 'handoff',
          cameraModel: 'iPhone 15 Pro',
          exifTimestamp: '2026-03-22T11:02:03.000Z',
          capturedAt: '2026-03-22T11:02:03.000Z',
          gpsLat: 13.6904,
          gpsLng: 101.0779,
        },
      }),
    );
  });

  it('uploadArtifact rejects checkpoint photos without verifiable EXIF/GPS metadata', async () => {
    findLaneByIdMock.mockResolvedValue({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'exporter-1',
    });
    (hashingService.hashFile as jest.Mock).mockResolvedValue(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    photoMetadataExtractor.extract.mockResolvedValue(null);

    await expect(
      service.uploadArtifact(
        {
          laneId: 'lane-db-1',
          artifactType: 'CHECKPOINT_PHOTO',
          fileName: 'checkpoint.jpg',
          mimeType: 'image/jpeg',
          fileSizeBytes: 4096,
          tempFilePath: uploadFilePath,
          source: ArtifactSource.CAMERA,
          checkpointId: 'checkpoint-1',
          metadata: null,
          links: [],
        },
        {
          id: 'exporter-1',
          email: 'exporter@example.com',
          role: 'EXPORTER',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(putObjectFromFileMock).not.toHaveBeenCalled();
  });

  it('deleteArtifact soft-deletes the record and appends audit', async () => {
    const artifact = buildArtifact();
    findArtifactByIdMock.mockResolvedValue(artifact);
    softDeleteArtifactMock.mockResolvedValue(
      buildArtifact({
        updatedAt: new Date('2026-03-22T10:05:00.000Z'),
        deletedAt: new Date('2026-03-22T10:05:00.000Z'),
      }),
    );
    (hashingService.hashString as jest.Mock).mockResolvedValue(
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    );

    await expect(
      service.deleteArtifact('artifact-1', {
        id: 'exporter-1',
        email: 'exporter@example.com',
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      }),
    ).resolves.toEqual({ success: true });

    expect(softDeleteArtifactMock).toHaveBeenCalledWith('artifact-1');
    expect(auditService.createEntryWithStore).toHaveBeenCalledWith(
      auditStore,
      expect.objectContaining({
        actor: 'exporter-1',
        action: 'DELETE',
        entityType: AuditEntityType.ARTIFACT,
        entityId: 'artifact-1',
      }),
    );
  });
});

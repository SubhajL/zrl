import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import type { AuditStore } from '../../common/audit/audit.types';
import type { HashingService } from '../../common/hashing/hashing.service';
import { EvidenceService } from './evidence.service';
import {
  ArtifactSource,
  type EvidenceArtifactGraph,
  type EvidenceArtifactRecord,
  type EvidenceArtifactStore,
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
  let listArtifactsForLaneMock: jest.Mock;
  let findArtifactByIdMock: jest.Mock;
  let updateArtifactVerificationStatusMock: jest.Mock;
  let findArtifactGraphForLaneMock: jest.Mock;
  let softDeleteArtifactMock: jest.Mock;

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
    listArtifactsForLaneMock = jest.fn();
    findArtifactByIdMock = jest.fn();
    updateArtifactVerificationStatusMock = jest.fn();
    findArtifactGraphForLaneMock = jest.fn();
    softDeleteArtifactMock = jest.fn();
    const transactionalStore = {} as EvidenceArtifactStore;
    Object.assign(transactionalStore, {
      runInTransaction: jest.fn(
        async <T>(
          operation: (nestedStore: EvidenceArtifactStore) => Promise<T>,
        ) => await operation(transactionalStore),
      ),
      asAuditStore: jest.fn().mockReturnValue(auditStore),
      findLaneById: findLaneByIdMock,
      createArtifact: createArtifactMock,
      createArtifactLinks: createArtifactLinksMock,
      listArtifactsForLane: listArtifactsForLaneMock,
      findArtifactById: findArtifactByIdMock,
      updateArtifactVerificationStatus: updateArtifactVerificationStatusMock,
      findArtifactGraphForLane: findArtifactGraphForLaneMock,
      softDeleteArtifact: softDeleteArtifactMock,
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
    service = new EvidenceService(
      store,
      objectStore,
      hashingService,
      auditService as never,
      photoMetadataExtractor as never,
    );
    tempDirectory = mkdtempSync(join(tmpdir(), 'zrl-evidence-'));
    uploadFilePath = join(tempDirectory, 'phyto.pdf');
    writeFileSync(uploadFilePath, 'phyto-certificate');
  });

  it('uploadArtifact hashes content, stores the object, and appends audit', async () => {
    const createdArtifact = buildArtifact();
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
      createdAt: createdArtifact.uploadedAt.toISOString(),
      updatedAt: createdArtifact.updatedAt.toISOString(),
    });
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

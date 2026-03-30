import { BadRequestException } from '@nestjs/common';
import { ArtifactSource } from './evidence.types';
import type { EvidenceService } from './evidence.service';
import type { LaneService } from '../lane/lane.service';

// We will import CheckpointEvidenceController after we create it — but first, let's
// define the test expectations so we get a RED result.
import { CheckpointEvidenceController } from './checkpoint-evidence.controller';

function buildLaneServiceMock(): {
  getCheckpoints: jest.Mock;
  createCheckpoint: jest.Mock;
  updateCheckpoint: jest.Mock;
} {
  return {
    getCheckpoints: jest.fn(),
    createCheckpoint: jest.fn(),
    updateCheckpoint: jest.fn(),
  };
}

function buildEvidenceServiceMock(): {
  uploadArtifact: jest.Mock;
} {
  return {
    uploadArtifact: jest.fn(),
  };
}

describe('CheckpointEvidenceController', () => {
  let controller: CheckpointEvidenceController;
  let laneServiceMock: ReturnType<typeof buildLaneServiceMock>;
  let evidenceServiceMock: ReturnType<typeof buildEvidenceServiceMock>;

  beforeEach(() => {
    laneServiceMock = buildLaneServiceMock();
    evidenceServiceMock = buildEvidenceServiceMock();
    controller = new CheckpointEvidenceController(
      laneServiceMock as unknown as LaneService,
      evidenceServiceMock as unknown as EvidenceService,
    );
  });

  const actor = {
    id: 'user-1',
    email: 'exporter@example.com',
    role: 'EXPORTER' as const,
    companyName: 'Exporter Co',
    mfaEnabled: false,
    sessionVersion: 0,
  };

  const request = { user: actor } as { user: typeof actor };

  it('creates checkpoint and uploads photo + signature artifacts', async () => {
    laneServiceMock.getCheckpoints.mockResolvedValue([
      {
        id: 'cp-1',
        laneId: 'lane-db-1',
        sequence: 1,
        locationName: 'Packing House',
        gpsLat: null,
        gpsLng: null,
        timestamp: null,
        temperature: null,
        signatureHash: null,
        signerName: null,
        conditionNotes: null,
        status: 'PENDING',
      },
    ]);

    evidenceServiceMock.uploadArtifact
      .mockResolvedValueOnce({
        artifact: {
          id: 'artifact-photo-1',
          contentHash: 'aaa',
          metadata: {
            capturedAt: '2026-03-22T06:00:00.000Z',
            gpsLat: 13.69,
            gpsLng: 101.08,
          },
        },
      })
      .mockResolvedValueOnce({
        artifact: {
          id: 'artifact-sig-1',
          contentHash: 'bbb',
          metadata: null,
        },
      });

    laneServiceMock.updateCheckpoint.mockResolvedValue({
      id: 'cp-1',
      laneId: 'lane-db-1',
      sequence: 1,
      locationName: 'Packing House',
      gpsLat: 13.69,
      gpsLng: 101.08,
      timestamp: new Date('2026-03-22T06:00:00.000Z'),
      temperature: 12.5,
      signatureHash: 'bbb',
      signerName: 'Somchai',
      conditionNotes: 'Good condition',
      status: 'COMPLETED',
    });

    const files = {
      photo: [
        {
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          path: '/tmp/photo.jpg',
        },
      ],
      signature: [
        {
          originalname: 'sig.png',
          mimetype: 'image/png',
          size: 512,
          path: '/tmp/sig.png',
        },
      ],
    };

    const body = {
      sequence: 1,
      temperature: 12.5,
      signerName: 'Somchai',
      conditionNotes: 'Good condition',
    };

    const result = await controller.createCheckpoint(
      'lane-db-1',
      files,
      body,
      request,
    );

    expect(result.checkpoint.id).toBe('cp-1');
    expect(result.checkpoint.status).toBe('COMPLETED');
    expect(result.checkpoint.signatureHash).toBe('bbb');

    expect(evidenceServiceMock.uploadArtifact).toHaveBeenCalledTimes(2);
    expect(evidenceServiceMock.uploadArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: 'lane-db-1',
        artifactType: 'CHECKPOINT_PHOTO',
        source: ArtifactSource.CAMERA,
        checkpointId: 'cp-1',
      }),
      actor,
    );
    expect(evidenceServiceMock.uploadArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: 'lane-db-1',
        artifactType: 'HANDOFF_SIGNATURE',
        source: ArtifactSource.UPLOAD,
        checkpointId: 'cp-1',
      }),
      actor,
    );
  });

  it('returns 400 for missing photo', async () => {
    const files = {
      signature: [
        {
          originalname: 'sig.png',
          mimetype: 'image/png',
          size: 512,
          path: '/tmp/sig.png',
        },
      ],
    };

    const body = {
      sequence: 1,
      temperature: 12.5,
      signerName: 'Somchai',
    };

    await expect(
      controller.createCheckpoint('lane-db-1', files, body, request),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.createCheckpoint('lane-db-1', files, body, request),
    ).rejects.toThrow('Checkpoint photo upload is required.');
  });

  it('returns 400 for missing signature', async () => {
    const files = {
      photo: [
        {
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          path: '/tmp/photo.jpg',
        },
      ],
    };

    const body = {
      sequence: 1,
      temperature: 12.5,
      signerName: 'Somchai',
    };

    await expect(
      controller.createCheckpoint('lane-db-1', files, body, request),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.createCheckpoint('lane-db-1', files, body, request),
    ).rejects.toThrow('Checkpoint signature upload is required.');
  });
});

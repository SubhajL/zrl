import { DisputeTimelineService } from './dispute-timeline.service';

describe('DisputeTimelineService', () => {
  function createLaneServiceMock() {
    return {
      getTimeline: jest.fn().mockResolvedValue([
        {
          id: 'audit-1',
          timestamp: new Date('2026-03-29T08:00:00.000Z'),
          actor: 'user-1',
          action: 'UPDATE',
          entityType: 'LANE',
          entityId: 'lane-db-1',
          description: 'Lane updated',
          metadata: {
            kind: 'lane',
            status: 'VALIDATED',
            completenessScore: 100,
            productType: 'MANGO',
            destinationMarket: 'JAPAN',
            statusChangedAt: new Date('2026-03-29T08:00:00.000Z'),
          },
        },
        {
          id: 'audit-2',
          timestamp: new Date('2026-03-29T08:15:00.000Z'),
          actor: 'user-1',
          action: 'UPLOAD',
          entityType: 'ARTIFACT',
          entityId: 'artifact-1',
          description: 'Artifact uploaded',
          metadata: {
            kind: 'artifact',
            artifactType: 'CHECKPOINT_PHOTO',
            fileName: 'pickup-photo.jpg',
            metadata: {
              capturedAt: '2026-03-29T08:14:00.000Z',
              gpsLat: 13.7,
              gpsLng: 101.0,
              cameraModel: 'iPhone',
            },
          },
        },
      ]),
    };
  }

  function createColdChainServiceMock() {
    return {
      getLaneTemperatureSlaReport: jest.fn().mockResolvedValue({
        status: 'PASS',
        defensibilityScore: 97,
        shelfLifeImpactPercent: 0,
        remainingShelfLifeDays: 11,
        excursionCount: 0,
        totalExcursionMinutes: 0,
        maxDeviationC: 0,
        excursions: [],
        chartData: {
          readings: [
            {
              timestamp: new Date('2026-03-29T08:00:00.000Z'),
              temperatureC: 12,
            },
            {
              timestamp: new Date('2026-03-29T09:00:00.000Z'),
              temperatureC: 12.5,
            },
          ],
          optimalBand: { minC: 10, maxC: 13 },
          checkpoints: [
            {
              checkpointId: 'cp-1',
              laneId: 'lane-db-1',
              sequence: 1,
              locationName: 'Farm Pickup',
              label: 'CP1 Farm Pickup',
              timestamp: new Date('2026-03-29T08:00:00.000Z'),
              status: 'COMPLETED',
            },
          ],
          excursionZones: [],
        },
        meta: {
          resolution: '1h',
          from: null,
          to: null,
          totalReadings: 2,
        },
      }),
    };
  }

  it('reconstructs a mixed-source defense timeline with temperature and photo evidence', async () => {
    const laneService = createLaneServiceMock();
    const coldChainService = createColdChainServiceMock();
    const service = new DisputeTimelineService(
      laneService as never,
      coldChainService as never,
    );

    const evidence = await service.buildDefenseEvidence('lane-db-1');

    expect(evidence.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'LANE_STATUS',
          title: 'Lane status changed to VALIDATED',
        }),
        expect.objectContaining({
          category: 'TEMPERATURE',
          title: 'Temperature reading',
          temperatureC: 12,
        }),
      ]),
    );
    expect(evidence.visualEvidence).toEqual([
      expect.objectContaining({
        fileName: 'pickup-photo.jpg',
        exifStatus: 'VERIFIED',
        gps: '13.70000, 101.00000',
      }),
    ]);
    expect(evidence.temperatureForensics).toEqual(
      expect.objectContaining({
        slaStatus: 'PASS',
        readingCount: 2,
        chartPoints: [
          expect.objectContaining({
            temperatureC: 12,
          }),
          expect.objectContaining({
            temperatureC: 12.5,
          }),
        ],
      }),
    );
  });
});

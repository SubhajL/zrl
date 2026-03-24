import { loadLaneDetailPageData } from './lane-detail-data';

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('loadLaneDetailPageData', () => {
  const originalFetch = global.fetch;
  const originalApiBaseUrl = process.env.ZRL_API_BASE_URL;
  const originalAccessToken = process.env.ZRL_API_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.ZRL_API_BASE_URL = 'http://backend.test';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalApiBaseUrl === undefined) {
      delete process.env.ZRL_API_BASE_URL;
    } else {
      process.env.ZRL_API_BASE_URL = originalApiBaseUrl;
    }

    if (originalAccessToken === undefined) {
      delete process.env.ZRL_API_ACCESS_TOKEN;
      return;
    }

    process.env.ZRL_API_ACCESS_TOKEN = originalAccessToken;
  });

  it('fetches live lane detail data, forwards auth, and maps backend payloads', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      expect(headers.get('authorization')).toBe('Bearer access-token');

      if (url === 'http://backend.test/lanes/lane-db-1') {
        return jsonResponse({
          lane: {
            id: 'lane-db-1',
            laneId: 'LN-2026-001',
            exporterId: 'user-1',
            status: 'EVIDENCE_COLLECTING',
            productType: 'MANGO',
            destinationMarket: 'JAPAN',
            completenessScore: 12,
            coldChainMode: 'TELEMETRY',
            coldChainDeviceId: 'telemetry-7',
            coldChainDataFrequencySeconds: 60,
            statusChangedAt: '2026-03-22T05:00:00.000Z',
            createdAt: '2026-03-22T05:00:00.000Z',
            updatedAt: '2026-03-24T03:00:00.000Z',
            batch: {
              id: 'batch-1',
              laneId: 'lane-db-1',
              batchId: 'MNG-JPN-20260322-001',
              product: 'MANGO',
              variety: 'Nam Doc Mai',
              quantityKg: 5000,
              originProvince: 'Chachoengsao',
              harvestDate: '2026-03-20T00:00:00.000Z',
              grade: 'A',
            },
            route: {
              id: 'route-1',
              laneId: 'lane-db-1',
              transportMode: 'AIR',
              carrier: 'Thai Airways Cargo',
              originGps: { lat: 13.7563, lng: 100.5018 },
              destinationGps: { lat: 35.6762, lng: 139.6503 },
              estimatedTransitHours: 8,
            },
            checkpoints: [
              {
                id: 'cp-1',
                laneId: 'lane-db-1',
                sequence: 1,
                locationName: 'Packing House',
                gpsLat: 13.7563,
                gpsLng: 100.5018,
                timestamp: '2026-03-23T01:00:00.000Z',
                temperature: 11.2,
                signatureHash: null,
                signerName: 'Somchai',
                conditionNotes: 'Loaded to truck',
                status: 'COMPLETED',
              },
            ],
            ruleSnapshot: null,
          },
        });
      }

      if (url === 'http://backend.test/lanes/lane-db-1/completeness') {
        return jsonResponse({
          score: 73,
          required: 4,
          present: 3,
          missing: ['VHT Certificate'],
          checklist: [],
          categories: [],
          labValidation: null,
          certificationAlerts: [],
        });
      }

      if (url === 'http://backend.test/lanes/lane-db-1/evidence') {
        return jsonResponse({
          artifacts: [
            {
              id: 'artifact-1',
              laneId: 'lane-db-1',
              artifactType: 'PHYTO_CERT',
              fileName: 'phyto.pdf',
              mimeType: 'application/pdf',
              fileSizeBytes: 1200,
              contentHash: 'abcdef1234567890',
              contentHashPreview: 'abcdef12',
              storagePath: 's3://bucket/phyto.pdf',
              verificationStatus: 'VERIFIED',
              source: 'UPLOAD',
              checkpointId: null,
              metadata: null,
              createdAt: '2026-03-23T02:00:00.000Z',
              updatedAt: '2026-03-23T02:05:00.000Z',
            },
          ],
          meta: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        });
      }

      if (url === 'http://backend.test/lanes/lane-db-1/evidence/graph') {
        return jsonResponse({
          nodes: [
            {
              id: 'node-1',
              artifactId: 'artifact-1',
              artifactType: 'PHYTO_CERT',
              label: 'Phytosanitary Certificate',
              status: 'VERIFIED',
              hashPreview: 'abcdef12',
            },
          ],
          edges: [],
        });
      }

      if (url === 'http://backend.test/lanes/lane-db-1/temperature') {
        return jsonResponse({
          readings: [
            {
              id: 'reading-1',
              laneId: 'lane-db-1',
              timestamp: '2026-03-23T01:00:00.000Z',
              temperatureC: 11.2,
              deviceId: 'telemetry-7',
            },
          ],
          excursions: [
            {
              id: 'exc-1',
              laneId: 'lane-db-1',
              startedAt: '2026-03-23T03:00:00.000Z',
              endedAt: null,
              ongoing: true,
              durationMinutes: 42,
              severity: 'MODERATE',
              direction: 'HIGH',
              type: 'HEAT',
              thresholdC: 15,
              minObservedC: 11.2,
              maxObservedC: 16.1,
              maxDeviationC: 1.1,
              shelfLifeImpactPercent: 12,
            },
          ],
          sla: {
            status: 'CONDITIONAL',
            defensibilityScore: 82,
            shelfLifeImpactPercent: 12,
            remainingShelfLifeDays: 9,
            excursionCount: 1,
            totalExcursionMinutes: 42,
            maxDeviationC: 1.1,
          },
          meta: {
            resolution: 'raw',
            from: null,
            to: null,
            totalReadings: 1,
          },
        });
      }

      if (url === 'http://backend.test/lanes/lane-db-1/audit') {
        return jsonResponse({
          entries: [
            {
              id: 'audit-1',
              timestamp: '2026-03-23T05:00:00.000Z',
              actor: 'system',
              action: 'VERIFY',
              entityType: 'LANE',
              entityId: 'lane-db-1',
              payloadHash: 'payload-1',
              prevHash: 'prev-1',
              entryHash: 'entry-1',
            },
          ],
        });
      }

      if (url === 'http://backend.test/cold-chain/profiles/MANGO') {
        return jsonResponse({
          profile: {
            id: 'profile-1',
            productType: 'MANGO',
            optimalMinC: 10,
            optimalMaxC: 13,
            chillingThresholdC: 10,
            heatThresholdC: 15,
            shelfLifeMinDays: 14,
            shelfLifeMaxDays: 21,
          },
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const data = await loadLaneDetailPageData('lane-db-1', {
      requestHeaders: new Headers({
        authorization: 'Bearer access-token',
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(data.lane.laneId).toBe('LN-2026-001');
    expect(data.lane.completenessScore).toBe(73);
    expect(data.lane.temperatureProfile).toEqual(
      expect.objectContaining({
        fruit: 'MANGO',
        optimalMinC: 10,
        optimalMaxC: 13,
      }),
    );
    expect(data.completeness.missing).toEqual(['VHT Certificate']);
    expect(data.evidence).toHaveLength(1);
    expect(data.evidenceGraph.nodes[0]?.status).toBe('COMPLETE');
    expect(data.temperature.readings[0]?.valueC).toBe(11.2);
    expect(data.temperature.readings[0]?.source).toBe('TELEMETRY');
    expect(data.temperature.excursions[0]).toEqual(
      expect.objectContaining({
        type: 'HEAT_DAMAGE',
        startAt: '2026-03-23T03:00:00.000Z',
        shelfLifeImpactPct: 12,
      }),
    );
    expect(data.auditEntries[0]?.actor).toBe('system');
    expect(data.proofPacks.backendAvailable).toBe(false);
  });

  it('falls back to the server access token env var when no auth header is forwarded', async () => {
    process.env.ZRL_API_ACCESS_TOKEN = 'dev-access-token';

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockImplementation(async (_input, init) => {
      const headers = new Headers(init?.headers);

      expect(headers.get('authorization')).toBe('Bearer dev-access-token');

      throw new Error('stop after auth assertion');
    });

    await expect(loadLaneDetailPageData('lane-db-1')).rejects.toThrow(
      'stop after auth assertion',
    );
  });
});

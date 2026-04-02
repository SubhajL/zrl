import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { PartnerIntegrationsService } from './integrations.service';

describe('PartnerIntegrationsService', () => {
  const actor = {
    id: 'exporter-1',
    email: 'exporter@example.com',
    role: 'EXPORTER',
    companyName: 'Exporter Co',
    mfaEnabled: false,
    sessionVersion: 0,
  } as const;

  let createPartnerLabArtifactMock: jest.Mock;
  let createPartnerTemperatureArtifactMock: jest.Mock;
  let createPartnerCertificationArtifactMock: jest.Mock;
  let service: PartnerIntegrationsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    createPartnerLabArtifactMock = jest.fn().mockResolvedValue({
      artifact: {
        id: 'artifact-lab-1',
        artifactType: 'MRL_TEST',
      },
    });
    createPartnerTemperatureArtifactMock = jest.fn().mockResolvedValue({
      artifact: {
        id: 'artifact-temp-1',
        artifactType: 'TEMP_DATA',
      },
      ingestion: {
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
      },
    });
    createPartnerCertificationArtifactMock = jest.fn().mockResolvedValue({
      artifact: {
        id: 'artifact-gap-1',
        artifactType: 'GAP_CERT',
      },
    });

    service = new PartnerIntegrationsService({
      createPartnerLabArtifact: createPartnerLabArtifactMock,
      createPartnerTemperatureArtifact: createPartnerTemperatureArtifactMock,
      createPartnerCertificationArtifact:
        createPartnerCertificationArtifactMock,
    });

    process.env['CENTRAL_LAB_API_BASE_URL'] = 'https://central.example.test';
    process.env['CENTRAL_LAB_API_KEY'] = 'central-key';
    process.env['SGS_API_BASE_URL'] = 'https://sgs.example.test';
    process.env['SGS_API_KEY'] = 'sgs-key';
    process.env['THAI_AIRWAYS_API_BASE_URL'] =
      'https://thaiairways.example.test';
    process.env['THAI_AIRWAYS_API_KEY'] = 'thaiairways-key';
    process.env['KERRY_API_BASE_URL'] = 'https://kerry.example.test';
    process.env['KERRY_API_KEY'] = 'kerry-key';
    process.env['ACFS_API_BASE_URL'] = 'https://acfs.example.test';
    process.env['INTEGRATION_HTTP_TIMEOUT_MS'] = '500';
    process.env['INTEGRATION_RATE_LIMIT_PER_MINUTE'] = '10';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete process.env['CENTRAL_LAB_API_BASE_URL'];
    delete process.env['CENTRAL_LAB_API_KEY'];
    delete process.env['SGS_API_BASE_URL'];
    delete process.env['SGS_API_KEY'];
    delete process.env['THAI_AIRWAYS_API_BASE_URL'];
    delete process.env['THAI_AIRWAYS_API_KEY'];
    delete process.env['KERRY_API_BASE_URL'];
    delete process.env['KERRY_API_KEY'];
    delete process.env['ACFS_API_BASE_URL'];
    delete process.env['INTEGRATION_HTTP_TIMEOUT_MS'];
    delete process.env['INTEGRATION_RATE_LIMIT_PER_MINUTE'];
    delete (global as typeof globalThis & { fetch?: typeof fetch }).fetch;
  });

  it('imports Central Lab payloads into normalized MRL results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          reportId: 'CL-001',
          issuedAt: '2026-04-02T10:00:00.000Z',
          issuer: 'Central Lab Thai',
          results: [
            {
              substance: 'Carbendazim',
              valueMgKg: 0.12,
              method: 'LC-MS/MS',
              detectionLimitMgKg: 0.01,
            },
          ],
        }),
    }) as unknown as typeof fetch;

    const result = await service.importLabResults(
      'central-lab-thai',
      'lane-db-1',
      { reportId: 'CL-001' },
      actor,
    );

    const [labInput, labActor] = createPartnerLabArtifactMock.mock.calls[0] as [
      {
        laneId: string;
        issuer?: string;
        issuedAt?: string;
        payload: {
          provider: string;
          reportId: string;
          results: Array<{
            substance: string;
            valueMgKg: number;
            method: string;
            detectionLimitMgKg: number;
          }>;
        };
      },
      typeof actor,
    ];
    expect(labInput).toMatchObject({
      laneId: 'lane-db-1',
      issuer: 'Central Lab Thai',
      issuedAt: '2026-04-02T10:00:00.000Z',
    });
    expect(labInput.payload).toMatchObject({
      provider: 'central-lab-thai',
      reportId: 'CL-001',
      results: [
        {
          substance: 'Carbendazim',
          valueMgKg: 0.12,
          method: 'LC-MS/MS',
          detectionLimitMgKg: 0.01,
        },
      ],
    });
    expect(labActor).toEqual(actor);
    expect(result.artifact.id).toBe('artifact-lab-1');
  });

  it('imports SGS multi residue payloads into normalized MRL results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          analysisId: 'SGS-44',
          issuedAt: '2026-04-02T11:00:00.000Z',
          laboratory: 'SGS Thailand',
          pages: [
            {
              entries: [
                {
                  analyte: 'Imidacloprid',
                  resultMgKg: '0.03',
                  methodName: 'LC-MS/MS',
                  loqMgKg: '0.01',
                },
              ],
            },
          ],
        }),
    }) as unknown as typeof fetch;

    await service.importLabResults(
      'sgs-thailand',
      'lane-db-1',
      { reportId: 'SGS-44' },
      actor,
    );

    const [sgsInput, sgsActor] = createPartnerLabArtifactMock.mock.calls[0] as [
      {
        payload: {
          provider: string;
          reportId: string;
          results: Array<{
            substance: string;
            valueMgKg: number;
            method: string;
            detectionLimitMgKg: number;
          }>;
        };
      },
      typeof actor,
    ];
    expect(sgsInput.payload).toMatchObject({
      provider: 'sgs-thailand',
      reportId: 'SGS-44',
      results: [
        {
          substance: 'Imidacloprid',
          valueMgKg: 0.03,
          method: 'LC-MS/MS',
          detectionLimitMgKg: 0.01,
        },
      ],
    });
    expect(sgsActor).toEqual(actor);
  });

  it('imports Thai Airways telemetry into normalized readings', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          shipmentId: 'TG-100',
          issuedAt: '2026-04-02T12:00:00.000Z',
          carrier: 'Thai Airways Cargo',
          telemetry: [
            {
              capturedAt: '2026-04-02T12:00:00.000Z',
              temperatureCelsius: 11.4,
              deviceId: 'tg-sensor-1',
              location: 'BKK',
            },
            {
              capturedAt: '2026-04-02T12:05:00.000Z',
              temperatureCelsius: 11.6,
              deviceId: 'tg-sensor-1',
              location: 'BKK',
            },
          ],
        }),
    }) as unknown as typeof fetch;

    const result = await service.importTemperatureData(
      'thai-airways',
      'lane-db-1',
      { shipmentId: 'TG-100' },
      actor,
    );

    const [thaiAirwaysInput, temperatureActor] =
      createPartnerTemperatureArtifactMock.mock.calls[0] as [
        {
          payload: {
            provider: string;
            shipmentId: string;
            readings: Array<{
              timestamp: string;
              temperatureC: number;
              deviceId: string;
              location: string;
            }>;
          };
        },
        typeof actor,
      ];
    expect(thaiAirwaysInput.payload).toMatchObject({
      provider: 'thai-airways',
      shipmentId: 'TG-100',
      readings: [
        {
          timestamp: '2026-04-02T12:00:00.000Z',
          temperatureC: 11.4,
          deviceId: 'tg-sensor-1',
          location: 'BKK',
        },
        {
          timestamp: '2026-04-02T12:05:00.000Z',
          temperatureC: 11.6,
          deviceId: 'tg-sensor-1',
          location: 'BKK',
        },
      ],
    });
    expect(temperatureActor).toEqual(actor);
    expect(result.ingestion?.count).toBe(2);
  });

  it('imports Kerry telemetry into normalized readings', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          shipmentId: 'KRY-9',
          issuedAt: '2026-04-02T13:00:00.000Z',
          provider: 'Kerry Express Cold Chain',
          readings: [
            {
              timestamp: '2026-04-02T13:00:00.000Z',
              valueCelsius: '10.9',
              sensorId: 'kerry-1',
              locationName: 'Laem Chabang',
            },
          ],
        }),
    }) as unknown as typeof fetch;

    await service.importTemperatureData(
      'kerry',
      'lane-db-1',
      { shipmentId: 'KRY-9' },
      actor,
    );

    const [kerryInput, kerryActor] = createPartnerTemperatureArtifactMock.mock
      .calls[0] as [
      {
        payload: {
          provider: string;
          shipmentId: string;
          readings: Array<{
            timestamp: string;
            temperatureC: number;
            deviceId: string;
            location: string;
          }>;
        };
      },
      typeof actor,
    ];
    expect(kerryInput.payload).toMatchObject({
      provider: 'kerry',
      shipmentId: 'KRY-9',
      readings: [
        {
          timestamp: '2026-04-02T13:00:00.000Z',
          temperatureC: 10.9,
          deviceId: 'kerry-1',
          location: 'Laem Chabang',
        },
      ],
    });
    expect(kerryActor).toEqual(actor);
  });

  it('caches ACFS lookup results for one hour', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          certificateNumber: 'GAP-100',
          status: 'ACTIVE',
          expiryDate: '2026-12-31',
          holderName: 'Exporter Co',
          scope: ['Mango', 'Packing'],
        }),
    }) as unknown as typeof fetch;

    const first = await service.lookupAcfsCertificate('GAP-100');
    const second = await service.lookupAcfsCertificate('GAP-100');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.valid).toBe(true);
  });

  it('retries transient provider failures with exponential backoff', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockRejectedValueOnce(new Error('temporary upstream failure'))
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            reportId: 'CL-002',
            issuedAt: '2026-04-02T10:00:00.000Z',
            issuer: 'Central Lab Thai',
            results: [],
          }),
      }) as unknown as typeof fetch;

    const promise = service.importLabResults(
      'central-lab-thai',
      'lane-db-1',
      { reportId: 'CL-002' },
      actor,
    );

    await jest.runAllTimersAsync();
    await promise;

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('fails closed on invalid ACFS certification imports', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          certificateNumber: 'GAP-404',
          status: 'EXPIRED',
          expiryDate: '2025-01-01',
          holderName: 'Exporter Co',
          scope: ['Mango'],
        }),
    }) as unknown as typeof fetch;

    await expect(
      service.importAcfsCertificate(
        'lane-db-1',
        { certificateNumber: 'GAP-404' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createPartnerCertificationArtifactMock).not.toHaveBeenCalled();
  });

  it('raises a gateway error when retries are exhausted', async () => {
    jest.useRealTimers();
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new Error('permanent upstream failure'),
      ) as unknown as typeof fetch;

    await expect(
      service.importTemperatureData(
        'kerry',
        'lane-db-1',
        { shipmentId: 'SHIP-1' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

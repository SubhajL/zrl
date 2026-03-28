import JSZip from 'jszip';
import { PrivacyService } from './privacy.service';
import {
  PrivacyConsentType,
  PrivacyRequestStatus,
  PrivacyRequestType,
  type DataExportRequestRecord,
  type PrivacyBreachIncidentRecord,
  type PrivacyConsentEventRecord,
  type PrivacyDataExportFootprint,
  type PrivacyRequestRecord,
  type PrivacyStore,
  type PrivacyUserProfileRecord,
} from './privacy.types';

class MockPrivacyStore implements PrivacyStore {
  getUserProfile = jest.fn<
    Promise<PrivacyUserProfileRecord | null>,
    [string]
  >();
  listConsentEvents = jest.fn<Promise<PrivacyConsentEventRecord[]>, [string]>();
  createConsentEvent = jest.fn<
    Promise<PrivacyConsentEventRecord>,
    [
      {
        userId: string;
        consentType: PrivacyConsentType;
        granted: boolean;
        source: string;
        createdAt: Date;
      },
    ]
  >();
  listPrivacyRequests = jest.fn<
    Promise<PrivacyRequestRecord[]>,
    [string, number | undefined]
  >();
  createPrivacyRequest = jest.fn<
    Promise<PrivacyRequestRecord>,
    [
      {
        userId: string;
        requestType: PrivacyRequestType;
        reason: string | null;
        details: Record<string, unknown> | null;
        status: PrivacyRequestStatus;
        dueAt: Date;
        createdAt: Date;
      },
    ]
  >();
  getDataExportFootprint = jest.fn<
    Promise<PrivacyDataExportFootprint>,
    [string]
  >();
  createDataExportRequest = jest.fn<
    Promise<DataExportRequestRecord>,
    [
      {
        userId: string;
        fileName: string;
        contentType: string;
        zipData: Buffer;
        exportedAt: Date;
      },
    ]
  >();
  findDataExportRequestForUser = jest.fn<
    Promise<DataExportRequestRecord | null>,
    [string, string]
  >();
  listOpenPrivacyRequests = jest.fn<Promise<PrivacyRequestRecord[]>, []>();
  findPrivacyRequestById = jest.fn<
    Promise<PrivacyRequestRecord | null>,
    [string]
  >();
  completePrivacyRequest = jest.fn<
    Promise<PrivacyRequestRecord>,
    [
      {
        requestId: string;
        status: PrivacyRequestStatus;
        completedAt: Date;
        processedByUserId: string;
        resolution: Record<string, unknown> | null;
      },
    ]
  >();
  updateUserProfile = jest.fn<
    Promise<PrivacyUserProfileRecord>,
    [
      string,
      {
        email?: string;
        companyName?: string | null;
      },
    ]
  >();
  anonymizeUser = jest.fn<Promise<PrivacyUserProfileRecord>, [string, Date]>();
  listUserProfiles = jest.fn<
    Promise<PrivacyUserProfileRecord[]>,
    [readonly string[]]
  >();
  createBreachIncident = jest.fn<
    Promise<PrivacyBreachIncidentRecord>,
    [
      {
        reportedByUserId: string;
        summary: string;
        description: string;
        affectedUserIds: readonly string[];
        detectedAt: Date;
        occurredAt: Date | null;
        createdAt: Date;
      },
    ]
  >();
  markBreachIncidentNotifications = jest.fn<
    Promise<PrivacyBreachIncidentRecord>,
    [
      {
        incidentId: string;
        pdpaOfficeNotifiedAt: Date;
        dataSubjectsNotifiedAt: Date;
      },
    ]
  >();
}

function buildUserProfile(
  overrides: Partial<PrivacyUserProfileRecord> = {},
): PrivacyUserProfileRecord {
  return {
    id: 'user-1',
    email: 'exporter@example.com',
    role: 'EXPORTER',
    companyName: 'Thai Tropical Exports',
    mfaEnabled: false,
    createdAt: new Date('2026-03-28T04:00:00.000Z'),
    updatedAt: new Date('2026-03-28T04:00:00.000Z'),
    ...overrides,
  };
}

function buildConsentEvent(
  overrides: Partial<PrivacyConsentEventRecord> = {},
): PrivacyConsentEventRecord {
  return {
    id: 'consent-1',
    userId: 'user-1',
    consentType: PrivacyConsentType.MARKETING_COMMUNICATIONS,
    granted: true,
    source: 'settings-ui',
    createdAt: new Date('2026-03-28T04:00:00.000Z'),
    ...overrides,
  };
}

function buildPrivacyRequest(
  overrides: Partial<PrivacyRequestRecord> = {},
): PrivacyRequestRecord {
  return {
    id: 'request-1',
    userId: 'user-1',
    requestType: PrivacyRequestType.DELETION,
    status: PrivacyRequestStatus.PENDING,
    reason: 'Remove dormant account data',
    details: null,
    dueAt: new Date('2026-04-27T04:00:00.000Z'),
    completedAt: null,
    processedByUserId: null,
    resolution: null,
    createdAt: new Date('2026-03-28T04:00:00.000Z'),
    updatedAt: new Date('2026-03-28T04:00:00.000Z'),
    ...overrides,
  };
}

function buildExportRequest(
  overrides: Partial<DataExportRequestRecord> = {},
): DataExportRequestRecord {
  return {
    id: 'export-1',
    userId: 'user-1',
    status: 'READY',
    fileName: 'pdpa-export-user-1-2026-03-28.zip',
    contentType: 'application/zip',
    zipData: Buffer.from('zip-data'),
    exportedAt: new Date('2026-03-28T04:00:00.000Z'),
    expiresAt: null,
    ...overrides,
  };
}

function buildFootprint(): PrivacyDataExportFootprint {
  return {
    profile: buildUserProfile(),
    consents: [
      buildConsentEvent(),
      buildConsentEvent({
        id: 'consent-2',
        granted: false,
        source: 'api',
        createdAt: new Date('2026-03-29T04:00:00.000Z'),
      }),
    ],
    requests: [buildPrivacyRequest()],
    lanes: [
      {
        id: 'lane-db-1',
        laneId: 'LN-001',
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        coldChainMode: 'LOGGER',
        coldChainDeviceId: 'logger-1',
        createdAt: '2026-03-28T04:00:00.000Z',
      },
    ],
    checkpoints: [
      {
        id: 'checkpoint-1',
        laneId: 'lane-db-1',
        sequence: 1,
        locationName: 'Bangkok DC',
        signerName: 'Somchai Prasert',
        conditionNotes: 'Loaded for departure',
        createdAt: '2026-03-28T04:10:00.000Z',
      },
    ],
    artifacts: [
      {
        id: 'artifact-1',
        laneId: 'lane-db-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        issuer: 'Thai Customs',
        issuedAt: '2026-03-28T04:20:00.000Z',
        source: 'UPLOAD',
        verificationStatus: 'VERIFIED',
        metadata: { consigneeEmail: 'buyer@example.jp' },
        uploadedAt: '2026-03-28T04:20:00.000Z',
      },
    ],
    notifications: [
      {
        id: 'notification-1',
        type: 'PACK_GENERATED',
        title: 'Pack ready',
        message: 'Your regulator pack is ready',
        readAt: null,
        createdAt: '2026-03-28T05:00:00.000Z',
      },
    ],
  };
}

function buildBreachIncident(
  overrides: Partial<PrivacyBreachIncidentRecord> = {},
): PrivacyBreachIncidentRecord {
  return {
    id: 'breach-1',
    reportedByUserId: 'admin-1',
    summary: 'Unauthorized export shared to an external recipient',
    description: 'A generated export was sent to the wrong inbox.',
    affectedUserIds: ['user-1'],
    detectedAt: new Date('2026-03-28T04:00:00.000Z'),
    occurredAt: new Date('2026-03-28T03:00:00.000Z'),
    pdpaOfficeNotifiedAt: null,
    dataSubjectsNotifiedAt: null,
    createdAt: new Date('2026-03-28T04:00:00.000Z'),
    updatedAt: new Date('2026-03-28T04:00:00.000Z'),
    ...overrides,
  };
}

describe('PrivacyService', () => {
  const mandatoryEmailDispatcher = {
    sendDirectEmail: jest.fn<Promise<void>, [unknown]>(),
  };

  beforeEach(() => {
    mandatoryEmailDispatcher.sendDirectEmail.mockReset();
    process.env['PDPA_OFFICE_NOTIFICATION_EMAIL'] = 'pdpa-office@example.go.th';
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env['PDPA_OFFICE_NOTIFICATION_EMAIL'];
  });

  it('getCurrentProfile returns profile consent and recent requests', async () => {
    const store = new MockPrivacyStore();
    const service = new PrivacyService(store);

    store.getUserProfile.mockResolvedValue(buildUserProfile());
    store.listConsentEvents.mockResolvedValue([
      buildConsentEvent({
        granted: true,
        createdAt: new Date('2026-03-27T04:00:00.000Z'),
      }),
      buildConsentEvent({
        id: 'consent-2',
        granted: false,
        createdAt: new Date('2026-03-28T04:00:00.000Z'),
      }),
    ]);
    store.listPrivacyRequests.mockResolvedValue([buildPrivacyRequest()]);

    const result = await service.getCurrentProfile('user-1');

    expect(result.user.email).toBe('exporter@example.com');
    expect(result.consent.granted).toBe(false);
    expect(result.consent.type).toBe(
      PrivacyConsentType.MARKETING_COMMUNICATIONS,
    );
    expect(result.requests).toHaveLength(1);
  });

  it('updateConsent appends a new marketing consent event', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T04:00:00.000Z'));
    const store = new MockPrivacyStore();
    const service = new PrivacyService(store);

    store.createConsentEvent.mockResolvedValue(
      buildConsentEvent({
        granted: false,
        source: 'settings-ui',
        createdAt: new Date('2026-03-28T04:00:00.000Z'),
      }),
    );

    const result = await service.updateConsent('user-1', {
      type: PrivacyConsentType.MARKETING_COMMUNICATIONS,
      granted: false,
      source: 'settings-ui',
    });

    expect(store.createConsentEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      consentType: PrivacyConsentType.MARKETING_COMMUNICATIONS,
      granted: false,
      source: 'settings-ui',
      createdAt: new Date('2026-03-28T04:00:00.000Z'),
    });
    expect(result.consent.granted).toBe(false);
  });

  it('createRightsRequest records type reason and dueAt', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T04:00:00.000Z'));
    const store = new MockPrivacyStore();
    const service = new PrivacyService(store);

    store.createPrivacyRequest.mockResolvedValue(buildPrivacyRequest());

    const result = await service.createRightsRequest('user-1', {
      type: PrivacyRequestType.DELETION,
      reason: 'Close the account permanently',
      details: { initiatedFrom: 'settings' },
    });

    expect(store.createPrivacyRequest).toHaveBeenCalledWith({
      userId: 'user-1',
      requestType: PrivacyRequestType.DELETION,
      reason: 'Close the account permanently',
      details: { initiatedFrom: 'settings' },
      status: PrivacyRequestStatus.PENDING,
      dueAt: new Date('2026-04-27T04:00:00.000Z'),
      createdAt: new Date('2026-03-28T04:00:00.000Z'),
    });
    expect(result.request.status).toBe(PrivacyRequestStatus.PENDING);
  });

  it('requestDataExport persists zip payload with JSON and CSV', async () => {
    jest.useRealTimers();
    const store = new MockPrivacyStore();
    const service = new PrivacyService(store);
    const footprint = buildFootprint();

    store.getUserProfile.mockResolvedValue(footprint.profile);
    store.getDataExportFootprint.mockResolvedValue(footprint);
    store.createDataExportRequest.mockImplementation((input) =>
      buildExportRequest({
        id: 'export-1',
        fileName: input.fileName,
        contentType: input.contentType,
        zipData: input.zipData,
        exportedAt: input.exportedAt,
      }),
    );

    const result = await service.requestDataExport('user-1');

    expect(result.requestId).toBe('export-1');
    expect(result.estimatedReady).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    const [[createInput]] = store.createDataExportRequest.mock.calls;
    const archive = await JSZip.loadAsync(createInput.zipData);
    const exportJson = JSON.parse(
      await archive.file('export.json')!.async('string'),
    ) as {
      profile: { email: string };
      lanes: Array<{ laneId: string }>;
    };
    const lanesCsv = await archive.file('lanes.csv')!.async('string');
    const consentCsv = await archive
      .file('consent-history.csv')!
      .async('string');

    expect(exportJson.profile.email).toBe('exporter@example.com');
    expect(exportJson.lanes[0]?.laneId).toBe('LN-001');
    expect(lanesCsv).toContain('LN-001');
    expect(consentCsv).toContain('MARKETING_COMMUNICATIONS');
  });

  it('downloadDataExport rejects a request owned by another user', async () => {
    const store = new MockPrivacyStore();
    const service = new PrivacyService(store);

    store.findDataExportRequestForUser.mockResolvedValue(null);

    await expect(
      service.downloadDataExport('user-1', 'foreign-request'),
    ).rejects.toThrow('Data export request not found.');
  });

  it('fulfillPrivacyRequest anonymizes deletion requests and marks them completed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T06:00:00.000Z'));
    const store = new MockPrivacyStore();
    const service = new PrivacyService(
      store,
      mandatoryEmailDispatcher as never,
    );

    store.findPrivacyRequestById.mockResolvedValue(
      buildPrivacyRequest({
        requestType: PrivacyRequestType.DELETION,
      }),
    );
    store.anonymizeUser.mockResolvedValue(
      buildUserProfile({
        email: 'deleted+user-1@privacy.invalid',
        companyName: null,
        mfaEnabled: false,
      }),
    );
    store.completePrivacyRequest.mockResolvedValue(
      buildPrivacyRequest({
        status: PrivacyRequestStatus.COMPLETED,
        completedAt: new Date('2026-03-28T06:00:00.000Z'),
        updatedAt: new Date('2026-03-28T06:00:00.000Z'),
        processedByUserId: 'admin-1',
        resolution: {
          action: 'ANONYMIZED',
          anonymizedEmail: 'deleted+user-1@privacy.invalid',
        },
      }),
    );

    const result = await service.fulfillPrivacyRequest('admin-1', 'request-1');

    expect(store.anonymizeUser).toHaveBeenCalledWith(
      'user-1',
      new Date('2026-03-28T06:00:00.000Z'),
    );
    expect(store.completePrivacyRequest).toHaveBeenCalledWith({
      requestId: 'request-1',
      status: PrivacyRequestStatus.COMPLETED,
      completedAt: new Date('2026-03-28T06:00:00.000Z'),
      processedByUserId: 'admin-1',
      resolution: {
        action: 'ANONYMIZED',
        anonymizedEmail: 'deleted+user-1@privacy.invalid',
      },
    });
    expect(result.request.status).toBe(PrivacyRequestStatus.COMPLETED);
  });

  it('fulfillPrivacyRequest turns portability requests into a ready export', async () => {
    jest.useRealTimers();
    const store = new MockPrivacyStore();
    const service = new PrivacyService(
      store,
      mandatoryEmailDispatcher as never,
    );
    const footprint = buildFootprint();

    store.findPrivacyRequestById.mockResolvedValue(
      buildPrivacyRequest({
        requestType: PrivacyRequestType.PORTABILITY,
      }),
    );
    store.getUserProfile.mockResolvedValue(footprint.profile);
    store.getDataExportFootprint.mockResolvedValue(footprint);
    store.createDataExportRequest.mockImplementation((input) =>
      buildExportRequest({
        id: 'export-99',
        fileName: input.fileName,
        contentType: input.contentType,
        zipData: input.zipData,
        exportedAt: input.exportedAt,
      }),
    );
    store.completePrivacyRequest.mockResolvedValue(
      buildPrivacyRequest({
        requestType: PrivacyRequestType.PORTABILITY,
        status: PrivacyRequestStatus.COMPLETED,
        completedAt: new Date('2026-03-28T06:00:00.000Z'),
        updatedAt: new Date('2026-03-28T06:00:00.000Z'),
        processedByUserId: 'admin-1',
        resolution: {
          action: 'EXPORT_READY',
          exportRequestId: 'export-99',
        },
      }),
    );

    const result = await service.fulfillPrivacyRequest('admin-1', 'request-1');

    expect(store.createDataExportRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        contentType: 'application/zip',
      }),
    );
    const [completeInput] = store.completePrivacyRequest.mock.calls[0] as [
      {
        requestId: string;
        resolution: Record<string, unknown> | null;
      },
    ];
    expect(completeInput.requestId).toBe('request-1');
    expect(completeInput.resolution).toEqual(
      expect.objectContaining({
        action: 'EXPORT_READY',
        exportRequestId: 'export-99',
      }),
    );
    expect(result.request.status).toBe(PrivacyRequestStatus.COMPLETED);
  });

  it('reportBreachIncident persists the incident and sends mandatory PDPA emails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T08:00:00.000Z'));
    const store = new MockPrivacyStore();
    const service = new PrivacyService(
      store,
      mandatoryEmailDispatcher as never,
    );

    store.listUserProfiles.mockResolvedValue([
      buildUserProfile(),
      buildUserProfile({
        id: 'user-2',
        email: 'buyer@example.com',
      }),
    ]);
    store.createBreachIncident.mockResolvedValue(
      buildBreachIncident({
        affectedUserIds: ['user-1', 'user-2'],
      }),
    );
    store.markBreachIncidentNotifications.mockResolvedValue(
      buildBreachIncident({
        affectedUserIds: ['user-1', 'user-2'],
        pdpaOfficeNotifiedAt: new Date('2026-03-28T08:00:00.000Z'),
        dataSubjectsNotifiedAt: new Date('2026-03-28T08:00:00.000Z'),
        updatedAt: new Date('2026-03-28T08:00:00.000Z'),
      }),
    );

    const result = await service.reportBreachIncident('admin-1', {
      summary: 'Unauthorized export shared to an external recipient',
      description: 'A generated export was sent to the wrong inbox.',
      affectedUserIds: ['user-1', 'user-2'],
      detectedAt: '2026-03-28T04:00:00.000Z',
      occurredAt: '2026-03-28T03:00:00.000Z',
    });

    expect(store.createBreachIncident).toHaveBeenCalledWith({
      reportedByUserId: 'admin-1',
      summary: 'Unauthorized export shared to an external recipient',
      description: 'A generated export was sent to the wrong inbox.',
      affectedUserIds: ['user-1', 'user-2'],
      detectedAt: new Date('2026-03-28T04:00:00.000Z'),
      occurredAt: new Date('2026-03-28T03:00:00.000Z'),
      createdAt: new Date('2026-03-28T08:00:00.000Z'),
    });
    expect(mandatoryEmailDispatcher.sendDirectEmail).toHaveBeenCalledTimes(3);
    expect(store.markBreachIncidentNotifications).toHaveBeenCalledWith({
      incidentId: 'breach-1',
      pdpaOfficeNotifiedAt: new Date('2026-03-28T08:00:00.000Z'),
      dataSubjectsNotifiedAt: new Date('2026-03-28T08:00:00.000Z'),
    });
    expect(result.incident.pdpaOfficeNotifiedAt).toBe(
      '2026-03-28T08:00:00.000Z',
    );
  });
});

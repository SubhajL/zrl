import http from 'k6/http';
import { check, fail, sleep } from 'k6';

export const BASE_URL = (__ENV.K6_BASE_URL || 'http://127.0.0.1:3201').replace(
  /\/$/,
  '',
);
export const EXPORTER_EMAIL =
  __ENV.K6_EXPORTER_EMAIL || 'exporter@zrl-dev.test';
export const EXPORTER_PASSWORD =
  __ENV.K6_EXPORTER_PASSWORD || 'ZrlDev2026!';
export const COMPLETENESS_TIMEOUT_MS = Number(
  __ENV.K6_COMPLETENESS_TIMEOUT_MS || 30000,
);
export const PACK_READY_TIMEOUT_MS = Number(
  __ENV.K6_PACK_READY_TIMEOUT_MS || 45000,
);
export const POLL_INTERVAL_SECONDS = Number(
  __ENV.K6_POLL_INTERVAL_SECONDS || 1,
);

function jsonHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

function parseJson(response, context) {
  try {
    return response.json();
  } catch (error) {
    fail(`${context} returned non-JSON response: ${String(error)}`);
  }
}

function assertOk(response, context, predicate = (status) => status >= 200 && status < 300) {
  const passed =
    check(response, {
      [`${context} status ok`]: (res) => predicate(res.status),
    }) && predicate(response.status);

  if (!passed) {
    fail(
      `${context} failed with ${response.status}: ${response.body ? response.body.slice(0, 500) : '<empty>'}`,
    );
  }

  return response;
}

export function login() {
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: EXPORTER_EMAIL,
      password: EXPORTER_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  const body = parseJson(assertOk(response, 'login'), 'login');
  if (typeof body.accessToken !== 'string' || body.accessToken.length === 0) {
    fail('login did not return an accessToken');
  }

  return body.accessToken;
}

function uniqueSuffix() {
  return `${Date.now()}-${__VU}-${__ITER}`;
}

export function createLane(token) {
  const suffix = uniqueSuffix();
  const response = http.post(
    `${BASE_URL}/lanes`,
    JSON.stringify({
      product: 'MANGO',
      batch: {
        variety: 'Nam Doc Mai',
        quantityKg: 5000,
        originProvince: 'Chachoengsao',
        harvestDate: '2026-03-29',
        grade: 'A',
      },
      destination: {
        market: 'JAPAN',
      },
      route: {
        transportMode: 'AIR',
        carrier: `Load Test Carrier ${suffix}`,
        estimatedTransitHours: 8,
      },
      coldChainMode: 'LOGGER',
      coldChainConfig: {
        mode: 'LOGGER',
        deviceId: `logger-${suffix}`,
        dataFrequencySeconds: 300,
      },
    }),
    jsonHeaders(token),
  );
  const body = parseJson(assertOk(response, 'create lane'), 'create lane');
  const lane = body && typeof body === 'object' ? body.lane : undefined;
  if (
    lane === undefined ||
    lane === null ||
    typeof lane.id !== 'string' ||
    typeof lane.laneId !== 'string'
  ) {
    fail('create lane did not return lane identifiers');
  }

  return {
    id: lane.id,
    publicId: lane.laneId,
  };
}

export function listLanes(token) {
  assertOk(http.get(`${BASE_URL}/lanes`, authHeaders(token)), 'list lanes');
}

export function getLaneDetail(token, lanePublicId) {
  assertOk(
    http.get(
      `${BASE_URL}/lanes/${encodeURIComponent(lanePublicId)}`,
      authHeaders(token),
    ),
    'get lane detail',
  );
}

export function getLaneCompleteness(token, lanePublicId) {
  const response = assertOk(
    http.get(
      `${BASE_URL}/lanes/${encodeURIComponent(lanePublicId)}/completeness`,
      authHeaders(token),
    ),
    'get lane completeness',
  );
  return parseJson(response, 'get lane completeness');
}

export function listLaneArtifacts(token, lanePublicId) {
  const response = assertOk(
    http.get(
      `${BASE_URL}/lanes/${encodeURIComponent(lanePublicId)}/evidence`,
      authHeaders(token),
    ),
    'list lane evidence',
  );
  return parseJson(response, 'list lane evidence');
}

export function uploadArtifact(token, lanePublicId, definition) {
  const response = http.post(
    `${BASE_URL}/lanes/${encodeURIComponent(lanePublicId)}/evidence`,
    {
      artifactType: definition.artifactType,
      source: definition.source || 'UPLOAD',
      metadata: JSON.stringify(definition.metadata || {}),
      file: http.file(
        definition.contents,
        definition.fileName,
        definition.mimeType,
      ),
    },
    authHeaders(token),
  );
  return parseJson(assertOk(response, `upload ${definition.fileName}`), 'upload artifact');
}

const REQUIRED_EVIDENCE = [
  {
    artifactType: 'MRL_TEST',
    fileName: 'mrl-test-report.pdf',
    mimeType: 'application/pdf',
    contents: 'mrl-test-report',
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
    contents: 'vht-certificate',
    metadata: {
      documentType: 'VHT Certificate',
      expiresAt: '2026-12-31',
    },
  },
  {
    artifactType: 'PHYTO_CERT',
    fileName: 'phytosanitary-certificate.pdf',
    mimeType: 'application/pdf',
    contents: 'phytosanitary-certificate',
    metadata: {
      documentType: 'Phytosanitary Certificate',
      expiresAt: '2026-12-31',
    },
  },
  {
    artifactType: 'GAP_CERT',
    fileName: 'gap-certificate.pdf',
    mimeType: 'application/pdf',
    contents: 'gap-certificate',
    metadata: {
      documentType: 'GAP Certificate',
      expiresAt: '2026-12-31',
    },
  },
  {
    artifactType: 'TEMP_DATA',
    fileName: 'temperature-log.csv',
    mimeType: 'text/csv',
    contents:
      'timestamp,temperatureC\n2026-03-29T02:00:00.000Z,12.0\n2026-03-29T03:00:00.000Z,12.2\n',
    metadata: {
      documentType: 'Temperature Log',
    },
  },
  {
    artifactType: 'INVOICE',
    fileName: 'export-license.pdf',
    mimeType: 'application/pdf',
    contents: 'export-license',
    metadata: {
      documentType: 'Export License',
    },
  },
  {
    artifactType: 'INVOICE',
    fileName: 'commercial-invoice.pdf',
    mimeType: 'application/pdf',
    contents: 'commercial-invoice',
    metadata: {
      documentType: 'Commercial Invoice',
    },
  },
  {
    artifactType: 'INVOICE',
    fileName: 'grading-report.pdf',
    mimeType: 'application/pdf',
    contents: 'grading-report',
    metadata: {
      documentType: 'Grading Report',
    },
  },
  {
    artifactType: 'INVOICE',
    fileName: 'product-photos.pdf',
    mimeType: 'application/pdf',
    contents: 'product-photos',
    metadata: {
      documentType: 'Product Photos',
    },
  },
  {
    artifactType: 'INVOICE',
    fileName: 'packing-list.pdf',
    mimeType: 'application/pdf',
    contents: 'packing-list',
    metadata: {
      documentType: 'Packing List',
    },
  },
  {
    artifactType: 'TEMP_DATA',
    fileName: 'sla-summary.json',
    mimeType: 'application/json',
    contents: JSON.stringify({
      slaPass: true,
      averageTemperatureC: 12.1,
    }),
    metadata: {
      documentType: 'SLA Summary',
    },
  },
  {
    artifactType: 'TEMP_DATA',
    fileName: 'excursion-report.json',
    mimeType: 'application/json',
    contents: JSON.stringify({
      excursionCount: 0,
      highestSeverity: 'NONE',
    }),
    metadata: {
      documentType: 'Excursion Report',
    },
  },
  {
    artifactType: 'HANDOFF_SIGNATURE',
    fileName: 'handoff-signatures.pdf',
    mimeType: 'application/pdf',
    contents: 'handoff-signatures',
    metadata: {
      documentType: 'Handoff Signatures',
    },
  },
  {
    artifactType: 'INVOICE',
    fileName: 'transport-document.pdf',
    mimeType: 'application/pdf',
    contents: 'transport-document',
    metadata: {
      documentType: 'Transport Document',
    },
  },
  {
    artifactType: 'INVOICE',
    fileName: 'delivery-note.pdf',
    mimeType: 'application/pdf',
    contents: 'delivery-note',
    metadata: {
      documentType: 'Delivery Note',
    },
  },
];

export function seedRequiredEvidence(token, lanePublicId) {
  for (const definition of REQUIRED_EVIDENCE) {
    uploadArtifact(token, lanePublicId, definition);
  }
}

export function waitForCompleteness(token, lanePublicId, minimumScore = 95) {
  const deadline = Date.now() + COMPLETENESS_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const body = getLaneCompleteness(token, lanePublicId);
    if (Number(body.score) >= minimumScore) {
      return body;
    }

    sleep(POLL_INTERVAL_SECONDS);
  }

  fail(`lane ${lanePublicId} did not reach ${minimumScore}% completeness in time`);
}

export function triggerPackGeneration(token, lanePublicId, packType = 'REGULATOR') {
  const response = assertOk(
    http.post(
      `${BASE_URL}/lanes/${encodeURIComponent(lanePublicId)}/packs/generate`,
      JSON.stringify({ packType }),
      jsonHeaders(token),
    ),
    `generate ${packType} pack`,
  );
  const body = parseJson(response, 'generate pack');
  const pack = body && typeof body === 'object' ? body.pack : undefined;
  if (
    pack === undefined ||
    pack === null ||
    typeof pack.id !== 'string' ||
    pack.id.length === 0
  ) {
    fail('generate pack did not return a pack id');
  }

  return pack;
}

export function waitForReadyPack(token, lanePublicId, packId) {
  const deadline = Date.now() + PACK_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = assertOk(
      http.get(
        `${BASE_URL}/lanes/${encodeURIComponent(lanePublicId)}/packs`,
        authHeaders(token),
      ),
      'list packs',
    );
    const body = parseJson(response, 'list packs');
    const pack = Array.isArray(body.packs)
      ? body.packs.find((entry) => entry.id === packId)
      : null;

    if (pack !== null && pack !== undefined && pack.status === 'READY') {
      return pack;
    }
    if (pack !== null && pack !== undefined && pack.status === 'FAILED') {
      fail(`pack ${packId} failed before reaching READY: ${pack.errorMessage || 'unknown error'}`);
    }

    sleep(POLL_INTERVAL_SECONDS);
  }

  fail(`pack ${packId} did not reach READY in time`);
}

export function verifyPack(packId) {
  const response = assertOk(
    http.get(`${BASE_URL}/packs/${encodeURIComponent(packId)}/verify`),
    'verify pack',
  );
  return parseJson(response, 'verify pack');
}

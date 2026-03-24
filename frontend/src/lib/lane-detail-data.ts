import {
  FRUIT_TEMPERATURE_PROFILES,
  type AuditEntry,
  type ColdChainMode,
  type CompletenessResult,
  type EvidenceArtifact,
  type EvidenceGraph,
  type Excursion,
  type LaneDetail,
  type TemperatureProfile,
  type TemperatureReading,
  type TemperatureSlaResult,
} from './types';

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3000';
const SERVER_ACCESS_TOKEN_ENV = 'ZRL_API_ACCESS_TOKEN';

type AuthHeaderSource = {
  get(name: string): string | null;
};

interface LoadLaneDetailPageDataOptions {
  readonly requestHeaders?: AuthHeaderSource;
}

interface BackendLaneResponse {
  readonly lane: Omit<LaneDetail, 'temperatureProfile'>;
}

interface BackendEvidenceListResponse {
  readonly artifacts: EvidenceArtifact[];
}

interface BackendEvidenceGraphResponse {
  readonly nodes: Array<{
    readonly id: string;
    readonly artifactId: string;
    readonly artifactType: string;
    readonly label: string;
    readonly status: 'PENDING' | 'VERIFIED' | 'FAILED';
    readonly hashPreview: string;
  }>;
  readonly edges: EvidenceGraph['edges'];
}

interface BackendTemperatureResponse {
  readonly readings: Array<{
    readonly id: string;
    readonly laneId: string;
    readonly timestamp: string;
    readonly temperatureC: number;
    readonly deviceId: string | null;
  }>;
  readonly excursions: Array<{
    readonly id: string;
    readonly laneId: string;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly ongoing: boolean;
    readonly durationMinutes: number;
    readonly severity: Excursion['severity'];
    readonly direction: 'LOW' | 'HIGH';
    readonly type: 'CHILLING' | 'HEAT';
    readonly thresholdC: number;
    readonly minObservedC: number;
    readonly maxObservedC: number;
    readonly maxDeviationC: number;
    readonly shelfLifeImpactPercent: number;
  }>;
  readonly sla: {
    readonly status: TemperatureSlaResult['status'];
    readonly defensibilityScore: number;
    readonly shelfLifeImpactPercent: number;
    readonly remainingShelfLifeDays: number;
    readonly excursionCount: number;
    readonly totalExcursionMinutes: number;
    readonly maxDeviationC: number;
  };
}

interface BackendAuditResponse {
  readonly entries: AuditEntry[];
}

interface BackendProfileResponse {
  readonly profile: {
    readonly productType: LaneDetail['productType'];
    readonly optimalMinC: number;
    readonly optimalMaxC: number;
    readonly chillingThresholdC: number | null;
    readonly heatThresholdC: number;
    readonly shelfLifeMinDays: number;
    readonly shelfLifeMaxDays: number;
  };
}

export interface LaneDetailPageData {
  readonly lane: LaneDetail;
  readonly completeness: CompletenessResult;
  readonly evidence: EvidenceArtifact[];
  readonly evidenceGraph: EvidenceGraph;
  readonly temperature: {
    readonly readings: TemperatureReading[];
    readonly excursions: Excursion[];
    readonly sla: TemperatureSlaResult;
  };
  readonly auditEntries: AuditEntry[];
  readonly proofPacks: {
    readonly backendAvailable: boolean;
  };
  readonly auditExportUrl: string;
}

function resolveBackendBaseUrl(): string {
  return (
    process.env.ZRL_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_BACKEND_BASE_URL
  ).replace(/\/$/, '');
}

function resolveReadingSource(
  coldChainMode: ColdChainMode | null,
): TemperatureReading['source'] {
  return coldChainMode ?? 'MANUAL';
}

function mapTemperatureProfile(
  profile: BackendProfileResponse['profile'] | null,
  productType: LaneDetail['productType'],
): TemperatureProfile {
  if (profile === null) {
    return FRUIT_TEMPERATURE_PROFILES[productType];
  }

  return {
    fruit: profile.productType,
    optimalMinC: profile.optimalMinC,
    optimalMaxC: profile.optimalMaxC,
    chillingThresholdC: profile.chillingThresholdC,
    heatThresholdC: profile.heatThresholdC,
    baseShelfLifeDays: profile.shelfLifeMaxDays,
    minShelfLifeDays: profile.shelfLifeMinDays,
  };
}

function mapLaneDetail(
  lane: BackendLaneResponse['lane'],
  completeness: CompletenessResult,
  profile: TemperatureProfile,
): LaneDetail {
  return {
    ...lane,
    completenessScore: completeness.score,
    temperatureProfile: profile,
  };
}

function mapEvidenceGraph(graph: BackendEvidenceGraphResponse): EvidenceGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      status:
        node.status === 'VERIFIED'
          ? 'COMPLETE'
          : node.status === 'FAILED'
            ? 'FAILED'
            : 'PENDING',
    })),
    edges: graph.edges,
  };
}

function mapTemperatureReadings(
  readings: BackendTemperatureResponse['readings'],
  coldChainMode: ColdChainMode | null,
): TemperatureReading[] {
  return readings.map((reading) => ({
    id: reading.id,
    timestamp: reading.timestamp,
    valueC: reading.temperatureC,
    deviceId: reading.deviceId,
    source: resolveReadingSource(coldChainMode),
    checkpointId: null,
  }));
}

function mapExcursions(
  excursions: BackendTemperatureResponse['excursions'],
): Excursion[] {
  return excursions.map((excursion) => ({
    id: excursion.id,
    type: excursion.type === 'CHILLING' ? 'CHILLING_INJURY' : 'HEAT_DAMAGE',
    severity: excursion.severity,
    startAt: excursion.startedAt,
    endAt: excursion.endedAt,
    durationMinutes: excursion.durationMinutes,
    maxDeviationC: excursion.maxDeviationC,
    shelfLifeImpactPct: excursion.shelfLifeImpactPercent,
  }));
}

function mapTemperatureSla(
  laneId: string,
  sla: BackendTemperatureResponse['sla'],
): TemperatureSlaResult {
  return {
    laneId,
    status: sla.status,
    totalExcursionMinutes: sla.totalExcursionMinutes,
    excursionCount: sla.excursionCount,
    maxDeviationC: sla.maxDeviationC,
    remainingShelfLifeDays: sla.remainingShelfLifeDays,
    shelfLifeImpactPct: sla.shelfLifeImpactPercent,
  };
}

function buildRequestHeaders(source?: AuthHeaderSource): Headers {
  const headers = new Headers({
    accept: 'application/json',
  });
  const authorization =
    source?.get('authorization') ??
    normalizeAccessToken(process.env[SERVER_ACCESS_TOKEN_ENV]);

  if (authorization !== null && authorization !== undefined) {
    headers.set('authorization', authorization);
  }

  return headers;
}

function normalizeAccessToken(token: string | undefined): string | null {
  if (token === undefined) {
    return null;
  }

  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

async function fetchBackendJson<T>(
  path: string,
  init: {
    readonly headers: Headers;
  },
): Promise<T> {
  const response = await fetch(`${resolveBackendBaseUrl()}${path}`, {
    cache: 'no-store',
    headers: init.headers,
  });

  if (!response.ok) {
    throw new Error(
      `Backend request failed for ${path}: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export async function loadLaneDetailPageData(
  laneId: string,
  options: LoadLaneDetailPageDataOptions = {},
): Promise<LaneDetailPageData> {
  const requestHeaders = buildRequestHeaders(options.requestHeaders);
  const { lane } = await fetchBackendJson<BackendLaneResponse>(
    `/lanes/${encodeURIComponent(laneId)}`,
    {
      headers: requestHeaders,
    },
  );

  const [completeness, evidenceResponse, evidenceGraph, temperatureResponse, auditResponse, profileResponse] =
    await Promise.all([
      fetchBackendJson<CompletenessResult>(
        `/lanes/${encodeURIComponent(laneId)}/completeness`,
        {
          headers: requestHeaders,
        },
      ),
      fetchBackendJson<BackendEvidenceListResponse>(
        `/lanes/${encodeURIComponent(laneId)}/evidence`,
        {
          headers: requestHeaders,
        },
      ),
      fetchBackendJson<BackendEvidenceGraphResponse>(
        `/lanes/${encodeURIComponent(laneId)}/evidence/graph`,
        {
          headers: requestHeaders,
        },
      ),
      fetchBackendJson<BackendTemperatureResponse>(
        `/lanes/${encodeURIComponent(laneId)}/temperature`,
        {
          headers: requestHeaders,
        },
      ),
      fetchBackendJson<BackendAuditResponse>(
        `/lanes/${encodeURIComponent(laneId)}/audit`,
        {
          headers: requestHeaders,
        },
      ),
      fetchBackendJson<BackendProfileResponse>(
        `/cold-chain/profiles/${encodeURIComponent(lane.productType)}`,
        {
          headers: requestHeaders,
        },
      ).catch(() => null),
    ]);

  const temperatureProfile = mapTemperatureProfile(
    profileResponse?.profile ?? null,
    lane.productType,
  );

  return {
    lane: mapLaneDetail(lane, completeness, temperatureProfile),
    completeness,
    evidence: evidenceResponse.artifacts,
    evidenceGraph: mapEvidenceGraph(evidenceGraph),
    temperature: {
      readings: mapTemperatureReadings(
        temperatureResponse.readings,
        lane.coldChainMode,
      ),
      excursions: mapExcursions(temperatureResponse.excursions),
      sla: mapTemperatureSla(laneId, temperatureResponse.sla),
    },
    auditEntries: auditResponse.entries,
    proofPacks: {
      backendAvailable: false,
    },
    auditExportUrl: `${resolveBackendBaseUrl()}/audit/export/${encodeURIComponent(laneId)}`,
  };
}

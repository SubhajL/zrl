import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { EvidenceService } from '../modules/evidence/evidence.service';
import type { EvidenceRequestUser } from '../modules/evidence/evidence.types';
import type {
  AcfsCertificateLookup,
  AcfsImportInput,
  LabImportReferenceInput,
  LabProvider,
  NormalizedLabResult,
  NormalizedTemperatureReading,
  PartnerAcfsImportResult,
  PartnerIntegrationEvidencePort,
  PartnerLabImportResult,
  PartnerTemperatureImportResult,
  TemperatureImportReferenceInput,
  TemperatureProvider,
} from './integrations.types';

const RETRY_DELAYS_MS = [100, 200];

interface ProviderConfig {
  name: string;
  baseUrlEnv: string;
  apiKeyEnv?: string;
}

function assertString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value.trim();
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function assertObject(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value as Record<string, unknown>;
}

function parseLabProvider(value: string): LabProvider {
  if (value === 'central-lab-thai' || value === 'sgs-thailand') {
    return value;
  }

  throw new BadRequestException('Unsupported lab provider.');
}

function parseTemperatureProvider(value: string): TemperatureProvider {
  if (value === 'thai-airways' || value === 'kerry') {
    return value;
  }

  throw new BadRequestException('Unsupported temperature provider.');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class PartnerIntegrationsService {
  private readonly logger = new Logger(PartnerIntegrationsService.name);
  private readonly acfsCache = new Map<
    string,
    { expiresAt: number; value: AcfsCertificateLookup }
  >();
  private readonly rateLimitState = new Map<string, number[]>();

  constructor(
    @Inject(EvidenceService)
    private readonly evidenceService: PartnerIntegrationEvidencePort,
  ) {}

  async importLabResults(
    providerInput: string,
    laneId: string,
    reference: LabImportReferenceInput,
    actor: EvidenceRequestUser,
  ): Promise<PartnerLabImportResult> {
    const provider = parseLabProvider(providerInput);
    const reportId = assertString(reference.reportId, 'reportId');
    const payload = await this.fetchProviderJson(
      this.getLabProviderConfig(provider),
      `/reports/${encodeURIComponent(reportId)}`,
    );
    const normalized = this.normalizeLabPayload(provider, reportId, payload);
    const created = await this.evidenceService.createPartnerLabArtifact(
      {
        laneId,
        issuer: normalized.issuer,
        issuedAt: normalized.issuedAt,
        payload: normalized.payload,
      },
      actor,
    );

    return {
      provider,
      artifact: created.artifact,
    };
  }

  async importTemperatureData(
    providerInput: string,
    laneId: string,
    reference: TemperatureImportReferenceInput,
    actor: EvidenceRequestUser,
  ): Promise<PartnerTemperatureImportResult> {
    const provider = parseTemperatureProvider(providerInput);
    const shipmentId = assertString(reference.shipmentId, 'shipmentId');
    const payload = await this.fetchProviderJson(
      this.getTemperatureProviderConfig(provider),
      `/shipments/${encodeURIComponent(shipmentId)}`,
    );
    const normalized = this.normalizeTemperaturePayload(
      provider,
      shipmentId,
      payload,
    );
    const created = await this.evidenceService.createPartnerTemperatureArtifact(
      {
        laneId,
        issuer: normalized.issuer,
        issuedAt: normalized.issuedAt,
        payload: normalized.payload,
      },
      actor,
    );

    return {
      provider,
      artifact: created.artifact,
      ingestion: created.ingestion,
    };
  }

  async lookupAcfsCertificate(
    certificateNumberInput: string,
  ): Promise<AcfsCertificateLookup> {
    const certificateNumber = assertString(
      certificateNumberInput,
      'certificateNumber',
    );
    const cacheKey = certificateNumber.toUpperCase();
    const cached = this.acfsCache.get(cacheKey);
    const now = Date.now();
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.value;
    }

    const payload = await this.fetchProviderJson(
      {
        name: 'acfs',
        baseUrlEnv: 'ACFS_API_BASE_URL',
      },
      `/certificates/${encodeURIComponent(certificateNumber)}`,
    );
    const value = this.normalizeAcfsPayload(certificateNumber, payload);
    this.acfsCache.set(cacheKey, {
      expiresAt: now + 60 * 60 * 1000,
      value,
    });

    return value;
  }

  async importAcfsCertificate(
    laneId: string,
    input: AcfsImportInput,
    actor: EvidenceRequestUser,
  ): Promise<PartnerAcfsImportResult> {
    const certificateNumber = assertString(
      input.certificateNumber,
      'certificateNumber',
    );
    const lookup = await this.lookupAcfsCertificate(certificateNumber);
    if (!lookup.valid) {
      throw new BadRequestException(
        'ACFS GAP certificate is invalid or expired.',
      );
    }

    const created =
      await this.evidenceService.createPartnerCertificationArtifact(
        {
          laneId,
          issuer: 'ACFS Thailand',
          issuedAt: lookup.checkedAt,
          payload: {
            provider: 'acfs',
            certificateNumber: lookup.certificateNumber,
            valid: lookup.valid,
            expiryDate: lookup.expiryDate,
            holderName: lookup.holderName,
            scope: lookup.scope,
            checkedAt: lookup.checkedAt,
          },
        },
        actor,
      );

    return {
      ...lookup,
      artifact: created.artifact,
    };
  }

  private getLabProviderConfig(provider: LabProvider): ProviderConfig {
    switch (provider) {
      case 'central-lab-thai':
        return {
          name: provider,
          baseUrlEnv: 'CENTRAL_LAB_API_BASE_URL',
          apiKeyEnv: 'CENTRAL_LAB_API_KEY',
        };
      case 'sgs-thailand':
        return {
          name: provider,
          baseUrlEnv: 'SGS_API_BASE_URL',
          apiKeyEnv: 'SGS_API_KEY',
        };
    }
  }

  private getTemperatureProviderConfig(
    provider: TemperatureProvider,
  ): ProviderConfig {
    switch (provider) {
      case 'thai-airways':
        return {
          name: provider,
          baseUrlEnv: 'THAI_AIRWAYS_API_BASE_URL',
          apiKeyEnv: 'THAI_AIRWAYS_API_KEY',
        };
      case 'kerry':
        return {
          name: provider,
          baseUrlEnv: 'KERRY_API_BASE_URL',
          apiKeyEnv: 'KERRY_API_KEY',
        };
    }
  }

  private async fetchProviderJson(
    config: ProviderConfig,
    path: string,
  ): Promise<Record<string, unknown>> {
    const baseUrl = process.env[config.baseUrlEnv]?.trim() ?? '';
    if (baseUrl.length === 0) {
      throw new BadRequestException(
        `Provider ${config.name} is not configured.`,
      );
    }

    this.applyRateLimit(config.name);
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    const timeoutMs = this.resolveTimeoutMs();
    const headers = new Headers({ accept: 'application/json' });
    const apiKey =
      config.apiKeyEnv === undefined
        ? ''
        : (process.env[config.apiKeyEnv] ?? '').trim();
    if (apiKey.length > 0) {
      headers.set('x-api-key', apiKey);
    }

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const responseText = await response.text().catch(() => '');
          const message =
            responseText.length > 0
              ? responseText
              : `Provider ${config.name} responded with ${response.status}.`;
          if (response.status >= 400 && response.status < 500) {
            throw new BadRequestException(message);
          }
          throw new Error(message);
        }

        return assertObject(await response.json(), `${config.name} payload`);
      } catch (error) {
        clearTimeout(timeout);
        const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
        if (error instanceof BadRequestException) {
          throw error;
        }
        if (!isLastAttempt) {
          await delay(
            RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1) ?? 200,
          );
          continue;
        }

        const message =
          error instanceof Error ? error.message : 'Unknown provider error.';
        this.logger.error(`Provider ${config.name} request failed: ${message}`);
        throw new BadGatewayException(
          `Provider ${config.name} request failed after retries.`,
        );
      }
    }

    throw new BadGatewayException(
      `Provider ${config.name} request failed after retries.`,
    );
  }

  private normalizeLabPayload(
    provider: LabProvider,
    reportId: string,
    payload: Record<string, unknown>,
  ): {
    issuer: string | undefined;
    issuedAt: string | undefined;
    payload: Record<string, unknown>;
  } {
    const issuedAt =
      parseOptionalString(payload['issuedAt']) ??
      parseOptionalString(payload['issued_at']) ??
      undefined;

    if (provider === 'central-lab-thai') {
      const issuer =
        parseOptionalString(payload['issuer']) ?? 'Central Lab Thai';
      const results = this.normalizeCentralLabResults(payload);
      return {
        issuer,
        issuedAt,
        payload: {
          provider,
          reportId,
          results,
          raw: payload,
        },
      };
    }

    const issuer = parseOptionalString(payload['laboratory']) ?? 'SGS Thailand';
    const results = this.normalizeSgsResults(payload);
    return {
      issuer,
      issuedAt,
      payload: {
        provider,
        reportId,
        results,
        raw: payload,
      },
    };
  }

  private normalizeCentralLabResults(
    payload: Record<string, unknown>,
  ): NormalizedLabResult[] {
    const results = payload['results'];
    if (!Array.isArray(results)) {
      throw new BadRequestException('Central Lab payload is missing results.');
    }

    return results.map((entry, index) => {
      const record = assertObject(entry, `results[${index}]`);
      const substance = assertString(record['substance'], 'substance');
      const valueMgKg = parseOptionalNumber(
        record['valueMgKg'] ?? record['value_mg_kg'],
      );
      if (valueMgKg === null) {
        throw new BadRequestException('Invalid lab result value.');
      }

      return {
        substance,
        valueMgKg,
        method: parseOptionalString(record['method']),
        detectionLimitMgKg: parseOptionalNumber(
          record['detectionLimitMgKg'] ?? record['detection_limit_mg_kg'],
        ),
      };
    });
  }

  private normalizeSgsResults(
    payload: Record<string, unknown>,
  ): NormalizedLabResult[] {
    const pages = payload['pages'];
    if (!Array.isArray(pages)) {
      throw new BadRequestException('SGS payload is missing pages.');
    }

    return pages.flatMap((page, pageIndex) => {
      const pageRecord = assertObject(page, `pages[${pageIndex}]`);
      const entries = pageRecord['entries'];
      if (!Array.isArray(entries)) {
        throw new BadRequestException('SGS payload is missing entries.');
      }

      return entries.map((entry, entryIndex) => {
        const record = assertObject(
          entry,
          `pages[${pageIndex}].entries[${entryIndex}]`,
        );
        const substance = assertString(record['analyte'], 'analyte');
        const valueMgKg = parseOptionalNumber(
          record['resultMgKg'] ?? record['result_mg_kg'],
        );
        if (valueMgKg === null) {
          throw new BadRequestException('Invalid SGS result value.');
        }

        return {
          substance,
          valueMgKg,
          method: parseOptionalString(
            record['methodName'] ?? record['method_name'],
          ),
          detectionLimitMgKg: parseOptionalNumber(
            record['loqMgKg'] ?? record['loq_mg_kg'],
          ),
        };
      });
    });
  }

  private normalizeTemperaturePayload(
    provider: TemperatureProvider,
    shipmentId: string,
    payload: Record<string, unknown>,
  ): {
    issuer: string | undefined;
    issuedAt: string | undefined;
    payload: Record<string, unknown>;
  } {
    const issuedAt =
      parseOptionalString(payload['issuedAt']) ??
      parseOptionalString(payload['issued_at']) ??
      undefined;

    const readings =
      provider === 'thai-airways'
        ? this.normalizeThaiAirwaysReadings(payload)
        : this.normalizeKerryReadings(payload);
    if (readings.length === 0) {
      throw new BadRequestException('Temperature payload has no readings.');
    }

    return {
      issuer:
        provider === 'thai-airways'
          ? (parseOptionalString(payload['carrier']) ?? 'Thai Airways Cargo')
          : (parseOptionalString(payload['provider']) ??
            'Kerry Express Cold Chain'),
      issuedAt,
      payload: {
        provider,
        shipmentId,
        readings,
        raw: payload,
      },
    };
  }

  private normalizeThaiAirwaysReadings(
    payload: Record<string, unknown>,
  ): NormalizedTemperatureReading[] {
    const telemetry = payload['telemetry'];
    if (!Array.isArray(telemetry)) {
      throw new BadRequestException(
        'Thai Airways payload is missing telemetry.',
      );
    }

    return telemetry.map((entry, index) => {
      const record = assertObject(entry, `telemetry[${index}]`);
      const timestamp = assertString(record['capturedAt'], 'capturedAt');
      const temperatureC = parseOptionalNumber(
        record['temperatureCelsius'] ?? record['temperature_celsius'],
      );
      if (temperatureC === null) {
        throw new BadRequestException('Invalid telemetry temperature.');
      }

      return {
        timestamp,
        temperatureC,
        deviceId: parseOptionalString(record['deviceId']),
        location: parseOptionalString(record['location']),
      };
    });
  }

  private normalizeKerryReadings(
    payload: Record<string, unknown>,
  ): NormalizedTemperatureReading[] {
    const readings = payload['readings'];
    if (!Array.isArray(readings)) {
      throw new BadRequestException('Kerry payload is missing readings.');
    }

    return readings.map((entry, index) => {
      const record = assertObject(entry, `readings[${index}]`);
      const timestamp = assertString(record['timestamp'], 'timestamp');
      const temperatureC = parseOptionalNumber(
        record['valueCelsius'] ?? record['value_celsius'],
      );
      if (temperatureC === null) {
        throw new BadRequestException('Invalid Kerry telemetry value.');
      }

      return {
        timestamp,
        temperatureC,
        deviceId: parseOptionalString(
          record['sensorId'] ?? record['deviceId'] ?? record['sensor_id'],
        ),
        location: parseOptionalString(
          record['locationName'] ?? record['location_name'],
        ),
      };
    });
  }

  private normalizeAcfsPayload(
    certificateNumber: string,
    payload: Record<string, unknown>,
  ): AcfsCertificateLookup {
    const valid =
      payload['valid'] === true ||
      ['ACTIVE', 'VALID'].includes(
        (parseOptionalString(payload['status']) ?? '').toUpperCase(),
      );

    const scopeValue = payload['scope'];
    const scope = Array.isArray(scopeValue)
      ? scopeValue
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => entry.length > 0)
      : typeof scopeValue === 'string'
        ? scopeValue
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : [];

    return {
      provider: 'acfs',
      certificateNumber:
        parseOptionalString(payload['certificateNumber']) ?? certificateNumber,
      valid,
      expiryDate:
        parseOptionalString(payload['expiryDate']) ??
        parseOptionalString(payload['expiry_date']),
      holderName:
        parseOptionalString(payload['holderName']) ??
        parseOptionalString(payload['holder_name']),
      scope,
      checkedAt: new Date().toISOString(),
    };
  }

  private resolveTimeoutMs(): number {
    const rawValue = process.env['INTEGRATION_HTTP_TIMEOUT_MS'];
    if (rawValue === undefined || rawValue.trim().length === 0) {
      return 5000;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsed) || parsed < 100) {
      throw new BadRequestException(
        'Invalid integration timeout configuration.',
      );
    }

    return parsed;
  }

  private applyRateLimit(provider: string): void {
    const rawValue = process.env['INTEGRATION_RATE_LIMIT_PER_MINUTE'];
    const limit =
      rawValue === undefined || rawValue.trim().length === 0
        ? 30
        : Number.parseInt(rawValue, 10);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Invalid integration rate limit.');
    }

    const now = Date.now();
    const threshold = now - 60_000;
    const timestamps = (this.rateLimitState.get(provider) ?? []).filter(
      (timestamp) => timestamp > threshold,
    );

    if (timestamps.length >= limit) {
      throw new BadGatewayException(
        `Provider ${provider} rate limit exceeded.`,
      );
    }

    timestamps.push(now);
    this.rateLimitState.set(provider, timestamps);
  }
}

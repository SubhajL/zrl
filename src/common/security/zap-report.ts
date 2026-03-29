export interface ZapAlertSummary {
  readonly pluginId: string;
  readonly name: string;
  readonly riskCode: number;
  readonly riskDescription: string;
  readonly instances: number;
  readonly source: string;
}

interface ZapAlertRecord {
  readonly pluginid?: number | string;
  readonly name?: string;
  readonly riskcode?: number | string;
  readonly riskdesc?: string;
  readonly instances?: unknown[];
  readonly count?: number | string;
}

interface ZapSiteRecord {
  readonly alerts?: unknown[];
}

interface ZapReportRecord {
  readonly site?: unknown[];
}

function normalizeRiskCode(alert: ZapAlertRecord): number {
  if (typeof alert.riskcode === 'number' && Number.isFinite(alert.riskcode)) {
    return alert.riskcode;
  }

  if (typeof alert.riskcode === 'string') {
    const parsed = Number.parseInt(alert.riskcode, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const riskDesc = alert.riskdesc?.trim().toLowerCase() ?? '';
  if (riskDesc.startsWith('high')) {
    return 3;
  }
  if (riskDesc.startsWith('medium')) {
    return 2;
  }
  if (riskDesc.startsWith('low')) {
    return 1;
  }

  return 0;
}

function normalizeInstances(alert: ZapAlertRecord): number {
  if (Array.isArray(alert.instances)) {
    return alert.instances.length;
  }

  if (typeof alert.count === 'number' && Number.isFinite(alert.count)) {
    return alert.count;
  }

  if (typeof alert.count === 'string') {
    const parsed = Number.parseInt(alert.count, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function collectZapAlerts(
  source: string,
  report: unknown,
): ZapAlertSummary[] {
  const root = asObject(report) as ZapReportRecord | null;
  if (root === null || !Array.isArray(root.site)) {
    return [];
  }

  return root.site.flatMap((site) => {
    const siteRecord = asObject(site) as ZapSiteRecord | null;
    if (siteRecord === null || !Array.isArray(siteRecord.alerts)) {
      return [];
    }

    return siteRecord.alerts.flatMap((alert) => {
      const alertRecord = asObject(alert) as ZapAlertRecord | null;
      if (alertRecord === null) {
        return [];
      }

      return [
        {
          pluginId: String(alertRecord.pluginid ?? 'unknown'),
          name: alertRecord.name?.trim() || 'Unnamed alert',
          riskCode: normalizeRiskCode(alertRecord),
          riskDescription: alertRecord.riskdesc?.trim() || 'Informational',
          instances: normalizeInstances(alertRecord),
          source,
        } satisfies ZapAlertSummary,
      ];
    });
  });
}

export function collectHighRiskZapAlerts(
  source: string,
  report: unknown,
): ZapAlertSummary[] {
  return collectZapAlerts(source, report).filter(
    (alert) => alert.riskCode >= 3,
  );
}

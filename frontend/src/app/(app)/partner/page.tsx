'use client';

import * as React from 'react';
import { FlaskConical, KeyRound, Thermometer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage, requestAppJson } from '@/lib/app-api';

function buildLabPayload() {
  return JSON.stringify(
    {
      laneId: 'lane-db-1',
      issuer: 'Thai Lab Network',
      issuedAt: '2026-03-28T09:00:00.000Z',
      results: [
        {
          substance: 'Chlorpyrifos',
          value: 0.01,
          unit: 'mg/kg',
        },
      ],
    },
    null,
    2,
  );
}

function buildTemperaturePayload() {
  return JSON.stringify(
    {
      laneId: 'lane-db-1',
      issuer: 'Cold Chain Carrier',
      issuedAt: '2026-03-28T09:15:00.000Z',
      readings: [
        {
          timestamp: '2026-03-28T09:15:00.000Z',
          value: 11.6,
          unit: 'C',
          deviceId: 'logger-001',
        },
      ],
    },
    null,
    2,
  );
}

function renderJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function PartnerPortalPage() {
  const [apiKey, setApiKey] = React.useState('');
  const [validateResult, setValidateResult] = React.useState<unknown>(null);
  const [labPayload, setLabPayload] = React.useState(buildLabPayload);
  const [labResult, setLabResult] = React.useState<unknown>(null);
  const [temperaturePayload, setTemperaturePayload] = React.useState(
    buildTemperaturePayload,
  );
  const [temperatureResult, setTemperatureResult] = React.useState<unknown>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingAction, setLoadingAction] = React.useState<
    'validate' | 'lab' | 'temperature' | null
  >(null);

  function requireApiKey(): string | null {
    const trimmed = apiKey.trim();
    if (trimmed.length === 0) {
      setError('Partner API key is required.');
      return null;
    }

    return trimmed;
  }

  function parsePayload(text: string, label: string): unknown | null {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      setError(`${label} must be valid JSON.`);
      return null;
    }
  }

  async function handleValidateApiKey() {
    const trimmedApiKey = requireApiKey();
    if (trimmedApiKey === null) {
      return;
    }

    setLoadingAction('validate');
    setError(null);

    try {
      const result = await requestAppJson<unknown>('/api/partner/validate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ apiKey: trimmedApiKey }),
      });

      setValidateResult(result);
      setStatusMessage('Partner API key validated against the live backend.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to validate API key.'));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSubmitLabResults() {
    const trimmedApiKey = requireApiKey();
    if (trimmedApiKey === null) {
      return;
    }

    const payload = parsePayload(labPayload, 'Lab result payload');
    if (payload === null) {
      return;
    }

    setLoadingAction('lab');
    setError(null);

    try {
      const result = await requestAppJson<unknown>('/api/partner/lab-results', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ apiKey: trimmedApiKey, payload }),
      });

      setLabResult(result);
      setStatusMessage('Lab result payload submitted to the live partner API.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to submit lab results.'));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSubmitTemperatureBatch() {
    const trimmedApiKey = requireApiKey();
    if (trimmedApiKey === null) {
      return;
    }

    const payload = parsePayload(
      temperaturePayload,
      'Temperature batch payload',
    );
    if (payload === null) {
      return;
    }

    setLoadingAction('temperature');
    setError(null);

    try {
      const result = await requestAppJson<unknown>('/api/partner/temperature', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ apiKey: trimmedApiKey, payload }),
      });

      setTemperatureResult(result);
      setStatusMessage(
        'Temperature batch submitted to the live logistics partner API.',
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'Unable to submit temperature telemetry payload.',
        ),
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Partner Portal</h1>
        <p className="mt-1 text-muted-foreground">
          Live lab and logistics partner submissions backed by the real backend
          API routes.
        </p>
      </header>

      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            Partner API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="partner-api-key">API key</Label>
            <Input
              id="partner-api-key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="zrl_pk_live_..."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => void handleValidateApiKey()}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'validate' ? 'Validating...' : 'Validate API Key'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Uses the live <code>/auth/api-keys/validate</code> backend route.
            </p>
          </div>

          {validateResult !== null && (
            <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {renderJson(validateResult)}
            </pre>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="size-5" />
              Lab Results Submission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Posts directly to the real <code>/partner/lab/results</code>{' '}
              backend flow through a local authenticated proxy.
            </p>
            <div className="space-y-2">
              <Label htmlFor="lab-payload">Lab result payload</Label>
              <textarea
                id="lab-payload"
                className="min-h-64 w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                value={labPayload}
                onChange={(event) => setLabPayload(event.target.value)}
              />
            </div>
            <Button
              onClick={() => void handleSubmitLabResults()}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'lab' ? 'Submitting...' : 'Submit Lab Results'}
            </Button>
            {labResult !== null && (
              <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                {renderJson(labResult)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="size-5" />
              Logistics Temperature Batch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Posts directly to the real{' '}
              <code>/partner/logistics/temperature</code> backend flow through a
              local authenticated proxy.
            </p>
            <div className="space-y-2">
              <Label htmlFor="temperature-payload">Temperature payload</Label>
              <textarea
                id="temperature-payload"
                className="min-h-64 w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                value={temperaturePayload}
                onChange={(event) => setTemperaturePayload(event.target.value)}
              />
            </div>
            <Button
              onClick={() => void handleSubmitTemperatureBatch()}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'temperature'
                ? 'Submitting...'
                : 'Submit Temperature Batch'}
            </Button>
            {temperatureResult !== null && (
              <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                {renderJson(temperatureResult)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

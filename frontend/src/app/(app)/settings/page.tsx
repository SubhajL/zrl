'use client';

import * as React from 'react';
import {
  Bell,
  Download,
  Shield,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage, requestAppJson } from '@/lib/app-api';
import { loadSettingsPageData, type SettingsPageData } from '@/lib/settings-data';

type PrivacyRequestType =
  | 'ACCESS'
  | 'PORTABILITY'
  | 'DELETION'
  | 'WITHDRAW_CONSENT';

export default function SettingsPage() {
  const [data, setData] = React.useState<SettingsPageData | null>(null);
  const [lineUserId, setLineUserId] = React.useState('');
  const [pushEndpoint, setPushEndpoint] = React.useState('');
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    void loadSettingsPageData()
      .then((result) => {
        if (active) {
          setData(result);
          setLineUserId(result.channelTargets.lineUserId ?? '');
          setPushEndpoint(result.channelTargets.pushEndpoint ?? '');
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError, 'Unable to load settings.'));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function reloadData(message?: string) {
    const latest = await loadSettingsPageData();
    setData(latest);
    setLineUserId(latest.channelTargets.lineUserId ?? '');
    setPushEndpoint(latest.channelTargets.pushEndpoint ?? '');
    setStatusMessage(message ?? null);
    setError(null);
  }

  async function handleToggleConsent() {
    try {
      await requestAppJson('/api/zrl/users/me/consent', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          type: 'MARKETING_COMMUNICATIONS',
          granted: !(data?.consent.granted ?? false),
          source: 'frontend-settings',
        }),
      });
      await reloadData('Marketing consent updated.');
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to update consent.'));
    }
  }

  async function handleDataExport() {
    try {
      await requestAppJson('/api/zrl/users/me/data-export', {
        method: 'POST',
      });
      await reloadData('PDPA export requested. Download will be available from the backend export endpoint.');
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to request data export.'));
    }
  }

  async function handleCreatePrivacyRequest(type: PrivacyRequestType) {
    try {
      await requestAppJson('/api/zrl/users/me/privacy-requests', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          type,
          source: 'frontend-settings',
        }),
      });
      await reloadData(`${type} request submitted.`);
    } catch (submitError) {
      setError(
        getErrorMessage(submitError, `Unable to submit ${type} privacy request.`),
      );
    }
  }

  async function handleSaveChannelTargets() {
    try {
      await requestAppJson('/api/zrl/notifications/channel-targets', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          lineUserId: lineUserId.trim().length > 0 ? lineUserId.trim() : null,
          pushEndpoint:
            pushEndpoint.trim().length > 0 ? pushEndpoint.trim() : null,
        }),
      });
      await reloadData('Notification channel targets updated.');
    } catch (submitError) {
      setError(
        getErrorMessage(submitError, 'Unable to update notification targets.'),
      );
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Live account, privacy, and notification controls backed by the API
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-semibold">Company</p>
              <p className="text-muted-foreground">
                {data?.user.companyName ?? 'No company name on file'}
              </p>
            </div>
            <div>
              <p className="font-semibold">Email</p>
              <p className="text-muted-foreground">{data?.user.email ?? '--'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{data?.user.role ?? 'UNKNOWN'}</Badge>
              <Badge variant={data?.user.mfaEnabled ? 'success' : 'warning'}>
                {data?.user.mfaEnabled ? 'MFA Enabled' : 'MFA Not Enabled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5" />
              PDPA Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Marketing Consent</p>
                <p className="text-sm text-muted-foreground">
                  {data?.consent.granted ? 'Granted' : 'Withdrawn'}
                </p>
              </div>
              <Button onClick={() => void handleToggleConsent()}>
                {data?.consent.granted ? 'Withdraw Consent' : 'Enable Consent'}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => void handleDataExport()}
            >
              <Download className="size-4" />
              Request PDPA Export
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void handleCreatePrivacyRequest('ACCESS')}
              >
                Access Request
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleCreatePrivacyRequest('PORTABILITY')}
              >
                Portability Request
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleCreatePrivacyRequest('DELETION')}
              >
                Deletion Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(data?.preferences ?? []).map((preference) => (
            <div
              key={preference.type}
              className="rounded-lg border border-border p-4"
            >
              <p className="font-semibold">{preference.type}</p>
              <p className="text-sm text-muted-foreground">
                In-app: {preference.inAppEnabled ? 'on' : 'off'} | Email:{' '}
                {preference.emailEnabled ? 'on' : 'off'} | Push:{' '}
                {preference.pushEnabled ? 'on' : 'off'} | LINE:{' '}
                {preference.lineEnabled ? 'on' : 'off'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel Targets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="line-user-id">LINE User ID</Label>
            <Input
              id="line-user-id"
              value={lineUserId}
              onChange={(event) => setLineUserId(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="push-endpoint">Push Endpoint</Label>
            <Input
              id="push-endpoint"
              value={pushEndpoint}
              onChange={(event) => setPushEndpoint(event.target.value)}
            />
          </div>
          <div className="lg:col-span-2">
            <Button onClick={() => void handleSaveChannelTargets()}>
              Save Notification Targets
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy Request History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.requests ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No privacy requests submitted yet.
            </p>
          ) : (
            data?.requests.map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{request.type}</p>
                  <Badge variant="outline">{request.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Due: {new Date(request.dueAt).toISOString().slice(0, 10)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

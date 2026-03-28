import { requestAppJson } from './app-api';

export interface SettingsPageData {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly role: string;
    readonly companyName: string | null;
    readonly mfaEnabled: boolean;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  readonly consent: {
    readonly type: string;
    readonly granted: boolean;
    readonly source: string | null;
    readonly updatedAt: string | null;
  };
  readonly requests: Array<{
    readonly id: string;
    readonly type: string;
    readonly status: string;
    readonly dueAt: string;
    readonly createdAt: string;
    readonly completedAt: string | null;
  }>;
  readonly preferences: Array<{
    readonly type: string;
    readonly inAppEnabled: boolean;
    readonly emailEnabled: boolean;
    readonly pushEnabled: boolean;
    readonly lineEnabled: boolean;
  }>;
  readonly channelTargets: {
    readonly lineUserId: string | null;
    readonly pushEndpoint: string | null;
  };
}

interface CurrentProfileResponse {
  readonly user: SettingsPageData['user'];
  readonly consent: SettingsPageData['consent'];
  readonly requests: SettingsPageData['requests'];
}

export async function loadSettingsPageData(): Promise<SettingsPageData> {
  const [profile, preferences, channelTargets] = await Promise.all([
    requestAppJson<CurrentProfileResponse>('/api/zrl/users/me'),
    requestAppJson<{ preferences: SettingsPageData['preferences'] }>(
      '/api/zrl/notifications/preferences',
    ),
    requestAppJson<{ targets: SettingsPageData['channelTargets'] }>(
      '/api/zrl/notifications/channel-targets',
    ),
  ]);

  return {
    user: profile.user,
    consent: profile.consent,
    requests: profile.requests,
    preferences: preferences.preferences,
    channelTargets: channelTargets.targets,
  };
}

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './page';
import { loadSettingsPageData } from '@/lib/settings-data';

jest.mock('@/lib/settings-data', () => ({
  loadSettingsPageData: jest.fn(),
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('renders live account and privacy data', async () => {
    (loadSettingsPageData as jest.Mock).mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'exporter@zrl-dev.test',
        role: 'EXPORTER',
        companyName: 'Chachoengsao Mango Export Co.',
        mfaEnabled: false,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      },
      consent: {
        type: 'MARKETING_COMMUNICATIONS',
        granted: true,
        source: 'seed',
        updatedAt: '2026-03-28T00:00:00.000Z',
      },
      requests: [],
      preferences: [
        {
          type: 'PACK_GENERATED',
          inAppEnabled: true,
          emailEnabled: true,
          pushEnabled: false,
          lineEnabled: false,
        },
      ],
      channelTargets: {
        lineUserId: 'line-123',
        pushEndpoint: null,
      },
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Chachoengsao Mango Export Co.')).toBeInTheDocument();
      expect(screen.getByText('Granted')).toBeInTheDocument();
      expect(screen.getByDisplayValue('line-123')).toBeInTheDocument();
    });
  });

  it('submits a PDPA export request through the API', async () => {
    (loadSettingsPageData as jest.Mock).mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'exporter@zrl-dev.test',
        role: 'EXPORTER',
        companyName: 'Chachoengsao Mango Export Co.',
        mfaEnabled: false,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      },
      consent: {
        type: 'MARKETING_COMMUNICATIONS',
        granted: true,
        source: 'seed',
        updatedAt: '2026-03-28T00:00:00.000Z',
      },
      requests: [],
      preferences: [],
      channelTargets: {
        lineUserId: null,
        pushEndpoint: null,
      },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      headers: { get: () => 'application/json' },
    });

    const user = userEvent.setup();
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Request PDPA Export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Request PDPA Export' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zrl/users/me/data-export',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

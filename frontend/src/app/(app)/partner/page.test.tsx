import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PartnerPortalPage from './page';

describe('PartnerPortalPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      headers: { get: () => 'application/json' },
    });
  });

  it('validates the live partner API key through the local route', async () => {
    const user = userEvent.setup();

    render(<PartnerPortalPage />);

    await user.type(screen.getByLabelText('API key'), 'partner-key');
    await user.click(screen.getByRole('button', { name: 'Validate API Key' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner/validate',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(screen.getByText(/validated against the live backend/i)).toBeVisible();
    });
  });

  it('submits lab and temperature payloads through live local proxies', async () => {
    const user = userEvent.setup();

    render(<PartnerPortalPage />);

    await user.type(screen.getByLabelText('API key'), 'partner-key');
    await user.click(screen.getByRole('button', { name: 'Submit Lab Results' }));
    await user.click(
      screen.getByRole('button', { name: 'Submit Temperature Batch' }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner/lab-results',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/partner/temperature',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

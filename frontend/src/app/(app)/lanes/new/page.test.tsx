import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LaneCreationWizard from './page';

// Mock next/navigation (App Router)
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/lanes/new',
}));

describe('LaneCreationWizard', () => {
  async function advanceToRouteStep(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    await user.click(screen.getByTestId('market-card-JAPAN'));
    await user.click(screen.getByRole('button', { name: /next: route/i }));
  }

  async function advanceToReviewStepWithColdChain(
    user: ReturnType<typeof userEvent.setup>,
    {
      coldChainMode,
      deviceId,
      dataFrequencySeconds,
    }: {
      coldChainMode: 'Logger' | 'Telemetry';
      deviceId: string;
      dataFrequencySeconds: string;
    },
  ): Promise<void> {
    render(<LaneCreationWizard />);

    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.type(screen.getByLabelText(/variety/i), 'Nam Doc Mai');
    await user.type(screen.getByLabelText(/quantity/i), '5000');
    await user.type(screen.getByLabelText(/harvest date/i), '2026-03-28');
    await user.type(screen.getByLabelText(/origin province/i), 'Chachoengsao');
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    await user.click(screen.getByTestId('market-card-JAPAN'));
    await user.click(screen.getByRole('button', { name: /next: route/i }));
    await user.click(screen.getByRole('button', { name: coldChainMode }));
    await user.type(screen.getByLabelText(/carrier/i), 'Thai Airways Cargo');
    await user.type(screen.getByLabelText(/device id/i), deviceId);
    await user.type(
      screen.getByLabelText(/data frequency \(seconds\)/i),
      dataFrequencySeconds,
    );
    await user.click(screen.getByRole('button', { name: /next: review/i }));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders the stepper with 4 steps', () => {
    render(<LaneCreationWizard />);

    const nav = screen.getByRole('navigation', { name: /progress/i });
    expect(nav).toBeInTheDocument();

    // Check step labels are present (sr-only on mobile, visible on md+)
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Destination')).toBeInTheDocument();
    expect(screen.getByText('Route')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders the 4 product cards on step 0', () => {
    render(<LaneCreationWizard />);

    expect(screen.getByTestId('product-card-MANGO')).toBeInTheDocument();
    expect(screen.getByTestId('product-card-DURIAN')).toBeInTheDocument();
    expect(screen.getByTestId('product-card-MANGOSTEEN')).toBeInTheDocument();
    expect(screen.getByTestId('product-card-LONGAN')).toBeInTheDocument();
  });

  it('highlights a product card when clicked', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    const mangoCard = screen.getByTestId('product-card-MANGO');
    await user.click(mangoCard);

    // The selected card should have the primary border class
    expect(mangoCard.className).toContain('border-primary');
  });

  it('navigates from step 0 to step 1 and back', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    // Initially on step 0 — should see Product heading
    expect(screen.getByText('Select Product & Batch')).toBeInTheDocument();

    // Select a product first (required for Next to be enabled)
    await user.click(screen.getByTestId('product-card-MANGO'));

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /next: destination/i });
    await user.click(nextBtn);

    // Step 1 should show
    expect(screen.getByText('Select Destination Market')).toBeInTheDocument();
    expect(
      screen.queryByText('Select Product & Batch'),
    ).not.toBeInTheDocument();

    // Click Back
    const backBtn = screen.getByRole('button', { name: /back/i });
    await user.click(backBtn);

    // Step 0 should show again
    expect(screen.getByText('Select Product & Batch')).toBeInTheDocument();
  });

  it('navigates through all 4 steps', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    // Select product first
    await user.click(screen.getByTestId('product-card-MANGO'));

    // Step 0 → 1
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    expect(screen.getByText('Select Destination Market')).toBeInTheDocument();

    // Select market first
    await user.click(screen.getByTestId('market-card-JAPAN'));

    // Step 1 → 2
    await user.click(screen.getByRole('button', { name: /next: route/i }));
    expect(screen.getByText('Logistics Route')).toBeInTheDocument();

    // Step 2 → 3
    await user.click(screen.getByRole('button', { name: /next: review/i }));
    expect(screen.getByText('Review & Create')).toBeInTheDocument();

    // On the last step, "Create Lane" button should appear
    expect(
      screen.getByRole('button', { name: /create lane/i }),
    ).toBeInTheDocument();
  });

  it('renders market cards on step 1 with strictness badges', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    // Select product then navigate to step 1
    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );

    expect(screen.getByTestId('market-card-JAPAN')).toBeInTheDocument();
    expect(screen.getByTestId('market-card-CHINA')).toBeInTheDocument();
    expect(screen.getByTestId('market-card-KOREA')).toBeInTheDocument();
    expect(screen.getByTestId('market-card-EU')).toBeInTheDocument();

    expect(screen.getByText('Strictness: 10/10')).toBeInTheDocument();
  });

  it('shows evidence checklist when a market is selected', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    // Select product then navigate
    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    await user.click(screen.getByTestId('market-card-JAPAN'));

    expect(screen.getByText('Required Evidence Summary')).toBeInTheDocument();
    expect(screen.getByText('MRL Test (MAFF)')).toBeInTheDocument();
  });

  it('displays batch ID in read-only format on step 0', () => {
    render(<LaneCreationWizard />);

    const batchEl = screen.getByTestId('batch-id');
    expect(batchEl).toBeInTheDocument();
    // Default batch ID with no product/market selected
    expect(batchEl.textContent).toMatch(/XXX-XXX-\d{8}-001/);
  });

  it('renders grade selection buttons', () => {
    render(<LaneCreationWizard />);

    expect(screen.getByRole('button', { name: 'Premium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
  });

  it('renders transport and cold-chain options on step 2', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    // Select product, navigate, select market, navigate to step 2
    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    await user.click(screen.getByTestId('market-card-JAPAN'));
    await user.click(screen.getByRole('button', { name: /next: route/i }));

    expect(screen.getByRole('button', { name: 'Air' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sea' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Truck' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manual' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logger' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Telemetry' }),
    ).toBeInTheDocument();
  });

  it('shows device and frequency inputs for logger mode', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await advanceToRouteStep(user);
    await user.click(screen.getByRole('button', { name: 'Logger' }));

    expect(screen.getByLabelText(/device id/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/data frequency \(seconds\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/logger mode requires readings every 300 to 900 seconds/i),
    ).toBeInTheDocument();
  });

  it('shows device and frequency inputs for telemetry mode', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await advanceToRouteStep(user);
    await user.click(screen.getByRole('button', { name: 'Telemetry' }));

    expect(screen.getByLabelText(/device id/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/data frequency \(seconds\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/telemetry mode requires readings every 60 seconds or less/i),
    ).toBeInTheDocument();
  });

  it('hides device and frequency inputs for manual mode', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await advanceToRouteStep(user);

    expect(screen.queryByLabelText(/device id/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/data frequency \(seconds\)/i),
    ).not.toBeInTheDocument();
  });

  it('blocks next review when logger config is incomplete', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await advanceToRouteStep(user);
    await user.click(screen.getByRole('button', { name: 'Logger' }));

    const nextReviewButton = screen.getByRole('button', {
      name: /next: review/i,
    });
    expect(nextReviewButton).toBeDisabled();
    expect(
      screen.getByText(/device id is required for logger and telemetry modes/i),
    ).toBeInTheDocument();
  });

  it('blocks next review when telemetry frequency exceeds 60 seconds', async () => {
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await advanceToRouteStep(user);
    await user.click(screen.getByRole('button', { name: 'Telemetry' }));
    await user.type(screen.getByLabelText(/device id/i), 'telemetry-1');
    await user.type(
      screen.getByLabelText(/data frequency \(seconds\)/i),
      '120',
    );

    const nextReviewButton = screen.getByRole('button', {
      name: /next: review/i,
    });
    expect(nextReviewButton).toBeDisabled();
    expect(
      screen.getByText(/telemetry mode frequency must be 60 seconds or less/i),
    ).toBeInTheDocument();
  });

  it('includes cold-chain config details in the review summary', async () => {
    const user = userEvent.setup();

    await advanceToReviewStepWithColdChain(user, {
      coldChainMode: 'Logger',
      deviceId: 'logger-1',
      dataFrequencySeconds: '600',
    });

    expect(screen.getByTestId('lane-review-field-device-id')).toHaveTextContent(
      'logger-1',
    );
    expect(
      screen.getByTestId('lane-review-field-data-frequency-seconds'),
    ).toHaveTextContent('600 sec');
  });

  it('submits telemetry cold-chain config in the lane create payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        lane: {
          id: 'lane-db-telemetry-1',
        },
      }),
    });

    const user = userEvent.setup();

    await advanceToReviewStepWithColdChain(user, {
      coldChainMode: 'Telemetry',
      deviceId: 'telemetry-1',
      dataFrequencySeconds: '30',
    });
    await user.click(screen.getByRole('button', { name: /create lane/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/zrl/lanes',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(String(requestInit.body))).toEqual(
      expect.objectContaining({
        coldChainMode: 'TELEMETRY',
        coldChainConfig: {
          mode: 'TELEMETRY',
          deviceId: 'telemetry-1',
          dataFrequencySeconds: 30,
        },
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/lanes/lane-db-telemetry-1');
  });

  it('submits a real lane creation request and redirects to the lane detail page', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        lane: {
          id: 'lane-db-1',
        },
      }),
    });
    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.type(screen.getByLabelText(/variety/i), 'Nam Doc Mai');
    await user.type(screen.getByLabelText(/quantity/i), '5000');
    await user.type(screen.getByLabelText(/harvest date/i), '2026-03-28');
    await user.type(screen.getByLabelText(/origin province/i), 'Chachoengsao');
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    await user.click(screen.getByTestId('market-card-JAPAN'));
    await user.click(screen.getByRole('button', { name: /next: route/i }));
    await user.click(screen.getByRole('button', { name: /next: review/i }));
    await user.click(screen.getByRole('button', { name: /create lane/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/zrl/lanes',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/lanes/lane-db-1');
  });

  it('validates and imports the GAP certificate during lane creation when provided', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lookup: {
            provider: 'acfs',
            certificateNumber: 'GAP-100',
            valid: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lane: {
            id: 'lane-db-1',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artifact: {
            id: 'artifact-gap-1',
            artifactType: 'GAP_CERT',
          },
          valid: true,
        }),
      });

    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.type(screen.getByLabelText(/variety/i), 'Nam Doc Mai');
    await user.type(screen.getByLabelText(/quantity/i), '5000');
    await user.type(screen.getByLabelText(/harvest date/i), '2026-03-28');
    await user.type(screen.getByLabelText(/origin province/i), 'Chachoengsao');
    await user.type(screen.getByLabelText(/gap certificate/i), 'GAP-100');
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    await user.click(screen.getByTestId('market-card-JAPAN'));
    await user.click(screen.getByRole('button', { name: /next: route/i }));
    await user.click(screen.getByRole('button', { name: /next: review/i }));
    await user.click(screen.getByRole('button', { name: /create lane/i }));

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/api/zrl/integrations/certifications/acfs/GAP-100',
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/zrl/lanes',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      '/api/zrl/lanes/lane-db-1/integrations/certifications/acfs/import',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/lanes/lane-db-1');
  });

  it('blocks lane creation when GAP certificate validation fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'ACFS GAP certificate is invalid or expired.',
      }),
    });

    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.type(screen.getByLabelText(/quantity/i), '5000');
    await user.type(screen.getByLabelText(/harvest date/i), '2026-03-28');
    await user.type(screen.getByLabelText(/origin province/i), 'Chachoengsao');
    await user.type(screen.getByLabelText(/gap certificate/i), 'BAD-CERT');
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    await user.click(screen.getByTestId('market-card-JAPAN'));
    await user.click(screen.getByRole('button', { name: /next: route/i }));
    await user.click(screen.getByRole('button', { name: /next: review/i }));
    await user.click(screen.getByRole('button', { name: /create lane/i }));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/zrl/integrations/certifications/acfs/BAD-CERT',
      expect.any(Object),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'ACFS GAP certificate is invalid or expired.',
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to the created lane even when post-create GAP import fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lookup: {
            provider: 'acfs',
            certificateNumber: 'GAP-100',
            valid: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lane: {
            id: 'lane-db-1',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'Temporary ACFS import failure.',
        }),
      });

    const user = userEvent.setup();
    render(<LaneCreationWizard />);

    await user.click(screen.getByTestId('product-card-MANGO'));
    await user.type(screen.getByLabelText(/quantity/i), '5000');
    await user.type(screen.getByLabelText(/harvest date/i), '2026-03-28');
    await user.type(screen.getByLabelText(/origin province/i), 'Chachoengsao');
    await user.type(screen.getByLabelText(/gap certificate/i), 'GAP-100');
    await user.click(
      screen.getByRole('button', { name: /next: destination/i }),
    );
    await user.click(screen.getByTestId('market-card-JAPAN'));
    await user.click(screen.getByRole('button', { name: /next: route/i }));
    await user.click(screen.getByRole('button', { name: /next: review/i }));
    await user.click(screen.getByRole('button', { name: /create lane/i }));

    expect(mockPush).toHaveBeenCalledWith('/lanes/lane-db-1');
  });
});

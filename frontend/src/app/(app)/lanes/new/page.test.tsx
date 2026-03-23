import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LaneCreationWizard from './page';

// Mock next/navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/lanes/new',
}));

describe('LaneCreationWizard', () => {
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
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckpointCapture from './page';

// Mock next/navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/checkpoint/capture',
}));

describe('CheckpointCapture', () => {
  it('renders the lane info display', () => {
    render(<CheckpointCapture />);

    expect(screen.getByTestId('lane-info')).toHaveTextContent(
      /LN-2026-001.*Mango.*Japan/,
    );
    expect(screen.getByTestId('checkpoint-name')).toHaveTextContent(
      /CP2.*Truck.*Port/,
    );
  });

  it('renders the step progress indicator', () => {
    render(<CheckpointCapture />);

    expect(screen.getByText('1 of 5')).toBeInTheDocument();
    expect(screen.getByText('Lane Info')).toBeInTheDocument();
  });

  it('navigates to photo step and renders camera placeholder', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    // Navigate to Photo step
    await user.click(screen.getByRole('button', { name: /next: photo/i }));

    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    expect(screen.getByTestId('take-photo-btn')).toBeInTheDocument();
    expect(screen.getByText('No photo yet')).toBeInTheDocument();
  });

  it('marks photo as captured when take photo is clicked', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    await user.click(screen.getByTestId('take-photo-btn'));

    expect(screen.getByText('Photo captured')).toBeInTheDocument();
  });

  it('renders temperature input with default value', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    // Navigate to Temperature step (step 2)
    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    await user.click(
      screen.getByRole('button', { name: /next: temperature/i }),
    );

    const tempDisplay = screen.getByTestId('temperature-display');
    // Default is midpoint of mango optimal range: (10 + 13) / 2 = 11.5
    expect(tempDisplay).toHaveTextContent('11.5');
  });

  it('increments and decrements temperature', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    // Navigate to Temperature step
    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    await user.click(
      screen.getByRole('button', { name: /next: temperature/i }),
    );

    const incrementBtn = screen.getByTestId('temp-increment');
    const decrementBtn = screen.getByTestId('temp-decrement');
    const tempDisplay = screen.getByTestId('temperature-display');

    // Default is midpoint of optimal range (11.5 for mango)
    expect(tempDisplay).toHaveTextContent('11.5');

    // Increment
    await user.click(incrementBtn);
    expect(tempDisplay).toHaveTextContent('12.0');

    // Decrement twice
    await user.click(decrementBtn);
    await user.click(decrementBtn);
    expect(tempDisplay).toHaveTextContent('11.0');
  });

  it('shows within-range badge for default temperature', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    await user.click(
      screen.getByRole('button', { name: /next: temperature/i }),
    );

    const badge = screen.getByTestId('temp-range-badge');
    expect(badge).toHaveTextContent(/within range/i);
  });

  it('renders condition assessment buttons', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    // Navigate to Condition step (step 3)
    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    await user.click(
      screen.getByRole('button', { name: /next: temperature/i }),
    );
    await user.click(screen.getByRole('button', { name: /next: condition/i }));

    expect(screen.getByTestId('condition-good')).toHaveTextContent('Good');
    expect(screen.getByTestId('condition-minor')).toHaveTextContent(
      'Minor Issue',
    );
    expect(screen.getByTestId('condition-major')).toHaveTextContent(
      'Major Issue',
    );
  });

  it('renders notes textarea on condition step', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    // Navigate to Condition step
    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    await user.click(
      screen.getByRole('button', { name: /next: temperature/i }),
    );
    await user.click(screen.getByRole('button', { name: /next: condition/i }));

    expect(screen.getByTestId('condition-notes')).toBeInTheDocument();
  });

  it('shows submit button on review step', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    // Navigate to Review step (step 4)
    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    await user.click(
      screen.getByRole('button', { name: /next: temperature/i }),
    );
    await user.click(screen.getByRole('button', { name: /next: condition/i }));
    await user.click(screen.getByRole('button', { name: /next: review/i }));

    expect(
      screen.getByRole('button', { name: /submit checkpoint/i }),
    ).toBeInTheDocument();
  });

  it('disables back button on the first step', () => {
    render(<CheckpointCapture />);

    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeDisabled();
  });

  it('navigates back from step 1 to step 0', async () => {
    const user = userEvent.setup();
    render(<CheckpointCapture />);

    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    expect(screen.getByText('2 of 5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
  });
});

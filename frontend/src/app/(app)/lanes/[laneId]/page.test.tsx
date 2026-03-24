import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LaneDetailPage from './page';

describe('LaneDetailPage', () => {
  it('renders lane header with lane ID', () => {
    render(<LaneDetailPage />);
    expect(screen.getByText('LN-2026-001')).toBeInTheDocument();
  });

  it('renders tab navigation with 6 tabs', () => {
    render(<LaneDetailPage />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);

    expect(screen.getByRole('tab', { name: 'Evidence' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Checkpoints' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Temperature' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Proof Packs' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Audit Trail' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Dispute' })).toBeInTheDocument();
  });

  it('defaults to Evidence tab', () => {
    render(<LaneDetailPage />);
    const evidenceTab = screen.getByRole('tab', { name: 'Evidence' });
    expect(evidenceTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches tabs when clicked', async () => {
    const user = userEvent.setup();
    render(<LaneDetailPage />);

    const checkpointsTab = screen.getByRole('tab', { name: 'Checkpoints' });
    await user.click(checkpointsTab);

    expect(checkpointsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('renders lane status badge', () => {
    render(<LaneDetailPage />);
    expect(screen.getByText('Collecting')).toBeInTheDocument();
  });

  it('renders completeness progress bar', () => {
    render(<LaneDetailPage />);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('renders product and destination info', () => {
    render(<LaneDetailPage />);
    expect(screen.getByText(/Mango/)).toBeInTheDocument();
    expect(screen.getByText(/Japan/)).toBeInTheDocument();
  });
});

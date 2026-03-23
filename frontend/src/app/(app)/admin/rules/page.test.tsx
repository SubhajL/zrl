import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesAdminPage from './page';

describe('RulesAdminPage', () => {
  it('renders the market selector with all 4 markets', () => {
    render(<RulesAdminPage />);
    expect(screen.getByText('Markets')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Japan market')).toBeInTheDocument();
    expect(screen.getByLabelText('Select China market')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Korea market')).toBeInTheDocument();
    expect(screen.getByLabelText('Select EU market')).toBeInTheDocument();
  });

  it('renders the substance table with mock data', () => {
    render(<RulesAdminPage />);
    expect(screen.getByText('Chlorpyrifos')).toBeInTheDocument();
    expect(screen.getByText('Dithiocarbamates')).toBeInTheDocument();
    expect(screen.getByText('Carbendazim')).toBeInTheDocument();
    expect(screen.getByText('Cypermethrin')).toBeInTheDocument();
    expect(screen.getByText('Imidacloprid')).toBeInTheDocument();
    expect(screen.getByText('Metalaxyl')).toBeInTheDocument();
  });

  it('renders the search bar', () => {
    render(<RulesAdminPage />);
    expect(
      screen.getByPlaceholderText('Search substances...'),
    ).toBeInTheDocument();
  });

  it('renders filter chips for all risk levels', () => {
    render(<RulesAdminPage />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Critical' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument();
  });

  it('filters substances when a risk level chip is clicked', async () => {
    const user = userEvent.setup();
    render(<RulesAdminPage />);

    await user.click(screen.getByRole('button', { name: 'Critical' }));

    // Critical substances should be visible
    expect(screen.getByText('Chlorpyrifos')).toBeInTheDocument();
    expect(screen.getByText('Dithiocarbamates')).toBeInTheDocument();

    // Non-critical substances should be hidden
    expect(screen.queryByText('Carbendazim')).not.toBeInTheDocument();
    expect(screen.queryByText('Metalaxyl')).not.toBeInTheDocument();
  });

  it('filters substances by search query', async () => {
    const user = userEvent.setup();
    render(<RulesAdminPage />);

    await user.type(
      screen.getByPlaceholderText('Search substances...'),
      'Chlor',
    );

    expect(screen.getByText('Chlorpyrifos')).toBeInTheDocument();
    expect(screen.queryByText('Carbendazim')).not.toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<RulesAdminPage />);
    expect(
      screen.getByRole('button', { name: /Add Substance/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Import CSV/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
  });

  it('renders version history section', () => {
    render(<RulesAdminPage />);
    expect(screen.getByText('Version History')).toBeInTheDocument();
    expect(screen.getByText('Added 15 new substances')).toBeInTheDocument();
    expect(screen.getByText('Updated Chlorpyrifos limit')).toBeInTheDocument();
    expect(
      screen.getByText('Major revision: 50 substances'),
    ).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('renders the page header with Japan selected by default', () => {
    render(<RulesAdminPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Japan.*MRL Rules v3\.2/,
    );
  });
});

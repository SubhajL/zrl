import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './page';

describe('SettingsPage', () => {
  it('renders the settings sidebar with all navigation items', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Data Export')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });

  it('renders the profile form with page title', () => {
    render(<SettingsPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Profile Settings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Manage your company and contact information'),
    ).toBeInTheDocument();
  });

  it('renders company name input with default value', () => {
    render(<SettingsPage />);
    const companyInput = screen.getByLabelText('Company Name');
    expect(companyInput).toBeInTheDocument();
    expect(companyInput).toHaveValue('Thai Tropical Exports Co., Ltd.');
  });

  it('renders all three form cards', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Company Information')).toBeInTheDocument();
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByText('Export Profile')).toBeInTheDocument();
    expect(screen.getByText('PDPA Privacy Controls')).toBeInTheDocument();
  });

  it('renders contact information fields', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('Full Name')).toHaveValue('Somchai Prasert');
    expect(screen.getByLabelText('Email')).toHaveValue('somchai@tte.co.th');
    expect(screen.getByLabelText('Phone')).toHaveValue('+66 81 234 5678');
    expect(screen.getByLabelText('Language')).toHaveValue('English');
  });

  it('renders verified badge on email', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders export profile with product and market pills', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Mango')).toBeInTheDocument();
    expect(screen.getByText('Durian')).toBeInTheDocument();
    expect(screen.getByText('Japan')).toBeInTheDocument();
    expect(screen.getByText('China')).toBeInTheDocument();
  });

  it('removes a product pill when X is clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByLabelText('Remove Mango'));

    expect(screen.queryByText('Mango')).not.toBeInTheDocument();
    expect(screen.getByText('Durian')).toBeInTheDocument();
  });

  it('renders save and discard buttons', () => {
    render(<SettingsPage />);
    expect(
      screen.getByRole('button', { name: 'Save Changes' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('renders annual volume input with tons suffix', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('Annual Volume')).toHaveValue('500');
    expect(screen.getByText('tons')).toBeInTheDocument();
  });

  it('toggles marketing consent from opt-in to opt-out', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(screen.getByText('Marketing Opt-In')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Withdraw Consent' }));

    expect(screen.getByText('Marketing Opt-Out')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Enable Marketing Updates' }),
    ).toBeInTheDocument();
  });

  it('updates export status when the PDPA export button is clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(
      screen.getByRole('button', { name: 'Request PDPA Export' }),
    );

    expect(
      screen.getByText(
        'Export requested. JSON and CSV ZIP ready in ~2 minutes.',
      ),
    ).toBeInTheDocument();
  });
});

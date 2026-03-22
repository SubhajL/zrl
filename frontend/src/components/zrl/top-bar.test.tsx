import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { TopBar } from './top-bar';

describe('TopBar', () => {
  it('renders ZRL logo text', () => {
    render(<TopBar />);
    expect(screen.getByText('ZRL')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<TopBar title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders action slot content', () => {
    render(
      <TopBar actions={<button type="button">Profile</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
  });

  it('renders notification bell icon', () => {
    render(<TopBar />);
    expect(
      screen.getByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument();
  });
});

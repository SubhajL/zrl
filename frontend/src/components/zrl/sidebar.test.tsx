import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Sidebar, type NavItem } from './sidebar';

const items: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <span data-testid="icon-dashboard">D</span> },
  { label: 'Lanes', href: '/lanes', icon: <span data-testid="icon-lanes">L</span> },
  { label: 'Settings', href: '/settings', icon: <span data-testid="icon-settings">S</span> },
];

describe('Sidebar', () => {
  it('renders navigation items', () => {
    render(<Sidebar items={items} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Lanes')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights active item', () => {
    render(<Sidebar items={items} activeHref="/lanes" />);
    const lanesLink = screen.getByText('Lanes').closest('a');
    expect(lanesLink).toHaveAttribute('aria-current', 'page');
    expect(lanesLink).toHaveClass('bg-primary/10');
    expect(lanesLink).toHaveClass('text-primary');

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).not.toHaveAttribute('aria-current');
  });

  it('renders item icons', () => {
    render(<Sidebar items={items} />);
    expect(screen.getByTestId('icon-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('icon-lanes')).toBeInTheDocument();
  });
});

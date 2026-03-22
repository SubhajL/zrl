import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders default variant', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-primary');
  });

  it('renders success variant with correct colors', () => {
    render(<Badge variant="success">Passed</Badge>);
    const badge = screen.getByText('Passed');
    expect(badge).toHaveClass('bg-emerald-100');
    expect(badge).toHaveClass('text-emerald-700');
    expect(badge).toHaveClass('border-emerald-200');
  });

  it('renders warning variant with correct colors', () => {
    render(<Badge variant="warning">Attention</Badge>);
    const badge = screen.getByText('Attention');
    expect(badge).toHaveClass('bg-amber-100');
    expect(badge).toHaveClass('text-amber-700');
    expect(badge).toHaveClass('border-amber-200');
  });

  it('renders info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-blue-100');
    expect(badge).toHaveClass('text-blue-700');
  });

  it('renders destructive variant', () => {
    render(<Badge variant="destructive">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge).toHaveClass('bg-destructive');
  });

  it('applies custom className', () => {
    render(<Badge className="extra-style">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('extra-style');
  });
});

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusDot } from './status-dot';

describe('StatusDot', () => {
  it('renders success status with emerald color', () => {
    const { container } = render(<StatusDot status="success" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toHaveClass('bg-emerald-500');
  });

  it('renders warning status with amber color', () => {
    const { container } = render(<StatusDot status="warning" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toHaveClass('bg-amber-500');
  });

  it('renders error status with red color', () => {
    const { container } = render(<StatusDot status="error" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toHaveClass('bg-red-500');
  });

  it('renders neutral status with slate color', () => {
    const { container } = render(<StatusDot status="neutral" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toHaveClass('bg-slate-400');
  });

  it('includes screen reader text for status', () => {
    render(<StatusDot status="success" />);
    expect(screen.getByText('success')).toBeInTheDocument();
  });

  it('applies pulse animation when pulse prop is true', () => {
    const { container } = render(<StatusDot status="success" pulse />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toHaveClass('animate-pulse');
  });
});

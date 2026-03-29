import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders with animate-pulse class', () => {
    render(<Skeleton data-testid="skeleton" />);
    const el = screen.getByTestId('skeleton');
    expect(el).toHaveClass('animate-pulse');
    expect(el).toHaveClass('rounded-md');
    expect(el).toHaveClass('bg-muted');
  });

  it('applies custom className', () => {
    render(<Skeleton data-testid="skeleton" className="h-8 w-20" />);
    const el = screen.getByTestId('skeleton');
    expect(el).toHaveClass('animate-pulse');
    expect(el).toHaveClass('h-8');
    expect(el).toHaveClass('w-20');
  });
});

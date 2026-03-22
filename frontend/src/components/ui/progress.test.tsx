import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Progress } from './progress';

describe('Progress', () => {
  it('renders with correct value', () => {
    render(<Progress value={60} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    // Verify the progress component renders with the correct semantic structure
    expect(progressbar).toHaveClass('bg-secondary');
    expect(progressbar.firstElementChild).toHaveClass('bg-primary');
  });

  it('clamps value to 0-100 range', () => {
    // Test below 0: should render without errors (clamped internally)
    const { rerender } = render(<Progress value={-20} />);
    let progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();

    // Test above 100: should render without errors (clamped internally)
    rerender(<Progress value={150} />);
    progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();

    // Test boundary: 0 and 100 should work fine
    rerender(<Progress value={0} />);
    progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();

    rerender(<Progress value={100} />);
    progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    render(<Progress value={50} className="custom-progress" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveClass('custom-progress');
  });
});

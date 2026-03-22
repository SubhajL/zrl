import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('renders label and percentage', () => {
    render(<ProgressBar value={75} label="Completeness" showPercentage />);
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('clamps value to valid range', () => {
    const { rerender } = render(
      <ProgressBar value={-10} label="Test" showPercentage />,
    );
    expect(screen.getByText('0%')).toBeInTheDocument();

    rerender(<ProgressBar value={150} label="Test" showPercentage />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('hides percentage when showPercentage is false', () => {
    render(<ProgressBar value={75} label="Test" showPercentage={false} />);
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('applies tint variant', () => {
    render(<ProgressBar value={50} label="Test" tint="success" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveClass('[&>div]:bg-emerald-500');
  });
});

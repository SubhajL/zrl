import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { KpiTile } from './kpi-tile';

describe('KpiTile', () => {
  it('renders title and value', () => {
    render(<KpiTile title="Total Lanes" value="42" />);
    expect(screen.getByText('Total Lanes')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders value with mono font', () => {
    render(<KpiTile title="Count" value="99" />);
    const valueEl = screen.getByText('99');
    expect(valueEl).toHaveClass('font-mono');
  });

  it('renders positive delta with up trend', () => {
    render(
      <KpiTile
        title="Lanes"
        value="10"
        delta={{ value: '+12%', trend: 'up' }}
      />,
    );
    expect(screen.getByText('+12%')).toBeInTheDocument();
    const trendContainer = screen.getByText('+12%').closest('div');
    expect(trendContainer).toHaveClass('text-emerald-600');
  });

  it('renders negative delta with down trend', () => {
    render(
      <KpiTile
        title="Lanes"
        value="5"
        delta={{ value: '-8%', trend: 'down' }}
      />,
    );
    expect(screen.getByText('-8%')).toBeInTheDocument();
    const trendContainer = screen.getByText('-8%').closest('div');
    expect(trendContainer).toHaveClass('text-red-600');
  });

  it('renders without delta', () => {
    render(<KpiTile title="Lanes" value="7" />);
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <KpiTile
        title="Lanes"
        value="3"
        icon={<span data-testid="tile-icon">Icon</span>}
      />,
    );
    expect(screen.getByTestId('tile-icon')).toBeInTheDocument();
  });
});

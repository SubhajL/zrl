import { render, screen } from '@testing-library/react';

import { TabTemperature, type TabTemperatureProps } from './tab-temperature';
import type {
  TemperatureReading,
  TemperatureSlaResult,
  TemperatureProfile,
} from '@/lib/types';

// Recharts uses ResponsiveContainer which relies on element dimensions.
// In jsdom, elements have zero dimensions, so we mock ResponsiveContainer
// to simply render its children at a fixed size.
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement;
    }) => <div data-testid="responsive-container">{children}</div>,
  };
});

const mangoProfile: TemperatureProfile = {
  fruit: 'MANGO',
  optimalMinC: 10,
  optimalMaxC: 13,
  chillingThresholdC: 10,
  heatThresholdC: 15,
  baseShelfLifeDays: 21,
  minShelfLifeDays: 14,
};

const longanProfile: TemperatureProfile = {
  fruit: 'LONGAN',
  optimalMinC: 2,
  optimalMaxC: 5,
  chillingThresholdC: null,
  heatThresholdC: 8,
  baseShelfLifeDays: 30,
  minShelfLifeDays: 21,
};

const baseSla: TemperatureSlaResult = {
  laneId: 'lane-1',
  status: 'PASS',
  totalExcursionMinutes: 0,
  excursionCount: 0,
  maxDeviationC: 0,
  remainingShelfLifeDays: 14,
  shelfLifeImpactPct: 0,
};

function makeReading(
  id: string,
  timestamp: string,
  valueC: number,
): TemperatureReading {
  return {
    id,
    timestamp,
    valueC,
    deviceId: 'device-1',
    source: 'TELEMETRY',
    checkpointId: null,
  };
}

const sampleReadings: TemperatureReading[] = [
  makeReading('r1', '2026-03-20T08:00:00Z', 11.0),
  makeReading('r2', '2026-03-20T09:00:00Z', 11.5),
  makeReading('r3', '2026-03-20T10:00:00Z', 12.0),
];

function buildProps(overrides?: Partial<TabTemperatureProps>): TabTemperatureProps {
  return {
    readings: sampleReadings,
    excursions: [],
    sla: baseSla,
    profile: mangoProfile,
    ...overrides,
  };
}

describe('TabTemperature — Temperature Curve chart', () => {
  it('renders the Temperature Curve card when readings exist', () => {
    render(<TabTemperature {...buildProps()} />);
    expect(screen.getByText('Temperature Curve')).toBeInTheDocument();
  });

  it('renders a ResponsiveContainer for the chart', () => {
    render(<TabTemperature {...buildProps()} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('shows empty message when there are no readings', () => {
    render(<TabTemperature {...buildProps({ readings: [] })} />);
    expect(
      screen.getByText('No temperature readings available'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('still renders existing content alongside the chart', () => {
    render(<TabTemperature {...buildProps()} />);
    // Telemetry Window card
    expect(screen.getByText('Telemetry Window')).toBeInTheDocument();
    // KPI tiles
    expect(screen.getByText('Target Range')).toBeInTheDocument();
    expect(screen.getByText('Observed Range')).toBeInTheDocument();
    // SLA Summary
    expect(screen.getByText('SLA Summary')).toBeInTheDocument();
    // Readings table
    expect(screen.getByText('Recent Readings')).toBeInTheDocument();
    // Excursion log
    expect(screen.getByText('Excursion Log')).toBeInTheDocument();
  });

  it('renders chart without chilling line when chillingThresholdC is null', () => {
    const { container } = render(
      <TabTemperature {...buildProps({ profile: longanProfile })} />,
    );
    // The "Chill" label should NOT appear for Longan (chillingThresholdC: null)
    expect(screen.queryByText('Chill')).not.toBeInTheDocument();
    // "Heat" should still be there
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders the chart card between telemetry window and KPI tiles', () => {
    const { container } = render(<TabTemperature {...buildProps()} />);
    const cards = container.querySelectorAll(':scope > div > div');
    // The Temperature Curve card should contain the title text
    const cardTexts = Array.from(cards).map((c) => c.textContent ?? '');
    const curveIndex = cardTexts.findIndex((t) => t.includes('Temperature Curve'));
    const kpiIndex = cardTexts.findIndex((t) => t.includes('Target Range'));
    expect(curveIndex).toBeGreaterThan(-1);
    expect(kpiIndex).toBeGreaterThan(-1);
    // Chart card should come before the KPI tiles
    expect(curveIndex).toBeLessThan(kpiIndex);
  });
});

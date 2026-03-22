import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Stepper } from './stepper';

const steps = [
  { label: 'Select Market' },
  { label: 'Add Evidence' },
  { label: 'Review' },
  { label: 'Submit' },
];

describe('Stepper', () => {
  it('renders all step labels', () => {
    render(<Stepper steps={steps} currentStep={0} />);
    for (const step of steps) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
  });

  it('marks current step with aria-current', () => {
    const { container } = render(<Stepper steps={steps} currentStep={1} />);
    const currentMarker = container.querySelector('[aria-current="step"]');
    expect(currentMarker).toBeInTheDocument();
  });

  it('renders completed steps with check icon', () => {
    const { container } = render(<Stepper steps={steps} currentStep={2} />);
    // Steps 0 and 1 are completed (index < currentStep)
    // Check icons have aria-hidden="true" in completed step circles
    const checkIcons = container.querySelectorAll('[aria-hidden="true"]');
    // At least 2 check icons for completed steps (plus connector lines which also have aria-hidden)
    const svgIcons = Array.from(checkIcons).filter(
      (el) => el.tagName.toLowerCase() === 'svg',
    );
    expect(svgIcons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders upcoming steps with step number', () => {
    render(<Stepper steps={steps} currentStep={1} />);
    // Steps 2 and 3 are upcoming and should show numbers 3 and 4
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('does not mark non-current steps with aria-current', () => {
    const { container } = render(<Stepper steps={steps} currentStep={1} />);
    const currentMarkers = container.querySelectorAll('[aria-current="step"]');
    // Only one element should have aria-current="step"
    expect(currentMarkers).toHaveLength(1);
  });
});

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface StepperStep {
  readonly label: string;
  readonly description?: string;
}

export interface StepperProps {
  readonly steps: readonly StepperStep[];
  readonly currentStep: number;
  readonly className?: string;
}

type StepState = 'completed' | 'current' | 'upcoming';

function getStepState(index: number, currentStep: number): StepState {
  if (index < currentStep) return 'completed';
  if (index === currentStep) return 'current';
  return 'upcoming';
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const state = getStepState(index, currentStep);
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.label}
              className={cn(
                'flex items-center',
                !isLast && 'flex-1',
              )}
            >
              <div className="flex flex-col items-center gap-2">
                {/* Step circle */}
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    state === 'completed' &&
                      'bg-primary text-primary-foreground',
                    state === 'current' &&
                      'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background',
                    state === 'upcoming' &&
                      'border-2 border-muted text-muted-foreground',
                  )}
                  {...(state === 'current'
                    ? { 'aria-current': 'step' as const }
                    : {})}
                >
                  {state === 'completed' ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Label */}
                <div className="text-center">
                  <span
                    className={cn(
                      'text-xs font-medium sr-only md:not-sr-only',
                      state === 'completed' && 'text-primary',
                      state === 'current' && 'text-primary',
                      state === 'upcoming' && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                  {step.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground sr-only md:not-sr-only">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1',
                    index < currentStep
                      ? 'bg-primary'
                      : 'bg-muted',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

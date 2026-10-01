'use client';

import React from 'react';
import { Check, AlertCircle } from 'lucide-react';

type StepStatus = 'pending' | 'active' | 'complete' | 'error';

interface Step {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
}

interface StepperProps {
  steps: Step[];
  currentStep?: number;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const statusStyles: Record<StepStatus, { circle: string; label: string }> = {
  pending: {
    circle: 'bg-[var(--background-tertiary)] text-[var(--foreground-secondary)]',
    label: 'text-[var(--foreground-secondary)]',
  },
  active: {
    circle: 'bg-brand text-[var(--lw-on-forest)] animate-pulse',
    label: 'text-[var(--primary-ink)] font-semibold',
  },
  /*
   * The LABELS move to the inks, the CIRCLES do not, and the split is measured
   * rather than stylistic. `text-success-600` is 2.92:1 on the page ground as
   * 14px bold text, which is not large text and so needs 4.5:1 - a live AA
   * failure; `text-error-600` was 4.28:1, also short. The inks are 6.33:1 and
   * 5.74:1. The circles are filled graphics holding a 24px icon, so the 3:1 bar
   * applies and white on them (3.30:1 and 4.83:1) already clears it - repainting
   * them would be a visual change with no correctness payoff.
   *
   * The connector line between two complete steps DOES move: it is a 2px
   * graphic on `--background-tertiary` at 2.55:1, under the same 3:1 bar.
   */
  complete: {
    circle: 'bg-success-600 text-white',
    label: 'text-[var(--success-ink)] font-semibold',
  },
  error: {
    circle: 'bg-error-600 text-white',
    label: 'text-[var(--error-ink)] font-semibold',
  },
};

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  orientation = 'horizontal',
  className,
}) => {
  return (
    <div
      className={`${
        orientation === 'horizontal' ? 'flex items-start gap-4' : 'space-y-6'
      } ${className || ''}`}
    >
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`flex ${orientation === 'horizontal' ? 'flex-col flex-1' : 'flex-row gap-4'}`}
        >
          <div className="flex items-start gap-3">
            {/* Step Circle */}
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all ${
                statusStyles[step.status].circle
              }`}
            >
              {step.status === 'complete' ? (
                <Check className="w-6 h-6" />
              ) : step.status === 'error' ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            {orientation === 'horizontal' && index < steps.length - 1 && (
              <div
                className={`absolute top-5 left-0 w-12 h-0.5 transform translate-x-10 ${
                  step.status === 'complete'
                    ? 'bg-[var(--success-ink)]'
                    : 'bg-[var(--background-tertiary)]'
                }`}
              />
            )}
          </div>

          {/* Step Content */}
          <div className={orientation === 'vertical' ? 'flex-1' : ''}>
            <p className={`text-sm font-semibold ${statusStyles[step.status].label}`}>
              {step.label}
            </p>
            {step.description && (
              <p className="text-xs text-[var(--foreground-secondary)] mt-1">
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

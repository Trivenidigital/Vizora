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
    circle: 'bg-primary-600 dark:bg-primary-400 text-white animate-pulse',
    label: 'text-primary-600 dark:text-primary-400 font-semibold',
  },
  complete: {
    circle: 'bg-success-600 dark:bg-success-500 text-white',
    label: 'text-success-600 dark:text-success-500 font-semibold',
  },
  error: {
    circle: 'bg-error-600 dark:bg-error-500 text-white',
    label: 'text-error-600 dark:text-error-500 font-semibold',
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
                    ? 'bg-success-600 dark:bg-success-500'
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

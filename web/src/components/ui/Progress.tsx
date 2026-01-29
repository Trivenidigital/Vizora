'use client';

import React from 'react';

type ProgressVariant = 'primary' | 'success' | 'warning' | 'error' | 'info';
type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressProps {
  value: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  showLabel?: boolean;
  animated?: boolean;
  striped?: boolean;
  className?: string;
}

const variantStyles: Record<ProgressVariant, string> = {
  primary: 'bg-primary-600 dark:bg-primary-400',
  success: 'bg-success-600 dark:bg-success-500',
  warning: 'bg-warning-600 dark:bg-warning-400',
  error: 'bg-error-600 dark:bg-error-500',
  info: 'bg-info-600 dark:bg-info-400',
};

const sizeStyles: Record<ProgressSize, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  animated = false,
  striped = false,
  className,
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={className}>
      <div
        className={`w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden ${sizeStyles[size]}`}
      >
        <div
          className={`${sizeStyles[size]} ${variantStyles[variant]} transition-all duration-500 ${
            animated ? 'animate-pulse' : ''
          } ${striped ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:20px_100%] animate-none' : ''}`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
      {showLabel && (
        <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {percentage.toFixed(0)}%
        </p>
      )}
    </div>
  );
};

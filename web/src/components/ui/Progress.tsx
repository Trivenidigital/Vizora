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

/*
 * The INKS, not the `-600` fills, and that is a correctness fix rather than a
 * palette preference. The filled portion of a progress bar is a meaningful
 * graphic, so WCAG 1.4.11 asks 3:1 against the track it sits in - and the track
 * is `--background-tertiary`. Measured there, three of the four failed:
 * success-600 2.55:1, warning-600 2.47:1, info-600 2.66:1; only error-600
 * (3.74:1) and `bg-brand` (8.66:1) cleared. The inks clear comfortably:
 * success 5.53:1, warning 5.49:1, error 5.01:1, info 4.51:1.
 *
 * None of this was visible to the colour-debt ratchet - its regex lists the
 * Tailwind hue families and not `success|warning|error|info`, so these classes
 * are uncounted either way. The dark-variant partners went with the dark theme.
 */
const variantStyles: Record<ProgressVariant, string> = {
  primary: 'bg-brand',
  success: 'bg-[var(--success-ink)]',
  warning: 'bg-[var(--warning-ink)]',
  error: 'bg-[var(--error-ink)]',
  info: 'bg-[var(--info-ink)]',
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
        className={`w-full bg-[var(--background-tertiary)] rounded-full overflow-hidden ${sizeStyles[size]}`}
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
        <p className="mt-2 text-sm font-medium text-[var(--foreground-secondary)]">
          {percentage.toFixed(0)}%
        </p>
      )}
    </div>
  );
};

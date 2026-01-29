'use client';

import React from 'react';
import { X } from 'lucide-react';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-100 border border-primary-300 dark:border-primary-700',
  success: 'bg-success-100 dark:bg-success-900 text-success-800 dark:text-success-100 border border-success-300 dark:border-success-700',
  warning: 'bg-warning-100 dark:bg-warning-900 text-warning-800 dark:text-warning-100 border border-warning-300 dark:border-warning-700',
  error: 'bg-error-100 dark:bg-error-900 text-error-800 dark:text-error-100 border border-error-300 dark:border-error-700',
  info: 'bg-info-100 dark:bg-info-900 text-info-800 dark:text-info-100 border border-info-300 dark:border-info-700',
  neutral: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  dismissible = false,
  onDismiss,
  className,
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full font-medium transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`}
    >
      {children}
      {dismissible && (
        <button
          onClick={onDismiss}
          className="ml-1 inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Dismiss badge"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

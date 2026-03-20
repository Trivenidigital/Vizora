'use client';

import React from 'react';
import { X } from 'lucide-react';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'amber';
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
  primary: 'eh-badge-success',
  success: 'eh-badge-success',
  warning: 'eh-badge-warning',
  error: 'eh-badge-error',
  info: 'eh-badge-info',
  neutral: 'eh-badge-neutral',
  amber: 'eh-badge-warning',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: '',
  lg: 'px-3.5 py-1.5 text-sm',
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
      className={`eh-badge ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`}
    >
      {children}
      {dismissible && (
        <button
          onClick={onDismiss}
          className="ml-0.5 inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Dismiss badge"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

'use client';

import { ButtonHTMLAttributes } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'eh-btn-sm',
    md: '',
    lg: 'eh-btn-lg',
  };

  const variantClasses = {
    primary: 'eh-btn-neon',
    secondary: 'bg-[var(--background-tertiary)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all duration-150',
    danger: 'eh-btn-danger',
    ghost: 'eh-btn-ghost',
  };

  const basePadding = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${basePadding[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
}

import React from 'react';
import { Icon, IconName, IconSize } from '@/theme/icons';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  title?: string;
  iconSize?: IconSize;
  isLoading?: boolean;
}

const sizeStyles = {
  sm: 'p-2 text-sm',
  md: 'p-3 text-base',
  lg: 'p-4 text-lg',
} as const;

const variantStyles = {
  primary: 'text-[#00E5A0] hover:text-[#00CC8E] hover:bg-[#00E5A0]/10',
  secondary: 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]',
  danger: 'text-red-600 hover:text-red-800 hover:bg-red-50',
  success: 'text-green-600 hover:text-green-800 hover:bg-green-50',
  warning: 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50',
} as const;

export function IconButton({
  icon,
  size = 'md',
  variant = 'secondary',
  title,
  iconSize = 'md',
  isLoading = false,
  className = '',
  disabled = false,
  ...props
}: IconButtonProps) {
  return (
    <button
      title={title}
      aria-label={title || `${icon} button`}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center
        rounded-lg transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-2 focus:outline-offset-2 focus:outline-[#00E5A0]
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <div className="animate-spin">
          <Icon name="power" size={iconSize} />
        </div>
      ) : (
        <Icon name={icon} size={iconSize} />
      )}
    </button>
  );
}

interface IconButtonWithLabelProps extends Omit<IconButtonProps, 'icon'> {
  icon: IconName;
  label?: string;
  labelPosition?: 'left' | 'right';
}

export function IconButtonWithLabel({
  icon,
  label,
  labelPosition = 'right',
  size = 'md',
  variant = 'secondary',
  iconSize = 'md',
  className = '',
  ...props
}: IconButtonWithLabelProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2 rounded-lg transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {labelPosition === 'left' && label && <span>{label}</span>}
      <Icon name={icon} size={iconSize} />
      {labelPosition === 'right' && label && <span>{label}</span>}
    </button>
  );
}

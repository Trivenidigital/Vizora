'use client';

import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'minimal';
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  if (variant === 'minimal') {
    return (
      <div className="eh-empty-state py-12 animate-[fadeIn_0.3s_ease-out]">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center mb-4">
          <Icon name={icon} size="xl" className="text-[var(--foreground-tertiary)]" />
        </div>
        <h3 className="eh-dash-subtitle text-base mb-1">{title}</h3>
        <p className="text-sm text-[var(--foreground-secondary)] text-center max-w-sm">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-5 px-5 py-2.5 eh-btn-neon eh-btn-sm rounded-xl"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="eh-empty-state eh-dash-card py-16 px-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="w-14 h-14 bg-[rgba(0,229,160,0.08)] rounded-2xl flex items-center justify-center mb-5">
        <Icon name={icon} size="2xl" className="text-[var(--primary)]" />
      </div>
      <h3 className="eh-dash-subtitle text-lg mb-2">{title}</h3>
      <p className="text-sm text-[var(--foreground-secondary)] text-center max-w-sm mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 eh-btn-neon rounded-xl font-semibold"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

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
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Icon name={icon} size="2xl" className="text-[var(--foreground-tertiary)] mb-4" />
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--foreground-tertiary)] text-center max-w-sm">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-4 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#00E5A0]/5 to-[#00B4D8]/5 rounded-lg border border-[#00E5A0]/20">
      <div className="w-16 h-16 bg-[var(--surface)] rounded-full flex items-center justify-center mb-6 shadow-sm">
        <Icon name={icon} size="2xl" className="text-[#00E5A0]" />
      </div>
      <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">{title}</h3>
      <p className="text-[var(--foreground-secondary)] text-center max-w-sm mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

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
        <Icon name={icon} size="2xl" className="text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 text-center max-w-sm">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-100">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
        <Icon name={icon} size="2xl" className="text-blue-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-center max-w-sm mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

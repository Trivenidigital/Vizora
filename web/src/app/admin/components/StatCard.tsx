'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
}

const colorStyles = {
  blue: {
    bg: 'bg-[#00E5A0]/5',
    icon: 'bg-[#00E5A0]/10 text-[#00E5A0]',
    border: 'border-[#00E5A0]/20',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    icon: 'bg-green-100 dark:bg-green-900 text-green-600',
    border: 'border-success-ink/30',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    icon: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600',
    border: 'border-warning-ink/30',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    icon: 'bg-red-100 dark:bg-red-900 text-red-600',
    border: 'border-error-ink/30',
  },
  purple: {
    bg: 'bg-[var(--cat-purple-bg)]',
    icon: 'bg-[var(--cat-purple-edge)] text-[var(--cat-purple)]',
    border: 'border-[var(--cat-purple-edge)]',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    icon: 'bg-orange-100 dark:bg-orange-900 text-orange-600',
    border: 'border-warning-ink/30',
  },
};

export function StatCard({ title, value, subtitle, trend, icon, color = 'blue' }: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div
      className={`bg-[var(--surface)] rounded-xl border ${styles.border} p-6 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--foreground-tertiary)]">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--foreground-tertiary)]">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-sm text-[var(--foreground-tertiary)]">vs last month</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${styles.icon}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

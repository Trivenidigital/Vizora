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
    bg: 'bg-brand/5',
    icon: 'bg-brand/10 text-[var(--primary-ink)]',
    border: 'border-brand/20',
  },
  green: {
    bg: 'bg-[var(--status-online-bg)]',
    icon: 'bg-[var(--status-online-bg)] text-[var(--success-ink)]',
    border: 'border-success-ink/30',
  },
  yellow: {
    bg: 'bg-[var(--status-error-bg)]',
    icon: 'bg-[var(--status-error-bg)] text-[var(--warning-ink)]',
    border: 'border-warning-ink/30',
  },
  red: {
    bg: 'bg-[var(--status-offline-bg)]',
    icon: 'bg-[var(--status-offline-bg)] text-[var(--error-ink)]',
    border: 'border-error-ink/30',
  },
  purple: {
    bg: 'bg-[var(--cat-purple-bg)]',
    icon: 'bg-[var(--cat-purple-edge)] text-[var(--cat-purple)]',
    border: 'border-[var(--cat-purple-edge)]',
  },
  orange: {
    bg: 'bg-[var(--status-error-bg)]',
    icon: 'bg-[var(--status-error-bg)] text-[var(--warning-ink)]',
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
                <TrendingUp className="w-4 h-4 text-[var(--success-ink)]" />
              ) : (
                <TrendingDown className="w-4 h-4 text-[var(--error-ink)]" />
              )}
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-[var(--success-ink)]' : 'text-[var(--error-ink)]'
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

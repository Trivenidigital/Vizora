'use client';

import type { SupportStats } from '@/lib/types';

interface SupportStatsCardsProps {
  stats: SupportStats | null;
}

export function SupportStatsCards({ stats }: SupportStatsCardsProps) {
  const cards = [
    {
      label: 'Open',
      value: stats?.open ?? 0,
      dotColor: 'bg-orange-500',
    },
    {
      label: 'In Progress',
      value: stats?.inProgress ?? 0,
      dotColor: 'bg-blue-500',
    },
    {
      label: 'Resolved This Week',
      value: stats?.resolvedThisWeek ?? 0,
      dotColor: 'bg-green-500',
    },
    {
      label: 'Total',
      value: stats?.total ?? 0,
      dotColor: 'bg-gray-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[#111827] rounded-xl p-6 border border-[var(--border)]"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 rounded-full ${card.dotColor}`} />
            <span className="text-sm text-[var(--foreground-secondary)]">{card.label}</span>
          </div>
          <p className="text-3xl font-bold text-[var(--foreground)]">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

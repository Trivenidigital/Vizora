'use client';

import type { SupportStats } from '@/lib/types';

interface SupportStatsCardsProps {
  stats: SupportStats | null;
}

export function SupportStatsCards({ stats }: SupportStatsCardsProps) {
  /*
   * The dots now speak the SAME vocabulary as the status badges on the cards
   * below them. They did not: `Open` was orange here and blue on the badge,
   * `In Progress` blue here and yellow there - so the summary row and the list
   * it summarises disagreed on the colour of every state. Aligned to the
   * semantic fills behind `--status-*-bg`.
   *
   * On `--surface`: info 3.32:1, warning 3.08:1, success 3.18:1,
   * foreground-tertiary 5.89:1. 10px dots beside a text label, so the 3:1
   * non-text bar applies and the label carries the meaning.
   */
  const cards = [
    {
      label: 'Open',
      value: stats?.open ?? 0,
      dotColor: 'bg-[var(--info)]',
    },
    {
      label: 'In Progress',
      value: stats?.inProgress ?? 0,
      dotColor: 'bg-[var(--warning)]',
    },
    {
      label: 'Resolved This Week',
      value: stats?.resolvedThisWeek ?? 0,
      dotColor: 'bg-[var(--success)]',
    },
    {
      label: 'Total',
      value: stats?.total ?? 0,
      dotColor: 'bg-[var(--foreground-tertiary)]',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)]"
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

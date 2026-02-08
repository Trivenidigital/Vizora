'use client';

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Active' },
  trialing: { bg: 'bg-[#00B4D8]/10', text: 'text-[#00B4D8]', label: 'Trial' },
  past_due: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', label: 'Past Due' },
  canceled: { bg: 'bg-[var(--surface-hover)]', text: 'text-[var(--foreground-tertiary)]', label: 'Canceled' },
  unpaid: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Unpaid' },
  incomplete: { bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'Incomplete' },
  incomplete_expired: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Expired' },
  paused: { bg: 'bg-[var(--surface-hover)]', text: 'text-[var(--foreground-tertiary)]', label: 'Paused' },
  free: { bg: 'bg-[var(--surface-hover)]', text: 'text-[var(--foreground-tertiary)]', label: 'Free' },
  // Invoice statuses
  paid: { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Paid' },
  open: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', label: 'Open' },
  draft: { bg: 'bg-[var(--surface-hover)]', text: 'text-[var(--foreground-tertiary)]', label: 'Draft' },
  void: { bg: 'bg-[var(--surface-hover)]', text: 'text-[var(--foreground-tertiary)]', label: 'Void' },
  uncollectible: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Uncollectible' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    bg: 'bg-[var(--surface-hover)]',
    text: 'text-[var(--foreground-tertiary)]',
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

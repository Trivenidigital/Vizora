'use client';

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-100', label: 'Active' },
  trialing: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-100', label: 'Trial' },
  past_due: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-100', label: 'Past Due' },
  canceled: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-100', label: 'Canceled' },
  unpaid: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-100', label: 'Unpaid' },
  incomplete: { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-100', label: 'Incomplete' },
  incomplete_expired: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-100', label: 'Expired' },
  paused: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-100', label: 'Paused' },
  free: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-100', label: 'Free' },
  // Invoice statuses
  paid: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-100', label: 'Paid' },
  open: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-100', label: 'Open' },
  draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-100', label: 'Draft' },
  void: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-100', label: 'Void' },
  uncollectible: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-100', label: 'Uncollectible' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-800 dark:text-gray-100',
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

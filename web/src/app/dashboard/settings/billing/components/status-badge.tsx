'use client';

import { Badge, type BadgeTone } from '@/components/ui/Badge';

interface StatusBadgeProps {
  status: string;
}

/**
 * Billing status pill — subscription statuses AND invoice statuses.
 *
 * Renders through the shared `ui/Badge`; what stays here is what is genuinely
 * billing's: which tone each provider status means, and the human label, which
 * is NOT derivable from the key (`incomplete_expired` -> "Expired",
 * `trialing` -> "Trial").
 *
 * ── Every distinction the old table drew is still drawn ───────────────────
 * The old table used six colours: green, cyan, yellow, grey, red and orange.
 * `incomplete` was the only orange, and it has to stay apart from the yellows
 * (`past_due`, `open`), so it takes the OUTLINED form of the warning family —
 * the same second axis `admin/StatusBadge` uses, for the same reason (see the
 * note in `ui/Badge`).
 *
 * The cyan `trial` becomes the BRAND tone, which is where it always pointed:
 * it was #00B4D8, the retired Electric Horizon cyan, and it is the one status
 * here that means "Vizora is carrying you" rather than a health verdict.
 */
const statusConfig: Record<string, { tone: BadgeTone; outline?: boolean; label: string }> = {
  active: { tone: 'success', label: 'Active' },
  trial: { tone: 'brand', label: 'Trial' },
  trialing: { tone: 'brand', label: 'Trial' },
  past_due: { tone: 'warning', label: 'Past Due' },
  canceled: { tone: 'neutral', label: 'Canceled' },
  unpaid: { tone: 'error', label: 'Unpaid' },
  incomplete: { tone: 'warning', outline: true, label: 'Incomplete' },
  incomplete_expired: { tone: 'error', label: 'Expired' },
  paused: { tone: 'neutral', label: 'Paused' },
  free: { tone: 'neutral', label: 'Free' },
  // Invoice statuses
  paid: { tone: 'success', label: 'Paid' },
  open: { tone: 'warning', label: 'Open' },
  draft: { tone: 'neutral', label: 'Draft' },
  void: { tone: 'neutral', label: 'Void' },
  uncollectible: { tone: 'error', label: 'Uncollectible' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    tone: 'neutral' as BadgeTone,
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
  };

  return (
    <Badge variant={config.tone} outline={config.outline} size="sm">
      {config.label}
    </Badge>
  );
}

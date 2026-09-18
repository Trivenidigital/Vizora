'use client';

import { Badge, type BadgeTone } from '@/components/ui/Badge';

type BadgeStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'trialing'
  | 'canceled'
  | 'past_due'
  | 'pending'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'maintenance'
  | 'critical';

interface StatusBadgeProps {
  status: BadgeStatus | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Admin status pill. Renders through the shared `ui/Badge` — the colour table
 * this file used to carry (13 entries of `bg-green-100 dark:bg-green-900/30`
 * and friends) is gone; what remains is the part that is genuinely admin's:
 * which tone each status means, and how the label is worded.
 *
 * ── Every distinction the old table drew is still drawn ───────────────────
 * The old table used seven visually distinct colours: green, grey, red, neon,
 * yellow, orange and purple. The Little Worlds tints cannot carry seven — see
 * the note in `ui/Badge` — so the two that would have collided take the
 * OUTLINED form of their family instead:
 *
 *   old            new                                       distinct from
 *   green          success, filled                           —
 *   grey           neutral, filled                           —
 *   red            error, filled                             —
 *   neon           brand, outlined (brand is always outlined) —
 *   yellow         warning, filled                           —
 *   orange         warning, OUTLINED                         yellow (filled)
 *   purple         info, OUTLINED                            neon (brand)
 *
 * So `past_due` still reads apart from `canceled`/`pending`, and `maintenance`
 * still reads apart from `trialing`/`info`. Nothing was collapsed onto
 * something it did not already share a meaning with.
 */
const statusTone: Record<string, { tone: BadgeTone; outline?: boolean }> = {
  active: { tone: 'success' },
  inactive: { tone: 'neutral' },
  suspended: { tone: 'error' },
  trialing: { tone: 'brand' },
  canceled: { tone: 'warning' },
  past_due: { tone: 'warning', outline: true },
  pending: { tone: 'warning' },
  success: { tone: 'success' },
  warning: { tone: 'warning' },
  error: { tone: 'error' },
  info: { tone: 'brand' },
  maintenance: { tone: 'info', outline: true },
  critical: { tone: 'error' },
};

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(' ', '_');
  const { tone, outline } = statusTone[normalizedStatus] || statusTone.inactive;

  const formatLabel = (s: string) => {
    return s
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Badge variant={tone} outline={outline} dot size={size} className={className}>
      {formatLabel(status)}
    </Badge>
  );
}

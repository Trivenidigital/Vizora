'use client';

import React from 'react';
import { X } from 'lucide-react';

/**
 * The ONE badge.
 *
 * There were three: this one, `app/admin/components/StatusBadge.tsx` and
 * `app/dashboard/settings/billing/components/status-badge.tsx`, each with its
 * own colour table written in raw palette classes. The two status badges now
 * render through this component and keep only what is genuinely theirs — the
 * status -> tone table and the label wording. Nothing about what a caller
 * renders for a given status was flattened; see those files for the mapping.
 *
 * ── Two axes, not one ─────────────────────────────────────────────────────
 * `tone` picks the semantic family; `outline` picks the FORM. The Little
 * Worlds status tints are deliberately low chroma, so six of them sit inside
 * about eight points of each other and a seventh could not be told from its
 * neighbours. Callers that need more than six distinctions take them from form
 * instead — an outlined pill is unmistakably not a filled one, including in
 * greyscale. The tone classes and their computed ratios live in globals.css.
 *
 * `outline` is also the white-label-safe form: it grounds the text on
 * `--surface`, which is the substrate `applyCSSVariables` derives a tenant's
 * `--brand-ink-light` against, so a brand-toned badge clears AA for every
 * tenant rather than only for Vizora's own forest.
 */
export type BadgeTone = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Legacy aliases kept so existing call sites need no edit.
 * `primary` was the brand tone; `amber` was always the warning tone.
 */
type BadgeVariant = BadgeTone | 'primary' | 'amber';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Outlined rather than filled — the second axis. See the note above. */
  outline?: boolean;
  /** Leading status dot, painted in the tone's own ink. */
  dot?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const TONE_OF: Record<BadgeVariant, BadgeTone> = {
  brand: 'brand',
  primary: 'brand',
  success: 'success',
  warning: 'warning',
  amber: 'warning',
  error: 'error',
  info: 'info',
  neutral: 'neutral',
};

/**
 * The FILLED classes. `brand` has no tint of its own — it is outlined always,
 * for the white-label reason above — so it maps to the same class either way.
 */
const FILLED: Record<BadgeTone, string> = {
  brand: 'eh-badge-brand',
  success: 'eh-badge-success',
  warning: 'eh-badge-warning',
  error: 'eh-badge-error',
  info: 'eh-badge-info',
  neutral: 'eh-badge-neutral',
};

/**
 * The OUTLINED classes: the tone's ink on `--surface` with a hairline in
 * `currentColor`. Computed on `--surface` (#fdfbf5): success 6.89:1,
 * warning 6.85:1, error 6.25:1, info 5.62:1, neutral 5.89:1, brand 10.79:1
 * for Vizora's forest and AA by construction for any tenant.
 */
const OUTLINED: Record<BadgeTone, string> = {
  brand: 'eh-badge-brand',
  success: 'eh-badge-outline text-[var(--success-ink)]',
  warning: 'eh-badge-outline text-[var(--warning-ink)]',
  error: 'eh-badge-outline text-[var(--error-ink)]',
  info: 'eh-badge-outline text-[var(--info-ink)]',
  neutral: 'eh-badge-outline text-[var(--foreground-tertiary)]',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: '',
  lg: 'px-3.5 py-1.5 text-sm',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  outline = false,
  dot = false,
  dismissible = false,
  onDismiss,
  className,
}) => {
  const tone = TONE_OF[variant] ?? 'brand';
  const toneClass = outline ? OUTLINED[tone] : FILLED[tone];

  return (
    <div className={`eh-badge ${toneClass} ${sizeStyles[size]} ${className || ''}`}>
      {/* `currentColor`, so the dot follows the tone without a second table. */}
      {dot && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full bg-current shrink-0"
        />
      )}
      {children}
      {dismissible && (
        <button
          onClick={onDismiss}
          className="ml-0.5 inline-flex items-center justify-center rounded-full hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Dismiss badge"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

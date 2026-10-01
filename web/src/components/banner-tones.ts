/**
 * The ONE tone vocabulary for the shell's top-of-page notice bars.
 *
 * `TrialBanner` and `EntitlementBanner` stack in the same fixed container, so
 * they have to agree on what each state looks like. Until now they agreed by
 * copy-paste: #355 established the `TONE_*` maps in `EntitlementBanner` and
 * `TrialBanner` restated them, with a comment saying it was "reusing" them. Two
 * copies of a shared vocabulary is exactly the arrangement that drifts, and the
 * one constraint that must not drift is recorded below.
 *
 * ── The load-bearing rule ─────────────────────────────────────────────────
 * `unknown` is NOT a ladder rung. It means "we could not determine your billing
 * state", which may be MASKING a rung. It must never render as one of the
 * escalating warnings, and it must never render as benign-looking silence.
 *
 * ── Why the ladder escalates by FILL, not by hue ──────────────────────────
 * The Little Worlds status tints are deliberately low chroma (globals.css:
 * "status must survive a greyscale screenshot"). Four warm tints inside eight
 * points of each other cannot carry a four-rung ladder — so the two lower rungs
 * are tinted and the two upper rungs are SOLID bars. That difference reads at a
 * glance, in greyscale, and at 390px where the message itself is truncated.
 *
 * Every ratio below is computed by `scripts/design/contrast.mjs`, never by eye.
 */

/** Ordered by escalation. `unknown` sits outside the ladder on purpose. */
export type BannerTone = 'unknown' | 'info' | 'warning' | 'urgent' | 'critical';

interface ToneStyle {
  /** The bar itself: ground + bottom hairline. */
  bar: string;
  /** Message text. */
  text: string;
  /** The leading status dot. */
  dot: string;
  /** Primary call to action inside the bar. */
  action: string;
  /** Secondary control (Retry / Dismiss). */
  quiet: string;
}

/**
 * Computed contrast, message text on its own bar:
 *   unknown   #23261f on #e6e3d9 = 11.95:1
 *   info      #23261f on #e0e0d6 = 11.55:1
 *   warning   #23261f on #ebdfd2 = 11.70:1
 *   urgent    #f2efe4 on #77591f =  5.64:1
 *   critical  #ffffff on #dc2626 =  4.83:1
 *
 * And the primary action inside each bar:
 *   on a tint   #f2efe4 on #1f4230 = 9.70:1
 *   on a solid  #23261f on #fdfbf5 = 14.83:1
 *
 * The tinted bars carry `--foreground` rather than the tone's own ink because
 * `--primary-ink` is white-label-derived: a tenant's ink is guaranteed AA
 * against `--surface` (#fdfbf5), not against a badge tint, and a tenant sitting
 * at exactly 4.5:1 on the card lands near 3.9:1 on #e0e0d6. The tone colour
 * stays where it is safe — the dot and the border.
 */
export const BANNER_TONE: Record<BannerTone, ToneStyle> = {
  unknown: {
    bar: 'bg-[var(--status-neutral-bg)] border-b border-[var(--border)]',
    text: 'text-[var(--foreground)]',
    dot: 'bg-[var(--foreground-tertiary)]',
    action:
      'bg-[var(--primary)] text-[var(--primary-contrast)] hover:bg-[var(--primary-light)]',
    quiet:
      'text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border-dark)] hover:bg-[var(--surface-hover)]',
  },
  info: {
    bar: 'bg-[var(--badge-brand-bg)] border-b border-[var(--border)]',
    text: 'text-[var(--foreground)]',
    dot: 'bg-[var(--primary-ink)]',
    action:
      'bg-[var(--primary)] text-[var(--primary-contrast)] hover:bg-[var(--primary-light)]',
    quiet:
      'text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border-dark)] hover:bg-[var(--surface-hover)]',
  },
  warning: {
    bar: 'bg-[var(--status-error-bg)] border-b border-[var(--warning-ink)]',
    text: 'text-[var(--foreground)]',
    dot: 'bg-[var(--warning-ink)]',
    action:
      'bg-[var(--primary)] text-[var(--primary-contrast)] hover:bg-[var(--primary-light)]',
    quiet:
      'text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border-dark)] hover:bg-[var(--surface-hover)]',
  },
  urgent: {
    bar: 'bg-[var(--accent-brass-ink)] border-b border-[var(--accent-brass-ink)]',
    text: 'text-[var(--lw-on-forest)]',
    dot: 'bg-[var(--lw-on-forest)]',
    action:
      'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]',
    quiet:
      'text-[var(--lw-on-forest)] bg-transparent border border-[var(--lw-on-forest)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
  },
  critical: {
    bar: 'bg-[var(--danger-solid)] border-b border-[var(--danger-solid)]',
    text: 'text-white',
    dot: 'bg-white',
    action:
      'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]',
    quiet:
      'text-white bg-transparent border border-white hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
  },
};

/** Shared geometry, so the two banners cannot drift on padding either. */
export const BANNER_ROW =
  'px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4';
export const BANNER_MESSAGE =
  'text-sm truncate sm:whitespace-normal sm:overflow-visible';
export const BANNER_ACTION =
  'shrink-0 px-4 py-1.5 text-sm font-semibold rounded-md transition-colors';
export const BANNER_QUIET_ACTION =
  'shrink-0 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-60';

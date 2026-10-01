'use client';

import React from 'react';

type SwitchSize = 'sm' | 'md';

interface SwitchProps {
  /** Current state. Drives `aria-checked` as well as the knob position. */
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: SwitchSize;
  /** Needed when no visible <label> wraps the switch. */
  'aria-label'?: string;
  className?: string;
}

/*
 * THE ONE TOGGLE TREATMENT.
 *
 * Three copies of this control had drifted apart — two sizes, one without a
 * focus ring, and one that had been half-fixed on its own — so the fourth would
 * have drifted too. The colours live here now and the call sites pass state.
 *
 * ── WHY THE OFF TRACK IS A MID NEUTRAL ───────────────────────────────────────
 * Two different 3:1 obligations meet on a switch, and the old `--border` track
 * failed BOTH: the knob is the state indicator, and the track is what tells you
 * the control exists at all (WCAG 1.4.11). With a white knob on a pale track on
 * a near-white card, the whole control nearly vanished when off.
 *
 * Measured on `--surface`, which is the ground all three call sites sit on:
 *
 *                            knob vs track    track vs card
 *   ON   --primary                 11.17            10.79
 *   OFF  --gray-500                 3.50             3.38
 *   OFF  --border (before)          1.46             1.41   <- failed both
 *
 * The knob stays white in BOTH states, which is what keeps ON untouched and
 * removes the conditional knob colour one copy had grown.
 *
 * ── WHY NOT GO DARKER ────────────────────────────────────────────────────────
 * `--foreground-tertiary` would clear every pairing with margin (6.10 / 5.89),
 * but it sits only 1.83:1 from the forest ON track in greyscale, against 3.19:1
 * for `--gray-500` — so a column of switches would stop reading on/off at a
 * glance. `--gray-500` is the step that satisfies the contrast obligations while
 * keeping the two states visibly different. Knob POSITION is the non-colour cue
 * that carries state regardless (WCAG 1.4.1), so the greyscale gap is a
 * usability margin rather than a conformance one.
 *
 * ── THE ONE RESIDUAL, recorded rather than chased ────────────────────────────
 * Two call sites sit in rows that hover to `--surface-hover`, where the OFF
 * track reads 2.89:1 instead of 3.38:1 — 0.11 short, in a transient state. The
 * only way to close it is the darker track above, which costs the at-a-glance
 * distinction permanently to fix a hover. Not worth it; see the commit body.
 *
 * ── FOCUS ────────────────────────────────────────────────────────────────────
 * `--primary-ink` at full strength, 10.79:1 on `--surface`. NOT `--accent-ring`,
 * which is forest at 15% alpha and composites to 1.30:1 on `--surface` — a focus
 * indicator needs 3:1. `focus-visible` rather than `focus`, so a mouse click does not
 * leave a ring behind; the state change is its own feedback there.
 */
const trackSize: Record<SwitchSize, string> = {
  sm: 'h-5 w-9',
  md: 'h-6 w-11',
};

const knobSize: Record<SwitchSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
};

const knobOn: Record<SwitchSize, string> = {
  sm: 'translate-x-4',
  md: 'translate-x-6',
};

const knobOff: Record<SwitchSize, string> = {
  sm: 'translate-x-0.5',
  md: 'translate-x-1',
};

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex ${trackSize[size]} items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ink)] focus-visible:ring-offset-2 disabled:opacity-50 ${
      checked ? 'bg-[var(--primary)]' : 'bg-[var(--gray-500)]'
    }${className ? ` ${className}` : ''}`}
  >
    <span
      className={`inline-block ${knobSize[size]} transform rounded-full bg-white transition-transform ${
        checked ? knobOn[size] : knobOff[size]
      }`}
    />
  </button>
);

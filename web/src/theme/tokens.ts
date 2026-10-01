/**
 * Design Tokens for Vizora — Electric Horizon
 * Centralized design system values for consistent UI/UX
 *
 * The groups Tailwind also consumes (spacing, radius, shadow, transition,
 * zIndex, breakpoints, animation, border, opacity) live in `./palette.js` and
 * are spread in below — see that file's header. The groups declared here are
 * the ones ONLY TypeScript uses, so they have no second home to drift from.
 */

import { tokens as palette } from './palette.js';

export const tokens = {
  ...palette,

  // Typography scales — TypeScript-only; Tailwind's type scale is its own.
  typography: {
    // Display heading - largest
    display: {
      lg: {
        fontSize: '48px',
        fontWeight: 700,
        lineHeight: '1.2',
        letterSpacing: '-0.02em',
      },
      md: {
        fontSize: '36px',
        fontWeight: 700,
        lineHeight: '1.25',
        letterSpacing: '-0.02em',
      },
    },

    // Heading styles
    heading: {
      h1: {
        fontSize: '32px',
        fontWeight: 700,
        lineHeight: '1.2',
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '24px',
        fontWeight: 700,
        lineHeight: '1.3',
        letterSpacing: '-0.01em',
      },
      h3: {
        fontSize: '20px',
        fontWeight: 600,
        lineHeight: '1.4',
        letterSpacing: '0em',
      },
      h4: {
        fontSize: '18px',
        fontWeight: 600,
        lineHeight: '1.4',
        letterSpacing: '0em',
      },
      h5: {
        fontSize: '16px',
        fontWeight: 600,
        lineHeight: '1.5',
        letterSpacing: '0em',
      },
      h6: {
        fontSize: '14px',
        fontWeight: 600,
        lineHeight: '1.5',
        letterSpacing: '0em',
      },
    },

    // Body text styles
    body: {
      lg: {
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: '1.6',
        letterSpacing: '0em',
      },
      base: {
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: '1.5',
        letterSpacing: '0em',
      },
      sm: {
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: '1.4',
        letterSpacing: '0em',
      },
      xs: {
        fontSize: '11px',
        fontWeight: 400,
        lineHeight: '1.4',
        letterSpacing: '0.01em',
      },
    },

    // Code/monospace
    code: {
      sm: {
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '1.4',
        letterSpacing: '0em',
        fontFamily: 'monospace',
      },
    },
  } as const,

  /*
   * Focus ring. The value was still the Electric Horizon neon, which is 1.65:1
   * on ivory and so could never have been a visible ring on this substrate.
   *
   * It is a LITERAL and not `var(--primary-ink)` because this object is consumed
   * as plain data, not as CSS. It is also currently consumed by NOTHING - a
   * repo-wide search for `tokens.focus` and `.focus.ring` finds no reader - so
   * correcting the value is a data fix, not a behaviour change. The live focus
   * ring is `--accent-ring`, applied by the `.eh-*` component rules in
   * globals.css. Deleting this is a separate call; leaving it holding a retired
   * palette value is not.
   */
  focus: {
    ring: '2px',
    ringOffset: '2px',
    ringColor: '#1f4230' /* = --primary / --lw-forest */,
  } as const,

  // Container widths
  container: {
    xs: '320px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  } as const,
} as const;

// Type exports for better TypeScript support
export type Spacing = keyof typeof tokens.spacing;
export type Radius = keyof typeof tokens.radius;
export type Shadow = keyof typeof tokens.shadow;
export type Transition = keyof typeof tokens.transition;
export type ZIndex = keyof typeof tokens.zIndex;
export type Breakpoint = keyof typeof tokens.breakpoints;

/**
 * Utility function to get spacing value
 */
export function getSpacing(size: Spacing): string {
  return tokens.spacing[size];
}

/**
 * Utility function to get border radius value
 */
export function getRadius(size: Radius): string {
  return tokens.radius[size];
}

/**
 * Utility function to get shadow value
 */
export function getShadow(size: Shadow): string {
  return tokens.shadow[size];
}

/**
 * Utility function to get transition value
 */
export function getTransition(type: Transition): string {
  return tokens.transition[type];
}

/**
 * Utility function to get z-index value
 */
export function getZIndex(level: ZIndex): string {
  return tokens.zIndex[level];
}

/**
 * Utility function to get breakpoint value
 */
export function getBreakpoint(bp: Breakpoint): string {
  return tokens.breakpoints[bp];
}

/**
 * Media query helper
 */
export function mediaQuery(breakpoint: Breakpoint): string {
  return `@media (min-width: ${tokens.breakpoints[breakpoint]})`;
}

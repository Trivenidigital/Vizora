/**
 * THE colour and design-token values. Authored once, here.
 *
 * Before this file the same numbers were written out in four places —
 * `tailwind.theme.cjs`, `theme/colors.ts`, `theme/tokens.ts` and (for the `eh`
 * namespace) `tailwind.config.js` itself — with nothing but a single deep-equal
 * test holding two of the four together. `docs/plans/2026-09-17-full-web-little-worlds-redesign.md`
 * §2 counts that duplication as one of the reasons the redesign is expensive:
 * a palette change had to be made four times and could half-land.
 *
 * Everything now reads from here:
 *   tailwind.theme.cjs   -> re-exports these, and derives the CSS-variable
 *                           colour map + the `--c-*` block globals.css declares
 *   tailwind.config.js   -> consumes that map
 *   theme/colors.ts      -> re-exports semanticColors (+ its helpers)
 *   theme/tokens.ts      -> re-exports tokens (+ typography/focus/container)
 *   theme/chartConfig.ts -> already derived from colors.ts
 *
 * Plain CommonJS on purpose: `tailwind.config.js` is loaded by PostCSS in bare
 * Node with no TypeScript in the pipeline, so the one file both sides share
 * cannot be a `.ts`. `web/package.json` declares no `"type"`, so `.js` here is
 * CommonJS, and `src/**\/*.js` is already inside the tsconfig `include` — so the
 * TypeScript side still gets full inference off these literals.
 *
 * VALUES IN THIS FILE ARE THE ELECTRIC HORIZON PALETTE AND ARE NOT THE
 * REDESIGN TARGET. Phase 1 of the plan above replaces them with Little Worlds.
 * Phase 0 moved them; it did not change one.
 */

const semanticColors = {
  // Primary action color — EH neon green
  primary: {
    light: '#00CC8E',
    dark: '#00E5A0',
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#00E5A0',
    600: '#00CC8E',
    700: '#00A876',
    800: '#007A56',
    900: '#064E3B',
  },

  // Success state — keep distinct from primary (slightly warmer green)
  success: {
    light: '#16a34a', // green-600
    dark: '#22c55e', // green-500
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#145231',
  },

  // Warning state - caution and attention needed
  warning: {
    light: '#d97706', // amber-600
    dark: '#fbbf24', // amber-400
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Error state - failures and destructive actions
  error: {
    light: '#dc2626', // red-600
    dark: '#ef4444', // red-500
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Info state — EH cyan
  info: {
    light: '#0097B8',
    dark: '#00B4D8',
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#00B4D8',
    600: '#0097B8',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
  },

  // Neutral — warm teal-gray (EH palette)
  neutral: {
    50: '#F0ECE8',
    100: '#E8E3DD',
    200: '#D1CBC5',
    300: '#B5AEA6',
    400: '#8A8278',
    500: '#5A5248',
    600: '#3D3632',
    700: '#1B3D47',
    800: '#122D35',
    900: '#0A222E',
    950: '#061A21',
  },
};

/**
 * The `eh-*` Tailwind namespace — the Electric Horizon surface colours.
 *
 * Lived inline in `tailwind.config.js`, which made it a fifth copy of the same
 * numbers that `globals.css` declares as `--background`, `--surface`, `--border`
 * and friends. It is kept as its own group rather than folded into
 * `semanticColors` because it is not a 50–900 ramp and the existing
 * tailwind.theme.cjs sync test pins `semanticColors`' exact shape.
 */
const ehColors = {
  bg: '#061A21',
  'bg-secondary': '#081E28',
  'bg-tertiary': '#0A222E',
  surface: '#0C2229',
  'surface-secondary': '#122D35',
  accent: '#00E5A0',
  'accent-hover': '#00CC8E',
  cyan: '#00B4D8',
  violet: '#8B5CF6',
  text: '#F0ECE8',
  'text-secondary': '#8A8278',
  'text-muted': '#5A5248',
  border: '#1B3D47',
  'border-light': '#264A55',
};

/**
 * Not a hex, so it is not part of `ehColors` and gets no channel variable: it
 * carries its own alpha. See the note on `EH_CARD` in tailwind.theme.cjs for
 * what that costs.
 */
const ehCard = 'rgba(12, 34, 41, 0.6)';

const tokens = {
  // Spacing scale (base unit: 4px)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
    '4xl': '64px',
    '5xl': '80px',
  },

  // Border radius scale
  radius: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px',
  },

  // Shadow/elevation system
  shadow: {
    none: 'none',
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px rgba(0, 0, 0, 0.1)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
  },

  // Transitions/animations
  transition: {
    fast: '150ms ease-in-out',
    normal: '300ms ease-in-out',
    slow: '500ms ease-in-out',
  },

  // Z-index scale
  zIndex: {
    hide: '-1',
    auto: 'auto',
    base: '0',
    docked: '10',
    dropdown: '1000',
    sticky: '1020',
    fixed: '1030',
    backdrop: '1040',
    offcanvas: '1050',
    modal: '1060',
    popover: '1070',
    tooltip: '1080',
  },

  // Breakpoints for responsive design
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Animation/keyframes
  animation: {
    spin: 'spin 1s linear infinite',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    bounce: 'bounce 1s infinite',
    fadeIn: 'fadeIn 300ms ease-in-out',
    slideIn: 'slideIn 300ms ease-in-out',
    slideOut: 'slideOut 300ms ease-in-out',
  },

  // Border widths
  border: {
    none: '0px',
    xs: '0.5px',
    sm: '1px',
    md: '2px',
    lg: '4px',
  },

  // Opacity scale
  opacity: {
    0: '0',
    5: '0.05',
    10: '0.1',
    20: '0.2',
    25: '0.25',
    30: '0.3',
    40: '0.4',
    50: '0.5',
    60: '0.6',
    70: '0.7',
    75: '0.75',
    80: '0.8',
    90: '0.9',
    95: '0.95',
    100: '1',
  },
};

/**
 * CHART SERIES — the categorical palette, and the one part of this file that
 * is already Little Worlds.
 *
 * It lives here rather than in `chartConfig.ts` for two reasons. This file is
 * the sanctioned home for colour VALUES (it is the ratchet's single named
 * exemption), and recharts writes these into SVG `fill`/`stroke` PRESENTATION
 * ATTRIBUTES, where a `var(--token)` is not resolved — so the chart palette
 * cannot be token references the way the rest of the redesign is. Concrete
 * values in the one sanctioned place is the honest form of that constraint.
 *
 * Series 1-3 are the brand triad (forest, brass, coral); 4-8 extend it with
 * muted hues in the same tonal register, because a categorical palette needs
 * separable HUES and the brand has only three. Every entry is checked on the
 * card substrate it renders on:
 *
 *   forest  #1f4230 10.79:1   teal   #2f6d6a 5.77:1
 *   brass   #b08a3e  3.10:1   plum   #7a4a63 6.79:1
 *   coral   #d96a4c  3.32:1   olive  #6b7a3e 4.53:1
 *                             blue   #46618c 6.06:1
 *                             clay   #8c5a3c 5.57:1
 *
 * All clear the 3:1 that WCAG SC 1.4.11 asks of a graphical object, and the
 * CLOSEST pair in sRGB is teal/blue at a distance of 42.8, comfortably past
 * the ~40 usually taken as the floor for categorical separability. Both
 * numbers matter: a palette can be readable and still be unusable because two
 * series cannot be told apart.
 *
 * Adding a ninth means re-running both checks, not eyeballing a gap.
 */
const chartSeries = [
  '#1f4230',
  '#b08a3e',
  '#d96a4c',
  '#2f6d6a',
  '#7a4a63',
  '#6b7a3e',
  '#46618c',
  '#8c5a3c',
];

/** Chart chrome — grid, axes, tooltip. Mirrors the `:root` tokens by value. */
const chartChrome = {
  surface: '#fdfbf5',
  ink: '#23261f',
  hairline: '#ddd5c2',
};

module.exports = { semanticColors, ehColors, ehCard, tokens, chartSeries, chartChrome };

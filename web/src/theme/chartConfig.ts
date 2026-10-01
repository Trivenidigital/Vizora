/**
 * Recharts configuration and theme.
 *
 * ── The categorical palette is in `theme/palette.js` ─────────────────────
 * Series colours must be concrete: recharts writes them into SVG `fill` and
 * `stroke` PRESENTATION ATTRIBUTES, where `var(--token)` is not resolved, so
 * this is the one surface in the redesign that cannot read the CSS variables.
 * `palette.js` is the sanctioned home for colour values, and it carries the
 * contrast and separability numbers for all eight.
 *
 * ── There is no dark chart theme any more ────────────────────────────────
 * Dark mode was removed (plan §3 D1) and `.dark` can never be applied, so a
 * second palette here would be unreachable — and an unreachable competing
 * palette is exactly what globals.css deletes the `.dark` token block to
 * avoid. The `mode` parameter and the `*Dark` export are KEPT because the five
 * chart wrappers still pass `isDark ? 'dark' : 'light'`; they now resolve to
 * the same one theme. Retiring those call sites is per-wave `useTheme` cleanup,
 * not a palette change's business.
 */

import { chartSeries, chartChrome } from './palette.js';

/**
 * Semantic chart colours — for a chart that means something by colour (a
 * success/error split), as opposed to one that just needs N distinct series.
 * Forest, brass and coral are the brand triad; the status three are the ink
 * tokens, which are the text-safe forms and read on ivory.
 */
const theme = {
  primary: chartSeries[0],
  secondary: chartSeries[3],
  success: '#166534',
  warning: '#92400e',
  error: '#b91c1c',
  neutral: '#8a8a7a',
  background: chartChrome.surface,
  text: chartChrome.ink,
  gridStroke: chartChrome.hairline,
  tooltipBg: chartChrome.surface,
  tooltipBorder: chartChrome.hairline,
};

export const chartColors = {
  light: theme,
  /** Unreachable — `.dark` is never applied. Same theme, deliberately. */
  dark: theme,
};

export const chartColorPalette = chartSeries;

/** Unreachable, kept for the five wrappers that still branch on `isDark`. */
export const chartColorPaletteDark = chartSeries;

/**
 * Get chart theme configuration based on mode
 */
export function getChartTheme(mode: 'light' | 'dark' = 'light') {
  const colors = mode === 'dark' ? chartColors.dark : chartColors.light;
  const palette = mode === 'dark' ? chartColorPaletteDark : chartColorPalette;

  return {
    colors,
    palette,
    responsive: {
      containerClassName: 'w-full h-full',
      width: '100%',
      height: 300,
    },
    cartesianGrid: {
      strokeDasharray: '3 3',
      stroke: colors.gridStroke,
      vertical: false,
    },
    tooltip: {
      contentStyle: {
        backgroundColor: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        color: colors.text,
      },
      /* Warm ink, not neutral black: a grey hover band on ivory reads as a
         dirty smudge rather than a highlight. */
      cursor: { fill: 'rgba(35, 38, 31, 0.05)' },
    },
    legend: {
      wrapperStyle: { color: colors.text },
      iconType: 'line' as const,
    },
    xAxis: {
      stroke: colors.gridStroke,
      style: { fontSize: '12px', fill: colors.text },
    },
    yAxis: {
      stroke: colors.gridStroke,
      style: { fontSize: '12px', fill: colors.text },
    },
  };
}

/**
 * Animation configuration for charts
 */
export const chartAnimations = {
  enabled: true,
  duration: 800,
  easing: 'ease-in-out' as const,
};

/**
 * Responsive chart sizing rules
 */
export const chartResponsiveConfig = {
  small: { width: '100%', height: 250 },
  medium: { width: '100%', height: 300 },
  large: { width: '100%', height: 400 },
  fullscreen: { width: '100%', height: 500 },
};

/**
 * Default chart options
 */
export const defaultChartOptions = {
  margin: {
    top: 5,
    right: 30,
    left: 0,
    bottom: 5,
  },
  cartesianGrid: true,
  tooltip: true,
  legend: true,
  responsive: true,
};

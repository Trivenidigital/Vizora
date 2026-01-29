/**
 * Recharts Configuration & Theme System
 * Provides consistent chart styling across the application
 * with dark mode and light mode support
 */

import { semanticColors } from './colors';

export const chartColors = {
  light: {
    primary: semanticColors.primary[600],
    secondary: semanticColors.info[600],
    success: semanticColors.success[600],
    warning: semanticColors.warning[600],
    error: semanticColors.error[600],
    neutral: semanticColors.neutral[400],
    background: '#ffffff',
    text: semanticColors.neutral[900],
    gridStroke: semanticColors.neutral[200],
    tooltipBg: '#ffffff',
    tooltipBorder: semanticColors.neutral[200],
  },
  dark: {
    primary: semanticColors.primary[400],
    secondary: semanticColors.info[400],
    success: semanticColors.success[500],
    warning: semanticColors.warning[400],
    error: semanticColors.error[500],
    neutral: semanticColors.neutral[500],
    background: semanticColors.neutral[900],
    text: semanticColors.neutral[50],
    gridStroke: semanticColors.neutral[700],
    tooltipBg: semanticColors.neutral[800],
    tooltipBorder: semanticColors.neutral[700],
  },
};

export const chartColorPalette = [
  semanticColors.primary[600],
  semanticColors.success[600],
  semanticColors.warning[500],
  semanticColors.error[600],
  semanticColors.info[600],
  semanticColors.primary[400],
  semanticColors.success[400],
  semanticColors.warning[400],
];

export const chartColorPaletteDark = [
  semanticColors.primary[400],
  semanticColors.success[500],
  semanticColors.warning[400],
  semanticColors.error[500],
  semanticColors.info[400],
  semanticColors.primary[300],
  semanticColors.success[300],
  semanticColors.warning[300],
];

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
      cursor: { fill: 'rgba(0, 0, 0, 0.05)' },
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

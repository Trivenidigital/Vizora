/**
 * Semantic Color System for Vizora — Electric Horizon
 * Provides consistent color usage across the application
 * with light and dark mode variants
 */

export const semanticColors = {
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

// Status-to-color mapping for device and content status indicators
export const statusColors = {
  online: semanticColors.success,
  offline: semanticColors.error,
  idle: semanticColors.warning,
  connecting: semanticColors.info,
  active: semanticColors.success,
  inactive: semanticColors.neutral,
  processing: semanticColors.info,
  completed: semanticColors.success,
  failed: semanticColors.error,
  pending: semanticColors.warning,
};

/**
 * Get text color that contrasts with a given background
 * Returns appropriate text color for the current theme
 */
export function getContrastColor(
  bgColor: string,
  lightColor: string = '#ffffff',
  darkColor: string = '#000000'
): string {
  // Simple implementation - in production, use more sophisticated contrast calculation
  // Check if background is considered "light" or "dark"
  const isLight = bgColor.includes('light') ||
                  bgColor.includes('50') ||
                  bgColor.includes('100');
  return isLight ? darkColor : lightColor;
}

/**
 * Get semantic color variant based on theme mode
 */
export function getSemanticColor(
  colorType: keyof typeof semanticColors,
  mode: 'light' | 'dark' = 'light'
): string {
  const color = semanticColors[colorType] as Record<string, string>;
  return color[mode] || color['500'] || '#000000';
}

/**
 * Semantic Color System for Vizora — Electric Horizon
 * Provides consistent color usage across the application
 * with light and dark mode variants
 *
 * The VALUES live in `./palette.js`, which Tailwind's config also reads — see
 * that file's header. This module is the typed surface the app imports, plus
 * the status mapping and helpers; it deliberately restates nothing.
 */

import { semanticColors as palette } from './palette.js';

export const semanticColors = palette;

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

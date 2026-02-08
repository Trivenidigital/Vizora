// Electric Horizon branding — matches web dashboard
export const colors = {
  // Backgrounds
  bg: '#0A0E1A',
  bgCard: '#111827',
  bgInput: '#1F2937',
  bgOverlay: 'rgba(0, 0, 0, 0.6)',

  // Accents
  teal: '#00E5A0',
  cyan: '#00B4D8',
  tealDim: 'rgba(0, 229, 160, 0.15)',

  // Text
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  // Status
  online: '#22C55E',
  offline: '#EF4444',
  pairing: '#F59E0B',

  // Borders
  border: '#374151',
  borderFocus: '#00E5A0',

  // Danger
  danger: '#EF4444',
  dangerDim: 'rgba(239, 68, 68, 0.15)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

/**
 * White-Label Customization System
 * Provides brand customization configuration and utilities
 */

export interface BrandConfig {
  id: string;
  name: string;
  logo?: string;
  logoAlt?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  showPoweredBy: boolean;
  customDomain?: string;
  customCSS?: string;
}

// Default brand configuration (matches Vizora's brand colors)
const defaultBrandConfig: BrandConfig = {
  id: 'default',
  name: 'Vizora',
  primaryColor: '#00E5A0',
  secondaryColor: '#00B4D8',
  accentColor: '#00CC8E',
  fontFamily: 'sans',
  showPoweredBy: true,
};

// Store for brand configuration (would be replaced with API call in production)
let currentBrandConfig: BrandConfig = defaultBrandConfig;

/**
 * Load brand configuration
 * In production, this would fetch from an API or environment variables
 */
export function loadBrandConfig(config?: BrandConfig): BrandConfig {
  if (config) {
    currentBrandConfig = config;
  }
  return currentBrandConfig;
}

/**
 * Get current brand configuration
 */
export function getBrandConfig(): BrandConfig {
  return currentBrandConfig;
}

/**
 * Update brand configuration
 */
export function updateBrandConfig(updates: Partial<BrandConfig>): BrandConfig {
  currentBrandConfig = {
    ...currentBrandConfig,
    ...updates,
  };
  return currentBrandConfig;
}

/**
 * Get logo URL
 */
export function getLogoUrl(): string | undefined {
  return currentBrandConfig.logo;
}

/**
 * Get primary color
 */
export function getPrimaryColor(): string {
  return currentBrandConfig.primaryColor;
}

/**
 * Get secondary color
 */
export function getSecondaryColor(): string {
  return currentBrandConfig.secondaryColor;
}

/**
 * Get accent color
 */
export function getAccentColor(): string {
  return currentBrandConfig.accentColor || currentBrandConfig.primaryColor;
}

/* ---------- contrast helpers ---------- */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: string, b: string): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return 1;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Return a version of `color` that is readable as TEXT on `background`.
 *
 * Brand colours are chosen to look good as fills, not as glyphs - Vizora's own
 * neon is 1.65:1 on white, which is illegible. This walks the colour toward
 * black (on a light background) or white (on a dark one) until it clears the
 * WCAG AA threshold for normal text, preserving hue as far as possible.
 *
 * Exported for tests: the ratios must be computed, not asserted by hand.
 */
export function readableInk(color: string, background: string, minRatio = 4.5): string {
  const base = hexToRgb(color);
  const bg = hexToRgb(background);
  if (!base || !bg) return color;
  if (contrastRatio(color, background) >= minRatio) return color;

  // Blend toward whichever endpoint moves away from the background.
  const target = relativeLuminance(bg) > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const candidate = toHex({
      r: base.r + (target.r - base.r) * t,
      g: base.g + (target.g - base.g) * t,
      b: base.b + (target.b - base.b) * t,
    });
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return toHex(target);
}

/**
 * Apply CSS variables for customization
 */
export function applyCSSVariables(config: BrandConfig = currentBrandConfig): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', config.primaryColor);
  root.style.setProperty('--brand-secondary', config.secondaryColor);
  root.style.setProperty('--brand-accent', config.accentColor || config.primaryColor);

  // Also override the theme's --primary so the entire UI adapts (sidebar, focus rings, buttons)
  // Only override if not using the default Vizora color to avoid flash
  if (config.id !== 'default') {
    root.style.setProperty('--primary', config.primaryColor);
    // `--primary` is a FILL colour and a tenant may legitimately pick one that
    // is unreadable as text (the Vizora neon itself is 1.65:1 on white). Derive
    // a text-safe ink per theme so brand-coloured labels stay legible.
    // These feed the theme-scoped `--primary-ink` rules rather than setting it
    // directly - an inline value would override both themes at once.
    root.style.setProperty('--brand-ink-light', readableInk(config.primaryColor, '#FFFFFF'));
    root.style.setProperty('--brand-ink-dark', readableInk(config.primaryColor, '#0C2229'));
  }

  // Font family
  if (config.fontFamily) {
    const fontMap: Record<string, string> = {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      serif: 'Georgia, "Times New Roman", serif',
      mono: '"Courier New", monospace',
    };
    root.style.setProperty('--brand-font-family', fontMap[config.fontFamily]);
  }

  // Custom CSS
  if (config.customCSS) {
    let styleEl = document.getElementById('brand-custom-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'brand-custom-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = config.customCSS;
  }
}

/**
 * Get styled logo component JSX
 */
export function getLogoComponent(): {
  src?: string;
  alt: string;
  fallback: string;
} {
  return {
    src: currentBrandConfig.logo,
    alt: currentBrandConfig.logoAlt || currentBrandConfig.name,
    fallback: currentBrandConfig.name.substring(0, 2).toUpperCase(),
  };
}

/**
 * Check if powered by badge should be shown
 */
export function shouldShowPoweredBy(): boolean {
  return currentBrandConfig.showPoweredBy;
}

/**
 * Get brand name
 */
export function getBrandName(): string {
  return currentBrandConfig.name;
}

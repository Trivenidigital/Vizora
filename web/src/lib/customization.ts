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

// Default brand configuration
const defaultBrandConfig: BrandConfig = {
  id: 'default',
  name: 'Vizora',
  primaryColor: '#0284c7',
  secondaryColor: '#38bdf8',
  accentColor: '#0ea5e9',
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

/**
 * Apply CSS variables for customization
 */
export function applyCSSVariables(config: BrandConfig = currentBrandConfig): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', config.primaryColor);
  root.style.setProperty('--brand-secondary', config.secondaryColor);
  root.style.setProperty('--brand-accent', config.accentColor || config.primaryColor);

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

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

/**
 * Default brand configuration (matches Vizora's brand colors).
 *
 * ── STILL THE RETIRED NEON, DELIBERATELY, AND IT OUTRANKS `:root` ─────────
 * These are not cosmetic defaults. `applyCSSVariables` below writes `--primary`
 * as an INLINE STYLE on <html> for any config whose id is not `'default'`, and
 * `CustomizationProvider` builds exactly such a config from the branding API —
 * so this triple (or the server's copy of it) decides `--primary` for the whole
 * authenticated app and beats the Little Worlds `:root` palette outright. No
 * organisation row currently stores a brand colour, so every signed-in tenant
 * takes the fallback. That is why the logged-in app is still neon after Phase 1
 * promoted the one palette to `:root`: the root token is correct and simply
 * never wins.
 *
 * They are NOT changed here because the authoritative copy is the server's —
 * `middleware/.../organizations.service.ts` `getBranding()` returns the same
 * triple and its comment requires the two to stay in sync. Moving the web side
 * alone would break that invariant and change nothing a user sees, since the
 * API response always wins for a signed-in session. Retiring the neon is a
 * coordinated web + middleware change (middleware deploy), not a web restyle.
 *
 * Exported so `CustomizationProvider` reads them instead of restating them:
 * this file is the one place the web side declares them.
 */
export const defaultBrandConfig: BrandConfig = {
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

  /*
   * Blend toward whichever endpoint actually contrasts better, measured.
   *
   * The obvious test — `relativeLuminance(bg) > 0.5 ? black : white` — is
   * wrong: the crossover where black stops beating white is at L ≈ 0.179, not
   * 0.5. For any mid-tone background in [0.179, 0.5] that test picks white when
   * black is strictly better, and since the loop below returns the endpoint if
   * nothing clears the threshold, it would hand back the WORSE of the two.
   */
  const BLACK = { r: 0, g: 0, b: 0 };
  const WHITE = { r: 255, g: 255, b: 255 };
  const target =
    contrastRatio('#000000', background) >= contrastRatio('#ffffff', background) ? BLACK : WHITE;
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
 * Does this branding carry Vizora's own default colours, i.e. did the tenant
 * never choose one?
 *
 * BRIDGE. See the long note at the call site in `applyCSSVariables` for why the
 * client has to recognise its own defaults at all, and what replaces this.
 *
 * Compares the triple only. `name`, `logoUrl` and the rest are real tenant
 * choices that a tenant may well have made without touching the colours, and
 * they do not feed `--primary`, so they must not affect this answer.
 *
 * Exported for tests: the whole point is that the predicate matches the values
 * the server actually sends.
 */
export function isUnbrandedDefault(config: BrandConfig): boolean {
  // Both sides optional: `accentColor` is optional on BrandConfig, so an absent
  // value on either side normalises to '' and two absences compare equal —
  // which is the right answer, not a coincidence worth tightening away.
  const eq = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  return (
    eq(config.primaryColor, defaultBrandConfig.primaryColor) &&
    eq(config.secondaryColor, defaultBrandConfig.secondaryColor) &&
    eq(config.accentColor, defaultBrandConfig.accentColor)
  );
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

  /*
   * Override the theme's `--primary` so the whole UI adapts — but ONLY when a
   * tenant actually chose a colour.
   *
   * ── The bug this guard was meant to prevent, and didn't ──────────────────
   * The condition used to be `config.id !== 'default'` alone. The intent was
   * right: don't override when the values are just Vizora's own defaults. The
   * implementation never matched it, because `CustomizationProvider` builds its
   * config from the branding API and stamps the real org id on it — so `id` is
   * never `'default'` for a signed-in user, and the guard passed even when the
   * triple was the untouched default.
   *
   * These writes are INLINE STYLES on <html>, which outrank every stylesheet
   * rule, so the effect was that `:root`'s Little Worlds `--primary` could never
   * win behind login. No organisation row stores a brand colour today, so every
   * tenant took the retired Electric Horizon neon: measured live, `.eh-btn-neon`
   * painted its `--lw-on-forest` label at 1.43:1 where the token pairing
   * promises 9.70:1.
   *
   * ── This is a BRIDGE, not the end state ──────────────────────────────────
   * Pattern-matching the default triple is the web-only half of the fix, and it
   * is exact rather than fuzzy on purpose: a tenant who deliberately picks
   * Vizora's own neon gets treated as unbranded, which is indistinguishable
   * from the correct outcome, and any other colour still overrides unchanged.
   *
   * The durable fix is for the SERVER to say whether branding was ever chosen —
   * a flag, or omitting the branding object entirely — instead of returning a
   * triple the client has to recognise. `getBranding()` in
   * middleware/src/modules/organizations/organizations.service.ts synthesises
   * this default, and its comment requires it to stay in sync with
   * `defaultBrandConfig` above. That change needs a middleware deploy and
   * belongs in W6, which already plans one. When it lands, delete
   * `isUnbrandedDefault` and guard on the server's answer.
   */
  if (config.id !== 'default' && !isUnbrandedDefault(config)) {
    root.style.setProperty('--primary', config.primaryColor);
    // `--primary` is a FILL colour and a tenant may legitimately pick one that
    // is unreadable as text (the Vizora neon itself is 1.65:1 on white). Derive
    // a text-safe ink per theme so brand-coloured labels stay legible.
    // These feed the theme-scoped `--primary-ink` rules rather than setting it
    // directly - an inline value would override both themes at once.
    // Derived against the REAL card surface each theme paints, not a notional
    // white. The light argument used to be plain white, which was right only by
    // coincidence — `--surface` happened to be white too. The Little Worlds
    // card is ivory, so deriving against white returns an ink a shade short of
    // AA on the surface it actually lands on. Keep these two arguments equal to
    // `--surface` in each theme.
    root.style.setProperty('--brand-ink-light', readableInk(config.primaryColor, '#fdfbf5'));
    /*
     * `--brand-ink-dark` is NOT set any more. Dark mode was removed (D1), which
     * took the `.dark` block — the only thing that ever read it — with it.
     * Writing it would leave a live-looking custom property on <html> that
     * nothing consumes, which is the shape of bug that gets "fixed" later by
     * someone wiring a new reader to it on the assumption it means something.
     * `readableInk` itself keeps working against any substrate and is still
     * covered for dark inputs by customization-ink.test.ts.
     */
  } else {
    /*
     * REMOVE, don't merely skip.
     *
     * This function runs more than once per page: `CustomizationProvider`
     * applies the localStorage-cached config first for a fast first paint, then
     * the API's answer when it arrives. So "unbranded" has to actively undo a
     * previous branded write — a tenant clearing their brand colour, or a cached
     * config from a different org, would otherwise leave a stale inline
     * `--primary` on <html> outranking `:root` forever. Skipping the write only
     * works if nothing ever wrote it, which is not a property this call has.
     *
     * `removeProperty` on an unset property is a no-op, so the common path
     * costs nothing.
     */
    root.style.removeProperty('--primary');
    root.style.removeProperty('--brand-ink-light');
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

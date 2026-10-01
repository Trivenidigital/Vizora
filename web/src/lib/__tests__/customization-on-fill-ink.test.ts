import { onFillInk, hoverFill, defaultBrandConfig } from '../customization';

/**
 * The INVERSE of what customization-ink.test.ts covers.
 *
 * That file pins "the brand colour as text on our surface". This one pins "our
 * text on the brand colour as a fill", which Phase 5's white-label matrix found
 * failing at 1.18:1 for a neon tenant while the forward direction was fine.
 *
 * Same discipline as the sibling file: COMPUTE the ratio, never assert a hex. A
 * test that expected a specific output would lock in whatever the implementation
 * happens to produce instead of the guarantee that matters.
 */

/** Independent WCAG implementation — deliberately not imported from the module under test. */
function ratio(hexA: string, hexB: string): number {
  const toRgb = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const lum = (h: string) =>
    toRgb(h)
      .map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      })
      .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
  const la = lum(hexA);
  const lb = lum(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const IVORY = '#f2efe4'; // the fixed --lw-on-forest, i.e. the old behaviour

/** The plan's three white-label matrix tenants, plus Vizora's own. */
const MATRIX = [
  { name: 'dark brand (navy)', fill: '#1a237e' },
  { name: 'light brand (pale yellow)', fill: '#ffd54f' },
  { name: 'neon brand', fill: '#39ff14' },
  { name: 'Vizora forest (unbranded default)', fill: '#1f4230' },
];

describe('onFillInk — text on a tenant brand fill', () => {
  it.each(MATRIX)('clears AA on the $name fill', ({ fill }) => {
    expect(ratio(onFillInk(fill), fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('is what the fixed ivory could not do: the light and neon brands failed', () => {
    // The premise. Without these two the token would not need to exist.
    expect(ratio(IVORY, '#39ff14')).toBeLessThan(1.5);
    expect(ratio(IVORY, '#ffd54f')).toBeLessThan(1.5);
  });

  it('keeps the Little Worlds ivory where the ivory already worked', () => {
    // A dark tenant fill and Vizora's own forest must not churn onto a computed
    // grey: the palette values are preferred when they clear the bar.
    expect(onFillInk('#1f4230')).toBe(IVORY);
    expect(onFillInk('#1a237e')).toBe(IVORY);
  });

  it('is not consulted for the unbranded default, which is still the EH neon', () => {
    /*
     * `defaultBrandConfig.primaryColor` is #00E5A0 — a frozen value that
     * `customization-branding-guard.test.ts` pins, NOT the forest `:root`
     * paints. A tenant matching it takes `isUnbrandedDefault`'s branch, where
     * applyCSSVariables REMOVES the inline properties and the CSS defaults
     * apply, so this function never runs for them.
     *
     * Asserted because it is the thing most likely to be misread: the honest
     * answer for the neon as a FILL is the dark ink, and that is only harmless
     * because nothing asks.
     */
    expect(defaultBrandConfig.primaryColor).toBe('#00E5A0');
    expect(ratio(onFillInk(defaultBrandConfig.primaryColor), defaultBrandConfig.primaryColor)).toBeGreaterThanOrEqual(4.5);
  });

  it('handles a mid-tone fill that carries neither end of the pair', () => {
    // Where the blend fallback earns its place rather than being dead code.
    const mid = '#8a8a7a';
    expect(ratio(IVORY, mid)).toBeLessThan(4.5);
    expect(ratio('#23261f', mid)).toBeLessThan(4.5);
    expect(ratio(onFillInk(mid), mid)).toBeGreaterThanOrEqual(4.5);
  });

  it('degrades to the ivory on an unparseable colour rather than throwing', () => {
    expect(onFillInk('not-a-colour')).toBe(IVORY);
  });
});

describe('hoverFill — the derived ink must survive the hover too', () => {
  it.each(MATRIX)('keeps the ink readable on the $name hover fill', ({ fill }) => {
    const ink = onFillInk(fill);
    expect(ratio(ink, hoverFill(fill, ink))).toBeGreaterThanOrEqual(4.5);
  });

  it('is why the resting fix alone was not enough', () => {
    // The static --primary-light, which every tenant used to hover to.
    const STATIC_HOVER = '#2b5942';
    const lightTenantInk = onFillInk('#ffd54f');
    expect(ratio(lightTenantInk, STATIC_HOVER)).toBeLessThan(2);
    // Derived instead, the same ink clears AA.
    expect(ratio(lightTenantInk, hoverFill('#ffd54f', lightTenantInk))).toBeGreaterThanOrEqual(4.5);
  });

  it('moves the fill rather than leaving it unchanged', () => {
    expect(hoverFill('#39ff14', onFillInk('#39ff14'))).not.toBe('#39ff14');
  });
});

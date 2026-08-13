import { readableInk } from '../customization';

/**
 * These tests COMPUTE the contrast ratio rather than asserting a specific hex.
 *
 * That is deliberate. `docs/plans/2026-08-03-full-app-rebrand.md` records that
 * an earlier hand-written contrast comment got four of six numbers wrong, so a
 * test that hard-codes "expect(readableInk(x)).toBe('#00745B')" would only lock
 * in whatever the implementation happens to produce. What actually matters is
 * the guarantee: whatever comes back is legible on the given background.
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

const WHITE = '#FFFFFF';
const DARK_SURFACE = '#0C2229';

describe('readableInk', () => {
  it('rescues the Vizora neon, which is illegible as text on white', () => {
    // The premise of the whole ink token: #00E5A0 is ~1.65:1 on white.
    expect(ratio('#00E5A0', WHITE)).toBeLessThan(2);
    expect(ratio(readableInk('#00E5A0', WHITE), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves a colour alone when it already passes', () => {
    // Near-black on white is far past AA and must not be altered.
    const already = '#111111';
    expect(readableInk(already, WHITE)).toBe(already);
  });

  it('lightens rather than darkens against a dark substrate', () => {
    const ink = readableInk('#00745B', DARK_SURFACE);
    expect(ratio(ink, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('produces a legible ink for arbitrary tenant brand colours', () => {
    // A tenant may pick anything; every result must clear AA on both substrates.
    const tenantColours = ['#FFFF00', '#0284c7', '#FF00FF', '#00E5A0', '#808080', '#123456'];
    for (const c of tenantColours) {
      expect(ratio(readableInk(c, WHITE), WHITE)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(readableInk(c, DARK_SURFACE), DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('returns the input unchanged when given a malformed colour', () => {
    expect(readableInk('not-a-colour', WHITE)).toBe('not-a-colour');
  });
});

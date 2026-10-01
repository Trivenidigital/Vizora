const { cssVarColors, cssVarSemanticColors } = require('../../../tailwind.theme.cjs');
const tailwindConfig = require('../../../tailwind.config.js');

/**
 * A ramp must never be replaced by a flat colour of the same name.
 *
 * `theme.extend.colors` holds two kinds of entry: RAMPS (`success` as an object
 * of 50…900) and FLAT semantic tokens (`surface`, `brand`, and — sharing four
 * names with the ramps — `success`, `warning`, `error`, `info`). Spreading the
 * flat set over the ramps replaces those four objects with strings, and
 * Tailwind does not complain: it simply stops emitting every `-50`…`-900`
 * class for them.
 *
 * That shipped. 141 classes across the app went dead at once, including
 * `Toast`'s four fills — whose shades are the ONLY values that clear 4.5:1
 * against a white label, and which were left painting white text on no
 * background — and the dashboard's "5 online", which is how it was eventually
 * caught: a 391-pixel screenshot diff, green to grey.
 *
 * Nothing else catches this. It is not a type error (both are valid colour
 * values), not a lint error, not a build failure, and the ratchet does not look
 * at the config. A class that emits nothing looks exactly like a class someone
 * meant to leave off.
 *
 * The fix is `DEFAULT` — Tailwind's own idiom for a name that is both a scale
 * and a single colour. This test pins that it stays that way.
 */
describe('colour scales are not shadowed by flat tokens', () => {
  const colors = tailwindConfig.theme.extend.colors as Record<string, unknown>;

  it.each(Object.keys(cssVarColors))('the %s ramp still resolves as a scale', (family) => {
    const entry = colors[family];
    expect(typeof entry).toBe('object');
    // The numeric scale specifically — a `{ DEFAULT }`-only object would pass a
    // bare typeof check while every numbered class stayed dead.
    for (const step of Object.keys((cssVarColors as Record<string, object>)[family])) {
      expect(entry).toHaveProperty(step);
    }
  });

  it('every flat token that shares a ramp name is exposed as that ramp DEFAULT', () => {
    const shared = Object.keys(cssVarSemanticColors).filter((k) => k in cssVarColors);
    // If this is ever empty the test below proves nothing, so assert the
    // premise: these four are exactly the overlap that caused the outage.
    expect(shared.sort()).toEqual(['error', 'info', 'success', 'warning']);

    for (const name of shared) {
      const entry = colors[name] as Record<string, string>;
      expect(entry.DEFAULT).toBe((cssVarSemanticColors as Record<string, string>)[name]);
    }
  });

  it('flat tokens that share no ramp name are still flat strings', () => {
    for (const name of Object.keys(cssVarSemanticColors)) {
      if (name in cssVarColors) continue;
      expect(typeof colors[name]).toBe('string');
    }
  });
});

/**
 * Tailwind's view of the design tokens.
 *
 * This file no longer holds any values. `src/theme/palette.js` does — see its
 * header for why four copies of the same numbers existed and what now reads
 * from where. What lives here is the DERIVATION Tailwind needs:
 *
 *   cssVarColors / cssVarEhColors   the colour map the config consumes, where
 *                                   every entry is `rgb(var(--c-…) / <alpha-value>)`
 *                                   instead of a literal hex
 *   colorVariableDeclarations()     the exact `--c-*` text globals.css declares
 *
 * ── Why CSS variables, and why CHANNELS rather than hex ───────────────────
 * Pointing the Tailwind colour map at CSS variables is what lets Phase 1
 * re-theme `bg-primary-500` from `:root` instead of from a rebuild. But a
 * variable holding `#00E5A0` cannot carry an opacity modifier: Tailwind expands
 * `bg-error-500/10` to `rgb(<value> / 0.1)`, and `rgb(#ef4444 / 0.1)` is not
 * valid CSS, so the declaration is dropped and the tint silently disappears.
 * There are 27 such usages in `web/src` today (`bg-error-500/10`,
 * `bg-success-500/10`, `border-error-500/20`, …) — every one of them a visible
 * status tint. So the variables hold bare channels (`239 68 68`) and the map
 * wraps them, which keeps all 27 working. This is the documented Tailwind v3
 * contract for themable colours, not a trick.
 *
 * The one exception is `eh.card`, which is an rgba with its own alpha and
 * therefore cannot be a channel triple. It stays a whole-colour variable, which
 * means `bg-eh-card/<n>` would not compose — checked, and there are zero such
 * usages.
 */
const { semanticColors, ehColors, ehCard, tokens, lwSemantic } = require('./src/theme/palette.js');

const VAR_PREFIX = '--c-';

/** `--c-primary-500`, `--c-eh-bg`, … */
const varName = (family, key) => `${VAR_PREFIX}${family}-${key}`;

/** `'#00E5A0'` -> `'0 229 160'`. Throws rather than emitting a broken variable. */
function hexToChannels(hex) {
  const body = String(hex).trim().replace(/^#/, '');
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`palette: expected a 3- or 6-digit hex colour, got "${hex}"`);
  }
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const alphaAware = (family, key) => `rgb(var(${varName(family, key)}) / <alpha-value>)`;

/** The 50–900 ramps, as variable references. */
const cssVarColors = Object.fromEntries(
  Object.entries(semanticColors).map(([family, ramp]) => [
    family,
    Object.fromEntries(Object.keys(ramp).map((key) => [key, alphaAware(family, key)])),
  ]),
);

/** The `eh-*` namespace, as variable references. See the `card` note above. */
const cssVarEhColors = {
  ...Object.fromEntries(Object.keys(ehColors).map((key) => [key, alphaAware('eh', key)])),
  card: `var(${varName('eh', 'card')})`,
};

/**
 * The SEMANTIC tokens as named, channel-backed Tailwind colours.
 *
 * This is the half the original mechanism never covered, and the reason 55
 * `bg-[var(--surface)]/80`-shaped declarations emit nothing today. Every entry
 * is named after the `:root` token it mirrors, so the mapping is mechanical and
 * a codemod can derive it rather than consulting a table — with two deliberate
 * exceptions, `brand` and `brand-ink`, which are NOT channel forms of the
 * tenant-overridable `--primary`. See the note in palette.js.
 *
 * Authors write `bg-surface/80`, `border-error/30`, `bg-brand/10`. NEVER
 * `bg-[var(--surface)]/80` — that is the form that silently emits nothing, and
 * `src/__tests__/no-var-opacity.test.ts` fails the build if it reappears.
 */
const cssVarSemanticColors = Object.fromEntries(
  Object.keys(lwSemantic).map((key) => [key, alphaAware('lw', key)]),
);

/**
 * The exact block `globals.css` must declare, generated from the palette.
 *
 * globals.css is hand-authored CSS with no build step, so the declarations
 * cannot literally be generated into it at compile time — which would leave the
 * hexes written out in two places with nothing holding them together. So they
 * ARE written in two places, and `src/theme/__tests__/css-token-sync.test.ts`
 * fails the build if the two ever disagree. Drift is caught, not hoped against.
 */
function colorVariableDeclarations(indent = '    ') {
  const lines = [];
  for (const [family, ramp] of Object.entries(semanticColors)) {
    for (const [key, hex] of Object.entries(ramp)) {
      lines.push(`${indent}${varName(family, key)}: ${hexToChannels(hex)};`);
    }
  }
  for (const [key, hex] of Object.entries(ehColors)) {
    lines.push(`${indent}${varName('eh', key)}: ${hexToChannels(hex)};`);
  }
  lines.push(`${indent}${varName('eh', 'card')}: ${ehCard};`);
  for (const [key, hex] of Object.entries(lwSemantic)) {
    lines.push(`${indent}${varName('lw', key)}: ${hexToChannels(hex)};`);
  }
  return lines.join('\n');
}

module.exports = {
  semanticColors,
  tokens,
  ehColors,
  ehCard,
  cssVarColors,
  cssVarEhColors,
  cssVarSemanticColors,
  lwSemantic,
  colorVariableDeclarations,
  hexToChannels,
  varName,
};

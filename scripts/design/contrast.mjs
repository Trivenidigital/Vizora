/**
 * WCAG contrast calculator for the design tokens.
 *
 * Exists because `docs/plans/2026-08-03-full-app-rebrand.md` records that four
 * of six hand-written ratios in an earlier pass were WRONG. Ratios in comments
 * and commit messages come from this script, never from judgement.
 *
 *   node scripts/design/contrast.mjs                 # the token matrix
 *   node scripts/design/contrast.mjs '#1f4230' '#f5f1e8'   # one pair
 *   node scripts/design/contrast.mjs --find '#b08a3e' '#fdfbf5' 4.5
 *       ^ darken/lighten a hue until it clears a threshold, preserving hue
 */
const hex = (c) => {
  const m = String(c).trim().replace('#', '');
  const f = m.length === 3 ? m.split('').map((x) => x + x).join('') : m;
  const n = parseInt(f, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Composite a translucent colour over an opaque one (Porter-Duff source-over). */
export const over = (fg, a, bg) => ({
  r: fg.r * a + bg.r * (1 - a),
  g: fg.g * a + bg.g * (1 - a),
  b: fg.b * a + bg.b * (1 - a),
});

const lum = ({ r, g, b }) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export const ratio = (a, b) => {
  const [x, y] = [typeof a === 'string' ? hex(a) : a, typeof b === 'string' ? hex(b) : b];
  const [l1, l2] = [lum(x), lum(y)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Walk a colour toward black (or white) until it clears `min`, keeping hue. */
export function find(color, background, min = 4.5) {
  if (ratio(color, background) >= min) return color;
  const base = hex(color);
  const target = ratio('#000000', background) >= ratio('#ffffff', background)
    ? { r: 0, g: 0, b: 0 }
    : { r: 255, g: 255, b: 255 };
  for (let t = 0.01; t <= 1.0001; t += 0.01) {
    const c = toHex({
      r: base.r + (target.r - base.r) * t,
      g: base.g + (target.g - base.g) * t,
      b: base.b + (target.b - base.b) * t,
    });
    if (ratio(c, background) >= min) return c;
  }
  return toHex(target);
}

const args = process.argv.slice(2);
if (args[0] === '--find') {
  const [, c, bg, min] = args;
  const out = find(c, bg, parseFloat(min || '4.5'));
  console.log(`${c} on ${bg}: ${ratio(c, bg).toFixed(2)}:1 -> ${out} = ${ratio(out, bg).toFixed(2)}:1`);
} else if (args.length >= 2) {
  console.log(`${args[0]} on ${args[1]} = ${ratio(args[0], args[1]).toFixed(2)}:1`);
} else {
  console.log('pass two colours, or --find <colour> <bg> <min>');
}

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * `-[var(--token)]/NN` MUST NOT EXIST. It compiles to nothing.
 *
 * Tailwind builds an opacity modifier as `rgb(<channels> / <alpha>)`. A CSS
 * variable holding a whole colour (`#fdfbf5`) cannot go in that slot —
 * `rgb(#fdfbf5 / .8)` is invalid — so Tailwind DISCARDS the entire declaration.
 * No warning, no fallback, no colour. The element simply has no background,
 * border or ring, and it looks exactly like an element someone meant to leave
 * transparent.
 *
 * This shipped: 55 such declarations across 19 files, including the dashboard
 * header, which had no background at all and let content scroll underneath it
 * behind nothing but a blur.
 *
 * ── Why this is a GATE and not a ratchet ──────────────────────────────────
 * The design-debt ratchet counts things that are merely old. This counts things
 * that are BROKEN, and the number that is correct is zero, so it does not get a
 * baseline to creep back toward.
 *
 * It matters most during the Phase 3 codemod. 390 opacity modifiers work today
 * on `[#hex]` and palette classes (177 + 213), and every one of them dies the
 * moment a rewrite turns it into `-[var(--token)]/NN`. That is seven times the
 * size of the bug above, it would land in one batch, and — being invisible —
 * would pass review. This test is what makes that failure loud.
 *
 * ── What to write instead ─────────────────────────────────────────────────
 * The named, channel-backed colours in `tailwind.config.js`:
 *     bg-[var(--surface)]/80   ->  bg-surface/80
 *     border-[var(--error)]/30 ->  border-error/30
 *     bg-[var(--primary)]/10   ->  bg-brand/10
 * They are named after the `:root` tokens they mirror, so the rewrite is a
 * lookup. `brand`/`brand-ink` are the two deliberate exceptions — see the note
 * in `theme/palette.js` for why they are not called `primary`.
 *
 * WITHOUT an opacity modifier, `bg-[var(--surface)]` is perfectly fine and is
 * used ~3,400 times. This test targets the modifier only.
 */

const SRC = path.join(__dirname, '..');
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'generated']);

/**
 * The offending form: any Tailwind colour utility whose value is an arbitrary
 * `var()` AND which carries an opacity modifier.
 *
 * `__tests__` is NOT excluded — this file has to be able to see its own
 * fixtures, and a broken class in a test is still a broken class. The pattern
 * deliberately does not match a bare `-[var(--x)]`, which is correct and
 * common.
 */
const DEAD_FORM =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|accent|placeholder|shadow|caret)-\[var\(--[a-zA-Z0-9-]+\)\]\/\d+/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|cjs|mjs|css)$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

describe('no opacity modifier on an arbitrary var() colour', () => {
  it('finds zero occurrences in web/src', () => {
    const offences: string[] = [];

    for (const file of walk(SRC)) {
      // This file necessarily contains the pattern in its own documentation.
      if (path.basename(file) === 'no-var-opacity.test.ts') continue;

      const body = readFileSync(file, 'utf8');
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      body.split('\n').forEach((line, i) => {
        const hits = line.match(new RegExp(DEAD_FORM.source, 'g'));
        if (hits) offences.push(`  ${rel}:${i + 1}  ${hits.join(', ')}`);
      });
    }

    if (offences.length) {
      throw new Error(
        `${offences.length} declaration(s) use \`-[var(--x)]/NN\`, which Tailwind discards ` +
          `entirely — these elements render with NO colour at all:\n${offences.join('\n')}\n\n` +
          `Use the named channel-backed colours instead: bg-surface/80, border-error/30, ` +
          `bg-brand/10. See the header of this file.`,
      );
    }
    expect(offences).toEqual([]);
  });

  /**
   * A SECOND dead form, found while fixing the first.
   *
   * `bg-[var(--surface)]/50/50` — a double opacity modifier — was sitting in
   * `dashboard/health/page-client.tsx` at three sites. Tailwind rejects it
   * outright, so those panels were dead twice over: once for the `var()` and
   * once for the second `/50`. The colour map had counted them as ordinary
   * `var()` sites, so converting them mechanically produced `bg-surface/50/50`,
   * which is still dead — a rewrite that looks like a fix and changes nothing.
   *
   * Cheap to check, and exactly the kind of thing a codemod manufactures at
   * scale, so it is pinned rather than trusted.
   */
  it('finds no double opacity modifier', () => {
    const DOUBLE =
      /\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|accent|placeholder)-[a-z0-9-]+\/\d+\/\d+\b/g;
    const offences: string[] = [];
    for (const file of walk(SRC)) {
      if (path.basename(file) === 'no-var-opacity.test.ts') continue;
      const body = readFileSync(file, 'utf8');
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      body.split('\n').forEach((line, i) => {
        const hits = line.match(new RegExp(DOUBLE.source, 'g'));
        if (hits) offences.push(`  ${rel}:${i + 1}  ${hits.join(', ')}`);
      });
    }
    expect(offences).toEqual([]);
  });

  /**
   * A control. If the pattern ever stops matching — someone "tidies" the regex,
   * or a Tailwind upgrade changes the syntax — the test above would pass by
   * matching nothing, which is indistinguishable from success. This fails first
   * and says why.
   */
  it('the detector actually detects (negative control)', () => {
    const sample = '<div className="bg-[var(--surface)]/80 border-[var(--error)]/30" />';
    expect(sample.match(new RegExp(DEAD_FORM.source, 'g'))).toHaveLength(2);
    // And does NOT flag the correct forms.
    const good = '<div className="bg-surface/80 bg-[var(--surface)] border-error/30" />';
    expect(good.match(new RegExp(DEAD_FORM.source, 'g'))).toBeNull();
  });
});

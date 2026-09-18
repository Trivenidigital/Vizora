import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import baseline from './design-debt-ratchet.baseline.json';

/**
 * Colour debt may go DOWN. It may not go up.
 *
 * `docs/plans/2026-09-17-full-web-little-worlds-redesign.md` §2 measures ~2.3k
 * hard-coded colour sites, and §4 Phase 3 retires them by codemod over many
 * PRs. A months-long migration with no counter regresses silently: one hurried
 * `bg-gray-100` lands in an unrelated feature PR, nobody notices, and the
 * finish line moves away from you. This test is the counter.
 *
 * It is a ratchet, not a gate — it never demands progress, it only refuses
 * regression. So it stays green for work that touches no colour at all.
 *
 * ── Lowering a number legitimately ────────────────────────────────────────
 *   1. Replace the literal with a token: `text-[#00E5A0]` -> `text-[var(--primary-ink)]`,
 *      `bg-gray-100` -> `bg-[var(--surface-secondary)]`, a hex in a TS object
 *      -> the matching entry in `src/theme/palette.js`.
 *   2. Re-run this test. It prints the new counts.
 *   3. Paste them into `design-debt-ratchet.baseline.json` IN THE SAME COMMIT.
 * Step 3 is what makes the ratchet hold: a baseline left high lets the debt
 * creep back to it for free.
 *
 * ── What is counted, and what is deliberately not ─────────────────────────
 * `src/components/landing/**` is excluded: the marketing homepage is a
 * finished, separately-reviewed surface on the `.lw` scope and its literals are
 * intentional art direction, not debt. Test files are excluded because a test
 * that asserts on a colour must name it.
 *
 * Comments are NOT stripped. That is deliberate and cuts both ways: Tailwind
 * scans comments when it builds its class list (a trap this repo has already
 * been bitten by), so a hex in a comment is not automatically inert — but it
 * also means documenting a migration can nudge a count up. Prefer naming the
 * token over quoting the hex when writing those comments.
 *
 * (a) and (b) OVERLAP by construction: every `[#abc]` is also a `#abc`. They
 * are tracked separately because they are retired by different means — (b) by a
 * class-level codemod, (a) also by rewriting TS values.
 */

const SRC = path.join(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, 'design-debt-ratchet.baseline.json');

const EXCLUDED_DIRS = new Set(['node_modules', '.next', '__tests__', 'generated']);

/** Art-directed marketing surface — see the note above. Path fragments, POSIX-style. */
const EXCLUDED_PATHS = ['components/landing/'];

const PATTERNS = {
  hexLiterals: /#[0-9a-fA-F]{3,8}\b/g,
  tailwindArbitraryColors: /\[#[0-9a-fA-F]{3,8}\]/g,
  rawPaletteClasses:
    /\b(?:bg|text|border|ring|from|to|via)-(?:gray|slate|zinc|neutral|blue|indigo|purple|green|emerald|teal|cyan|red|rose|yellow|amber|orange)-\d+\b/g,
  darkVariants: /\bdark:/g,
} as const;

type Metric = keyof typeof PATTERNS;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function countAll() {
  const files = walk(SRC).filter((f) => {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    return !EXCLUDED_PATHS.some((p) => rel.startsWith(p));
  });

  const counts = { hexLiterals: 0, tailwindArbitraryColors: 0, rawPaletteClasses: 0, darkVariants: 0 };
  const worst: Record<Metric, Array<{ file: string; n: number }>> = {
    hexLiterals: [],
    tailwindArbitraryColors: [],
    rawPaletteClasses: [],
    darkVariants: [],
  };

  for (const file of files) {
    const body = readFileSync(file, 'utf8');
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    for (const key of Object.keys(PATTERNS) as Metric[]) {
      // A /g regex carries lastIndex across calls, so it must not be shared
      // between files — reuse would silently skip matches in the next file.
      const n = (body.match(new RegExp(PATTERNS[key].source, 'g')) || []).length;
      if (n) {
        counts[key] += n;
        worst[key].push({ file: rel, n });
      }
    }
  }

  for (const key of Object.keys(worst) as Metric[]) worst[key].sort((a, b) => b.n - a.n);
  return { counts, worst, fileCount: files.length };
}

describe('design debt ratchet', () => {
  const { counts, worst, fileCount } = countAll();

  it('reports the current counts', () => {
    const lines = (Object.keys(PATTERNS) as Metric[]).map((key) => {
      const now = counts[key];
      const was = (baseline.counts as Record<string, number>)[key];
      const delta = now - was;
      const sign = delta > 0 ? `+${delta}` : String(delta);
      const top = worst[key]
        .slice(0, 3)
        .map((w) => `${w.file} (${w.n})`)
        .join(', ');
      return `  ${key.padEnd(24)} ${String(now).padStart(5)}  (baseline ${was}, ${sign})${top ? `  top: ${top}` : ''}`;
    });
    // eslint-disable-next-line no-console
    console.log(`\ndesign debt across ${fileCount} source files:\n${lines.join('\n')}\n`);
    expect(fileCount).toBeGreaterThan(0);
  });

  for (const key of Object.keys(PATTERNS) as Metric[]) {
    it(`${key} does not increase`, () => {
      const now = counts[key];
      const was = (baseline.counts as Record<string, number>)[key];
      expect(typeof was).toBe('number');
      if (now > was) {
        const top = worst[key]
          .slice(0, 5)
          .map((w) => `    ${w.file}: ${w.n}`)
          .join('\n');
        throw new Error(
          `${key} rose from ${was} to ${now} (+${now - was}).\n` +
            `Replace the new literal(s) with tokens — see the header of this file.\n` +
            `Heaviest files:\n${top}\n` +
            `If the rise is genuinely intended, raise the number in ${path.basename(BASELINE_FILE)} ` +
            `in the same commit and say why in the message.`,
        );
      }
      expect(now).toBeLessThanOrEqual(was);
    });
  }
});

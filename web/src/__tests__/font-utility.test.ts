import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * `font-[var(--x)]` is a silent-failure pattern and must not come back.
 *
 * Tailwind types a bare `var()` in the `font-` namespace as font-WEIGHT, so
 * `font-[var(--font-sora)]` compiles to `font-weight: var(--font-sora)`. That
 * resolves to a font stack, which is not a valid weight, so the declaration is
 * dropped and the typeface silently never applies. It shipped that way at 35
 * call sites — passing typecheck, lint and the whole test suite.
 *
 * Note this is NOT the same as `text-[var(--x)]`, which is safe: `dataTypes.color`
 * accepts anything starting with `var(` and `dataTypes.length` rejects it, so
 * inside colour namespaces the inference cannot go wrong. The `font-` namespace
 * has no such protection. The fix is the named `font-sora` utility from
 * tailwind.config.js, which can only emit font-family.
 */
const SRC = path.join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('font utility hygiene', () => {
  const files = walk(SRC);

  it('no source file uses the mistyped font-[var(...)] arbitrary value', () => {
    const offenders: string[] = [];
    for (const file of files) {
      // This file necessarily contains the pattern in order to search for it.
      if (path.resolve(file) === path.resolve(__filename)) continue;
      const body = readFileSync(file, 'utf8');
      body.split('\n').forEach((line, i) => {
        // Ignore prose. The defect is deliberately documented in comments, so a
        // naive substring scan would flag the documentation describing it.
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        if (line.includes('font-[var(')) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the named font-sora utility is actually used', () => {
    const users = files.filter(f => readFileSync(f, 'utf8').includes('font-sora'));
    expect(users.length).toBeGreaterThan(0);
  });

  it('tailwind config defines the font families the utilities depend on', () => {
    const cfg = readFileSync(path.join(SRC, '..', 'tailwind.config.js'), 'utf8');
    expect(cfg).toMatch(/fontFamily:\s*\{/);
    expect(cfg).toMatch(/sora:\s*\['var\(--font-sora\)'/);
  });
});

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Claims the product cannot support must not come back.
 *
 * These were flagged during the homepage work and were still shipping on the
 * auth surfaces months later, because a restyle moves copy around without
 * reading it — the redesign plan's W1 says in as many words: do not restyle a
 * false claim into the new palette. Removing them once is not enough; the
 * strings are exactly the kind of thing that gets reinstated from an old
 * mockup, a copy doc, or a reverted branch.
 *
 * Each entry says WHY it is unsupportable, because "banned string" with no
 * reason is the sort of rule a future author deletes rather than obeys:
 *
 *   2,500+ organizations  — a customer count nobody has substantiated.
 *   AI-powered            — there is no AI in the content or scheduling path.
 *                           `AGENT_AI_PROVIDER` defaults to `heuristic`.
 *   99.9% uptime          — NOT false in itself: `/sla` is a published
 *                           commitment and states this figure. What is wrong
 *                           is presenting it UNQUALIFIED, because that SLA
 *                           scopes it to Pro and Enterprise — so a signup form
 *                           offering a free trial was promising a paid-tier
 *                           guarantee. The SLA page is excluded below for
 *                           exactly this reason: that is where the number
 *                           belongs, with its scope attached.
 *   256-bit encrypted     — a specific cipher-strength claim about a
 *                           connection whose negotiated suite is not pinned.
 *
 * ── Two deliberate exclusions, both load-bearing ─────────────────────────
 * `app/sla/` — the SLA document itself. It is where the uptime commitment is
 * DEFINED, with the tier scope attached. Banning the figure from the page that
 * qualifies it would be the wrong fix.
 *
 * `components/landing/` — the marketing homepage, a separately reviewed
 * surface that must stay byte-identical while that review is open. It carries
 * the uptime figure in its pricing table, where it is attached to the
 * Enterprise plan and so is qualified in the same way. Not this batch's to
 * change; raise it with the homepage review instead of editing it here.
 *
 * Everything else is in scope: a claim is a claim wherever it renders. If one
 * of these becomes true and provable, delete its entry in the same commit that
 * re-adds it, and say what made it true.
 */

const SRC = path.join(__dirname, '..');
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'generated', '__tests__']);

/** POSIX-style, relative to `web/src`. See the two exclusions in the header. */
const EXCLUDED_PATHS = ['app/sla/', 'components/landing/'];

const BANNED: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /2,?500\+?\s+organi[sz]ations/i, why: 'unsubstantiated customer count' },
  { pattern: /\bAI[- ]powered\b/i, why: 'no AI in the content or scheduling path' },
  { pattern: /99\.9\s*%\s*uptime/i, why: 'the /sla commitment scopes this to Pro and Enterprise' },
  { pattern: /\b256-bit\b/i, why: 'cipher strength is not pinned' },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(full);
  }
  return out;
}

describe('unsupportable marketing claims', () => {
  it('none appear anywhere in web/src', () => {
    const offences: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      if (EXCLUDED_PATHS.some((p) => rel.startsWith(p))) continue;
      const body = readFileSync(file, 'utf8');
      body.split('\n').forEach((line, i) => {
        for (const { pattern, why } of BANNED) {
          if (pattern.test(line)) offences.push(`  ${rel}:${i + 1}  (${why})  ${line.trim().slice(0, 90)}`);
        }
      });
    }
    if (offences.length) {
      throw new Error(
        `Unsupportable claim(s) found:\n${offences.join('\n')}\n\n` +
          `If one of these has become true and provable, remove its entry from this ` +
          `test in the same commit and say what made it true.`,
      );
    }
    expect(offences).toEqual([]);
  });

  /**
   * The detector must be able to fail. Without this, deleting a pattern by
   * accident leaves a test that passes by checking nothing.
   */
  it('the detector actually detects (negative control)', () => {
    const sample = [
      'Join 2,500+ organizations managing their displays.',
      'AI-powered content & scheduling',
      '99.9% uptime, enterprise security',
      '256-bit encrypted',
    ];
    for (const line of sample) {
      expect(BANNED.some(({ pattern }) => pattern.test(line))).toBe(true);
    }
    expect(BANNED.some(({ pattern }) => pattern.test('Encrypted connection'))).toBe(false);
  });
});

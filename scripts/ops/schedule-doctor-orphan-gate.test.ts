/**
 * schedule-doctor — the absent-display check must stay READ-ONLY.
 *
 * Source-scan guards, in the shape of `content-lifecycle-archive-gate.test.ts`.
 * They exist because of the exact failure they pin (K28): check 2 built its
 * existence oracle from the `isDisabled`-filtered display list — a list that
 * exists only to suppress paging (#259) — so a schedule pointing at a merely
 * DISABLED display read as pointing at a deleted one. It was then PATCHed to
 * `isActive: false` and announced with a critical alert saying the display "no
 * longer exists", which is false in both halves.
 *
 * The behavioural tests in `schedule-doctor-resolution.test.ts` prove today's
 * agent writes nothing here. This file pins the SHAPE, because the write is
 * cheap to reintroduce and the harm is invisible on any tenant with no disabled
 * displays and no truncated walk — and it is exactly a "restore the auto-fix"
 * tidy-up that would do it.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'schedule-doctor.ts'), 'utf8');

/**
 * The source of one `// ─── Check N:` section, bounded by the next `// ─── `
 * banner. Slicing by banner keeps these assertions readable; a banner that
 * moves fails loudly here rather than silently widening the window.
 */
function checkSection(n: number): string {
  const start = source.indexOf(`// ─── Check ${n}:`);
  assert.ok(start > -1, `no banner for check ${n} — the section markers moved`);
  const end = source.indexOf('  // ─── ', start + 10);
  assert.ok(end > start, `no banner after check ${n} — cannot bound it`);
  return source.slice(start, end);
}

test('check 2 issues NO write of any kind', () => {
  const section = codeOf(checkSection(2));
  for (const write of ['api.patch', 'api.post', 'api.put', 'api.delete', 'sendInlineAlert']) {
    assert.ok(
      !section.includes(write),
      `check 2 must not call \`${write}\`. A schedule pointing at a display this scan did not ` +
        `see is evidence that the AGENT'S VIEW is wrong (org scope, response shape, a short page ` +
        `walk) — a deleted display cascades its schedules away, so the tenant-data reading is ` +
        `impossible. Mutating customer schedules off a view we have just called unreliable is ` +
        `the K28 damage.`,
    );
  }
});

/**
 * The section with its `//` comments removed.
 *
 * The wording assertions below are about what the agent EMITS, and the block
 * comment at check 2 quotes the old wording verbatim to explain why it is gone.
 * Without this the explanation would fail the test that the explanation exists
 * for — and the obvious "fix" would be to delete the explanation.
 */
function codeOf(section: string): string {
  return section.replace(/^\s*\/\/.*$/gm, '');
}

test('check 2 raises no critical, and never claims the display was deleted', () => {
  const section = codeOf(checkSection(2));
  assert.ok(
    !section.includes("severity: 'critical'"),
    'a finding that can only mean "this agent cannot see straight" is not a tenant emergency',
  );
  assert.ok(
    !/no longer exists|nonexistent/.test(section),
    'the old wording asserted a deletion that the FK cascade makes impossible',
  );
  assert.match(
    section,
    /absent from this scan/,
    'the finding must describe what was actually observed: absence from THIS scan',
  );
});

test('check 2 runs only under a complete scan', () => {
  const section = checkSection(2);
  assert.match(
    section,
    /if \(scanComplete\) \{/,
    'a truncated walk cannot prove nonexistence — the same reasoning the resolution sweep ' +
      'already applies, and the reason content-lifecycle gates its archive path',
  );
  const gateIdx = section.indexOf('if (scanComplete) {');
  const oracleIdx = section.indexOf('displayIds.has(');
  assert.ok(gateIdx > -1 && oracleIdx > gateIdx, 'the oracle read must sit INSIDE the gate');
  assert.match(source, /SKIP absent-display check/, 'the skipped branch must say so out loud');
});

test('the existence oracle is built from allDisplays, the suppression list is not', () => {
  // The one-line heart of K28.
  assert.match(
    source,
    /const displayIds = new Set\(allDisplays\.map\(d => d\.id\)\)/,
    '`displayIds` answers "does this display exist" and must be built from the RAW scan',
  );
  assert.ok(
    !source.includes('new Set(alertableDisplays.map(d => d.id))'),
    'building the existence oracle from the alerting-suppression list is the defect itself',
  );
});

test('check 4 keeps iterating the FILTERED list (#259)', () => {
  // The over-correction guard, pinned structurally. Coverage gaps are a paging
  // decision, and an operator-disabled display must not page.
  assert.match(checkSection(4), /for \(const display of alertableDisplays\)/);
  assert.ok(
    !checkSection(4).includes('for (const display of allDisplays)'),
    'iterating the raw list here reproduces the 2026-08-02 22:30 coverage_gap incident',
  );
});

test('the two display bindings exist under names that carry their meaning', () => {
  assert.match(source, /let allDisplays: DisplayItem\[\]/, 'the existence universe');
  assert.match(source, /const alertableDisplays = allDisplays\.filter/, 'the suppression list');
  // A reassignment is how the two collapsed back into one the first time.
  assert.ok(
    !/^\s*allDisplays = allDisplays\.filter/m.test(source),
    'allDisplays must never be narrowed in place — that recreates the merged binding',
  );
});

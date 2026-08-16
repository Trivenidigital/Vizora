/**
 * content-lifecycle — the DESTRUCTIVE call site must stay behind the gate.
 *
 * Source-scan guards, in the shape of the `pm2 flush` guards in
 * `lib/log-retention.test.ts`. They exist because of the exact failure they
 * pin: #353 introduced `contentScanComplete` and wired it to the incident
 * RESOLUTION set (`CONTENT_SCAN_TYPES`) while leaving the archive write
 * unconditional. The incomplete branch logged, raised `scan-truncated`, and
 * then fell straight through to `checkOrphanedContent`, archiving against the
 * partial playlist universe it had just declared unusable.
 *
 * A behavioural test alone would not have caught the un-gating either, because
 * the behaviour it protects is invisible on any tenant under the 501-playlist
 * boundary — which is every tenant in production today. So the call site is
 * pinned structurally as well as behaviourally.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'content-lifecycle.ts'), 'utf8');

/**
 * The `{ ... }` body of the first `if (<cond>) {` in the source.
 * Brace-counted rather than regex-matched so a nested block cannot end it early.
 */
function ifBlockBody(code: string, condition: string): string {
  const head = `if (${condition}) {`;
  const start = code.indexOf(head);
  assert.ok(start > -1, `no \`${head}\` in content-lifecycle.ts`);
  let depth = 0;
  for (let i = start + head.length - 1; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return code.slice(start + head.length, i);
    }
  }
  assert.fail(`unbalanced braces after \`${head}\``);
}

test('checkOrphanedContent is called ONCE, and only from inside the completeness gate', () => {
  const calls = source.match(/^\s*await checkOrphanedContent\(/gm) ?? [];
  assert.equal(
    calls.length,
    1,
    `expected exactly one call site, found ${calls.length} — every one of them must be gated`,
  );

  const gated = ifBlockBody(source, 'counters.contentScanComplete');
  assert.match(
    gated,
    /await checkOrphanedContent\(/,
    'the archive check must run INSIDE `if (counters.contentScanComplete)`. ' +
      'Un-gated, it archives customer content against a knowingly-partial reference universe, ' +
      'and archiving stops delivery to screens.',
  );
});

test('the skipped branch says so out loud', () => {
  // Silence here is the failure mode being prevented: a run that archived
  // nothing because it could not see, and a run that archived nothing because
  // there was nothing to archive, must not read the same in the log.
  assert.match(source, /SKIP orphan archive/);
});

test('checkExpiredContent is deliberately NOT gated', () => {
  // Different safety class. Its predicate reads only the item's own fields, so
  // a truncated list yields FEWER findings, never a wrong one. Gating it would
  // be cargo-culting the orphan gate onto a check that does not need it.
  const gated = ifBlockBody(source, 'counters.contentScanComplete');
  assert.ok(
    !gated.includes('checkExpiredContent('),
    'checkExpiredContent must stay outside the completeness gate',
  );
  assert.match(source, /^\s*await checkExpiredContent\(/m);
});

test('every archive POST is preceded by a per-item confirmation read', () => {
  // The inversion that makes the invariant untruncatable: the orphan path must
  // re-read each candidate before writing, not diff against a reconstructed
  // universe. Pinning the read here stops a "tidy-up" that drops it.
  assert.match(
    source,
    /await api\.get<ContentDetail>\(`\/content\/\$\{item\.id\}`\)/,
    'the orphan path must confirm each candidate with GET /content/:id before archiving',
  );
  assert.match(
    source,
    /detail\.playlistItems\.length > 0/,
    'the confirmation must refuse any candidate that carries playlist references',
  );
});

test('the truncation remediation does not tell the operator to raise the cap', () => {
  // The pre-existing text said "Raise the getAll page-walk cap", which is the
  // fix this change rejects — it re-arms the identical defect at 5000 and does
  // nothing at all about the reference TYPES the list can never carry.
  assert.ok(
    !source.includes('Raise the getAll page-walk cap'),
    'the old remediation text is still present — it reads as an instruction to re-arm the defect',
  );
  assert.match(
    source,
    /Do NOT raise the page-walk cap/,
    'the remediation must say so explicitly, or the next operator will do it',
  );
});

test('the reference universe includes layout zones and replacement pointers', () => {
  // GAP-1 and GAP-2. Both are invisible to `CONTENT_LIST_SELECT`, so a refactor
  // that "simplifies" the detail reads away silently reopens them.
  assert.match(source, /harvestZoneContentIds\(/, 'layout zone pins must be harvested (GAP-1)');
  assert.match(
    source,
    /referencedIds\.add\(detail\.replacementContentId\)/,
    'replacementContentId must join the reference set (GAP-2)',
  );
});

/**
 * Log retention — bounds disk WITHOUT destroying cross-service evidence.
 *
 * Pins the behaviour that replaces the daily global `pm2 flush`. Runs against a
 * real temp directory rather than a mocked fs: the whole point is what actually
 * happens to bytes on disk, and a mock would pin the mock.
 *
 * Several assertions here exist because an earlier revision PASSED them while
 * being wrong. Where that is so the test says which mutation it kills, so the
 * assertion does not get "simplified" back to the vacuous version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyLogRetention, trimMarker, trimToTail, type TrimFile } from './log-retention.js';

/** Matches the resolution used by the other ops tests (import.meta.dirname is
 *  undefined under the tsx transform). */
const opsDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const SMALL = { maxBytes: 4096, keepTailBytes: 1024 };

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'vizora-logret-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `count` numbered records, so we can assert WHICH end survived. */
function writeNumberedLines(path: string, count: number): void {
  let out = '';
  for (let i = 1; i <= count; i++) out += `line ${i} ${'x'.repeat(80)}\n`;
  writeFileSync(path, out);
}

/** Everything after the marker line. */
function bodyOf(path: string): string {
  const text = readFileSync(path, 'utf8');
  return text.slice(text.indexOf('\n') + 1);
}

// ─── The core guarantee ──────────────────────────────────────────────────────

test('a file under the cap is left byte-identical, however old', () => {
  withTempDir(dir => {
    const p = join(dir, 'middleware-out.log');
    writeFileSync(p, 'important evidence\n');
    // Nine days old — the previous age-based mechanism would have emptied this.
    const ancient = new Date(Date.now() - 9 * 24 * 3600 * 1000);
    utimesSync(p, ancient, ancient);

    const r = applyLogRetention(dir, { maxBytes: 1024 });

    assert.equal(readFileSync(p, 'utf8'), 'important evidence\n');
    assert.equal(r.trimmed.length, 0);
    assert.equal(r.untouched, 1);
  });
});

test('THE REGRESSION: a trimmed file still contains its most recent records', () => {
  // `pm2 flush` zeroed every service's log daily. Asserting only `size > 0`
  // would be satisfied by a file holding nothing but the marker — which an
  // earlier revision could actually produce — so assert real content survives.
  withTempDir(dir => {
    const p = join(dir, 'realtime-out.log');
    writeNumberedLines(p, 5000);

    applyLogRetention(dir, SMALL);

    const body = bodyOf(p);
    assert.ok(body.length > 500, `body was ${body.length} bytes`);
    assert.ok(body.includes('line 5000 '), 'the newest record must survive');
  });
});

test('an oversized file keeps its NEWEST records and loses its oldest', () => {
  withTempDir(dir => {
    const p = join(dir, 'ops-health-guardian-out.log');
    writeNumberedLines(p, 2000);
    const before = statSync(p).size;

    const r = applyLogRetention(dir, SMALL);

    const body = bodyOf(p);
    assert.equal(r.trimmed.length, 1);
    assert.ok(statSync(p).size < before);
    assert.ok(body.endsWith(`line 2000 ${'x'.repeat(80)}\n`), 'must end at the newest record');
    assert.ok(!body.includes('line 1 '), 'the oldest record should be gone');
  });
});

test('exactly one partial record is dropped — no more', () => {
  // Slicing to the SECOND newline silently discards one good record per trim
  // and still satisfies a "starts with a whole record" assertion, so pin the
  // identity of the first survivor rather than its shape.
  withTempDir(dir => {
    const p = join(dir, 'partial.log');
    writeNumberedLines(p, 2000);
    const raw = readFileSync(p);

    applyLogRetention(dir, SMALL);

    const start = raw.length - SMALL.keepTailBytes;
    const firstWholeRecord = raw.indexOf(0x0a, start) + 1;
    assert.equal(bodyOf(p), raw.subarray(firstWholeRecord).toString('utf8'));
  });
});

test('a trimmed file says so, so it is never mistaken for complete', () => {
  withTempDir(dir => {
    const p = join(dir, 'ops-fleet-manager-out.log');
    writeNumberedLines(p, 2000);

    applyLogRetention(dir, SMALL, new Date('2026-08-13T03:00:00Z'));

    const after = readFileSync(p, 'utf8');
    assert.ok(after.startsWith('[log-retention] 2026-08-13T03:00:00.000Z'), after.slice(0, 120));
    assert.match(after, /kept the most recent \d+/);
    assert.match(after, /it was NOT empty/);
  });
});

// ─── Convergence ─────────────────────────────────────────────────────────────

test('trimming lands UNDER the cap and a second run is a no-op', () => {
  // An earlier assertion bounded the result at maxBytes + marker + 200 — ABOVE
  // the cap — so it could not express the only property that matters. Mutating
  // the clamp to `Math.max(1, maxBytes)` passed it, and at production defaults
  // that re-trims the same file every night forever.
  withTempDir(dir => {
    const p = join(dir, 'converge.log');
    writeNumberedLines(p, 2000);

    const first = applyLogRetention(dir, SMALL);
    assert.equal(first.trimmed.length, 1);
    assert.ok(statSync(p).size <= SMALL.maxBytes, `size ${statSync(p).size} exceeds cap`);

    const snapshot = readFileSync(p);
    const second = applyLogRetention(dir, SMALL);

    assert.equal(second.trimmed.length, 0, 'a settled file must not be re-trimmed');
    assert.equal(second.untouched, 1);
    assert.deepEqual(readFileSync(p), snapshot, 'second run must not touch the bytes');
  });
});

test('a file exactly AT the cap is untouched', () => {
  // `size <= maxBytes` vs `size < maxBytes`: the strict form trims a file
  // sitting exactly on the boundary, losing history for no gain.
  withTempDir(dir => {
    const p = join(dir, 'exact.log');
    writeFileSync(p, Buffer.alloc(4096, 0x61));

    const r = applyLogRetention(dir, SMALL);

    assert.equal(r.trimmed.length, 0);
    assert.equal(r.untouched, 1);
    assert.equal(statSync(p).size, 4096);
  });
});

test('keepTailBytes is clamped to half the cap, so trimming always shrinks', () => {
  withTempDir(dir => {
    const p = join(dir, 'clamp.log');
    writeNumberedLines(p, 2000);

    const r = applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 999_999 });

    assert.equal(r.trimmed.length, 1);
    assert.ok(statSync(p).size <= 4096, 'must land under the cap even with an absurd tail size');
  });
});

// ─── Byte fidelity ───────────────────────────────────────────────────────────

test('invalid UTF-8 survives byte-for-byte', () => {
  // PM2 `out` streams carry arbitrary child stdout. Decoding the tail to a
  // string rewrote every invalid byte as U+FFFD — corrupting the evidence AND
  // expanding it 3x, which could push the trimmed file back over the cap.
  withTempDir(dir => {
    const p = join(dir, 'binary.log');
    const record = Buffer.concat([
      Buffer.from('rec '),
      Buffer.from([0xff, 0xfe, 0x80]),
      Buffer.from('\n'),
    ]);
    writeFileSync(p, Buffer.concat(Array.from({ length: 2000 }, () => record)));
    const before = statSync(p).size;

    const r = applyLogRetention(dir, SMALL);

    assert.equal(r.trimmed.length, 1);
    const after = readFileSync(p);
    assert.ok(after.length < before, 'must shrink, not grow');
    assert.ok(after.includes(Buffer.from([0xff, 0xfe, 0x80])), 'raw bytes must be preserved');
    assert.ok(!after.includes(Buffer.from('�', 'utf8')), 'no replacement chars on disk');
  });
});

test('a tail with no newline keeps its bytes rather than being discarded', () => {
  withTempDir(dir => {
    const p = join(dir, 'oneline.log');
    writeFileSync(p, Buffer.alloc(20_000, 0x5a)); // 'Z', no newline anywhere

    const r = applyLogRetention(dir, SMALL);

    assert.equal(r.trimmed.length, 1);
    const after = readFileSync(p);
    const body = after.subarray(after.indexOf(0x0a) + 1);
    assert.equal(body.length, SMALL.keepTailBytes, 'the whole tail survives');
    assert.ok(body.every(b => b === 0x5a));
  });
});

// ─── Concurrency: defer rather than punch a hole ─────────────────────────────

test('a file that GREW since the stat is skipped, not truncated', () => {
  // writeFileSync truncates, so every byte past the stale `size` would be
  // discarded — measured at ~130 KB of contiguous records against a real
  // concurrent appender. Deferring to the next run loses nothing.
  withTempDir(dir => {
    const p = join(dir, 'hot.log');
    writeNumberedLines(p, 2000);
    const staleSize = statSync(p).size;
    writeFileSync(p, readFileSync(p).toString() + 'line 2001 appended after the stat\n');
    const grownSize = statSync(p).size;

    const outcome = trimToTail(p, staleSize, 1024, '2026-08-13T03:00:00Z');

    assert.equal(outcome, null, 'must decline to trim');
    assert.equal(statSync(p).size, grownSize, 'file must be untouched');
    assert.ok(readFileSync(p, 'utf8').includes('appended after the stat'));
  });
});

test('a file that SHRANK since the stat is skipped, not rewritten', () => {
  // Otherwise the restarted service's first lines are overwritten by a marker
  // asserting a byte count that was never true.
  withTempDir(dir => {
    const p = join(dir, 'restarted.log');
    writeNumberedLines(p, 2000);
    const staleSize = statSync(p).size;
    writeFileSync(p, 'fresh process first line\n');

    const outcome = trimToTail(p, staleSize, 1024, '2026-08-13T03:00:00Z');

    assert.equal(outcome, null);
    assert.equal(readFileSync(p, 'utf8'), 'fresh process first line\n');
  });
});

test('skipped files are counted separately from untouched ones', () => {
  withTempDir(dir => {
    writeNumberedLines(join(dir, 'a.log'), 2000);
    writeFileSync(join(dir, 'b.log'), 'small\n');

    const decline: TrimFile = () => null;
    const r = applyLogRetention(dir, { ...SMALL, trimFile: decline });

    assert.equal(r.skipped, 1);
    assert.equal(r.untouched, 1);
    assert.equal(r.trimmed.length, 0);
  });
});

// ─── Robustness ──────────────────────────────────────────────────────────────

test('an unreadable directory is an error, not a crash', () => {
  const r = applyLogRetention(join(tmpdir(), 'vizora-does-not-exist-9f3a'));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /not readable/);
  assert.equal(r.trimmed.length, 0);
});

test('one failing file does not abort the sweep for the rest', () => {
  // 36 log files run through this nightly. Hoisting the try outside the loop
  // would silently stop trimming everything after the first failure — and no
  // test caught that, because the per-file catch was unreachable from a real
  // filesystem on either platform.
  withTempDir(dir => {
    for (const n of ['a.log', 'b.log', 'c.log']) writeNumberedLines(join(dir, n), 2000);

    const explodeOnB: TrimFile = (filePath, size, keep, iso) => {
      if (filePath.endsWith('b.log')) throw new Error('EBUSY: file is locked');
      return trimToTail(filePath, size, keep, iso);
    };
    const r = applyLogRetention(dir, { ...SMALL, trimFile: explodeOnB });

    assert.deepEqual(r.trimmed.map(t => t.file).sort(), ['a.log', 'c.log']);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0]!, /b\.log: EBUSY/);
  });
});

test('an invalid cap refuses to run rather than trimming everything away', () => {
  // Not reachable from db-maintainer today, but the obvious next change is an
  // env-configurable cap, and this repo parses those with parseInt.
  withTempDir(dir => {
    writeNumberedLines(join(dir, 'a.log'), 2000);
    const before = readFileSync(join(dir, 'a.log'));

    for (const bad of [0, -1, Number.NaN]) {
      const r = applyLogRetention(dir, { maxBytes: bad });
      assert.equal(r.trimmed.length, 0, `maxBytes=${bad} must not trim`);
      assert.match(r.errors[0] ?? '', /invalid maxBytes/);
    }
    assert.deepEqual(readFileSync(join(dir, 'a.log')), before);
  });
});

// ─── Scope ───────────────────────────────────────────────────────────────────

test('only files ending exactly in .log are considered', () => {
  // `includes('.log')` would rewrite a rotated gzip archive as raw bytes.
  withTempDir(dir => {
    const json = join(dir, 'ops-state.json');
    const gz = join(dir, 'old.log.gz');
    writeFileSync(json, 'x'.repeat(50_000));
    writeFileSync(gz, 'y'.repeat(50_000));
    writeNumberedLines(join(dir, 'a.log'), 2000);

    const r = applyLogRetention(dir, SMALL);

    assert.equal(statSync(json).size, 50_000, 'non-.log files must not be touched');
    assert.equal(statSync(gz).size, 50_000, 'rotated archives must not be touched');
    assert.deepEqual(r.trimmed.map(t => t.file), ['a.log']);
  });
});

test('a directory named *.log is ignored, and real logs still get trimmed', () => {
  withTempDir(dir => {
    writeNumberedLines(join(dir, 'a.log'), 2000);
    mkdirSync(join(dir, 'b.log'));
    writeNumberedLines(join(dir, 'c.log'), 2000);

    const r = applyLogRetention(dir, SMALL);

    assert.deepEqual(r.trimmed.map(t => t.file).sort(), ['a.log', 'c.log']);
    assert.deepEqual(r.errors, []);
    assert.equal(r.untouched, 0, 'the directory must not be counted as a healthy log');
  });
});

test('every trim reports the byte counts it acted on', () => {
  withTempDir(dir => {
    const p = join(dir, 'a.log');
    writeNumberedLines(p, 2000);
    const before = statSync(p).size;

    const r = applyLogRetention(dir, SMALL);

    assert.equal(r.trimmed[0]?.wasBytes, before);
    assert.equal(r.trimmed[0]?.nowBytes, statSync(p).size);
  });
});

test('the marker arithmetic adds up to the original size', () => {
  withTempDir(dir => {
    const p = join(dir, 'a.log');
    writeNumberedLines(p, 2000);
    const before = statSync(p).size;

    applyLogRetention(dir, SMALL, new Date('2026-08-13T03:00:00Z'));

    const after = readFileSync(p);
    const kept = after.subarray(after.indexOf(0x0a) + 1).length;
    assert.ok(
      after.toString('utf8').startsWith(trimMarker('2026-08-13T03:00:00.000Z', before - kept, kept)),
    );
  });
});

// ─── Source guards ───────────────────────────────────────────────────────────

/** Every non-test .ts under scripts/, recursively, with comments stripped. */
function opsSources(): Array<{ file: string; code: string }> {
  const out: Array<{ file: string; code: string }> = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        // Comments are stripped so the guards cannot punish the documentation
        // that explains why the hazard is forbidden.
        const code = readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
        out.push({ file: full, code });
      }
    }
  };
  walk(join(opsDir, '..'));
  return out;
}

test('the source scan reaches nested directories, including lib/', () => {
  // A non-recursive readdir skipped scripts/ops/lib entirely — where the shared
  // helpers live, and where this very module lives. The guards below would have
  // been blind to a lib/pm2.ts wrapper.
  const files = opsSources().map(s => s.file);
  assert.ok(files.some(f => f.includes('log-retention.ts')), 'lib/ must be scanned');
  assert.ok(files.some(f => f.includes('db-maintainer.ts')));
  assert.ok(files.length > 20, `only found ${files.length} sources`);
});

test('no ops script flushes PM2 logs, in any call shape', () => {
  // Bare `pm2 flush` destroys every app's history; `pm2 flush <app>` still
  // EMPTIES that app's history. Emptying is the wrong primitive either way, so
  // both are rejected — as is reaching it through a shell.
  const offenders = opsSources()
    .filter(s => /(['"`])pm2\1[\s\S]{0,120}?(['"`])flush\2|pm2\s+flush/.test(s.code))
    .map(s => s.file);
  assert.deepEqual(offenders, []);
});

test('no ops script empties a log file directly', () => {
  // The guard above is about pm2. This one is about the actual acceptance
  // criterion — "never empty a log" — which a reinstated
  // `writeFileSync(path, '')` would violate while passing the pm2 guard.
  const offenders = opsSources()
    .filter(s => /writeFileSync\([^,)]+,\s*(['"`])\1\s*\)|truncateSync\(/.test(s.code))
    .map(s => s.file);
  assert.deepEqual(offenders, []);
});

test('db-maintainer still actually calls log retention', () => {
  // Every ceiling claim in this module rests on one call site. Deleting it
  // passed the entire suite, guards included, and left disk unbounded with no
  // signal — so pin the wiring positively, not just the hazard negatively.
  const src = readFileSync(join(opsDir, 'db-maintainer.ts'), 'utf8');
  assert.match(src, /applyLogRetention\(/);
});

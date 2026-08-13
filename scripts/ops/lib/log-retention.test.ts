/**
 * Log retention — bounds disk WITHOUT destroying cross-service evidence.
 *
 * Pins the behaviour that replaces the daily global `pm2 flush`. Runs against a
 * real temp directory rather than a mocked fs: the whole point is what actually
 * happens to bytes on disk, and a mock would pin the mock.
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

/** Matches the resolution used by the other ops tests (import.meta.dirname is
 *  undefined under the tsx transform). */
const opsDir = join(dirname(fileURLToPath(import.meta.url)), '..');

import {
  applyLogRetention,
  DEFAULT_KEEP_TAIL_BYTES,
  DEFAULT_MAX_BYTES,
  trimMarker,
} from './log-retention.js';

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'vizora-logret-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `lines` numbered records, so we can assert WHICH end survived. */
function writeNumberedLines(path: string, count: number): void {
  let out = '';
  for (let i = 1; i <= count; i++) out += `line ${i} ${'x'.repeat(80)}\n`;
  writeFileSync(path, out);
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

test('THE REGRESSION: retention never empties a file', () => {
  // `pm2 flush` zeroed every service's log daily. Whatever retention does now,
  // producing a zero-byte file is the one outcome that must never happen.
  withTempDir(dir => {
    writeNumberedLines(join(dir, 'realtime-out.log'), 5000);
    writeFileSync(join(dir, 'web-out.log'), 'short\n');

    applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 1024 });

    for (const f of ['realtime-out.log', 'web-out.log']) {
      assert.ok(statSync(join(dir, f)).size > 0, `${f} was emptied`);
    }
  });
});

test('an oversized file keeps its NEWEST lines and loses its oldest', () => {
  withTempDir(dir => {
    const p = join(dir, 'ops-health-guardian-out.log');
    writeNumberedLines(p, 2000);
    const before = statSync(p).size;

    const r = applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 1024 });

    const after = readFileSync(p, 'utf8');
    assert.equal(r.trimmed.length, 1);
    assert.ok(statSync(p).size < before, 'file should have shrunk');
    assert.ok(after.includes('line 2000'), 'the most recent line must survive');
    assert.ok(!after.includes('line 1 '), 'the oldest line should be gone');
  });
});

test('a trimmed file says so, so it is never mistaken for complete', () => {
  withTempDir(dir => {
    const p = join(dir, 'ops-fleet-manager-out.log');
    writeNumberedLines(p, 2000);

    applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 1024 }, new Date('2026-08-13T03:00:00Z'));

    const after = readFileSync(p, 'utf8');
    assert.ok(after.startsWith('[log-retention] 2026-08-13T03:00:00.000Z'), after.slice(0, 120));
    assert.match(after, /kept the most recent \d+/);
    assert.match(after, /it was NOT empty/);
  });
});

test('the surviving tail never begins mid-record', () => {
  withTempDir(dir => {
    const p = join(dir, 'partial.log');
    writeNumberedLines(p, 2000);

    applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 1024 });

    const lines = readFileSync(p, 'utf8').split('\n');
    // [0] is the marker; [1] is the first surviving record.
    assert.match(lines[1] ?? '', /^line \d+ x+$/, `got: ${lines[1]}`);
  });
});

// ─── Scope ───────────────────────────────────────────────────────────────────

test('only .log files are considered', () => {
  withTempDir(dir => {
    const keep = join(dir, 'ops-state.json');
    writeFileSync(keep, 'x'.repeat(50_000));
    writeNumberedLines(join(dir, 'a.log'), 2000);

    const r = applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 1024 });

    assert.equal(statSync(keep).size, 50_000, 'non-.log files must not be touched');
    assert.equal(r.trimmed.length, 1);
  });
});

test('every oversized file in the directory is trimmed, not just the first', () => {
  withTempDir(dir => {
    for (const n of ['a.log', 'b.log', 'c.log']) writeNumberedLines(join(dir, n), 2000);

    const r = applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 1024 });

    assert.equal(r.trimmed.length, 3);
    assert.deepEqual(r.trimmed.map(t => t.file).sort(), ['a.log', 'b.log', 'c.log']);
  });
});

test('reports the byte counts it acted on', () => {
  withTempDir(dir => {
    const p = join(dir, 'a.log');
    writeNumberedLines(p, 2000);
    const before = statSync(p).size;

    const r = applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 1024 });

    assert.equal(r.trimmed[0]?.wasBytes, before);
    assert.equal(r.trimmed[0]?.nowBytes, statSync(p).size);
    assert.ok(r.trimmed[0]!.nowBytes < r.trimmed[0]!.wasBytes);
  });
});

// ─── Robustness ──────────────────────────────────────────────────────────────

test('an unreadable directory is an error, not a crash', () => {
  const r = applyLogRetention(join(tmpdir(), 'vizora-does-not-exist-9f3a'));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /not readable/);
  assert.equal(r.trimmed.length, 0);
});

test('a directory named *.log is ignored, and real logs still get trimmed', () => {
  // statSync on a directory reports a platform-dependent size, so without an
  // explicit isFile() check this would either be counted as a healthy file or
  // attempt a read that fails — differently on Windows and Linux.
  withTempDir(dir => {
    writeNumberedLines(join(dir, 'a.log'), 2000);
    mkdirSync(join(dir, 'b.log'));
    writeNumberedLines(join(dir, 'c.log'), 2000);

    const r = applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 1024 });

    assert.deepEqual(r.trimmed.map(t => t.file).sort(), ['a.log', 'c.log']);
    assert.deepEqual(r.errors, []);
    assert.equal(r.untouched, 0, 'the directory must not be counted as a healthy log');
  });
});

test('keepTailBytes is clamped below maxBytes so trimming always shrinks', () => {
  withTempDir(dir => {
    const p = join(dir, 'a.log');
    writeNumberedLines(p, 2000);
    const before = statSync(p).size;

    // Asking to keep MORE than the cap would otherwise grow the file back.
    const r = applyLogRetention(dir, { maxBytes: 4096, keepTailBytes: 999_999 });

    assert.equal(r.trimmed.length, 1);
    assert.ok(statSync(p).size < before, 'must shrink even with an absurd keepTailBytes');
    assert.ok(statSync(p).size <= 4096 + trimMarker('x', 0, 0).length + 200);
  });
});

test('defaults are sane relative to each other', () => {
  assert.ok(DEFAULT_KEEP_TAIL_BYTES < DEFAULT_MAX_BYTES);
});

// ─── Source guard ────────────────────────────────────────────────────────────

test('db-maintainer never invokes `pm2 flush` again', () => {
  // The acceptance criterion is "db-maintainer cannot erase other services'
  // diagnostic history". `pm2 flush` takes no target, so a single reintroduced
  // call re-arms the exact failure. db-maintainer.ts calls main() at import, so
  // it cannot be loaded in-process — scanning the source is the honest check.
  const src = readFileSync(join(opsDir, 'db-maintainer.ts'), 'utf8');
  const calls = src.match(/execFileSync\(\s*['"]pm2['"]\s*,\s*\[[^\]]*['"]flush['"]/g);
  assert.equal(calls, null, `db-maintainer must not call pm2 flush: ${JSON.stringify(calls)}`);
});

test('no ops agent invokes `pm2 flush`', () => {
  // Same hazard, wider net: any agent doing this destroys every other
  // service's history, not just its own.
  const dir = opsDir;
  const offenders: string[] = [];
  for (const f of readdirSync(dir).filter(n => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    if (/execFileSync\(\s*['"]pm2['"]\s*,\s*\[[^\]]*['"]flush['"]/.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, []);
});

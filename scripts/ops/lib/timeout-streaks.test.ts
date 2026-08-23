import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  STREAK_MAX_AGE_MS,
  readTimeoutStreaks,
  streakFilePath,
  writeTimeoutStreaks,
} from './timeout-streaks.js';

function withDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'streaks-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const NOW = Date.parse('2026-08-23T20:00:00.000Z');

test('an ABSENT file is a legitimate first run — zero streak, not degraded', () => {
  withDir((dir) => {
    const snapshot = readTimeoutStreaks(dir, NOW);
    assert.deepEqual(snapshot.streaks, {});
    // This distinction is the whole point: absent must NOT fail toward
    // remediation, or every first timeout would restart.
    assert.equal(snapshot.degraded, false);
  });
});

test('a round-trip preserves the counts', () => {
  withDir((dir) => {
    assert.deepEqual(writeTimeoutStreaks(dir, { middleware: 2, web: 1 }, NOW), { ok: true });
    const snapshot = readTimeoutStreaks(dir, NOW);
    assert.deepEqual(snapshot.streaks, { middleware: 2, web: 1 });
    assert.equal(snapshot.degraded, false);
  });
});

test('an entry older than the max age is discarded', () => {
  withDir((dir) => {
    writeTimeoutStreaks(dir, { middleware: 2 }, NOW - STREAK_MAX_AGE_MS - 1);
    // Otherwise last week's outage makes an unrelated blip restart on its first
    // timeout — the original bug, through the back door.
    assert.deepEqual(readTimeoutStreaks(dir, NOW).streaks, {});
  });
});

test('an entry just inside the max age is kept', () => {
  withDir((dir) => {
    writeTimeoutStreaks(dir, { middleware: 2 }, NOW - STREAK_MAX_AGE_MS + 1000);
    assert.deepEqual(readTimeoutStreaks(dir, NOW).streaks, { middleware: 2 });
  });
});

test('writing an empty set REMOVES the file, so absent keeps meaning zero', () => {
  withDir((dir) => {
    writeTimeoutStreaks(dir, { middleware: 2 }, NOW);
    assert.ok(existsSync(streakFilePath(dir)));
    writeTimeoutStreaks(dir, {}, NOW);
    assert.equal(existsSync(streakFilePath(dir)), false);
    assert.equal(readTimeoutStreaks(dir, NOW).degraded, false);
  });
});

test('a recovered service is dropped rather than stored at zero', () => {
  withDir((dir) => {
    writeTimeoutStreaks(dir, { middleware: 2, web: 1 }, NOW);
    writeTimeoutStreaks(dir, { web: 1 }, NOW);
    assert.deepEqual(readTimeoutStreaks(dir, NOW).streaks, { web: 1 });
  });
});

test('a PRESENT but unparseable file is degraded, not silently empty', () => {
  withDir((dir) => {
    writeFileSync(streakFilePath(dir), '{ not json');
    const snapshot = readTimeoutStreaks(dir, NOW);
    assert.deepEqual(snapshot.streaks, {});
    assert.equal(snapshot.degraded, true);
    assert.match(snapshot.reason ?? '', /not valid JSON/);
  });
});

test('a non-object payload is degraded', () => {
  withDir((dir) => {
    for (const raw of ['[]', '"a string"', '42', 'null']) {
      writeFileSync(streakFilePath(dir), raw);
      const snapshot = readTimeoutStreaks(dir, NOW);
      assert.equal(snapshot.degraded, true, `${raw} should be degraded`);
    }
  });
});

test('malformed individual entries are skipped without degrading the whole file', () => {
  withDir((dir) => {
    writeFileSync(
      streakFilePath(dir),
      JSON.stringify({
        good: { count: 2, at: new Date(NOW).toISOString() },
        noCount: { at: new Date(NOW).toISOString() },
        zero: { count: 0, at: new Date(NOW).toISOString() },
        negative: { count: -3, at: new Date(NOW).toISOString() },
        fractional: { count: 1.5, at: new Date(NOW).toISOString() },
        badStamp: { count: 2, at: 'not-a-date' },
        futureStamp: { count: 2, at: new Date(NOW + 60_000).toISOString() },
        notAnObject: 7,
      }),
    );
    const snapshot = readTimeoutStreaks(dir, NOW);
    // One bad neighbour must not discard a valid streak, and a valid file must
    // not read as degraded just because it has junk in it.
    assert.deepEqual(snapshot.streaks, { good: 2 });
    assert.equal(snapshot.degraded, false);
  });
});

test('a future-dated stamp cannot establish freshness', () => {
  withDir((dir) => {
    writeTimeoutStreaks(dir, { middleware: 9 }, NOW + 60_000);
    // Clock skew must not let a streak outlive its window indefinitely.
    assert.deepEqual(readTimeoutStreaks(dir, NOW).streaks, {});
  });
});

test('a write failure is reported, never thrown', () => {
  // The probing has already happened by the time this runs; losing the streak
  // write must not take the run down with it.
  const result = writeTimeoutStreaks(
    join(tmpdir(), 'streaks-does-not-exist', 'nested', 'deeper'),
    { middleware: 1 },
    NOW,
  );
  assert.equal(result.ok, false);
});

test('the file is written atomically and leaves no temp behind', () => {
  withDir((dir) => {
    writeTimeoutStreaks(dir, { middleware: 3 }, NOW);
    const parsed = JSON.parse(readFileSync(streakFilePath(dir), 'utf8'));
    assert.equal(parsed.middleware.count, 3);
    assert.equal(existsSync(`${streakFilePath(dir)}.tmp-${process.pid}`), false);
  });
});

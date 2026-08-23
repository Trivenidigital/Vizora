import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TIMEOUT_RESTART_CEILING,
  TIMEOUT_RESTART_THRESHOLD,
  classifyFetchError,
  decideRestart,
  resolveRestartThreshold,
  type ProbeFailureKind,
} from './probe-failure.js';

// ─── classifyFetchError ─────────────────────────────────────────────────────

test('an aborted probe is a timeout, not an absent peer', () => {
  // What Node actually throws when an AbortController fires on fetch.
  const abort = new Error('This operation was aborted');
  abort.name = 'AbortError';
  assert.equal(classifyFetchError(abort), 'timeout');
});

test('AbortError is recognised even when it is not instanceof Error', () => {
  // DOMException is not reliably `instanceof Error`, and carries a NUMERIC
  // legacy `code` (20 = ABORT_ERR) that must not be read as a libuv code.
  const domish = { name: 'AbortError', message: 'This operation was aborted', code: 20 };
  assert.equal(classifyFetchError(domish), 'timeout');
});

test('a refused connection is unreachable — nothing is listening', () => {
  const err = new TypeError('fetch failed');
  (err as { cause?: unknown }).cause = Object.assign(new Error('connect ECONNREFUSED'), {
    code: 'ECONNREFUSED',
  });
  assert.equal(classifyFetchError(err), 'unreachable');
});

test('undici header/body timeouts are timeouts, not unreachability', () => {
  for (const code of ['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'ETIMEDOUT']) {
    const err = new TypeError('fetch failed');
    (err as { cause?: unknown }).cause = Object.assign(new Error(code), { code });
    assert.equal(classifyFetchError(err), 'timeout', `${code} should be a timeout`);
  }
});

test('reset / unroutable / DNS failures are unreachable', () => {
  for (const code of ['ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE']) {
    const err = new TypeError('fetch failed');
    (err as { cause?: unknown }).cause = Object.assign(new Error(code), { code });
    assert.equal(classifyFetchError(err), 'unreachable', `${code} should be unreachable`);
  }
});

test('a cause nested several levels deep is still classified', () => {
  const inner = Object.assign(new Error('deep'), { code: 'ECONNREFUSED' });
  const mid = Object.assign(new Error('mid'), { cause: inner });
  const outer = Object.assign(new TypeError('fetch failed'), { cause: mid });
  assert.equal(classifyFetchError(outer), 'unreachable');
});

test('a cyclic cause chain terminates instead of hanging', () => {
  const a = new Error('a') as Error & { cause?: unknown };
  const b = new Error('b') as Error & { cause?: unknown };
  a.cause = b;
  b.cause = a;
  assert.equal(classifyFetchError(a), 'unknown');
});

test('unrecognised shapes classify as unknown, never as timeout', () => {
  // 'unknown' is restart-ELIGIBLE, so misclassifying something as 'timeout'
  // would silently suppress remediation. That direction must not happen by
  // accident.
  for (const value of [null, undefined, 'a string', 42, {}, new Error('boom')]) {
    assert.equal(classifyFetchError(value), 'unknown');
  }
});

// ─── decideRestart ──────────────────────────────────────────────────────────

test('every non-timeout failure is restart-eligible immediately', () => {
  const kinds: ProbeFailureKind[] = ['unreachable', 'http-error', 'asset-failure', 'unknown'];
  for (const kind of kinds) {
    const d = decideRestart(kind, 0);
    assert.equal(d.restart, true, `${kind} should be restart-eligible`);
    assert.match(d.reason, new RegExp(kind));
  }
});

test('a timeout below the threshold does NOT earn a restart', () => {
  for (let n = 1; n < TIMEOUT_RESTART_THRESHOLD; n++) {
    const d = decideRestart('timeout', n);
    assert.equal(d.restart, false, `${n} consecutive timeouts must not restart`);
    assert.match(d.reason, /listening but slow/);
  }
});

test('a timeout that persists to the threshold is treated as a hang and restarted', () => {
  for (const n of [TIMEOUT_RESTART_THRESHOLD, TIMEOUT_RESTART_THRESHOLD + 5]) {
    const d = decideRestart('timeout', n);
    assert.equal(d.restart, true, `${n} consecutive timeouts should restart`);
    assert.match(d.reason, /treating it as a hang/);
  }
});

test('the threshold is overridable and honoured exactly', () => {
  assert.equal(decideRestart('timeout', 1, 2).restart, false);
  assert.equal(decideRestart('timeout', 2, 2).restart, true);
  // A threshold of 1 restores restart-on-first-timeout.
  assert.equal(decideRestart('timeout', 1, 1).restart, true);
});

test('the default threshold is more than one — a single timeout can never restart', () => {
  // This is the whole point of the module: guard against a regression that
  // sets the threshold to 1 and silently restores the old behaviour.
  assert.ok(TIMEOUT_RESTART_THRESHOLD > 1);
  assert.equal(decideRestart('timeout', 1).restart, false);
});

// ─── resolveRestartThreshold ────────────────────────────────────────────────

test('an absent or blank override uses the default', () => {
  for (const raw of [undefined, '', '   ']) {
    const r = resolveRestartThreshold(raw);
    assert.equal(r.threshold, TIMEOUT_RESTART_THRESHOLD);
    assert.equal(r.warning, undefined);
  }
});

test('a plain integer is honoured, with surrounding whitespace', () => {
  assert.equal(resolveRestartThreshold('1').threshold, 1);
  assert.equal(resolveRestartThreshold('  4 ').threshold, 4);
  assert.equal(resolveRestartThreshold('4').warning, undefined);
});

test('values that parseInt would TRUNCATE are rejected, not truncated', () => {
  // The whole reason this is matched rather than parsed. Each of these used to
  // be silently accepted as a different number than the operator wrote.
  for (const raw of ['3x', '2.9', '1e9', '0x10', '+3', ' 3 4', '3,000']) {
    const r = resolveRestartThreshold(raw);
    assert.equal(r.threshold, TIMEOUT_RESTART_THRESHOLD, `${raw} must not be honoured`);
    assert.match(r.warning ?? '', /not a plain integer/, `${raw} must warn`);
  }
});

test("'1e9' does not silently become 1 — the intent-inverting case", () => {
  // An operator reaching for "effectively never auto-restart" must not get
  // "restart on the very first timeout" instead.
  const r = resolveRestartThreshold('1e9');
  assert.notEqual(r.threshold, 1);
  assert.equal(r.threshold, TIMEOUT_RESTART_THRESHOLD);
});

test('zero and negatives are refused — the gate cannot be disabled by 0', () => {
  for (const raw of ['0', '00', '-1']) {
    const r = resolveRestartThreshold(raw);
    assert.equal(r.threshold, TIMEOUT_RESTART_THRESHOLD);
    assert.ok(r.warning, `${raw} must warn`);
  }
});

test('a threshold above the ceiling is honoured but says so out loud', () => {
  const r = resolveRestartThreshold(String(TIMEOUT_RESTART_CEILING + 1));
  assert.equal(r.threshold, TIMEOUT_RESTART_CEILING + 1);
  assert.match(r.warning ?? '', /effectively\s+DISABLED/);
});

test('a threshold at the ceiling is honoured silently', () => {
  const r = resolveRestartThreshold(String(TIMEOUT_RESTART_CEILING));
  assert.equal(r.threshold, TIMEOUT_RESTART_CEILING);
  assert.equal(r.warning, undefined);
});

test('an absurd integer cannot overflow into an unsafe value', () => {
  const r = resolveRestartThreshold('9'.repeat(30));
  assert.equal(r.threshold, TIMEOUT_RESTART_THRESHOLD);
  assert.match(r.warning ?? '', /not an integer >= 1/);
});

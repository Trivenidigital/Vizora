import { test } from 'node:test';
import assert from 'node:assert/strict';
import { awaitReadiness, type ReadinessProbe } from './await-readiness';

/**
 * Negative controls for the readiness gate. The point of this gate is to tell
 * a warm-up transition apart from a real regression, so the three cases that
 * matter are: transient recovers (must PASS), permanently bad (must FAIL),
 * and never stabilizes in time (must FAIL).
 */

const ok: ReadinessProbe = { httpStatus: 200, readiness: 'ok' };
const degraded: ReadinessProbe = { httpStatus: 200, readiness: 'degraded' };
const down: ReadinessProbe = { httpStatus: 0, readiness: null };

/** Deterministic harness: virtual clock, scripted probe sequence, no timers. */
function harness(sequence: ReadinessProbe[], opts: { consecutiveOk?: number; timeoutMs?: number } = {}) {
  let clock = 0;
  let i = 0;
  const intervalMs = 1_000;
  return awaitReadiness({
    consecutiveOk: opts.consecutiveOk ?? 3,
    timeoutMs: opts.timeoutMs ?? 10_000,
    intervalMs,
    probe: async () => sequence[Math.min(i++, sequence.length - 1)],
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
  });
}

test('a transient degraded that recovers PASSES — this is the warm-up case', async () => {
  // Exactly the 2026-08-22 incident: degraded for the first seconds, then ok.
  const r = await harness([degraded, degraded, ok, ok, ok]);
  assert.equal(r.stabilized, true);
  assert.equal(r.consecutiveOkReached, 3);
  // It must have SEEN the degraded samples, not skipped them.
  assert.ok(r.samples >= 5);
  assert.deepEqual(r.lastNonOk, degraded);
});

test('a permanently degraded service FAILS — the regression case', async () => {
  const r = await harness([degraded]);
  assert.equal(r.stabilized, false);
  assert.equal(r.consecutiveOkReached, 0);
  assert.deepEqual(r.lastNonOk, degraded);
});

test('an unreachable service FAILS rather than being read as ok', async () => {
  const r = await harness([down]);
  assert.equal(r.stabilized, false);
  assert.deepEqual(r.lastNonOk, down);
});

test('never stabilizing before the timeout FAILS', async () => {
  // ok/degraded alternating forever: it reaches ok repeatedly but never in a row.
  const r = await harness([ok, degraded, ok, degraded, ok, degraded, ok, degraded,
                           ok, degraded, ok, degraded, ok, degraded, ok, degraded]);
  assert.equal(r.stabilized, false);
  // It got to 1 but never to 3 — proving the streak resets rather than accumulating.
  assert.equal(r.consecutiveOkReached, 1);
});

test('a non-ok RESETS the streak — cumulative ok is not stabilization', async () => {
  // Two ok, one degraded, two ok, then degraded forever (the harness repeats its
  // last element, so it must END non-ok or it would hand out a third ok itself).
  // Cumulative ok = 4, but never a run of 3.
  const r = await harness([ok, ok, degraded, ok, ok, degraded], { timeoutMs: 8_000 });
  assert.equal(r.stabilized, false);
  assert.equal(r.consecutiveOkReached, 2);
});

test('an immediately healthy service passes without waiting out the budget', async () => {
  const r = await harness([ok], { timeoutMs: 60_000 });
  assert.equal(r.stabilized, true);
  assert.equal(r.samples, 3);
  // Only the two inter-sample sleeps, nowhere near the 60s budget.
  assert.equal(r.elapsedMs, 2_000);
});

test('consecutiveOk=1 still requires a real ok, not merely a reachable endpoint', async () => {
  const r = await harness([degraded], { consecutiveOk: 1, timeoutMs: 3_000 });
  assert.equal(r.stabilized, false);
});

test('always takes at least one sample even with a zero budget', async () => {
  const r = await harness([degraded], { timeoutMs: 0 });
  assert.equal(r.samples, 1);
  assert.equal(r.stabilized, false);
});

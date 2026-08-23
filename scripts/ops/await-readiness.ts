/**
 * Readiness stabilization gate — run AFTER a service reload and BEFORE
 * `scripts/deploy-verify.sh`.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * On 2026-08-22 a middleware-only deploy reloaded cleanly, and `deploy-verify.sh`
 * ran immediately afterwards. It reported
 *
 *     FAIL  GET /api/v1/health/ready -> 200 status=degraded (expected status=ok)
 *
 * against a pre-deploy baseline of `status=ok`. That is textbook "a check that
 * newly fails", which the rollout runbook — correctly — says IS a rollout failure.
 * It was not one. The process had roughly ten seconds of uptime; querying directly
 * returned `status: ok`, and re-running once warm gave 0 failures with the diff
 * reduced to the commit line.
 *
 * So the sequence "reload, then verify" manufactures the exact signal the runbook
 * teaches you to roll back on. At 2am that costs you a good deploy.
 *
 * The fix is NOT "sleep and hope" — a fixed sleep is both too long on a fast box
 * and too short on a loaded one, and it silently passes a service that never
 * becomes ready. Instead this gate distinguishes the two cases the runbook cannot:
 *
 *   expected startup transition   → readiness reaches ok and STAYS there
 *   persistent deployment regression → it never does, within a bounded window
 *
 * A single `ok` is not enough: readiness can flap through ok during warm-up. We
 * require N CONSECUTIVE ok samples, and any non-ok resets the run. Failing to
 * stabilize before the timeout is itself a rollout failure — this gate weakens
 * nothing, it only stops the clock from starting too early.
 */

export interface ReadinessProbe {
  /** HTTP status, or 0 if the request could not be made. */
  httpStatus: number;
  /** The `status` field from the readiness body, or null if unparseable. */
  readiness: string | null;
}

export interface AwaitReadinessOptions {
  /** Consecutive `ok` samples required. Default 3. */
  consecutiveOk?: number;
  /** Total wall-clock budget in ms. Default 120_000. */
  timeoutMs?: number;
  /** Delay between samples in ms. Default 3_000. */
  intervalMs?: number;
  probe: () => Promise<ReadinessProbe>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

export interface AwaitReadinessResult {
  stabilized: boolean;
  samples: number;
  consecutiveOkReached: number;
  elapsedMs: number;
  /** The last non-ok observation, for the failure message. */
  lastNonOk: ReadinessProbe | null;
}

export const DEFAULT_CONSECUTIVE_OK = 3;
export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_INTERVAL_MS = 3_000;

/**
 * Poll until readiness is `ok` for `consecutiveOk` samples in a row, or the
 * budget expires.
 *
 * Deliberately counts CONSECUTIVE successes rather than cumulative ones: a
 * service that alternates ok/degraded has not stabilized, and treating those
 * as progress would let a genuinely sick deploy through.
 */
export async function awaitReadiness(
  opts: AwaitReadinessOptions,
): Promise<AwaitReadinessResult> {
  const need = opts.consecutiveOk ?? DEFAULT_CONSECUTIVE_OK;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const log = opts.log ?? (() => {});

  const started = opts.now();
  let streak = 0;
  let samples = 0;
  let best = 0;
  let lastNonOk: ReadinessProbe | null = null;

  // Always take at least one sample, even with a zero budget, so the result
  // reports what was actually observed rather than an empty timeout.
  for (;;) {
    const probe = await opts.probe();
    samples += 1;

    if (probe.httpStatus === 200 && probe.readiness === 'ok') {
      streak += 1;
      if (streak > best) best = streak;
      log(`  readiness ok (${streak}/${need})`);
      if (streak >= need) {
        return {
          stabilized: true,
          samples,
          consecutiveOkReached: streak,
          elapsedMs: opts.now() - started,
          lastNonOk,
        };
      }
    } else {
      // Any non-ok resets the run — an alternating service has not stabilized.
      if (streak > 0) {
        log(`  readiness regressed after ${streak} ok sample(s) — streak reset`);
      }
      streak = 0;
      lastNonOk = probe;
      log(
        `  readiness not ready: http=${probe.httpStatus} status=${probe.readiness ?? 'unparseable'}`,
      );
    }

    const elapsed = opts.now() - started;
    // Stop if the NEXT sample could not complete inside the budget.
    if (elapsed + intervalMs > timeoutMs) {
      return {
        stabilized: false,
        samples,
        consecutiveOkReached: best,
        elapsedMs: elapsed,
        lastNonOk,
      };
    }
    await opts.sleep(intervalMs);
  }
}

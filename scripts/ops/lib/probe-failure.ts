/**
 * Why a health probe failed — and whether `pm2 restart` can possibly fix it.
 *
 * STARVATION_IS_NOT_A_CRASH: before 2026-08-23 `health-guardian` collapsed every
 * probe failure into one verdict and answered all of them with `pm2 restart`. On a
 * CPU-saturated box that is actively harmful: a starved-but-listening service is
 * indistinguishable from a dead one at the socket, so the guardian restarted
 * healthy processes and spent the one resource that was exhausted (CPU) doing it.
 *
 * The evidence that motivated this module, from the retained prod log window
 * (2026-08-19 → 2026-08-23) on a box whose CPU idle sat at 0.20–0.25% for nine
 * days while ClickHouse consumed 166% of 200%:
 *
 *   6 UNHEALTHY verdicts — 6 of 6 `AbortError` (the 10s probe timeout)
 *                        — 0 of 6 ECONNREFUSED
 *   5 `pm2 restart` attempts fired, every one of them at a live listener.
 *
 * The restarts also read as successful, which is how this hid: at 19:02:05
 * middleware timed out, was restarted, and at 19:05:03 answered in 199ms. A
 * service that answers in 199ms three minutes later was never broken — a
 * momentary starvation spike (all five events land within a minute of an hour
 * boundary, i.e. the hourly cron fleet) cleared on its own and the restart took
 * the credit.
 *
 * This is the same reasoning the `probeRemediable` gate already encodes for
 * non-loopback probes — raise the incident, never answer it with pm2, because a
 * restart cannot repair what this probe measures — applied to a second axis.
 *
 * WHY NOT "never restart on a timeout": a genuinely hung process (blocked event
 * loop, deadlock) also presents as a timeout, and there a restart IS the remedy.
 * The discriminator is not the observation, it is PERSISTENCE — starvation clears
 * within a cycle, a hang does not. So a timeout still earns a restart, it just has
 * to survive `TIMEOUT_RESTART_THRESHOLD` consecutive cycles first.
 *
 * The operator does not lose visibility — they GAIN a notification, and that is
 * not a rounding error. Previously a starvation blip was restarted and resolved
 * inside a single run, so no incident outlived the cycle and no status change
 * occurred. Now the incident stays open across the waiting cycles, which moves
 * systemStatus and makes `ops-reporter` alert on the transition. It is filed at
 * `warning` (DEGRADED) rather than `critical` precisely because of that: a box
 * too slow to answer a health check in 10s IS worth telling someone about, but
 * spending CRITICAL on something that historically clears by itself is how
 * alerts get tuned out. What waits is the pm2 action, not the reporting.
 *
 * FAIL TOWARD REMEDIATION, with one honest limit: anything THIS MODULE cannot
 * classify is restart-eligible, so an unanticipated error shape degrades to the
 * previous behaviour. That safety does not extend to the stateful call site — a
 * correctly-classified timeout whose streak is lost (see the KNOWN LIMIT at the
 * gate in `health-guardian.ts`) degrades the other way, to never-remediate.
 * `GUARDIAN_TIMEOUT_RESTART_THRESHOLD=1` is the lever for that case.
 */

/** Why a probe failed, in terms of what remedy could possibly apply. */
export type ProbeFailureKind =
  /** Aborted by our own deadline — the peer accepted the socket but never answered. */
  | 'timeout'
  /** No listener, or the connection was refused/reset/unroutable. */
  | 'unreachable'
  /** The service answered, with a failing status. */
  | 'http-error'
  /** The service answered, but the assets its HTML references are broken. */
  | 'asset-failure'
  /** Unrecognised failure shape. Treated as restart-eligible on purpose. */
  | 'unknown';

/**
 * Consecutive timeout observations required before a timeout earns a restart.
 *
 * At the every-5-minutes cron cadence that is ~10 minutes from the FIRST failed
 * probe to the first restart (cycle 1 observes, cycle 3 acts), or up to ~15
 * minutes from actual onset once you add detection latency. Every starvation
 * event in the observed window recovered inside a single cycle; a real hang
 * persists, so it is still restarted — just later. That delay is the price of
 * the fix, and it is why `GUARDIAN_TIMEOUT_RESTART_THRESHOLD` exists.
 */
export const TIMEOUT_RESTART_THRESHOLD = 3;

/** libuv/undici codes that mean "nothing is listening / cannot be routed to". */
const UNREACHABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

/** undici codes that mean "the peer took too long", not "the peer is absent". */
const TIMEOUT_CODES = new Set([
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

function errorCodeOf(err: unknown): string | undefined {
  // undici wraps the real cause: `TypeError: fetch failed` -> cause.code.
  for (let node: unknown = err, depth = 0; node != null && depth < 5; depth++) {
    const code = (node as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    node = (node as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Classify the exception thrown by a bounded `fetch`.
 *
 * Only ever sees genuine fetch exceptions — a non-2xx response and a broken-asset
 * verdict are classified by their call sites, which know more than this does.
 */
export function classifyFetchError(err: unknown): ProbeFailureKind {
  // AbortController firing is OUR deadline, not the peer's absence. Checked by
  // name and FIRST: the abort arrives as a DOMException, which is not reliably
  // `instanceof Error` across runtimes and carries a numeric legacy `code` that
  // must not be confused with a libuv string code.
  if (typeof (err as { name?: unknown } | null)?.name === 'string'
      && (err as { name: string }).name === 'AbortError') {
    return 'timeout';
  }

  const code = errorCodeOf(err);
  if (code !== undefined) {
    if (UNREACHABLE_CODES.has(code)) return 'unreachable';
    if (TIMEOUT_CODES.has(code)) return 'timeout';
  }

  return 'unknown';
}

export interface RestartDecision {
  /** Whether `pm2 restart` may be attempted for this failure, this cycle. */
  restart: boolean;
  /** Operator-facing explanation, used verbatim in the log and the incident. */
  reason: string;
}

/**
 * Decide whether a probe failure earns a `pm2 restart` on THIS cycle.
 *
 * `consecutiveTimeouts` must already include the current observation.
 */
export function decideRestart(
  kind: ProbeFailureKind,
  consecutiveTimeouts: number,
  threshold: number = TIMEOUT_RESTART_THRESHOLD,
): RestartDecision {
  if (kind !== 'timeout') {
    return { restart: true, reason: `failure kind '${kind}' is answerable by a restart` };
  }

  // Being asked about a timeout means at least one was observed, whatever the
  // caller's bookkeeping says. Without this a caller passing 0 gets a decision
  // reasoned as "timed out 0/3", which reads as nonsense in an incident.
  const observed = Math.max(1, consecutiveTimeouts);

  if (observed >= threshold) {
    return {
      restart: true,
      reason:
        `unresponsive for ${observed} consecutive checks (>= ${threshold}) — ` +
        `sustained past what resource starvation explains, treating it as a hang`,
    };
  }

  return {
    restart: false,
    reason:
      `timed out ${observed}/${threshold} consecutive checks — the process is ` +
      `listening but slow, which a restart cannot fix and would make worse by spending CPU; ` +
      `waiting for it to persist before treating it as a hang`,
  };
}

export interface ThresholdResolution {
  /** The threshold to use. Always a safe integer >= 1. */
  threshold: number;
  /** Operator-facing line to log, when the raw value was not honoured as given. */
  warning?: string;
}

/**
 * Above this, timeout auto-restart is effectively off (~1h at the 5-minute cadence).
 * Honoured, but said out loud.
 */
export const TIMEOUT_RESTART_CEILING = 12;

/**
 * Resolve GUARDIAN_TIMEOUT_RESTART_THRESHOLD.
 *
 * Matched STRICTLY rather than parsed. `Number.parseInt` truncates instead of
 * rejecting, so '3x' becomes 3 and '2.9' becomes 2 despite the documented
 * contract — and '1e9' becomes 1, which hands an operator reaching for
 * "effectively never auto-restart during this incident" the exact opposite:
 * restart on the very first timeout, silently. Same posture as this repo's
 * API_KEY_ENTITLEMENT_GATE_ENABLED: only a well-formed value counts, anything
 * else is ignored and warned about.
 *
 * Pure so every rejection case is cheap to pin, including the ones that
 * previously passed `parseInt` and should not have.
 */
export function resolveRestartThreshold(raw: string | undefined): ThresholdResolution {
  if (raw === undefined || raw.trim() === '') return { threshold: TIMEOUT_RESTART_THRESHOLD };

  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return {
      threshold: TIMEOUT_RESTART_THRESHOLD,
      warning:
        `GUARDIAN_TIMEOUT_RESTART_THRESHOLD='${raw}' is not a plain integer — ` +
        `ignoring it and using the default of ${TIMEOUT_RESTART_THRESHOLD}`,
    };
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return {
      threshold: TIMEOUT_RESTART_THRESHOLD,
      warning:
        `GUARDIAN_TIMEOUT_RESTART_THRESHOLD='${raw}' is not an integer >= 1 — ` +
        `ignoring it and using the default of ${TIMEOUT_RESTART_THRESHOLD}`,
    };
  }

  if (parsed > TIMEOUT_RESTART_CEILING) {
    return {
      threshold: parsed,
      warning:
        `GUARDIAN_TIMEOUT_RESTART_THRESHOLD=${parsed} is above ${TIMEOUT_RESTART_CEILING} ` +
        `(~1h at the every-5-minutes cadence) — timeout auto-restart is effectively ` +
        `DISABLED. Honouring it, but saying so out loud.`,
    };
  }

  return { threshold: parsed };
}

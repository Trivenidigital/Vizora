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
 * to survive `TIMEOUT_RESTART_THRESHOLD` consecutive cycles first. The incident is
 * raised on the FIRST timeout either way, so the operator loses no visibility; only
 * the automated pm2 action waits.
 *
 * FAIL TOWARD REMEDIATION: anything this module cannot classify is treated as
 * restart-eligible, so an unanticipated error shape degrades to the previous
 * behaviour rather than silently disabling auto-remediation.
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
 * At the every-5-minutes cron cadence this is ~10 minutes of sustained unresponsiveness. Every
 * starvation event in the observed window recovered inside a single cycle; a real
 * hang persists indefinitely, so it still gets restarted, ~15 minutes later.
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

  if (consecutiveTimeouts >= threshold) {
    return {
      restart: true,
      reason:
        `unresponsive for ${consecutiveTimeouts} consecutive checks (>= ${threshold}) — ` +
        `sustained past what resource starvation explains, treating it as a hang`,
    };
  }

  return {
    restart: false,
    reason:
      `timed out ${consecutiveTimeouts}/${threshold} consecutive checks — the process is ` +
      `listening but slow, which a restart cannot fix and would make worse by spending CPU; ` +
      `waiting for it to persist before treating it as a hang`,
  };
}

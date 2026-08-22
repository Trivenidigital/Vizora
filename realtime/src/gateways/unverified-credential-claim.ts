/**
 * DIAGNOSTICS-ONLY extraction of the `sub` claim from a device JWT that FAILED
 * verification.
 *
 * ## Trust boundary — read before using anything this module returns
 *
 * A token that did not verify carries no identity. Its payload is a string the
 * caller sent us; anyone can mint one naming any device. The value returned by
 * `extractUnverifiedDeviceClaim` is therefore ATTACKER-CONTROLLED METADATA, and
 * it may reach exactly one destination: a log line.
 *
 * It must NEVER: authorize a request; alter a device row; change pairing or
 * revocation state; trigger a 410 or a credential purge; disable/delete/revoke a
 * device; count as authenticated activity or a heartbeat; update lastSeen; become
 * dashboard device state; drive a tenant-scoped action; or suppress signature
 * verification. It is a hint for an operator reading logs, nothing more — which is
 * why the emitted line tags it `attribution=unverified` and why
 * this value never travels in the same field as the VERIFIED `deviceId` that
 * `DeviceHandshakeResult` already carries.
 *
 * Deliberately duplicated in `middleware/src/modules/displays/` — the two packages
 * cannot share code, and the middleware copy has the same contract. Keep them in
 * sync by hand.
 */

/** Anything outside this set is stripped: the value lands in a log line. */
const DISALLOWED_CLAIM_CHARS = /[^A-Za-z0-9_.:-]/g;

/** Log lines are for humans; a display id is a cuid, far shorter than this. */
const MAX_CLAIM_LENGTH = 64;

/** A device JWT is ~400 bytes. Refuse to even decode an absurd input. */
const MAX_TOKEN_LENGTH = 8192;

/** Dedupe + global-ceiling window. */
export const CLAIM_TELEMETRY_WINDOW_MS = 15 * 60 * 1000;

/** Hard cap on the dedupe Map — an attacker must not be able to grow it. */
export const CLAIM_TELEMETRY_MAX_TRACKED = 500;

/** Hard cap on emissions per window ACROSS ALL CLAIMS. */
export const CLAIM_TELEMETRY_MAX_PER_WINDOW = 20;

/**
 * Base64url-decode ONLY the payload segment of `token`, and return its `sub` if
 * that is a non-empty string. No verification, no DB, no Redis.
 *
 * NEVER THROWS, for any input. Returns null whenever a claim cannot be read.
 *
 * The returned value is sanitised (allowed charset + length cap) BEFORE it is
 * returned, so a caller cannot forge a second log line by putting a newline in
 * `sub`. If sanitising empties the value, null is returned.
 */
export function extractUnverifiedDeviceClaim(token: string | undefined): string | null {
  try {
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
      return null;
    }
    const segments = token.split('.');
    if (segments.length !== 3) return null;

    const payloadSegment = segments[1];
    if (!payloadSegment) return null;

    const decoded = Buffer.from(payloadSegment, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

    const sub = (parsed as { sub?: unknown }).sub;
    if (typeof sub !== 'string' || sub.length === 0) return null;

    const sanitised = sub.replace(DISALLOWED_CLAIM_CHARS, '').slice(0, MAX_CLAIM_LENGTH);
    return sanitised.length > 0 ? sanitised : null;
  } catch {
    // JSON.parse, a RangeError on absurd nesting, anything at all — a diagnostic
    // must never become a failure mode of the auth path.
    return null;
  }
}

// ---- emission budget -------------------------------------------------------
// Module-level state. Minting invalid JWTs is free, so without a budget an
// attacker can write unbounded log volume (and unbounded Map entries) by varying
// `sub`. Only EMITTED claims are tracked, so a flood of distinct claims stops
// consuming memory as soon as the global ceiling trips.

const lastEmittedAt = new Map<string, number>();
let windowStartedAt = 0;
let emissionsInWindow = 0;
let ceilingHitInWindow = false;
let suppressionNoticeTakenInWindow = false;

function rollWindow(now: number): void {
  if (windowStartedAt === 0 || now - windowStartedAt >= CLAIM_TELEMETRY_WINDOW_MS) {
    windowStartedAt = now;
    emissionsInWindow = 0;
    ceilingHitInWindow = false;
    suppressionNoticeTakenInWindow = false;
  }
}

/**
 * True at most once per distinct claim per window, and at most
 * `CLAIM_TELEMETRY_MAX_PER_WINDOW` times per window overall.
 *
 * `now` is injected so callers and tests need no timer control.
 */
export function shouldEmitClaimTelemetry(claim: string, now: number): boolean {
  if (typeof claim !== 'string' || claim.length === 0) return false;
  rollWindow(now);

  // Dedupe first: a repeat of an already-logged claim is not new information and
  // must not consume the global budget or trip the suppression notice.
  const previous = lastEmittedAt.get(claim);
  if (previous !== undefined && now - previous < CLAIM_TELEMETRY_WINDOW_MS) return false;

  if (emissionsInWindow >= CLAIM_TELEMETRY_MAX_PER_WINDOW) {
    ceilingHitInWindow = true;
    return false;
  }

  // delete-then-set keeps Map insertion order == recency, so the first key is the
  // least-recently-emitted claim and is the right one to evict at the cap.
  lastEmittedAt.delete(claim);
  lastEmittedAt.set(claim, now);
  while (lastEmittedAt.size > CLAIM_TELEMETRY_MAX_TRACKED) {
    const oldest = lastEmittedAt.keys().next();
    if (oldest.done) break;
    lastEmittedAt.delete(oldest.value);
  }

  emissionsInWindow += 1;
  return true;
}

/**
 * True at most once per window, and only after the global ceiling has actually
 * suppressed something. Lets the caller record THAT suppression happened without
 * recording any claim value.
 */
export function takeClaimSuppressionNotice(now: number): boolean {
  rollWindow(now);
  if (!ceilingHitInWindow || suppressionNoticeTakenInWindow) return false;
  suppressionNoticeTakenInWindow = true;
  return true;
}

/** Test seam — module state is process-global. */
export function resetClaimTelemetryState(): void {
  lastEmittedAt.clear();
  windowStartedAt = 0;
  emissionsInWindow = 0;
  ceilingHitInWindow = false;
  suppressionNoticeTakenInWindow = false;
}

/** Test seam — asserts the Map cap is honoured. */
export function claimTelemetryTrackedCount(): number {
  return lastEmittedAt.size;
}

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
 * why the emitted line tags it `attribution=unauthenticated-claim` and why
 * this value never appears in a response body and is never confused with the
 * VERIFIED `payload.sub` this service reads only AFTER `jwtService.verify` succeeds.
 *
 * Deliberately duplicated in `realtime/src/gateways/` — the two packages
 * cannot share code, and the realtime copy has the same contract. Keep them in
 * sync by hand.
 */

/**
 * Anything outside this set is stripped: the value lands in a log line.
 *
 * `.` is deliberately EXCLUDED. Device ids here are cuids/UUIDs and never contain
 * one, while allowing it lets a `sub` render as a JWT-shaped `eyJ....eyJ....Sfl...`
 * string — which trips secret scanners on the log stream and, worse, trains
 * operators to skim past JWT-shaped values in logs.
 */
const DISALLOWED_CLAIM_CHARS = /[^A-Za-z0-9_:-]/g;

/**
 * Peers are addresses, so this set keeps `.` — stripping it would render 10.0.0.7 as
 * `10007`, which is not merely lossy but actively misleading. Same helper, same
 * anchored-strip discipline; only the alphabet differs, and for a stated reason.
 */
const DISALLOWED_PEER_CHARS = /[^A-Za-z0-9_.:-]/g;

/** Log lines are for humans; a display id is a cuid, far shorter than this. */
const MAX_CLAIM_LENGTH = 64;

/** Enough for an IPv6 address with a zone id, and nothing like enough to spam. */
const MAX_PEER_LENGTH = 64;

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

    return sanitiseForLog(sub, DISALLOWED_CLAIM_CHARS, MAX_CLAIM_LENGTH);
  } catch {
    // JSON.parse, a RangeError on absurd nesting, anything at all — a diagnostic
    // must never become a failure mode of the auth path.
    return null;
  }
}

/**
 * Strip every character outside `allowed` and cap the length. The ONLY way an
 * untrusted value may reach a log line in this module — a CR/LF or an `=` surviving
 * here is a forged log record, so the strip is a whitelist, never a blacklist.
 */
function sanitiseForLog(
  value: string,
  disallowed: RegExp,
  maxLength: number,
): string | null {
  const sanitised = value.replace(disallowed, '').slice(0, maxLength);
  return sanitised.length > 0 ? sanitised : null;
}

/**
 * Sanitise the peer address that presented an unverifiable credential, for the
 * `peer=` / `clientIp=` field on the reject line.
 *
 * The address is attacker-influenced in the same way the claim is (whatever the
 * transport reports), and it is NOT identity either — it is the only thing on the
 * line that is at least observed rather than asserted, which is exactly why the
 * enriched line needs it: without a source, a forged `claimedDeviceId` naming a real
 * customer display is indistinguishable from that display genuinely misbehaving.
 *
 * NEVER THROWS. Returns null when there is nothing usable.
 */
export function sanitiseUnverifiedPeer(peer: string | undefined | null): string | null {
  try {
    if (typeof peer !== 'string' || peer.length === 0) return null;
    return sanitiseForLog(peer, DISALLOWED_PEER_CHARS, MAX_PEER_LENGTH);
  } catch {
    return null;
  }
}

// ---- emission budget -------------------------------------------------------
// Minting invalid JWTs is free, so without a budget an attacker can write
// unbounded attacker-controlled text into the logs (and unbounded Map entries) by
// varying `sub`. Callers must therefore omit the claim entirely when the gate says
// no, not merely log it more quietly: prod runs with debug enabled, so demoting the
// level bounds nothing. Only EMITTED claims are tracked, so a flood of distinct
// claims also stops consuming memory as soon as the global ceiling trips.
//
// ACCEPTED RESIDUAL, deliberately not fixed: an attacker who spends the window's
// 20 distinct claims at its start suppresses genuine attribution for the rest of it.
// That is the trade for not letting them write unbounded attacker-controlled text
// into prod logs, and what makes it acceptable is the suppression notice the callers
// emit — it converts "silently degraded" into "known degraded", so an operator who
// sees an unattributed reject can tell whether attribution was withheld or simply
// undecodable. Widening the budget would buy back the tail at the cost of the flood.
//
// The state is module-level, so the budget is PER PROCESS. Realtime runs one PM2
// instance, so its numbers are the fleet-wide ones; middleware runs 2 in cluster
// mode, giving ~2x the ceiling fleet-wide and independent dedupe maps — the same
// claim can legitimately be logged once per worker inside one window. Same caveat
// as the MCP in-memory rate limit. A duplicate line is not a bug.

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

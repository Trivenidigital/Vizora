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
 * this value never travels in the same field as the VERIFIED `deviceId` that
 * `DeviceHandshakeResult` already carries.
 *
 * Deliberately duplicated in `middleware/src/modules/displays/` — the two packages
 * cannot share code, and the middleware copy has the same contract. Keep them in
 * sync by hand.
 */

import { isIP } from 'net';

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
 * A peer is validated by SHAPE, not filtered by alphabet.
 *
 * A charset filter cannot work here: keeping `.` (which IPv4 needs) would let a
 * JWT-shaped header render intact as `peer=eyJ....eyJ....Sfl...`, reopening on this
 * field exactly the rendering the claim alphabet removes; dropping `.` would render
 * 10.0.0.7 as `10007`, which is worse than lossy. So the value must either BE an
 * address or be reported as unknown — `net.isIP` decides, and its accepted output
 * (hex digits, dots, colons) cannot contain a space, an `=`, or a newline, which is
 * a stronger guarantee than any strip.
 */
const PEER_ZONE_ID = /^[A-Za-z0-9_.-]{1,32}$/;

/** Log lines are for humans; a display id is a cuid, far shorter than this. */
const MAX_CLAIM_LENGTH = 64;

/** Enough for an IPv6 address plus a zone id (45 + 1 + 32 at the extreme). */
const MAX_PEER_LENGTH = 78;

/** Refuse to even parse an absurd header; the parser accepts thousands of bytes. */
const MAX_PEER_INPUT_LENGTH = 512;

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
 * Validate the peer address that presented an unverifiable credential, for the
 * `peer=` / `clientIp=` field on the reject line. Returns the address, or null when
 * the value is not one — callers render null as `unknown` rather than dropping the
 * field, so the line shape stays stable.
 *
 * The address is attacker-influenced in the same way the claim is, and it is NOT
 * identity either — it is the only thing on the line that is observed rather than
 * asserted, which is why the enriched line needs it: without a source, a forged
 * `claimedDeviceId` naming a real customer display is indistinguishable from that
 * display genuinely misbehaving.
 *
 * Takes the LAST comma-separated element. Node joins repeated headers of the same
 * name with `, ` (it only arrays `set-cookie`), so a duplicated header arrives as
 * `"1.1.1.1, 2.2.2.2"` — which a naive strip would render as the fabricated address
 * `1.1.1.12.2.2.2`. The last element is the one closest to us.
 *
 * NEVER THROWS.
 */
export function sanitiseUnverifiedPeer(peer: string | undefined | null): string | null {
  try {
    if (typeof peer !== 'string' || peer.length === 0) return null;
    if (peer.length > MAX_PEER_INPUT_LENGTH) return null;

    const candidate = (peer.split(',').pop() ?? '').trim();
    if (candidate.length === 0 || candidate.length > MAX_PEER_LENGTH) return null;

    // An IPv6 zone id (`fe80::1%eth0`) is legitimate and `net.isIP` rejects it, so
    // split it off, constrain it, and validate the address on its own.
    const parts = candidate.split('%');
    if (parts.length > 2) return null;
    const [address, zone] = parts;
    if (zone !== undefined && !PEER_ZONE_ID.test(zone)) return null;
    if (isIP(address) === 0) return null;

    return zone === undefined ? address : `${address}%${zone}`;
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
let suppressedInWindow = 0;
let noticesTakenInWindow = 0;

function rollWindow(now: number): void {
  if (windowStartedAt === 0 || now - windowStartedAt >= CLAIM_TELEMETRY_WINDOW_MS) {
    windowStartedAt = now;
    emissionsInWindow = 0;
    suppressedInWindow = 0;
    noticesTakenInWindow = 0;
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
    suppressedInWindow += 1;
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
 * Order-of-magnitude checkpoints at which the caller should say that suppression is
 * happening, and how much of it. A bare "suppression occurred" cannot separate two
 * claims lost to incidental budget exhaustion from fifty thousand lost to an active
 * flood, and that distinction is the whole reason the over-budget residual is
 * tolerable. Escalating thresholds give the operator the first signal immediately and
 * the magnitude as it develops, while bounding the notice itself to at most five
 * lines per window — the count is a number WE generate, never attacker text, so it
 * cannot be used to widen the flood.
 */
const SUPPRESSION_NOTICE_AT = [1, 10, 100, 1000, 10000];

/**
 * The number of suppressed emissions so far this window, at the moments that number
 * crosses one of `SUPPRESSION_NOTICE_AT` — otherwise null. Never a claim value.
 */
export function takeClaimSuppressionNotice(now: number): number | null {
  rollWindow(now);
  if (noticesTakenInWindow >= SUPPRESSION_NOTICE_AT.length) return null;
  const nextThreshold = SUPPRESSION_NOTICE_AT[noticesTakenInWindow];
  if (suppressedInWindow < nextThreshold) return null;
  noticesTakenInWindow += 1;
  return suppressedInWindow;
}

/** Test seam — module state is process-global. */
export function resetClaimTelemetryState(): void {
  lastEmittedAt.clear();
  windowStartedAt = 0;
  emissionsInWindow = 0;
  suppressedInWindow = 0;
  noticesTakenInWindow = 0;
}

/** Test seam — asserts the Map cap is honoured. */
export function claimTelemetryTrackedCount(): number {
  return lastEmittedAt.size;
}

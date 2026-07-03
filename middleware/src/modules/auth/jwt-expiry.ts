/**
 * Single source of truth for the access-token TTL.
 *
 * Standalone (no NestJS imports) so the module, service, and controller can all
 * import it without a circular dependency.
 *
 * Two footguns this closes:
 *  1. jsonwebtoken reads a UNITLESS string as milliseconds ("3600" → 3600ms ≈
 *     3.6s) but a number as seconds. So `JWT_EXPIRES_IN=3600` (meant as seconds)
 *     silently mints 3.6s tokens. We resolve to a bounded whole-seconds NUMBER.
 *  2. Response `expiresIn`, cookie `maxAge`, and the JWT's real `exp` were three
 *     independent hardcoded 7d constants. If they diverge (e.g. a short
 *     JWT_EXPIRES_IN) the client thinks it's logged in for 7d while the token
 *     dies early — a "ghost session" that 401s until the cookie's maxAge elapses.
 *     Everything now derives from getAccessTokenTtlSeconds().
 */

/**
 * MAX is pinned to the revocation-marker TTL (AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS
 * = 7d): `user_revoked`/`pwd_changed` Redis markers are written with that TTL, so
 * a token outliving it would resurrect a revoked session. Capping here makes that
 * impossible regardless of how JWT_EXPIRES_IN is set. MIN guards near-instant expiry.
 */
export const ACCESS_TOKEN_TTL_MIN_S = 60;
export const ACCESS_TOKEN_TTL_MAX_S = 7 * 24 * 60 * 60; // 604800
export const ACCESS_TOKEN_TTL_DEFAULT_S = 7 * 24 * 60 * 60;

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };

/** Parse a JWT_EXPIRES_IN value to whole seconds, or null if unparseable. */
export function parseExpiryToSeconds(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return ACCESS_TOKEN_TTL_DEFAULT_S;
  const v = raw.trim();
  // Bare integer = seconds (NOT ms).
  if (/^\d+$/.test(v)) return Number(v);
  // Unit string "7d"/"1h"/"30m"/"2w" (whole numbers only).
  const m = v.match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (m) return Number(m[1]) * UNIT_SECONDS[m[2].toLowerCase()];
  // Decimals ("3600.5"), negatives, garbage — the footgun class. Unparseable.
  return null;
}

/**
 * Resolve JWT_EXPIRES_IN to a bounded whole-seconds NUMBER. Fail-SAFE: unparseable
 * → 7d default; out-of-range → clamp into [MIN, MAX]. Never MORE permissive than
 * the default, never longer than the revocation-marker TTL. Non-clean inputs warn
 * so a misconfig is visible rather than silent.
 */
export function resolveAccessTokenTtlSeconds(raw = process.env.JWT_EXPIRES_IN): number {
  const parsed = parseExpiryToSeconds(raw);
  if (parsed === null || !Number.isFinite(parsed)) {
    // eslint-disable-next-line no-console
    console.warn(`[auth] JWT_EXPIRES_IN="${raw}" is not a valid duration; using 7d default.`);
    return ACCESS_TOKEN_TTL_DEFAULT_S;
  }
  if (parsed < ACCESS_TOKEN_TTL_MIN_S) {
    // eslint-disable-next-line no-console
    console.warn(`[auth] JWT_EXPIRES_IN resolves to ${parsed}s (< ${ACCESS_TOKEN_TTL_MIN_S}s min); clamping up.`);
    return ACCESS_TOKEN_TTL_MIN_S;
  }
  if (parsed > ACCESS_TOKEN_TTL_MAX_S) {
    // eslint-disable-next-line no-console
    console.warn(`[auth] JWT_EXPIRES_IN resolves to ${parsed}s (> ${ACCESS_TOKEN_TTL_MAX_S}s max = revocation TTL); clamping down.`);
    return ACCESS_TOKEN_TTL_MAX_S;
  }
  return parsed;
}

/** Memoized resolved access-token TTL (seconds) — single source of truth. */
let _ttlSecondsCache: number | undefined;
export function getAccessTokenTtlSeconds(): number {
  if (_ttlSecondsCache === undefined) _ttlSecondsCache = resolveAccessTokenTtlSeconds();
  return _ttlSecondsCache;
}
export function getAccessTokenTtlMs(): number {
  return getAccessTokenTtlSeconds() * 1000;
}

/** Test-only: reset the memoized cache so a spec can vary JWT_EXPIRES_IN. */
export function __resetAccessTokenTtlCacheForTest(): void {
  _ttlSecondsCache = undefined;
}

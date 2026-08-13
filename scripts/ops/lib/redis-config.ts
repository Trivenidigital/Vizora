/**
 * Vizora Autonomous Operations — Redis configuration canonicalisation (B4)
 *
 * ─── The two representations, and who consumes which ────────────────────────
 *
 * Established by reading the consuming paths rather than the docs:
 *
 *   REDIS_URL       the ONLY thing application code reads. middleware
 *                   (modules/redis/redis.service.ts), realtime
 *                   (services/redis.service.ts, adapters/redis-io.adapter.ts)
 *                   and ops (db-maintainer.ts) each do
 *                   `process.env.REDIS_URL || 'redis://localhost:6379'`.
 *                   realtime's boot validator also requires it in production.
 *
 *   REDIS_PASSWORD  read by NO application code. Its only consumers are
 *                   docker/docker-compose.yml, where it sets the Redis
 *                   SERVER's `--requirepass` and the healthcheck's `-a` flag.
 *
 * So they are not duplicates of each other: one configures the server, the
 * other configures every client. That is fine — until they disagree.
 *
 * ─── The failure ────────────────────────────────────────────────────────────
 *
 * Rotate REDIS_PASSWORD in `.env` and recreate the container, and the server
 * now demands the new password while every client still presents the old one
 * embedded in REDIS_URL. Nothing in either file references the other, so the
 * divergence is invisible until every Redis operation starts failing. The
 * reverse — editing REDIS_URL alone — leaves clients presenting a password the
 * server does not accept.
 *
 * ─── The canonical rule ─────────────────────────────────────────────────────
 *
 * REDIS_URL is canonical for clients. REDIS_PASSWORD exists solely to
 * configure the server, and its value MUST equal the password component of
 * REDIS_URL. This module checks that invariant; it never rewrites either
 * value, and it never emits a fingerprint — only MATCH/DRIFT, exactly as the
 * B1 ruling requires for secrets.
 *
 * ─── Every finding is COUNTERFACTUAL, never present tense ───────────────────
 *
 * The caller evaluates ZERO-STATE config: "would a rebuild come up able to
 * talk to Redis?" It does not observe the running server. Step 1 of a password
 * rotation — edit `.env`, container not yet recreated — is a legitimate
 * transient state in which Redis is 100% healthy while these values disagree.
 * A present-tense "clients cannot authenticate" would page hourly through that
 * window and teach the operator to mute the detector, which is precisely the
 * failure the stability guard in config-drift.ts exists to prevent. Phrase
 * every detail as what a REBUILD would do.
 */

import { decomposeRedisUrl } from './pg-url.js';
import { compareSecretValues, type SecretVerdict } from './secret-compare.js';

export type RedisConsistency =
  /** URL password and REDIS_PASSWORD agree. */
  | 'CONSISTENT'
  /** Both present and DISAGREE — a rebuild would leave clients unable to auth. */
  | 'PASSWORD_DRIFT'
  /** REDIS_PASSWORD set, URL carries none — a rebuild would require auth clients omit. */
  | 'URL_MISSING_PASSWORD'
  /** URL carries a password, REDIS_PASSWORD unset — a rebuild could not start Redis. */
  | 'SERVER_MISSING_PASSWORD'
  /** Neither side uses a password — valid for a local unauthenticated Redis. */
  | 'NO_PASSWORD_EITHER_SIDE'
  /** REDIS_URL absent or unparseable — a different problem, reported as such. */
  | 'URL_UNAVAILABLE';

export interface RedisConsistencyResult {
  verdict: RedisConsistency;
  /** Never contains a secret or any derivation of one. */
  detail: string;
}

/**
 * Check the two representations against each other.
 *
 * `redisPassword` is the server-side value (docker-compose's `--requirepass`).
 * Both inputs are compared in memory; only the verdict escapes.
 */
export function checkRedisConsistency(
  redisUrl: string | undefined,
  redisPassword: string | undefined,
): RedisConsistencyResult {
  const parsed = decomposeRedisUrl(redisUrl);
  if (!parsed) {
    return {
      verdict: 'URL_UNAVAILABLE',
      detail: redisUrl
        ? 'REDIS_URL is set but could not be parsed as a Redis connection string'
        : 'REDIS_URL is not set — every client would fall back to redis://localhost:6379',
    };
  }

  const urlPassword = parsed.password;
  const hasUrlPassword = Boolean(urlPassword);
  const hasServerPassword = Boolean(redisPassword);

  if (!hasUrlPassword && !hasServerPassword) {
    return {
      verdict: 'NO_PASSWORD_EITHER_SIDE',
      detail: 'neither REDIS_URL nor REDIS_PASSWORD carries a password',
    };
  }
  if (!hasUrlPassword) {
    return {
      verdict: 'URL_MISSING_PASSWORD',
      detail:
        'REDIS_PASSWORD is set but REDIS_URL carries no password — a zero-state ' +
        'rebuild would start a server requiring auth and clients sending none, ' +
        'and every client would then be rejected with NOAUTH',
    };
  }
  if (!hasServerPassword) {
    return {
      verdict: 'SERVER_MISSING_PASSWORD',
      detail:
        'REDIS_URL carries a password but REDIS_PASSWORD is unset — a zero-state ' +
        'rebuild would fail to start Redis at all (docker-compose requires the ' +
        'variable), and a server brought up without auth would reject the AUTH ' +
        'command clients send',
    };
  }

  const verdict: SecretVerdict = compareSecretValues(urlPassword, redisPassword);
  return verdict === 'MATCH'
    ? {
        verdict: 'CONSISTENT',
        detail: 'REDIS_URL password component matches REDIS_PASSWORD',
      }
    : {
        verdict: 'PASSWORD_DRIFT',
        detail:
          'REDIS_URL password component does NOT match REDIS_PASSWORD — a ' +
          'zero-state rebuild would come up with server and clients holding ' +
          'different credentials',
      };
}

/** True for the states that would break Redis for every service. */
export function isRedisBroken(result: RedisConsistencyResult): boolean {
  return (
    result.verdict === 'PASSWORD_DRIFT' ||
    result.verdict === 'URL_MISSING_PASSWORD' ||
    result.verdict === 'SERVER_MISSING_PASSWORD'
  );
}

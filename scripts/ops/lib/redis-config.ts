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
 */

import { decomposeRedisUrl } from './pg-url.js';
import { compareSecretValues, type SecretVerdict } from './secret-compare.js';

export type RedisConsistency =
  /** URL password and REDIS_PASSWORD agree. */
  | 'CONSISTENT'
  /** Both representations present and DISAGREE — clients cannot authenticate. */
  | 'PASSWORD_DRIFT'
  /** Server is password-protected but the client URL carries no password. */
  | 'URL_MISSING_PASSWORD'
  /** Client URL carries a password but the server is not configured with one. */
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
        'REDIS_PASSWORD is set (the server will require auth) but REDIS_URL carries ' +
        'no password — every client would be rejected with NOAUTH',
    };
  }
  if (!hasServerPassword) {
    return {
      verdict: 'SERVER_MISSING_PASSWORD',
      detail:
        'REDIS_URL carries a password but REDIS_PASSWORD is unset — docker-compose ' +
        'would refuse to start Redis, and a server started without auth would ' +
        'reject the AUTH command clients send',
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
          'REDIS_URL password component does NOT match REDIS_PASSWORD — the server ' +
          'and its clients are configured with different credentials',
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

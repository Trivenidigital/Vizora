/**
 * Vizora Autonomous Operations — Postgres/Redis URL decomposition
 *
 * Extracted so `db-maintainer` can share it with `config-drift` without
 * importing that module's Zod/middleware dependency chain. A maintenance agent
 * must not fail to start because an unrelated validation schema changed.
 *
 * `DATABASE_URL` and `REDIS_URL` are MIXED values: the password component has
 * to be handled separately from host/port/database and from pool tuning, both
 * for comparison correctness and so credentials never reach argv or a log line.
 */

export interface PostgresParts {
  scheme: string;
  user?: string;
  password?: string;
  host: string;
  port: string;
  database: string;
  params: Record<string, string>;
}

export interface RedisParts {
  scheme: string;
  password?: string;
  host: string;
  port: string;
}

export function decomposePostgresUrl(url: string | undefined): PostgresParts | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { params[k] = v; });
    return {
      scheme: u.protocol.replace(':', ''),
      user: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      host: u.hostname,
      port: u.port,
      database: u.pathname.replace(/^\//, ''),
      params,
    };
  } catch {
    return null;
  }
}

/**
 * Decompose a Redis connection URL.
 *
 * The password is percent-DECODED, which matches what the client actually
 * sends: ioredis parses with legacy `url.parse(url, true, true)`, and that
 * decodes the auth component. So `redis://:p%40ss@h` yields `p@ss` on both
 * sides, and a comparison against a raw `REDIS_PASSWORD` is apples-to-apples.
 *
 * Also reads the `?password=` query form, which ioredis honours via its
 * `defaults(result, parsed.query)` merge. Userinfo wins when both are present,
 * mirroring that merge order. Without this, a URL using the query form reads as
 * having NO password — which would make the B4 consistency check emit a false
 * CRITICAL every hour for a configuration that works.
 */
export function decomposeRedisUrl(url: string | undefined): RedisParts | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const userinfo = u.password ? decodeURIComponent(u.password) : undefined;
    const query = u.searchParams.get('password') || undefined;
    return {
      scheme: u.protocol.replace(':', ''),
      password: userinfo ?? query,
      host: u.hostname,
      port: u.port,
    };
  } catch {
    return null;
  }
}

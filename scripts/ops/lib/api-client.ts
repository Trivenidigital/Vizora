/**
 * Vizora Autonomous Operations — API Client
 *
 * HTTP client for the Vizora middleware API. Extends the patterns from
 * validate-monitor.ts with write operations (PATCH/POST) and audit logging
 * for all remediation actions.
 *
 * Features:
 * - Response envelope unwrapping (`{ success, data }` → `data`)
 * - Paginated GET with automatic page walking (max 500 items)
 * - Rate limiting (100ms between requests)
 * - Remediation audit trail via RemediationAction log
 * - HEAD probe for URL reachability checks
 */

import type { RemediationAction } from './types.js';
import { log } from './alerting.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const PROBE_TIMEOUT_MS = 5_000;
const RATE_LIMIT_MS = 100;

/**
 * Hard ceiling on how many entities `getAll` will walk. Exported because it is
 * not an implementation detail to its callers: a list that comes back with
 * EXACTLY this many items may have been cut short, and a caller reasoning about
 * whether it saw the whole tenant needs the number to test against.
 *
 * Prefer `getAllScan().complete` over comparing against this — the server's
 * `meta.total` gives an EXACT answer where it is present, and this ceiling is
 * only the fallback proxy.
 */
export const MAX_ENTITIES = 500;

/**
 * Page size requested by the page walk.
 *
 * COUPLED to the API's `PaginationDto`, which declares `@Max(100)` on `limit`
 * (middleware/src/modules/common/dto/pagination.dto.ts). This value must never
 * exceed that maximum, and the walk's "a short page means the last page"
 * heuristic silently depends on the server honouring the requested size:
 * a server that CLAMPED limit to something smaller would return a short first
 * page and the walk would stop, reporting a partial list as the whole
 * collection. The `meta.total` check in `getAllScan` is what makes that
 * failure detectable rather than silent.
 */
const PAGE_SIZE = 100;

/** Result of a full page walk, with an explicit completeness verdict. */
export interface ListScan<T> {
  /** Items actually retrieved (never more than MAX_ENTITIES). */
  items: T[];
  /**
   * True only when the walk PROVABLY covered the entire server-side
   * collection. Callers that resolve incidents must gate on this: an entity
   * the walk never retrieved cannot be evidence that its incident cleared.
   */
  complete: boolean;
  /** Server-reported collection size, when the envelope carried one. */
  total: number | null;
}

// ─── Standalone Login ───────────────────────────────────────────────────────

/**
 * Sessions opened by `login()` that have not been released yet, keyed by the
 * access token. The value is the `Cookie:` header needed to release them.
 *
 * WHY THIS EXISTS. `POST /auth/login` mints a rotating refresh-token row and
 * returns it as an httpOnly cookie. These agents authenticate with `fetch`,
 * which has no cookie jar, so the cookie was dropped on the floor and the row
 * was orphaned at birth — never used, never revoked, valid for 30 days. Every
 * cron firing leaked one. Measured on prod 2026-08-02: ~16/hour, ~384/day,
 * 8,405 rows accumulated since the table was created on 2026-07-12, with
 * `replacedByTokenHash = 0` across the board — not one was ever redeemed.
 *
 * `POST /auth/logout` only revokes the row when the refresh cookie is
 * PRESENTED back (auth.controller.ts: `extractRefreshToken(req)` ->
 * `revokeByRawToken`). A bearer token alone is not enough. So we keep the
 * cookie just long enough to hand it back.
 */
const openSessions = new Map<string, { baseUrl: string; cookie: string; csrf: string }>();

/** Turn a login response's Set-Cookie headers into `name=value` pairs. */
function cookiePairs(res: Response): string[] {
  const raw =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''].filter(Boolean);
  // Keep only the `name=value` pair from each cookie, discard the attributes.
  return raw.map(c => c.split(';')[0].trim()).filter(Boolean);
}

/** Read one cookie's value out of `name=value` pairs. */
function valueOf(pairs: string[], name: string): string {
  const hit = pairs.find(p => p.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : '';
}

/**
 * Count of sessions this process failed to release. Non-zero means refresh-token
 * rows were leaked; agents surface it so a silent failure cannot recur.
 */
let releaseFailures = 0;

/** How many session releases failed in this process. */
export function sessionReleaseFailures(): number {
  return releaseFailures;
}

/**
 * Release a session opened by `login()`. Never throws — a failed logout must not
 * fail an ops run — but it is NOT silent.
 *
 * Silence here is what let two ineffective fixes ship looking correct: the
 * server was rejecting the logout 401 (cookies presented without the matching
 * CSRF header) and the swallowed error made it look like nothing happened at
 * all. Any non-2xx or thrown error is now logged at ERROR and counted.
 */
export async function logout(baseUrl: string, token: string): Promise<void> {
  const session = openSessions.get(token);
  openSessions.delete(token);
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(session?.cookie ? { Cookie: session.cookie } : {}),
        // Required. Presenting cookies makes this look cookie-authenticated, so
        // the CSRF double-submit check applies: cookies WITHOUT this header are
        // rejected 401 and nothing is revoked. Verified on prod — cookie alone
        // = 401 + row still live; cookie + this header = 201 + row revoked.
        ...(session?.csrf ? { 'X-CSRF-Token': session.csrf } : {}),
      },
    });
    if (!res.ok) {
      releaseFailures++;
      log(
        'api-client',
        `ERROR: session release rejected (${res.status}) — the refresh-token row was NOT revoked and is leaked for its full TTL. ` +
          `A 401 here usually means the CSRF header did not accompany the cookies.`,
      );
    }
  } catch (err) {
    releaseFailures++;
    log(
      'api-client',
      `ERROR: session release failed — ${err instanceof Error ? err.message : err}. The refresh-token row was NOT revoked.`,
    );
  }
}

/**
 * Authenticate with the Vizora API and return a bearer token.
 * Same pattern as validate-monitor.ts — extracts token from envelope.
 *
 * Records the refresh cookie so the session can be released later. The CALLER
 * must release it — agents do that via `.finally(() => releaseSessions())` on
 * their entry-point chain.
 *
 * Do not "simplify" this back to an automatic `process.once('beforeExit')`
 * hook. That was tried and deployed, and it does not work: the hook fires
 * (verified on prod), but it can only kick off a fire-and-forget request, and
 * the process exits before that request completes — the row is never revoked.
 * The release has to be awaited from the promise chain the process is already
 * waiting on.
 */
export async function login(
  baseUrl: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  const data = (json.data ?? json) as Record<string, unknown>;
  const token = data.accessToken || data.access_token || data.token;
  if (!token) throw new Error('Login response has no token');

  const accessToken = String(token);
  const pairs = cookiePairs(res);
  if (pairs.length > 0) {
    openSessions.set(accessToken, {
      baseUrl,
      cookie: pairs.join('; '),
      csrf: valueOf(pairs, 'vizora_csrf_token'),
    });
  }
  return accessToken;
}

/**
 * Release every session this process opened. Agents call this from a `.finally`
 * on their entry point, so it runs on success AND on failure.
 *
 * This replaced a `process.once('beforeExit')` hook that did NOT work. The hook
 * fired -- verified on prod -- but it kicked off a fire-and-forget `logout()`
 * and the process exited before the request completed, so the row was never
 * revoked. Awaiting from the entry-point chain is deterministic: the promise is
 * part of the chain, so the loop stays alive until the release finishes.
 */
export async function releaseSessions(): Promise<void> {
  const tokens = [...openSessions.keys()];
  if (tokens.length === 0) return;
  await Promise.all(tokens.map(t => logout(openSessions.get(t)!.baseUrl, t)));
  // Operational signal: agents run headless on cron, so an unreported failure
  // here is invisible until someone counts rows in the database months later.
  if (releaseFailures > 0) {
    log('api-client', `ERROR: ${releaseFailures}/${tokens.length} session release(s) FAILED — refresh tokens leaked this run`);
  } else {
    log('api-client', `released ${tokens.length} session(s)`);
  }
}

/** Test seam: reset the release-failure counter between cases. */
export function __resetSessionReleaseFailures(): void {
  releaseFailures = 0;
}

/** Test seam: how many sessions are still holding a refresh cookie. */
export function __openSessionCount(): number {
  return openSessions.size;
}

// ─── OpsApiClient ───────────────────────────────────────────────────────────

export class OpsApiClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly agentName: string;
  private readonly _auditLog: RemediationAction[] = [];
  private lastRequestTime = 0;

  constructor(baseUrl: string, token: string, agentName: string) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.agentName = agentName;
  }

  /** Return all recorded remediation actions from this session. */
  get auditLog(): RemediationAction[] {
    return this._auditLog;
  }

  // ─── Rate Limiting ──────────────────────────────────────────────────────

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  // ─── GET ────────────────────────────────────────────────────────────────

  /**
   * GET a single resource. Unwraps the `{ success, data }` response envelope.
   */
  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    await this.rateLimit();
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText} — ${path}`);
      const json = (await res.json()) as Record<string, unknown>;
      // Unwrap response envelope
      if (json.success !== undefined && json.data !== undefined) return json.data as T;
      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Paginated GET — walks pages until exhausted or MAX_ENTITIES reached.
   * Handles multiple response shapes: array, { items }, { data }.
   *
   * Returns items only. Callers deciding whether they saw the WHOLE collection
   * must use `getAllScan` instead — a bare array cannot distinguish "this
   * tenant has 500 schedules" from "this tenant has 5000 and you saw 500".
   */
  async getAll<T>(path: string, params?: Record<string, string | number>): Promise<T[]> {
    return (await this.getAllScan<T>(path, params)).items;
  }

  /**
   * Paginated GET that also reports whether the walk was COMPLETE.
   *
   * Two failure modes are handled here rather than left to callers:
   *
   *  - Unrecognized response shape THROWS. It previously `break`ed, yielding an
   *    empty list that every caller read as a successful "this tenant has zero
   *    entities". A response-shape drift would therefore have made every ops
   *    agent see an empty fleet simultaneously — and an agent that resolves
   *    incidents it did not re-raise would then clear EVERYTHING, report
   *    HEALTHY and exit 0. Throwing routes it into each agent's existing fetch
   *    try/catch, which exits 2 and writes no state.
   *
   *  - Incomplete walks are reported, not guessed at. `meta.total` (present on
   *    every `PaginatedResponse` endpoint) makes the verdict EXACT and covers
   *    both truncation at the cap AND a short walk caused by a server that did
   *    not honour the requested page size. The `< MAX_ENTITIES` proxy is only
   *    the fallback for endpoints that report no total.
   */
  async getAllScan<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<ListScan<T>> {
    const collected: T[] = [];
    let page = 1;
    let total: number | null = null;

    while (collected.length < MAX_ENTITIES) {
      const data = await this.get<T[] | { items?: T[]; data?: T[]; meta?: { total?: number } }>(
        path,
        { ...params, page: String(page), limit: String(PAGE_SIZE) },
      );

      let batch: T[];
      if (Array.isArray(data)) batch = data;
      else if (Array.isArray(data?.items)) batch = data.items;
      else if (Array.isArray(data?.data)) batch = data.data;
      else {
        throw new Error(
          `API returned an unrecognized list shape for ${path} — expected an array, ` +
            `{ items: [] } or { data: [] }, got keys [${
              data && typeof data === 'object' ? Object.keys(data).join(', ') : typeof data
            }]. Refusing to report this as an empty collection.`,
        );
      }

      const reported = (data as { meta?: { total?: unknown } })?.meta?.total;
      if (typeof reported === 'number' && Number.isFinite(reported)) total = reported;

      collected.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    const items = collected.slice(0, MAX_ENTITIES);
    // Exact when the server told us the size; otherwise fall back to the cap
    // proxy, which reads "exactly 500" as possibly-truncated. That false
    // positive is in the safe direction — it withholds incident resolution
    // rather than granting it on unseen data.
    const complete = total !== null ? items.length === total : collected.length < MAX_ENTITIES;

    return { items, complete, total };
  }

  // ─── PATCH ──────────────────────────────────────────────────────────────

  /**
   * PATCH a resource. Records a RemediationAction in the audit log.
   *
   * @param path  API path (e.g. `/content/abc123`)
   * @param body  Request body
   * @param auditTarget  Optional `{ target, targetId, action }` for the audit log
   */
  async patch<T>(
    path: string,
    body: Record<string, unknown>,
    auditTarget?: { target: string; targetId: string; action: string; before?: unknown },
  ): Promise<T> {
    await this.rateLimit();
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const remediation: RemediationAction = {
      agent: this.agentName,
      timestamp: new Date().toISOString(),
      action: auditTarget?.action ?? `PATCH ${path}`,
      target: auditTarget?.target ?? 'unknown',
      targetId: auditTarget?.targetId ?? 'unknown',
      method: 'PATCH',
      endpoint: `/api/v1${path}`,
      before: auditTarget?.before,
      success: false,
    };

    try {
      const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${res.statusText} — ${path}: ${errText}`);
      }
      const json = (await res.json()) as Record<string, unknown>;
      const data = json.success !== undefined && json.data !== undefined ? json.data : json;
      remediation.success = true;
      remediation.after = data;
      return data as T;
    } catch (err) {
      remediation.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      clearTimeout(timer);
      this._auditLog.push(remediation);
    }
  }

  // ─── POST ──────────────────────────────────────────────────────────────

  /**
   * POST a resource. Records a RemediationAction in the audit log.
   *
   * @param path  API path (e.g. `/content`)
   * @param body  Request body
   * @param auditTarget  Optional `{ target, targetId, action }` for the audit log
   */
  async post<T>(
    path: string,
    body: Record<string, unknown>,
    auditTarget?: { target: string; targetId: string; action: string; before?: unknown },
  ): Promise<T> {
    await this.rateLimit();
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const remediation: RemediationAction = {
      agent: this.agentName,
      timestamp: new Date().toISOString(),
      action: auditTarget?.action ?? `POST ${path}`,
      target: auditTarget?.target ?? 'unknown',
      targetId: auditTarget?.targetId ?? 'unknown',
      method: 'POST',
      endpoint: `/api/v1${path}`,
      before: auditTarget?.before,
      success: false,
    };

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${res.statusText} — ${path}: ${errText}`);
      }
      const json = (await res.json()) as Record<string, unknown>;
      const data = json.success !== undefined && json.data !== undefined ? json.data : json;
      remediation.success = true;
      remediation.after = data;
      return data as T;
    } catch (err) {
      remediation.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      clearTimeout(timer);
      this._auditLog.push(remediation);
    }
  }

  // ─── Probe ─────────────────────────────────────────────────────────────

  /**
   * HEAD request to check URL reachability. Returns true if 2xx/3xx.
   * Uses a shorter timeout (5s) since this is just a connectivity check.
   */
  async probe(url: string): Promise<boolean> {
    await this.rateLimit();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      return res.ok || (res.status >= 300 && res.status < 400);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}

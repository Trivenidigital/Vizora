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

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const PROBE_TIMEOUT_MS = 5_000;
const MAX_ENTITIES = 500;
const RATE_LIMIT_MS = 100;

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
const openSessions = new Map<string, string>();

/** Turn a login response's Set-Cookie headers into a single Cookie header. */
function cookieHeaderFrom(res: Response): string {
  const raw =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''].filter(Boolean);
  // Keep only the `name=value` pair from each cookie, discard the attributes.
  return raw.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

/**
 * Release a session opened by `login()`. Best-effort and never throws — a
 * failed logout must not fail an ops run, it just leaves one row to expire.
 */
export async function logout(baseUrl: string, token: string): Promise<void> {
  const cookie = openSessions.get(token);
  openSessions.delete(token);
  try {
    await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
  } catch {
    // swallowed by design — see above
  }
}

/**
 * Authenticate with the Vizora API and return a bearer token.
 * Same pattern as validate-monitor.ts — extracts token from envelope.
 *
 * Registers a `beforeExit` hook that releases the session automatically, so
 * every existing caller is fixed without touching the agents. `beforeExit`
 * fires when the loop drains, which is how these short-lived cron scripts
 * finish (they set `process.exitCode` and return rather than calling
 * `process.exit()`). It does NOT fire on an explicit `process.exit()` or an
 * unhandled fatal — those leave one row to expire on its own, which is the
 * pre-existing behaviour and not a regression. Call `logout()` explicitly if
 * you want a deterministic release.
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
  const cookie = cookieHeaderFrom(res);
  if (cookie) {
    openSessions.set(accessToken, cookie);
    process.once('beforeExit', () => {
      void logout(baseUrl, accessToken);
    });
  }
  return accessToken;
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
   */
  async getAll<T>(path: string, params?: Record<string, string | number>): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    while (items.length < MAX_ENTITIES) {
      const data = await this.get<T[] | { items?: T[]; data?: T[] }>(path, {
        ...params,
        page: String(page),
        limit: '100',
      });
      let batch: T[];
      if (Array.isArray(data)) batch = data;
      else if (Array.isArray(data?.items)) batch = data.items;
      else if (Array.isArray(data?.data)) batch = data.data;
      else break;
      items.push(...batch);
      if (batch.length < 100) break;
      page++;
    }
    return items.slice(0, MAX_ENTITIES);
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

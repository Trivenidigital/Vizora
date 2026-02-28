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
 * Authenticate with the Vizora API and return a bearer token.
 * Same pattern as validate-monitor.ts — extracts token from envelope.
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
  return String(token);
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

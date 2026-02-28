/**
 * Vizora Content Validator — Shared Library
 *
 * Provides API client, types, and utilities for all validation scripts.
 * Zero external dependencies — uses Node.js built-in fetch (v18+).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'warning' | 'info';

export interface ValidationIssue {
  rule: string;
  severity: Severity;
  entity: string;
  entityId: string;
  entityName: string;
  message: string;
  recommendation: string;
}

export interface ValidationResult {
  category: string;
  timestamp: string;
  durationMs: number;
  issues: ValidationIssue[];
  stats: Record<string, number>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  durationMs: number;
  services: Record<string, { status: string; responseTimeMs?: number; error?: string }>;
}

export interface CliArgs {
  baseUrl: string;
  token: string;
  orgId: string;
  limit: number;
  inputFiles: string[];
}

// ─── Arg Parser ──────────────────────────────────────────────────────────────

export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args: CliArgs = {
    baseUrl: 'http://localhost:3000',
    token: '',
    orgId: '',
    limit: 500,
    inputFiles: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--base-url':
        args.baseUrl = next;
        i++;
        break;
      case '--token':
        args.token = next;
        i++;
        break;
      case '--org-id':
        args.orgId = next;
        i++;
        break;
      case '--limit':
        args.limit = Math.min(parseInt(next, 10) || 500, 500);
        i++;
        break;
      case '--input':
        args.inputFiles.push(next);
        i++;
        break;
      default:
        if (!arg.startsWith('--')) {
          args.inputFiles.push(arg);
        }
    }
  }

  return args;
}

// ─── API Client ──────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30_000;

export class VizoraApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async get<T = unknown>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`API ${res.status}: ${res.statusText} — ${path}`);
      }

      const json = (await res.json()) as Record<string, unknown>;

      // Unwrap Vizora response envelope { success, data, meta }
      if (json.success !== undefined && json.data !== undefined) {
        return json.data as T;
      }
      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Paginate through a list endpoint, collecting up to `limit` items. */
  async getAll<T = unknown>(
    path: string,
    params?: Record<string, string | number>,
    limit = 500,
  ): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    const pageSize = 100;

    while (items.length < limit) {
      const data = await this.get<T[] | { items?: T[]; data?: T[] }>(path, {
        ...params,
        page: String(page),
        limit: String(pageSize),
      });

      let batch: T[];
      if (Array.isArray(data)) {
        batch = data;
      } else if (Array.isArray(data?.items)) {
        batch = data.items;
      } else if (Array.isArray(data?.data)) {
        batch = data.data;
      } else {
        break;
      }

      items.push(...batch);
      if (batch.length < pageSize) break;
      page++;
    }

    return items.slice(0, limit);
  }

  /** Check if a URL is reachable (HEAD request, 5s timeout). */
  async probe(url: string): Promise<{ ok: boolean; status: number; ms: number }> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      return { ok: res.ok, status: res.status, ms: Date.now() - start };
    } catch {
      return { ok: false, status: 0, ms: Date.now() - start };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Output Helpers ──────────────────────────────────────────────────────────

export function outputJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

export function fail(message: string): never {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exitCode = 2;
  // Use exitCode instead of process.exit() to avoid Windows Node.js assertion crash
  throw new Error(message);
}

export function makeResult(
  category: string,
  issues: ValidationIssue[],
  stats: Record<string, number>,
  startTime: number,
): ValidationResult {
  return {
    category,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    issues,
    stats,
  };
}

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import * as http from 'http';
import * as https from 'https';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckStatus = 'healthy' | 'warning' | 'degraded' | 'critical';

interface MetricCheck {
  status: CheckStatus;
  value: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface ContinuousHealthResult {
  timestamp: string;
  overall: CheckStatus;
  checks: {
    api_latency: MetricCheck & { slowest?: { endpoint: string; ms: number } };
    database: MetricCheck;
    redis: MetricCheck;
    error_rate: MetricCheck;
    notification_latency: MetricCheck;
    ssl: MetricCheck & { expires_in_days?: number };
  };
}

// ---------------------------------------------------------------------------
// Health history (in-memory ring buffer — last 288 entries = 24h at 5min intervals)
// ---------------------------------------------------------------------------
const MAX_HISTORY = 288;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ContinuousHealthMonitorService {
  private readonly logger = new Logger(ContinuousHealthMonitorService.name);
  private readonly history: ContinuousHealthResult[] = [];
  private _latest: ContinuousHealthResult | null = null;

  // Track 5xx/4xx error counts (populated externally via interceptor or log parsing)
  private errorCounts = { _5xx: 0, _4xx: 0, windowStart: Date.now() };

  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  get latest(): ContinuousHealthResult | null {
    return this._latest;
  }

  /** Last 24h of health check results for sparklines */
  getHistory(): ContinuousHealthResult[] {
    return [...this.history];
  }

  /** Aggregated metrics for dashboard */
  getMetrics(): {
    avg_latency_ms: number;
    error_rate_5xx: number;
    uptime_pct: number;
    checks_count: number;
  } {
    if (this.history.length === 0) {
      return { avg_latency_ms: 0, error_rate_5xx: 0, uptime_pct: 100, checks_count: 0 };
    }

    const latencies = this.history.map((h) => h.checks.api_latency.value);
    const avg_latency_ms = Math.round(
      latencies.reduce((a, b) => a + b, 0) / latencies.length,
    );
    const healthyCount = this.history.filter((h) => h.overall === 'healthy').length;
    const uptime_pct = Math.round((healthyCount / this.history.length) * 1000) / 10;
    const error_rate_5xx = this.history.length > 0
      ? this.history[this.history.length - 1].checks.error_rate.value
      : 0;

    return {
      avg_latency_ms,
      error_rate_5xx,
      uptime_pct,
      checks_count: this.history.length,
    };
  }

  /** Called by interceptors/middleware to record error counts */
  recordError(statusCode: number): void {
    // Reset window every 5 minutes
    const now = Date.now();
    if (now - this.errorCounts.windowStart > 5 * 60 * 1000) {
      this.errorCounts = { _5xx: 0, _4xx: 0, windowStart: now };
    }
    if (statusCode >= 500) this.errorCounts._5xx++;
    else if (statusCode >= 400 && statusCode !== 401) this.errorCounts._4xx++;
  }

  // -----------------------------------------------------------------------
  // Scheduled check — every 5 minutes
  // -----------------------------------------------------------------------
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runHealthCheck(): Promise<ContinuousHealthResult> {
    const [api_latency, database, redis, error_rate, notification_latency, ssl] =
      await Promise.all([
        this.checkApiLatency(),
        this.checkDatabase(),
        this.checkRedis(),
        this.checkErrorRate(),
        this.checkNotificationLatency(),
        this.checkSsl(),
      ]);

    const checks = { api_latency, database, redis, error_rate, notification_latency, ssl };

    // Determine overall status (worst wins)
    const statuses = Object.values(checks).map((c) => c.status);
    let overall: CheckStatus = 'healthy';
    if (statuses.includes('critical')) overall = 'critical';
    else if (statuses.includes('degraded')) overall = 'degraded';
    else if (statuses.includes('warning')) overall = 'warning';

    const result: ContinuousHealthResult = {
      timestamp: new Date().toISOString(),
      overall,
      checks,
    };

    // Store in history ring buffer
    this.history.push(result);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    this._latest = result;

    // Cache in Redis for dashboard consumption
    if (this.redis) {
      try {
        await this.redis.set(
          'vizora:health:latest',
          JSON.stringify(result),
          600, // 10min TTL
        );
        // Also store compressed history for dashboard sparklines
        const sparklineData = this.history.map((h) => ({
          t: h.timestamp,
          s: h.overall,
          l: h.checks.api_latency.value,
          e: h.checks.error_rate.value,
          d: h.checks.database.value,
        }));
        await this.redis.set(
          'vizora:health:history',
          JSON.stringify(sparklineData),
          600,
        );
      } catch (err) {
        this.logger.warn(`Failed to cache health result in Redis: ${err}`);
      }
    }

    // Log status changes
    if (overall !== 'healthy') {
      const issues = Object.entries(checks)
        .filter(([, c]) => c.status !== 'healthy')
        .map(([name, c]) => `${name}=${c.status}(${c.message})`)
        .join(', ');
      this.logger.warn(`Health check: ${overall.toUpperCase()} — ${issues}`);
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Individual checks
  // -----------------------------------------------------------------------

  private async checkApiLatency(): Promise<MetricCheck & { slowest?: { endpoint: string; ms: number } }> {
    const port = parseInt(process.env.MIDDLEWARE_PORT || process.env.PORT || '3000', 10);
    const endpoints = [
      { path: '/api/v1/health', label: 'health' },
      { path: '/api/v1/health/live', label: 'live' },
    ];

    let maxMs = 0;
    let slowestEndpoint = '';
    let totalMs = 0;

    for (const ep of endpoints) {
      try {
        const start = Date.now();
        await this.httpGet(port, ep.path, 5000);
        const elapsed = Date.now() - start;
        totalMs += elapsed;
        if (elapsed > maxMs) {
          maxMs = elapsed;
          slowestEndpoint = ep.path;
        }
      } catch {
        maxMs = 5000;
        slowestEndpoint = ep.path;
        totalMs += 5000;
      }
    }

    const avgMs = Math.round(totalMs / endpoints.length);
    let status: CheckStatus = 'healthy';
    if (avgMs > 2000) status = 'critical';
    else if (avgMs > 500) status = 'degraded';
    else if (avgMs > 200) status = 'warning';

    return {
      status,
      value: avgMs,
      message: `Avg ${avgMs}ms, slowest ${maxMs}ms`,
      slowest: { endpoint: slowestEndpoint, ms: maxMs },
    };
  }

  private async checkDatabase(): Promise<MetricCheck> {
    const start = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;
      const ms = Date.now() - start;

      // Check connection pool
      let poolInfo: Record<string, unknown> = {};
      try {
        const result = await this.db.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()
        `;
        const activeConnections = Number(result[0]?.count ?? 0);
        poolInfo = { activeConnections };

        if (activeConnections > 16) {
          return {
            status: 'warning',
            value: ms,
            message: `${ms}ms, ${activeConnections} active connections (high)`,
            details: poolInfo,
          };
        }
      } catch {
        // pg_stat_activity might not be accessible — non-critical
      }

      // Check for long-running queries
      try {
        const longQueries = await this.db.$queryRaw<Array<{ duration: string; query: string }>>`
          SELECT NOW() - query_start AS duration, LEFT(query, 100) as query
          FROM pg_stat_activity
          WHERE state = 'active' AND NOW() - query_start > interval '30 seconds'
          AND query NOT LIKE '%pg_stat_activity%'
          LIMIT 5
        `;
        if (longQueries.length > 0) {
          return {
            status: 'warning',
            value: ms,
            message: `${ms}ms, ${longQueries.length} slow query(ies) running >30s`,
            details: { ...poolInfo, slowQueries: longQueries.length },
          };
        }
      } catch {
        // Non-critical if we can't check
      }

      let status: CheckStatus = 'healthy';
      if (ms > 500) status = 'degraded';
      else if (ms > 100) status = 'warning';

      return { status, value: ms, message: `${ms}ms`, details: poolInfo };
    } catch (error) {
      return {
        status: 'critical',
        value: Date.now() - start,
        message: `Database unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async checkRedis(): Promise<MetricCheck> {
    if (!this.redis) {
      return { status: 'warning', value: 0, message: 'Redis not configured' };
    }

    const start = Date.now();
    try {
      const health = await this.redis.healthCheck();
      const ms = health.responseTime || (Date.now() - start);

      if (!health.healthy) {
        return {
          status: 'critical',
          value: ms,
          message: `Redis unhealthy: ${health.error}`,
        };
      }

      let status: CheckStatus = 'healthy';
      if (ms > 100) status = 'degraded';
      else if (ms > 20) status = 'warning';

      return { status, value: ms, message: `${ms}ms` };
    } catch (error) {
      return {
        status: 'critical',
        value: Date.now() - start,
        message: `Redis error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async checkErrorRate(): Promise<MetricCheck> {
    const { _5xx, _4xx, windowStart } = this.errorCounts;
    const windowMinutes = Math.max(1, (Date.now() - windowStart) / 60000);

    let status: CheckStatus = 'healthy';
    let message = `${_5xx} 5xx, ${_4xx} notable 4xx in ${Math.round(windowMinutes)}min`;

    if (_5xx > 5) {
      status = 'critical';
      message = `Elevated error rate: ${_5xx} 5xx errors in ${Math.round(windowMinutes)}min`;
    } else if (_5xx > 0) {
      status = 'warning';
    }

    // A spike in 400 errors (excluding 401) suggests a DTO/validation bug
    if (_4xx > 10) {
      if (status === 'healthy') status = 'warning';
      message += ` — 4xx spike may indicate broken endpoint`;
    }

    return { status, value: _5xx, message };
  }

  private async checkNotificationLatency(): Promise<MetricCheck> {
    // Specifically guard against the 30s timeout regression on unread-count
    const start = Date.now();
    try {
      // Internal health proxy — just measure DB query time for notification counts
      const result = await this.db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "notifications" WHERE "read" = false LIMIT 1
      `;
      const ms = Date.now() - start;
      void result; // We don't care about the count, just the latency

      let status: CheckStatus = 'healthy';
      if (ms > 2000) {
        status = 'critical';
        this.logger.error(`REGRESSION GUARD: Notification query took ${ms}ms (was the 30s timeout bug)`);
      } else if (ms > 500) {
        status = 'warning';
      }

      return { status, value: ms, message: `${ms}ms` };
    } catch (error) {
      return {
        status: 'warning',
        value: Date.now() - start,
        message: `Notification query failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async checkSsl(): Promise<MetricCheck & { expires_in_days?: number }> {
    const baseUrl = process.env.API_BASE_URL || '';
    if (!baseUrl.startsWith('https://')) {
      return { status: 'healthy', value: 0, message: 'Not using HTTPS (dev environment)' };
    }

    try {
      const hostname = new URL(baseUrl).hostname;
      const daysLeft = await this.checkSslExpiry(hostname);

      if (daysLeft === null) {
        return { status: 'warning', value: 0, message: 'Could not check SSL certificate' };
      }

      let status: CheckStatus = 'healthy';
      if (daysLeft < 7) status = 'critical';
      else if (daysLeft < 30) status = 'warning';

      return {
        status,
        value: daysLeft,
        message: `${daysLeft} days until expiry`,
        expires_in_days: daysLeft,
      };
    } catch {
      return { status: 'warning', value: 0, message: 'SSL check failed' };
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private httpGet(port: number, urlPath: string, timeoutMs: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = http.get(
        { hostname: '127.0.0.1', port, path: urlPath, timeout: timeoutMs },
        (res) => {
          res.resume();
          resolve(res.statusCode || 0);
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  private checkSslExpiry(hostname: string): Promise<number | null> {
    return new Promise((resolve) => {
      try {
        const req = https.get(
          { hostname, port: 443, method: 'HEAD', rejectUnauthorized: true, timeout: 5000 },
          (res) => {
            const socket = res.socket as import('tls').TLSSocket;
            const cert = socket?.getPeerCertificate?.();
            res.resume();

            if (cert?.valid_to) {
              const expiryDate = new Date(cert.valid_to);
              const daysLeft = Math.floor(
                (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              resolve(daysLeft);
            } else {
              resolve(null);
            }
          },
        );
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }
}

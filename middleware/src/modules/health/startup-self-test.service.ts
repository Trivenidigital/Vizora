import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  passed: boolean;
  message: string;
  duration_ms: number;
  details?: Record<string, unknown>;
}

export interface SelfTestResult {
  passed: boolean;
  timestamp: string;
  duration_ms: number;
  results: {
    database: CheckResult;
    redis: CheckResult;
    minio: CheckResult;
    api_endpoints: CheckResult & { failures: string[] };
    templates: CheckResult & { count: number };
    email: CheckResult & { configured: boolean };
    billing: CheckResult & { stripe: boolean; razorpay: boolean };
    id_consistency: CheckResult & { mismatches: string[] };
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

// Strict allowlist for table existence checks — prevents any injection via $queryRawUnsafe
const CRITICAL_TABLES = new Set([
  'organizations', 'users', 'devices', 'Content',
  'Playlist', 'Schedule', 'notifications', 'plans',
]);

// Minimum cooldown between self-test runs (60 seconds)
const SELF_TEST_COOLDOWN_MS = 60_000;

@Injectable()
export class StartupSelfTestService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupSelfTestService.name);
  private _result: SelfTestResult | null = null;
  private _running = false;
  private _lastRunAt = 0;

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  /** Check if cooldown has elapsed since last run */
  get canRun(): boolean {
    return !this._running && (Date.now() - this._lastRunAt > SELF_TEST_COOLDOWN_MS);
  }

  /** Access latest self-test result (null if not yet run) */
  get result(): SelfTestResult | null {
    return this._result;
  }

  get isRunning(): boolean {
    return this._running;
  }

  /**
   * Runs automatically after all NestJS modules are initialized.
   * Does NOT block the server — logs results and sets health status.
   */
  async onApplicationBootstrap(): Promise<void> {
    // Small delay to let the HTTP server start listening
    setTimeout(() => this.runSelfTest(), 2000);
  }

  async runSelfTest(): Promise<SelfTestResult> {
    this._running = true;
    this._lastRunAt = Date.now();
    const start = Date.now();
    this.logger.log('Starting startup self-test...');

    try {
      const [database, redis, minio, api_endpoints, templates, email, billing, id_consistency] =
        await Promise.all([
          this.checkDatabase(),
          this.checkRedis(),
          this.checkMinio(),
          this.checkApiEndpoints(),
          this.checkTemplates(),
          this.checkEmail(),
          this.checkBilling(),
          this.checkIdConsistency(),
        ]);

      const results = { database, redis, minio, api_endpoints, templates, email, billing, id_consistency };
      const allPassed = Object.values(results).every((r) => r.passed);

      this._result = {
        passed: allPassed,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - start,
        results,
      };

      // Log structured result
      const failedChecks = Object.entries(results)
        .filter(([, r]) => !r.passed)
        .map(([name]) => name);

      if (allPassed) {
        this.logger.log(
          `Self-test PASSED (${this._result.duration_ms}ms) — all ${Object.keys(results).length} checks passed`,
        );
      } else {
        this.logger.warn(
          `Self-test FAILED (${this._result.duration_ms}ms) — failed checks: ${failedChecks.join(', ')}`,
        );
      }

      // Log full structured JSON for monitoring tools
      this.logger.log(`Self-test result: ${JSON.stringify(this._result)}`);

      return this._result;
    } finally {
      this._running = false;
    }
  }

  // -------------------------------------------------------------------------
  // Individual checks
  // -------------------------------------------------------------------------

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;

      // Check critical tables exist — only tables in CRITICAL_TABLES allowlist are queried
      const missing: string[] = [];
      for (const table of CRITICAL_TABLES) {
        try {
          // Safe: table name comes from hardcoded allowlist, not user input
          await this.db.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
        } catch {
          missing.push(table);
        }
      }

      if (missing.length > 0) {
        return {
          passed: false,
          message: `Missing tables: ${missing.join(', ')}`,
          duration_ms: Date.now() - start,
          details: { missing },
        };
      }

      return { passed: true, message: 'Database connected, all critical tables exist', duration_ms: Date.now() - start };
    } catch (error) {
      return {
        passed: false,
        message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - start,
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const health = await this.redis.healthCheck();
      if (!health.healthy) {
        return { passed: false, message: `Redis unhealthy: ${health.error}`, duration_ms: Date.now() - start };
      }

      // Verify SET/GET/DEL cycle
      const testKey = 'vizora:selftest:probe';
      await this.redis.set(testKey, 'ok', 10);
      const val = await this.redis.get(testKey);
      await this.redis.del(testKey);

      if (val !== 'ok') {
        return { passed: false, message: 'Redis SET/GET cycle failed', duration_ms: Date.now() - start };
      }

      return { passed: true, message: 'Redis connected, read/write verified', duration_ms: Date.now() - start };
    } catch (error) {
      return {
        passed: false,
        message: `Redis check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - start,
      };
    }
  }

  private async checkMinio(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const health = await this.storage.healthCheck();
      if (!health.healthy) {
        return {
          passed: false,
          message: `MinIO unhealthy: ${health.error}`,
          duration_ms: Date.now() - start,
          details: { bucket: health.bucket },
        };
      }
      return {
        passed: true,
        message: `MinIO connected, bucket "${health.bucket}" accessible`,
        duration_ms: Date.now() - start,
      };
    } catch (error) {
      return {
        passed: false,
        message: `MinIO check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - start,
      };
    }
  }

  private async checkApiEndpoints(): Promise<CheckResult & { failures: string[] }> {
    const start = Date.now();
    const port = parseInt(process.env.MIDDLEWARE_PORT || process.env.PORT || '3000', 10);
    const failures: string[] = [];

    // Endpoints and their expected status codes
    const checks: Array<{ path: string; expect: number[]; label: string }> = [
      { path: '/api/v1/health', expect: [200], label: 'Health' },
      { path: '/api/v1/health/ready', expect: [200, 503], label: 'Ready' },
      { path: '/api/v1/health/live', expect: [200], label: 'Live' },
      // Protected endpoints should return 401 (not 400/500)
      { path: '/api/v1/templates', expect: [401], label: 'Templates (auth)' },
      { path: '/api/v1/devices', expect: [401], label: 'Devices (auth)' },
      { path: '/api/v1/playlists', expect: [401], label: 'Playlists (auth)' },
      { path: '/api/v1/content', expect: [401], label: 'Content (auth)' },
      { path: '/api/v1/notifications', expect: [401], label: 'Notifications (auth)' },
    ];

    for (const check of checks) {
      try {
        const status = await this.httpGet(port, check.path, 5000);
        if (!check.expect.includes(status)) {
          const msg = `${check.label}: expected ${check.expect.join('|')}, got ${status}`;
          failures.push(msg);
          // 400 is particularly concerning — likely a DTO/validation bug
          if (status === 400) {
            this.logger.error(`SELF-TEST: ${check.path} returned 400 — possible DTO whitelist bug`);
          }
          if (status === 500) {
            this.logger.error(`SELF-TEST: ${check.path} returned 500 — server error`);
          }
        }
      } catch (error) {
        failures.push(`${check.label}: ${error instanceof Error ? error.message : 'request failed'}`);
      }
    }

    return {
      passed: failures.length === 0,
      message: failures.length === 0
        ? `All ${checks.length} endpoint checks passed`
        : `${failures.length}/${checks.length} endpoint checks failed`,
      duration_ms: Date.now() - start,
      failures,
    };
  }

  private async checkTemplates(): Promise<CheckResult & { count: number }> {
    const start = Date.now();
    try {
      const result = await this.db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Content" WHERE "isGlobal" = true AND "type" = 'template'
      `;
      const count = Number(result[0]?.count ?? 0);

      if (count === 0) {
        return {
          passed: false,
          message: 'No system templates seeded — template library will be empty. Run the seed script.',
          duration_ms: Date.now() - start,
          count,
        };
      }

      // We expect 75+ templates based on the seed data
      const warning = count < 50 ? ` (low count — expected 75+)` : '';
      return {
        passed: true,
        message: `${count} system templates seeded${warning}`,
        duration_ms: Date.now() - start,
        count,
      };
    } catch (error) {
      // Template table might not exist yet
      return {
        passed: false,
        message: `Template check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - start,
        count: 0,
      };
    }
  }

  private async checkEmail(): Promise<CheckResult & { configured: boolean }> {
    const start = Date.now();
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    // Support both SMTP_PASSWORD (mail.service.ts) and SMTP_PASS (CLAUDE.md/env docs)
    const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
    const configured = !!(host && user && pass);

    if (!configured) {
      return {
        passed: true, // Not a failure — just a warning
        message: 'SMTP not configured — emails will fail silently',
        duration_ms: Date.now() - start,
        configured,
        details: {
          SMTP_HOST: !!host,
          SMTP_USER: !!user,
          SMTP_PASSWORD: !!pass,
        },
      };
    }

    // Verify SMTP connectivity (connect only, don't send)
    try {
      const nodemailer = await import('nodemailer');
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 5000,
      });
      await transporter.verify();
      transporter.close();

      return {
        passed: true,
        message: `SMTP connected (${host}:${port})`,
        duration_ms: Date.now() - start,
        configured,
      };
    } catch (error) {
      return {
        passed: false,
        message: `SMTP configured but connection failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - start,
        configured,
      };
    }
  }

  private async checkBilling(): Promise<CheckResult & { stripe: boolean; razorpay: boolean }> {
    const start = Date.now();
    const stripeKey = process.env.STRIPE_SECRET_KEY || '';
    const razorpayKey = process.env.RAZORPAY_KEY_ID || '';
    const stripe = stripeKey.startsWith('sk_');
    const razorpay = !!razorpayKey;

    const warnings: string[] = [];

    if (!stripe && !razorpay) {
      return {
        passed: true, // Not a failure in dev — just informational
        message: 'No payment provider configured (Stripe/Razorpay)',
        duration_ms: Date.now() - start,
        stripe: false,
        razorpay: false,
      };
    }

    if (stripe && stripeKey.startsWith('sk_test_')) {
      warnings.push('Stripe using test keys');
    }

    // Check for placeholder price IDs in env
    const priceEnvVars = Object.keys(process.env).filter(
      (k) => k.startsWith('STRIPE_') && k.endsWith('_PRICE_ID'),
    );
    const placeholders = priceEnvVars.filter((k) => {
      const val = process.env[k] || '';
      return val.includes('placeholder') || val.includes('xxx') || val === '';
    });
    if (placeholders.length > 0) {
      warnings.push(`${placeholders.length} Stripe price IDs are placeholders`);
    }

    return {
      passed: true,
      message: warnings.length > 0
        ? `Billing configured with warnings: ${warnings.join('; ')}`
        : `Billing configured (Stripe: ${stripe}, Razorpay: ${razorpay})`,
      duration_ms: Date.now() - start,
      stripe,
      razorpay,
      details: warnings.length > 0 ? { warnings } : undefined,
    };
  }

  private async checkIdConsistency(): Promise<CheckResult & { mismatches: string[] }> {
    const start = Date.now();
    const mismatches: string[] = [];

    // Models that use UUID (from schema.prisma)
    const uuidModels = new Set(['Organization', 'User', 'PasswordResetToken', 'Display', 'SupportRequest', 'SupportMessage']);

    // Scan controller files for ParseUUIDPipe usage on CUID models
    const controllerDir = path.join(process.cwd(), 'src', 'modules');

    // Map of controller file patterns to their model
    const controllerModelMap: Record<string, string> = {
      'content/content.controller': 'Content',
      'playlists/playlists.controller': 'Playlist',
      'schedules/schedules.controller': 'Schedule',
      'template-library/template-library.controller': 'Template',
      'notifications/notifications.controller': 'Notification',
      'display-groups/display-groups.controller': 'DisplayGroup',
      'folders/folders.controller': 'ContentFolder',
      'api-keys/api-keys.controller': 'ApiKey',
      'admin/admin.controller': 'mixed', // skip — handles multiple model types
    };

    let filesChecked = 0;
    for (const [controllerPath, model] of Object.entries(controllerModelMap)) {
      if (model === 'mixed') continue;
      if (uuidModels.has(model)) continue; // UUID models SHOULD use ParseUUIDPipe

      const fullPath = path.join(controllerDir, `${controllerPath}.ts`);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        filesChecked++;
        if (content.includes('ParseUUIDPipe')) {
          mismatches.push(`${controllerPath} uses ParseUUIDPipe but ${model} uses CUID`);
        }
      } catch {
        // Source files not available in production builds (compiled to dist/) — skip gracefully
      }
    }

    const skipped = filesChecked === 0;
    return {
      passed: mismatches.length === 0,
      message: skipped
        ? 'Skipped — source files not available (production build). Covered by regression guard tests.'
        : mismatches.length === 0
          ? `All ${filesChecked} controllers use correct ID pipe for their model type`
          : `${mismatches.length} controller(s) use wrong ID pipe`,
      duration_ms: Date.now() - start,
      mismatches,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private httpGet(port: number, urlPath: string, timeoutMs: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = http.get(
        { hostname: '127.0.0.1', port, path: urlPath, timeout: timeoutMs },
        (res) => {
          // Consume response body to free socket
          res.resume();
          resolve(res.statusCode || 0);
        },
      );
      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      });
    });
  }
}

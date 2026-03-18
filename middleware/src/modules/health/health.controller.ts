import { Controller, Get, Post, Body, HttpStatus, HttpException, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { ValidationMonitorService } from './validation-monitor.service';
import { StartupSelfTestService } from './startup-self-test.service';
import { ContinuousHealthMonitorService } from './continuous-health-monitor.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';

@Controller('health')
@SkipThrottle() // Health checks should not be rate limited
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly validationMonitor: ValidationMonitorService,
    private readonly selfTest: StartupSelfTestService,
    private readonly monitor: ContinuousHealthMonitorService,
  ) {}

  /**
   * Basic liveness probe - always returns 200 if the server is running
   */
  @Get()
  @Public()
  async health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Detailed readiness probe - checks all dependencies.
   * Includes self-test status (pass/fail/pending) but NOT detailed results.
   */
  @Get('ready')
  @Public()
  async ready() {
    const result = await this.healthService.check();

    // Enrich with self-test status (status only — not detailed results)
    const selfTestStatus = this.selfTest.isRunning
      ? 'running'
      : this.selfTest.result
        ? this.selfTest.result.passed
          ? 'passed'
          : 'failed'
        : 'pending';

    const enriched = {
      ...result,
      self_test: selfTestStatus,
      ...(this.selfTest.result && !this.selfTest.result.passed
        ? {
            self_test_failures: Object.entries(this.selfTest.result.results)
              .filter(([, r]) => !r.passed)
              .map(([name, r]) => `${name}: ${r.message}`),
          }
        : {}),
    };

    if (result.status === 'unhealthy') {
      throw new HttpException(enriched, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return enriched;
  }

  /**
   * Liveness probe for Kubernetes/Docker
   */
  @Get('live')
  @Public()
  async live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Full startup self-test results.
   * Admin-only — exposes infrastructure details (SMTP config, table existence, etc.).
   */
  @Get('self-test')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async getSelfTest() {
    if (this.selfTest.isRunning) {
      return { status: 'running', message: 'Self-test is currently in progress' };
    }
    if (!this.selfTest.result) {
      return { status: 'pending', message: 'Self-test has not yet run' };
    }
    return this.selfTest.result;
  }

  /**
   * Trigger a new self-test run on demand.
   * Admin-only. Rate-limited: 60s cooldown between runs.
   */
  @Post('self-test')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @SkipThrottle(false) // Re-enable throttling for this endpoint
  async runSelfTest() {
    if (this.selfTest.isRunning) {
      return { status: 'already_running', message: 'Self-test is already in progress' };
    }
    if (!this.selfTest.canRun) {
      return { status: 'cooldown', message: 'Self-test was run recently. Wait 60 seconds between runs.' };
    }
    // Run async — don't block the response
    this.selfTest.runSelfTest();
    return { status: 'started', message: 'Self-test triggered' };
  }

  /**
   * Content validation status for the authenticated user's organization.
   * Returns latest validation state (READY/DEGRADED/NOT READY) with issues.
   */
  @Get('validation')
  async validation(@Req() req: { user?: { organizationId?: string } }) {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return { status: 'unknown', message: 'No organization context' };
    }
    const state = await this.validationMonitor.getValidationState(orgId);
    return state || { status: 'unknown', message: 'No validation data available' };
  }

  /**
   * Latest continuous health check result.
   * Admin-only — contains DB connection pool info, slow query counts, etc.
   */
  @Get('monitor/current')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async getMonitorCurrent() {
    return this.monitor.latest || { status: 'pending', message: 'No health checks run yet' };
  }

  /**
   * Health check history for dashboard sparklines (last 24h).
   * Admin-only.
   */
  @Get('monitor/history')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async getMonitorHistory() {
    return this.monitor.getHistory();
  }

  /**
   * Aggregated health metrics (avg latency, error rate, uptime %).
   * Admin-only.
   */
  @Get('monitor/metrics')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async getMonitorMetrics() {
    return this.monitor.getMetrics();
  }

  /**
   * Update ops status data (stored in Redis with TTL).
   * Auth-protected — no @Public() decorator.
   */
  @Post('ops-status')
  async updateOpsStatus(@Body() body: Record<string, unknown>) {
    await this.healthService.setOpsStatus(body);
    return { status: 'ok' };
  }

  /**
   * Retrieve current ops status data from Redis.
   * Auth-protected — no @Public() decorator.
   */
  @Get('ops-status')
  async getOpsStatus() {
    return this.healthService.getOpsStatus();
  }
}

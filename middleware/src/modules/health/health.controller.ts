import { Controller, Get, Post, Body, HttpStatus, HttpException, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { ValidationMonitorService } from './validation-monitor.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
@SkipThrottle() // Health checks should not be rate limited
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly validationMonitor: ValidationMonitorService,
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
   * Detailed readiness probe - checks all dependencies
   */
  @Get('ready')
  @Public()
  async ready() {
    const result = await this.healthService.check();
    
    if (result.status === 'unhealthy') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    
    return result;
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

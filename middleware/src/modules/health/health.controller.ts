import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
@SkipThrottle() // Health checks should not be rate limited
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

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
}

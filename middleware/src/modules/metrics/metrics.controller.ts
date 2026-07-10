import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('internal')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // @Public() opts this route out of the global JwtAuthGuard so Prometheus
  // (which has no JWT) can scrape it. Access is instead gated by
  // MetricsAuthMiddleware (localhost or METRICS_TOKEN bearer) — wired in
  // MetricsModule.configure().
  @Public()
  @Get('metrics')
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(metrics);
  }
}

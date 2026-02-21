import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('internal')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // Requires JWT auth. For Prometheus scraping, use network-level access control or an API key.
  @Get('metrics')
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(metrics);
  }
}

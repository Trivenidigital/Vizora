import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('device-metrics')
  getDeviceMetrics(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getDeviceMetrics(organizationId, range);
  }

  @Get('content-performance')
  getContentPerformance(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getContentPerformance(organizationId, range);
  }

  @Get('usage-trends')
  getUsageTrends(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getUsageTrends(organizationId, range);
  }

  @Get('device-distribution')
  getDeviceDistribution(
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.analyticsService.getDeviceDistribution(organizationId);
  }

  @Get('bandwidth')
  getBandwidthUsage(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getBandwidthUsage(organizationId, range);
  }

  @Get('playlist-performance')
  getPlaylistPerformance(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getPlaylistPerformance(organizationId, range);
  }

  @Get('summary')
  getSummary(
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.analyticsService.getSummary(organizationId);
  }
}

import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('device-metrics')
  @Roles('admin', 'manager')
  getDeviceMetrics(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getDeviceMetrics(organizationId, range);
  }

  @Get('content-performance')
  @Roles('admin', 'manager')
  getContentPerformance(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getContentPerformance(organizationId, range);
  }

  @Get('usage-trends')
  @Roles('admin', 'manager')
  getUsageTrends(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getUsageTrends(organizationId, range);
  }

  @Get('device-distribution')
  @Roles('admin', 'manager')
  getDeviceDistribution(
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.analyticsService.getDeviceDistribution(organizationId);
  }

  @Get('bandwidth')
  @Roles('admin', 'manager')
  getBandwidthUsage(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getBandwidthUsage(organizationId, range);
  }

  @Get('playlist-performance')
  @Roles('admin', 'manager')
  getPlaylistPerformance(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getPlaylistPerformance(organizationId, range);
  }

  @Get('summary')
  @Roles('admin', 'manager')
  getSummary(
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.analyticsService.getSummary(organizationId);
  }

  @Get('export')
  @Roles('admin', 'manager')
  exportAnalytics(
    @CurrentUser('organizationId') organizationId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.exportAnalytics(organizationId, range);
  }

  @Get('device-uptime/:deviceId')
  @Roles('admin', 'manager', 'viewer')
  getDeviceUptime(
    @Param('deviceId') deviceId: string,
    @Query('days') days?: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.analyticsService.getDeviceUptime(
      organizationId,
      deviceId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('uptime-summary')
  @Roles('admin', 'manager', 'viewer')
  getUptimeSummary(
    @Query('days') days?: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.analyticsService.getUptimeSummary(
      organizationId,
      days ? parseInt(days, 10) : 30,
    );
  }
}

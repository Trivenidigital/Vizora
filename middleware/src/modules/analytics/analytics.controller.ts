import { Controller, Get, Header, Query, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkipEnvelope } from '../common/interceptors/response-envelope.interceptor';
import { ProofOfPlayQueryDto } from './dto/proof-of-play-query.dto';

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

  @Get('content/:contentId/metrics')
  @Roles('admin', 'manager')
  getContentMetrics(
    @CurrentUser('organizationId') organizationId: string,
    @Param('contentId', ParseIdPipe) contentId: string,
    @Query('range') range: string = 'month',
  ) {
    return this.analyticsService.getContentMetrics(organizationId, contentId, range);
  }

  @Get('device-uptime/:deviceId')
  @Roles('admin', 'manager', 'viewer')
  getDeviceUptime(
    @Param('deviceId', ParseIdPipe) deviceId: string,
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

  // ===========================================================================
  // O2 — Proof-of-play reports
  // ===========================================================================

  /**
   * Paginated proof-of-play impressions for the caller's org.
   * Filters: dateFrom/dateTo (ISO date), contentId, displayId, playlistId,
   * displayTagId (filter by displays carrying a Tag), page, limit.
   */
  @Get('proof-of-play')
  @Roles('admin', 'manager')
  getProofOfPlay(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ProofOfPlayQueryDto,
  ) {
    return this.analyticsService.getProofOfPlay(organizationId, query);
  }

  /**
   * Streaming CSV export. Same filters as getProofOfPlay. Capped at 100k
   * rows; operators wanting larger exports can iterate the paginated query.
   *
   * Uses @Res() bypassing the response interceptor so we can stream
   * incrementally — the body never fully resides in memory.
   */
  @Get('proof-of-play.csv')
  @Roles('admin', 'manager')
  @SkipEnvelope()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="proof-of-play.csv"')
  async streamProofOfPlayCsv(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ProofOfPlayQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      for await (const chunk of this.analyticsService.streamProofOfPlayCsv(
        organizationId,
        query,
      )) {
        res.write(chunk);
      }
      res.end();
    } catch (err) {
      // Mid-stream DB failure: the response has already been written with a
      // 200 OK header, so a 500 status response is impossible. The fallback
      // is a trailing comment line the client can detect — telling them the
      // CSV is incomplete. PR-review fix.
      const msg = err instanceof Error ? err.message : 'unknown error';
      res.write(`# ERROR: proof-of-play stream truncated mid-response: ${msg}\n`);
      res.end();
    }
  }
}

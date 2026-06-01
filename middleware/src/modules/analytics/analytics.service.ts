import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import type {
  DeviceMetricDataPoint,
  ContentPerformanceItem,
  UsageTrendDataPoint,
  DeviceDistributionItem,
  BandwidthDataPoint,
  PlaylistPerformanceItem,
  AnalyticsSummary,
  ContentMetrics,
  DeviceUptimeResult,
  UptimeSummaryResult,
  ExportAnalyticsResult,
} from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly db: DatabaseService) {}

  private getRangeDays(range: string): number {
    switch (range) {
      case 'week': return 7;
      case 'year': return 365;
      case 'month':
      default: return 30;
    }
  }

  private getDateRange(range: string): { startDate: Date; endDate: Date } {
    const days = this.getRangeDays(range);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return { startDate, endDate };
  }

  /**
   * Device metrics - tracks device online/offline status over time
   * Uses Display table heartbeat data
   */
  async getDeviceMetrics(organizationId: string, range: string): Promise<DeviceMetricDataPoint[]> {
    const days = this.getRangeDays(range);

    // Get all devices for this org
    const displays = await this.db.display.findMany({
      where: { organizationId },
      select: {
        id: true,
        status: true,
        lastHeartbeat: true,
        metadata: true,
        createdAt: true,
      },
    });

    const totalDevices = displays.length;
    if (totalDevices === 0) return [];

    // Generate daily data points based on device creation/heartbeat patterns
    const dataPoints = [];
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Count devices that existed and had heartbeats by this date
      const activeByDate = displays.filter(d => {
        const created = new Date(d.createdAt);
        return created <= date;
      }).length;

      // Simulate uptime categories based on real device count
      const baseUptime = totalDevices > 0 ? (activeByDate / totalDevices) * 100 : 0;

      dataPoints.push({
        date: dateStr,
        mobile: Math.min(100, Math.max(0, baseUptime * 0.85)),
        tablet: Math.min(100, Math.max(0, baseUptime * 0.92)),
        desktop: Math.min(100, Math.max(0, baseUptime * 0.98)),
        isEstimated: true,
        metricSource: 'display_inventory_estimate',
        unit: 'percent',
      });
    }

    return dataPoints;
  }

  /**
   * Content performance - views/engagement from real impression data
   */
  async getContentPerformance(organizationId: string, range: string): Promise<ContentPerformanceItem[]> {
    const { startDate } = this.getDateRange(range);

    const impressions = await this.db.contentImpression.groupBy({
      by: ['contentId'],
      where: {
        organizationId,
        timestamp: { gte: startDate },
      },
      _count: { id: true },
      _avg: { duration: true, completionPercentage: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const contentIds = impressions.map(i => i.contentId);
    const contents = await this.db.content.findMany({
      where: { id: { in: contentIds }, organizationId },
      select: { id: true, name: true },
    });
    const contentMap = new Map(contents.map(c => [c.id, c.name]));

    return impressions.map(i => ({
      title: contentMap.get(i.contentId) || 'Unknown',
      impressions: i._count.id,
      averageCompletion: Math.round(i._avg.completionPercentage || 0),
      views: i._count.id,
      engagement: Math.round(i._avg.completionPercentage || 0),
      shares: 0,
      impressionsSource: 'content_impressions',
      engagementSource: 'content_impressions',
      sharesTracked: false,
    }));
  }

  /**
   * Usage trends - real daily impression counts by content type
   */
  async getUsageTrends(organizationId: string, range: string): Promise<UsageTrendDataPoint[]> {
    const { startDate } = this.getDateRange(range);
    const days = this.getRangeDays(range);

    // Aggregate type breakdown per date in the database instead of fetching all rows
    const typeBreakdown = await this.db.$queryRaw<
      Array<{ date: Date; type: string | null; count: bigint }>
    >`
      SELECT ci.date, c.type, COUNT(*)::bigint as count
      FROM content_impressions ci
      LEFT JOIN "Content" c
        ON ci."contentId" = c.id
       AND c."organizationId" = ci."organizationId"
      WHERE ci."organizationId" = ${organizationId}
        AND ci.timestamp >= ${startDate}
      GROUP BY ci.date, c.type
    `;

    // Build lookup map: dateStr -> { video, image, text, interactive, other }
    const dailyData = new Map<string, Record<string, number>>();
    for (const row of typeBreakdown) {
      const dateStr = new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailyData.has(dateStr)) {
        dailyData.set(dateStr, { video: 0, image: 0, text: 0, interactive: 0, other: 0 });
      }
      const dayData = dailyData.get(dateStr)!;
      const count = Number(row.count);
      const type = row.type;
      if (type === 'video') dayData.video += count;
      else if (type === 'image') dayData.image += count;
      else if (type === 'html') dayData.text += count;
      else if (type === 'url') dayData.interactive += count;
      else dayData.other += count;
    }

    // Generate data points for all days in range
    const dataPoints = [];
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const data = dailyData.get(dateStr) || { video: 0, image: 0, text: 0, interactive: 0, other: 0 };
      dataPoints.push({ date: dateStr, ...data });
    }

    return dataPoints;
  }

  /**
   * Device distribution - by status/type
   */
  async getDeviceDistribution(organizationId: string): Promise<DeviceDistributionItem[]> {
    const displays = await this.db.display.findMany({
      where: { organizationId },
      select: {
        status: true,
        metadata: true,
        resolution: true,
      },
    });

    // Group by status
    const statusCounts: Record<string, number> = {};
    displays.forEach(d => {
      const status = d.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const colors: Record<string, string> = {
      online: '#10B981',
      offline: '#6B7280',
      pairing: '#F59E0B',
      error: '#EF4444',
      unknown: '#9CA3AF',
    };

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[name] || '#6B7280',
    }));
  }

  /**
   * Bandwidth usage - estimated from content file sizes and device count
   */
  async getBandwidthUsage(organizationId: string, range: string): Promise<BandwidthDataPoint[]> {
    const days = this.getRangeDays(range);

    const [contentStats, deviceCount] = await Promise.all([
      this.db.content.aggregate({
        where: { organizationId },
        _sum: { fileSize: true },
        _count: { id: true },
      }),
      this.db.display.count({ where: { organizationId } }),
    ]);

    const totalSizeMB = (contentStats._sum.fileSize || 0) / (1024 * 1024);
    const avgDailyMB = deviceCount > 0 ? (totalSizeMB * deviceCount) / Math.max(days, 1) : 0;

    const dataPoints = [];
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      dataPoints.push({
        time: dateStr,
        current: avgDailyMB,
        average: avgDailyMB,
        peak: avgDailyMB * 1.5,
        isEstimated: true,
        metricSource: 'content_size_device_count_estimate',
        unit: 'MB/day',
      });
    }

    return dataPoints;
  }

  /**
   * Playlist performance - real impression data grouped by playlist
   */
  async getPlaylistPerformance(organizationId: string, range: string): Promise<PlaylistPerformanceItem[]> {
    const { startDate } = this.getDateRange(range);

    const impressions = await this.db.contentImpression.groupBy({
      by: ['playlistId'],
      where: {
        organizationId,
        playlistId: { not: null },
        timestamp: { gte: startDate },
      },
      _count: { id: true },
      _avg: { completionPercentage: true },
    });

    const playlistIds = impressions.map(i => i.playlistId).filter(Boolean) as string[];
    const playlists = await this.db.playlist.findMany({
      where: { id: { in: playlistIds }, organizationId },
      include: { _count: { select: { assignedDisplays: true } } },
    });
    const playlistMap = new Map(playlists.map(p => [p.id, p]));

    return impressions.map(i => {
      const playlist = playlistMap.get(i.playlistId!);
      const proofOfPlayImpressions = i._count.id;
      const averageCompletion = Math.round(i._avg.completionPercentage || 0);
      const assignedScreens = playlist?._count?.assignedDisplays || 0;
      return {
        name: playlist?.name || 'Unknown',
        proofOfPlayImpressions,
        averageCompletion,
        assignedScreens,
        plays: proofOfPlayImpressions,
        engagement: averageCompletion,
        uniqueDevices: assignedScreens,
        views: proofOfPlayImpressions,
        completion: averageCompletion,
        playsSource: 'content_impressions',
        completionSource: 'content_impressions',
        uniqueDevicesSource: 'assigned_displays',
        uniquePlaybackDevicesTracked: false,
      };
    });
  }

  /**
   * Summary KPI data
   */
  async getSummary(organizationId: string): Promise<AnalyticsSummary> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalDevices,
      onlineDevices,
      totalContent,
      processingContent,
      totalPlaylists,
      activePlaylists,
      totalImpressions,
      contentSize,
    ] = await Promise.all([
      this.db.display.count({ where: { organizationId } }),
      this.db.display.count({ where: { organizationId, status: 'online' } }),
      this.db.content.count({ where: { organizationId } }),
      this.db.content.count({ where: { organizationId, status: 'processing' } }),
      this.db.playlist.count({ where: { organizationId } }),
      this.db.playlist.count({
        where: {
          organizationId,
          OR: [{ isDefault: true }, { items: { some: {} } }],
        },
      }),
      this.db.contentImpression.count({
        where: { organizationId, timestamp: { gte: thirtyDaysAgo } },
      }),
      this.db.content.aggregate({
        where: { organizationId },
        _sum: { fileSize: true },
      }),
    ]);

    const uptimePercent = totalDevices > 0
      ? ((onlineDevices / totalDevices) * 100).toFixed(1)
      : '0.0';

    return {
      totalDevices,
      onlineDevices,
      totalContent,
      processingContent,
      totalPlaylists,
      activePlaylists,
      totalContentSize: contentSize._sum.fileSize || 0,
      uptimePercent: parseFloat(uptimePercent),
      onlineNowPercent: parseFloat(uptimePercent),
      uptimePercentSource: 'current_online_ratio',
      uptimePercentIsHistorical: false,
      totalImpressions,
    };
  }

  /**
   * Per-content detailed metrics
   */
  async getContentMetrics(organizationId: string, contentId: string, range: string): Promise<ContentMetrics> {
    // Verify content exists and belongs to the organization
    const content = await this.db.content.findFirst({
      where: { id: contentId, organizationId },
      select: { id: true },
    });
    if (!content) {
      throw new NotFoundException(`Content ${contentId} not found`);
    }

    const { startDate } = this.getDateRange(range);

    const [totalViews, avgMetrics, dailyTrend, topDevices] = await Promise.all([
      this.db.contentImpression.count({
        where: { organizationId, contentId, timestamp: { gte: startDate } },
      }),
      this.db.contentImpression.aggregate({
        where: { organizationId, contentId, timestamp: { gte: startDate } },
        _avg: { duration: true, completionPercentage: true },
      }),
      this.db.contentImpression.groupBy({
        by: ['date'],
        where: { organizationId, contentId, timestamp: { gte: startDate } },
        _count: { id: true },
        orderBy: { date: 'asc' },
      }),
      this.db.contentImpression.groupBy({
        by: ['displayId'],
        where: { organizationId, contentId, timestamp: { gte: startDate } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    const deviceIds = topDevices.map(d => d.displayId);
    const devices = await this.db.display.findMany({
      where: { id: { in: deviceIds }, organizationId },
      select: { id: true, nickname: true },
    });
    const deviceMap = new Map(devices.map(d => [d.id, d.nickname || 'Unnamed']));

    return {
      totalViews,
      avgDuration: Math.round(avgMetrics._avg.duration || 0),
      avgCompletion: Math.round(avgMetrics._avg.completionPercentage || 0),
      dailyTrend: dailyTrend.map(d => ({
        date: d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: d._count.id,
      })),
      topDevices: topDevices.map(d => ({
        deviceId: d.displayId,
        deviceName: deviceMap.get(d.displayId) || 'Unknown',
        views: d._count.id,
      })),
    };
  }

  /**
   * Device uptime for a specific device
   * Returns uptime percentage and online/offline minutes
   */
  async getDeviceUptime(
    organizationId: string,
    deviceId: string,
    days: number = 30,
  ): Promise<DeviceUptimeResult> {
    // Get device from DB
    const device = await this.db.display.findFirst({
      where: { id: deviceId, organizationId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Simple calculation based on current status and lastHeartbeat
    // For now, if device has heartbeat within last 5 minutes, consider it online
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const isOnline = device.lastHeartbeat && device.lastHeartbeat > fiveMinutesAgo;

    // For a more realistic calculation, we'd query audit logs or a heartbeat history table
    // For now, return a simplified response based on current state
    const totalMinutes = days * 24 * 60;
    const uptimePercent = isOnline ? 95 : device.status === 'online' ? 80 : 20;

    return {
      deviceId,
      uptimePercent,
      totalOnlineMinutes: Math.round((totalMinutes * uptimePercent) / 100),
      totalOfflineMinutes: Math.round((totalMinutes * (100 - uptimePercent)) / 100),
      lastHeartbeat: device.lastHeartbeat,
      isEstimated: true,
      metricSource: 'heartbeat_status_heuristic',
    };
  }

  /**
   * Uptime summary across all devices in an organization
   */
  async getUptimeSummary(
    organizationId: string,
    _days: number = 30,
  ): Promise<UptimeSummaryResult> {
    const devices = await this.db.display.findMany({
      where: { organizationId },
      select: { id: true, nickname: true, status: true, lastHeartbeat: true },
    });

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const deviceUptimes = devices.map((device) => {
      const isOnline = device.lastHeartbeat && device.lastHeartbeat > fiveMinutesAgo;
      const uptimePercent = isOnline ? 95 : device.status === 'online' ? 80 : 20;
      return {
        id: device.id,
        nickname: device.nickname || 'Unnamed Device',
        uptimePercent,
        isOnline,
      };
    });

    const onlineCount = deviceUptimes.filter((d) => d.isOnline).length;
    const avgUptimePercent =
      deviceUptimes.length > 0
        ? deviceUptimes.reduce((sum, d) => sum + d.uptimePercent, 0) / deviceUptimes.length
        : 0;

    return {
      avgUptimePercent: Math.round(avgUptimePercent * 10) / 10,
      deviceCount: devices.length,
      onlineCount,
      offlineCount: devices.length - onlineCount,
      devices: deviceUptimes.map(({ id, nickname, uptimePercent }) => ({
        id,
        nickname,
        uptimePercent,
      })),
      isEstimated: true,
      metricSource: 'heartbeat_status_heuristic',
    };
  }

  /**
   * Cleanup old impressions (older than 90 days) - runs daily at 2 AM
   */
  @Cron('0 2 * * *')
  async cleanupOldImpressions() {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
      const batchSize = 10000;
      let totalDeleted = 0;
      let batchDeleted: number;

      do {
        // Find IDs to delete in batches to avoid long-running transactions
        const batch = await this.db.contentImpression.findMany({
          where: { timestamp: { lt: ninetyDaysAgo } },
          select: { id: true },
          take: batchSize,
        });

        if (batch.length === 0) break;

        const result = await this.db.contentImpression.deleteMany({
          where: { id: { in: batch.map(b => b.id) } },
        });
        batchDeleted = result.count;
        totalDeleted += batchDeleted;
      } while (batchDeleted === batchSize);

      this.logger.log(`Cleaned up ${totalDeleted} old impressions`);
    } catch (error) {
      this.logger.error('Failed to cleanup old impressions:', error);
    }
  }

  /**
   * Export all analytics data combined
   */
  async exportAnalytics(organizationId: string, range: string = 'month'): Promise<ExportAnalyticsResult> {
    const [
      summary,
      deviceMetrics,
      contentPerformance,
      usageTrends,
      deviceDistribution,
      bandwidthUsage,
      playlistPerformance,
    ] = await Promise.all([
      this.getSummary(organizationId),
      this.getDeviceMetrics(organizationId, range),
      this.getContentPerformance(organizationId, range),
      this.getUsageTrends(organizationId, range),
      this.getDeviceDistribution(organizationId),
      this.getBandwidthUsage(organizationId, range),
      this.getPlaylistPerformance(organizationId, range),
    ]);

    return {
      summary,
      deviceMetrics,
      contentPerformance,
      usageTrends,
      deviceDistribution,
      bandwidthUsage,
      playlistPerformance,
    };
  }

  // ===========================================================================
  // O2 — Proof-of-play reports (raw impression rows + CSV export)
  // ===========================================================================

  /**
   * Paginated query over the ContentImpression table with optional filters.
   * All filters are AND-combined. Cross-org guard is the `organizationId`
   * predicate; FKs (contentId, displayId, playlistId) inside the same org
   * are safe by schema construction.
   *
   * `displayTagId` joins through DisplayTag — find impressions whose Display
   * carries the given tag.
   */
  async getProofOfPlay(
    organizationId: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
      contentId?: string;
      displayId?: string;
      playlistId?: string;
      displayTagId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(500, Math.max(1, filters.limit ?? 50));

    const where = this.buildProofOfPlayWhere(organizationId, filters);

    const [data, total] = await Promise.all([
      this.db.contentImpression.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          content: { select: { id: true, name: true, organizationId: true } },
          display: { select: { id: true, nickname: true, deviceIdentifier: true, organizationId: true } },
        },
      }),
      this.db.contentImpression.count({ where }),
    ]);

    return {
      data: data.map((row) => this.sanitizeProofOfPlayRelations(row, organizationId)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Streaming CSV export. Yields the header row first, then batches of 1000
   * impression rows. Capped at 100,000 rows total to defend against
   * unbounded memory use; operators wanting larger exports can iterate the
   * paginated query directly.
   */
  async *streamProofOfPlayCsv(
    organizationId: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
      contentId?: string;
      displayId?: string;
      playlistId?: string;
      displayTagId?: string;
      /**
       * IANA timezone (e.g. 'America/New_York', 'Asia/Kolkata') used to
       * format the timestamp column. Defaults to UTC. Without this,
       * an operator in EST exporting a 15:00 UTC impression sees
       * `2026-05-24T15:00:00.000Z` in the spreadsheet, has to
       * mentally subtract 5h every row, and downstream consumers
       * (NDA partners, retail HQ reports) get the wrong day for
       * impressions near midnight.
       */
      tz?: string;
    },
  ): AsyncGenerator<string> {
    const where = this.buildProofOfPlayWhere(organizationId, filters);
    const tz = this.normalizeTimezone(filters.tz);

    // Header stays stable across tz values so downstream parsers don't
    // break — the cell content carries the tz suffix for non-UTC rows
    // (e.g. "2026-05-24 11:00:00 America/New_York"). UTC rows keep
    // ISO format so the CSV is byte-identical to the pre-tz version
    // when `tz` is unspecified.
    yield 'timestamp,contentId,contentName,displayId,displayName,playlistId,duration_sec,completion_percent\n';

    const BATCH = 1000;
    const MAX_ROWS = 100_000;
    let skip = 0;
    let emitted = 0;

    while (emitted < MAX_ROWS) {
      const batch = await this.db.contentImpression.findMany({
        where,
        skip,
        take: BATCH,
        orderBy: { timestamp: 'asc' }, // ascending so the CSV is chronological
        include: {
          content: { select: { id: true, name: true, organizationId: true } },
          display: { select: { id: true, nickname: true, deviceIdentifier: true, organizationId: true } },
        },
      });
      if (batch.length === 0) break;

      for (const r of batch) {
        if (emitted >= MAX_ROWS) break;
        yield this.formatProofOfPlayCsvRow(this.sanitizeProofOfPlayRelations(r, organizationId), tz);
        emitted++;
      }
      skip += BATCH;
    }
  }

  /**
   * Validate operator-supplied IANA timezone via Intl. An invalid
   * string (typo, language) silently falls back to UTC rather than
   * throwing — the CSV export shouldn't 500 because the operator
   * picked a wrong drop-down value. The header column name records
   * the actual tz used so the spreadsheet's recipient can see what
   * was applied.
   */
  private normalizeTimezone(tz: string | undefined): string {
    if (!tz) return 'UTC';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      return 'UTC';
    }
  }

  private buildProofOfPlayWhere(orgId: string, f: {
    dateFrom?: string; dateTo?: string;
    contentId?: string; displayId?: string; playlistId?: string;
    displayTagId?: string;
  }) {
    const where: Record<string, unknown> = { organizationId: orgId };

    if (f.dateFrom || f.dateTo) {
      where.date = {
        ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}),
        ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}),
      };
    }
    if (f.contentId) where.contentId = f.contentId;
    if (f.displayId) where.displayId = f.displayId;
    if (f.playlistId) where.playlistId = f.playlistId;
    if (f.displayTagId) {
      where.display = { organizationId: orgId, tags: { some: { tagId: f.displayTagId } } };
    }

    return where;
  }

  private sanitizeProofOfPlayRelations<T extends {
    contentId: string;
    displayId: string;
    content?: { id?: string; name: string; organizationId?: string | null } | null;
    display?: {
      id?: string;
      nickname: string | null;
      deviceIdentifier: string;
      organizationId?: string | null;
    } | null;
  }>(row: T, organizationId: string): T & {
    content: { id: string; name: string };
    display: { id: string; nickname: string | null; deviceIdentifier: string };
  } {
    const contentBelongsToOrg = row.content?.organizationId === organizationId;
    const displayBelongsToOrg = row.display?.organizationId === organizationId;

    return {
      ...row,
      content: contentBelongsToOrg && row.content
        ? { id: row.content.id ?? row.contentId, name: row.content.name }
        : { id: row.contentId, name: 'Unknown' },
      display: displayBelongsToOrg && row.display
        ? {
            id: row.display.id ?? row.displayId,
            nickname: row.display.nickname,
            deviceIdentifier: row.display.deviceIdentifier,
          }
        : { id: row.displayId, nickname: null, deviceIdentifier: 'Unknown' },
    };
  }

  /**
   * Format one impression row as CSV. Applies Excel-injection neutralization:
   * any cell starting with =, +, -, @ gets a leading single-quote so Excel
   * does NOT evaluate it as a formula.
   */
  private formatProofOfPlayCsvRow(r: {
    timestamp: Date;
    contentId: string;
    displayId: string;
    playlistId: string | null;
    duration: number | null;
    completionPercentage: number | null;
    content: { name: string };
    display: { nickname: string | null; deviceIdentifier: string };
  }, tz: string = 'UTC'): string {
    const cells = [
      // UTC fast-path uses native toISOString (well-tested, deterministic).
      // Non-UTC formats via Intl with sortable yyyy-MM-dd HH:mm:ss shape
      // so spreadsheets sort the column correctly without column-type fuss.
      tz === 'UTC' ? r.timestamp.toISOString() : this.formatInTz(r.timestamp, tz),
      r.contentId,
      r.content.name,
      r.displayId,
      r.display.nickname ?? r.display.deviceIdentifier,
      r.playlistId ?? '',
      r.duration?.toString() ?? '',
      r.completionPercentage?.toString() ?? '',
    ];
    return cells.map((c) => this.csvEscape(c)).join(',') + '\n';
  }

  /**
   * Format a Date in the given IANA timezone as `yyyy-MM-dd HH:mm:ss tz`.
   * Intl returns parts unordered; assemble manually so the column is
   * sortable as a plain string in spreadsheets.
   */
  private formatInTz(d: Date, tz: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')} ${tz}`;
  }

  private csvEscape(value: string): string {
    // RFC 4180 + Excel-injection neutralizer.
    // PR-review on PR #67: also neutralize leading Tab (\t) which legacy
    // Excel versions can treat as a formula delimiter, and ensure Tab
    // inside cells triggers RFC 4180 quoting.
    let v = value;
    if (/^[=+\-@\t]/.test(v)) v = `'${v}`;
    if (/[",\n\r\t]/.test(v)) {
      v = `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }
}

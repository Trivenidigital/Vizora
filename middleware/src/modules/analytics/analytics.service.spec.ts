import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { DatabaseService } from '../database/database.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockDb: any;
  let mockClickhouse: any;

  beforeEach(() => {
    mockClickhouse = {
      // Default: ClickHouse has no history → uptime reads are "insufficient data".
      getDeviceUptimeAggregate: jest.fn().mockResolvedValue(null),
      getOrgUptimeAggregates: jest.fn().mockResolvedValue(null),
      getLatestSampleTime: jest.fn().mockResolvedValue({ available: false, lastSample: null }),
      isHealthy: jest.fn().mockResolvedValue(false),
      ensureSchema: jest.fn().mockResolvedValue(undefined),
      isEnabled: true,
    };

    mockDb = {
      display: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      content: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { fileSize: 0 }, _count: { id: 0 } }),
        count: jest.fn().mockResolvedValue(0),
      },
      playlist: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      contentImpression: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _avg: { duration: 0, completionPercentage: 0 } }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    service = new AnalyticsService(mockDb as DatabaseService, mockClickhouse);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDeviceMetrics', () => {
    it('should return empty array when no devices', async () => {
      const result = await service.getDeviceMetrics('org-123', 'month');
      expect(result).toEqual([]);
    });

    it('should return data points when devices exist', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: '1', status: 'online', lastHeartbeat: new Date(), createdAt: new Date('2025-01-01') },
      ]);

      const result = await service.getDeviceMetrics('org-123', 'week');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('mobile');
    });

    it('marks inventory-derived device metrics as estimated availability', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: '1', status: 'online', lastHeartbeat: new Date(), createdAt: new Date('2025-01-01') },
      ]);

      const result = await service.getDeviceMetrics('org-123', 'week');

      expect(result[0]).toEqual(expect.objectContaining({
        isEstimated: true,
        metricSource: 'display_inventory_estimate',
        unit: 'percent',
      }));
    });

    it('should respect range parameter', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: '1', status: 'online', lastHeartbeat: new Date(), createdAt: new Date('2025-01-01') },
      ]);

      const weekResult = await service.getDeviceMetrics('org-123', 'week');
      expect(weekResult.length).toBe(7);

      const monthResult = await service.getDeviceMetrics('org-123', 'month');
      expect(monthResult.length).toBe(30);
    });
  });

  describe('getContentPerformance', () => {
    it('should return empty array when no impressions', async () => {
      const result = await service.getContentPerformance('org-123', 'month');
      expect(result).toEqual([]);
    });

    it('should return content with views from impressions', async () => {
      mockDb.contentImpression.groupBy.mockResolvedValue([
        {
          contentId: 'content-1',
          _count: { id: 15 },
          _avg: { duration: 30, completionPercentage: 85 },
        },
      ]);
      mockDb.content.findMany.mockResolvedValue([
        { id: 'content-1', name: 'Test Content' },
      ]);

      const result = await service.getContentPerformance('org-123', 'month');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Content');
      expect(result[0].views).toBe(15);
      expect(result[0].impressions).toBe(15);
      expect(result[0].engagement).toBe(85);
      expect(result[0].averageCompletion).toBe(85);
    });

    it('does not resolve content names from another organization', async () => {
      mockDb.contentImpression.groupBy.mockResolvedValue([
        {
          contentId: 'foreign-content',
          _count: { id: 4 },
          _avg: { duration: 10, completionPercentage: 50 },
        },
      ]);
      mockDb.content.findMany.mockImplementation((args: any) => {
        if (args.where?.organizationId === 'org-123') return Promise.resolve([]);
        return Promise.resolve([{ id: 'foreign-content', name: 'Other Tenant Menu' }]);
      });

      const result = await service.getContentPerformance('org-123', 'month');

      expect(result[0].title).toBe('Unknown');
      expect(mockDb.content.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['foreign-content'] }, organizationId: 'org-123' },
        select: { id: true, name: true },
      });
    });

    it('marks untracked shares and measured proof-of-play fields', async () => {
      mockDb.contentImpression.groupBy.mockResolvedValue([
        {
          contentId: 'content-1',
          _count: { id: 15 },
          _avg: { duration: 30, completionPercentage: 85 },
        },
      ]);
      mockDb.content.findMany.mockResolvedValue([{ id: 'content-1', name: 'Promo' }]);

      const result = await service.getContentPerformance('org-123', 'month');

      expect(result[0]).toEqual(expect.objectContaining({
        impressionsSource: 'content_impressions',
        engagementSource: 'content_impressions',
        sharesTracked: false,
      }));
    });
  });

  describe('getUsageTrends', () => {
    it('should return trend data points', async () => {
      // getUsageTrends now uses $queryRaw for DB-level aggregation
      const today = new Date();
      mockDb.$queryRaw.mockResolvedValue([
        { date: today, type: 'video', count: BigInt(2) },
        { date: today, type: 'image', count: BigInt(1) },
      ]);

      const result = await service.getUsageTrends('org-123', 'week');
      expect(result.length).toBe(7);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('video');
      expect(result[0]).toHaveProperty('image');
      expect(result[0]).toHaveProperty('other');
    });

    it('joins content by organization as well as content id', async () => {
      await service.getUsageTrends('org-123', 'week');

      const queryArg = mockDb.$queryRaw.mock.calls[0][0];
      const queryText = Array.isArray(queryArg) ? queryArg.join('') : String(queryArg);
      expect(queryText).toContain('c."organizationId" = ci."organizationId"');
    });
  });

  describe('getDeviceDistribution', () => {
    it('should return empty array when no devices', async () => {
      const result = await service.getDeviceDistribution('org-123');
      expect(result).toEqual([]);
    });

    it('should group devices by status', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { status: 'online', metadata: null, resolution: null },
        { status: 'online', metadata: null, resolution: null },
        { status: 'offline', metadata: null, resolution: null },
      ]);

      const result = await service.getDeviceDistribution('org-123');
      expect(result).toHaveLength(2);

      const online = result.find((d: any) => d.name === 'Online');
      expect(online?.value).toBe(2);
    });

    it('should assign correct colors', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { status: 'online', metadata: null, resolution: null },
        { status: 'offline', metadata: null, resolution: null },
      ]);

      const result = await service.getDeviceDistribution('org-123');
      const online = result.find((d: any) => d.name === 'Online');
      const offline = result.find((d: any) => d.name === 'Offline');
      expect(online?.color).toBe('#10B981');
      expect(offline?.color).toBe('#6B7280');
    });
  });

  describe('getBandwidthUsage', () => {
    it('should return bandwidth data points', async () => {
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1048576 }, _count: { id: 1 } });
      mockDb.display.count.mockResolvedValue(5);

      const result = await service.getBandwidthUsage('org-123', 'week');
      expect(result.length).toBe(7);
      expect(result[0]).toHaveProperty('time');
      expect(result[0]).toHaveProperty('current');
      expect(result[0]).toHaveProperty('average');
      expect(result[0]).toHaveProperty('peak');
    });

    it('marks bandwidth as estimated daily transfer volume', async () => {
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1048576 }, _count: { id: 1 } });
      mockDb.display.count.mockResolvedValue(5);

      const result = await service.getBandwidthUsage('org-123', 'week');

      expect(result[0]).toEqual(expect.objectContaining({
        isEstimated: true,
        metricSource: 'content_size_device_count_estimate',
        unit: 'MB/day',
      }));
    });

    it('should return zero bandwidth when no devices', async () => {
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1048576 }, _count: { id: 1 } });
      mockDb.display.count.mockResolvedValue(0);

      const result = await service.getBandwidthUsage('org-123', 'week');
      expect(result.length).toBe(7);
      expect(result[0].average).toBe(0);
    });
  });

  describe('getPlaylistPerformance', () => {
    it('should return empty array when no playlist impressions', async () => {
      const result = await service.getPlaylistPerformance('org-123', 'month');
      expect(result).toEqual([]);
    });

    it('should return playlist stats from impressions', async () => {
      mockDb.contentImpression.groupBy.mockResolvedValue([
        {
          playlistId: 'playlist-1',
          _count: { id: 20 },
          _avg: { completionPercentage: 75 },
        },
      ]);
      mockDb.playlist.findMany.mockResolvedValue([
        {
          id: 'playlist-1',
          name: 'Test Playlist',
          _count: { assignedDisplays: 3 },
        },
      ]);

      const result = await service.getPlaylistPerformance('org-123', 'month');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Playlist');
      expect(result[0].plays).toBe(20);
      expect(result[0].proofOfPlayImpressions).toBe(20);
      expect(result[0].uniqueDevices).toBe(3);
      expect(result[0].assignedScreens).toBe(3);
    });

    it('does not resolve playlist names from another organization', async () => {
      mockDb.contentImpression.groupBy.mockResolvedValue([
        {
          playlistId: 'foreign-playlist',
          _count: { id: 7 },
          _avg: { completionPercentage: 80 },
        },
      ]);
      mockDb.playlist.findMany.mockImplementation((args: any) => {
        if (args.where?.organizationId === 'org-123') return Promise.resolve([]);
        return Promise.resolve([
          { id: 'foreign-playlist', name: 'Other Tenant Loop', _count: { assignedDisplays: 9 } },
        ]);
      });

      const result = await service.getPlaylistPerformance('org-123', 'month');

      expect(result[0].name).toBe('Unknown');
      expect(result[0].uniqueDevices).toBe(0);
      expect(result[0].assignedScreens).toBe(0);
      expect(mockDb.playlist.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['foreign-playlist'] }, organizationId: 'org-123' },
        include: { _count: { select: { assignedDisplays: true } } },
      });
    });

    it('marks assigned displays separately from unique playback devices', async () => {
      mockDb.contentImpression.groupBy.mockResolvedValue([
        {
          playlistId: 'playlist-1',
          _count: { id: 20 },
          _avg: { completionPercentage: 75 },
        },
      ]);
      mockDb.playlist.findMany.mockResolvedValue([
        { id: 'playlist-1', name: 'Test Playlist', _count: { assignedDisplays: 3 } },
      ]);

      const result = await service.getPlaylistPerformance('org-123', 'month');

      expect(result[0]).toEqual(expect.objectContaining({
        playsSource: 'content_impressions',
        completionSource: 'content_impressions',
        uniqueDevicesSource: 'assigned_displays',
        uniquePlaybackDevicesTracked: false,
      }));
    });
  });

  describe('getSummary', () => {
    it('should return zeroed KPI summary when empty', async () => {
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 } });

      const result = await service.getSummary('org-123');
      expect(result.totalDevices).toBe(0);
      expect(result.onlineDevices).toBe(0);
      expect(result.totalContent).toBe(0);
      expect(result.totalPlaylists).toBe(0);
      expect(result.processingContent).toBe(0);
      expect(result.activePlaylists).toBe(0);
      expect(result.uptimePercent).toBe(0);
      expect(result.totalImpressions).toBe(0);
    });

    it('should return KPI summary', async () => {
      mockDb.display.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // online
      mockDb.content.count.mockImplementation((args: any) => (
        args.where?.status === 'processing' ? Promise.resolve(4) : Promise.resolve(50)
      ));
      mockDb.playlist.count.mockImplementation((args: any) => (
        args.where?.OR ? Promise.resolve(3) : Promise.resolve(5)
      ));
      mockDb.contentImpression.count.mockResolvedValue(1200);
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1024000 } });

      const result = await service.getSummary('org-123');
      expect(result.totalDevices).toBe(10);
      expect(result.onlineDevices).toBe(8);
      expect(result.uptimePercent).toBe(80);
      expect(result.onlineNowPercent).toBe(80);
      expect(result.uptimePercentSource).toBe('current_online_ratio');
      expect(result.uptimePercentIsHistorical).toBe(false);
      expect(result.totalContent).toBe(50);
      expect(result.processingContent).toBe(4);
      expect(result.totalPlaylists).toBe(5);
      expect(result.activePlaylists).toBe(3);
      expect(result.totalContentSize).toBe(1024000);
      expect(result.totalImpressions).toBe(1200);
      expect(mockDb.content.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', status: 'processing' },
      });
      expect(mockDb.playlist.count).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          OR: [{ isDefault: true }, { items: { some: {} } }],
        },
      });
    });
  });

  describe('deterministic output', () => {
    it('getDeviceMetrics should return same values on repeated calls', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: '1', status: 'online', lastHeartbeat: new Date(), createdAt: new Date('2025-01-01') },
      ]);

      const result1 = await service.getDeviceMetrics('org-123', 'week');
      const result2 = await service.getDeviceMetrics('org-123', 'week');

      expect(result1).toEqual(result2);
    });

    it('getUsageTrends should return same values on repeated calls', async () => {
      const today = new Date();
      mockDb.$queryRaw.mockResolvedValue([
        { date: today, type: 'video', count: BigInt(1) },
        { date: today, type: 'image', count: BigInt(1) },
      ]);

      const result1 = await service.getUsageTrends('org-123', 'week');
      const result2 = await service.getUsageTrends('org-123', 'week');

      expect(result1).toEqual(result2);
    });

    it('getBandwidthUsage should return same values on repeated calls', async () => {
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1048576 }, _count: { id: 1 } });
      mockDb.display.count.mockResolvedValue(5);

      const result1 = await service.getBandwidthUsage('org-123', 'week');
      const result2 = await service.getBandwidthUsage('org-123', 'week');

      expect(result1).toEqual(result2);
    });

    it('getUsageTrends should count real impressions by type', async () => {
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      mockDb.$queryRaw.mockResolvedValue([
        { date: today, type: 'video', count: BigInt(1) },
      ]);

      const result = await service.getUsageTrends('org-123', 'week');
      // Find today's entry in the results
      const todayEntry = result.find((r: any) => r.date === todayStr);
      expect(todayEntry?.video).toBe(1);
      expect(todayEntry?.image).toBe(0);
    });

    it('getBandwidthUsage current should equal average', async () => {
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1048576 }, _count: { id: 1 } });
      mockDb.display.count.mockResolvedValue(5);

      const result = await service.getBandwidthUsage('org-123', 'week');
      // Current should now equal average (no random jitter)
      expect(result[0].current).toBe(result[0].average);
    });
  });

  describe('getDeviceUptime', () => {
    // A device online for the whole window: a sample in (nearly) every 5-min
    // bucket. ~30 days ⇒ ~8640 buckets; giving firstSample=windowStart and
    // upBuckets≈totalBuckets yields ~100% measured uptime.
    const fullCoverageAggregate = (deviceId: string, days: number, upFraction = 1) => {
      const now = Date.now();
      const firstSample = new Date(now - days * 24 * 60 * 60 * 1000);
      const totalBuckets = Math.ceil((days * 24 * 60 * 60 * 1000) / (5 * 60 * 1000));
      return {
        deviceId,
        upBuckets: Math.round(totalBuckets * upFraction),
        sampleCount: Math.round(totalBuckets * upFraction),
        firstSample,
        lastSample: new Date(now),
      };
    };

    it('returns a REAL measured uptime when ClickHouse has samples', async () => {
      const now = new Date();
      mockDb.display.findFirst.mockResolvedValue({ id: 'device-123', lastHeartbeat: now });
      mockClickhouse.getDeviceUptimeAggregate.mockResolvedValue(
        fullCoverageAggregate('device-123', 30, 1),
      );

      const result = await service.getDeviceUptime('org-123', 'device-123', 30);

      expect(result.deviceId).toBe('device-123');
      expect(result.measured).toBe(true);
      expect(result.metricSource).toBe('clickhouse_health_samples');
      expect(result.uptimePercent).not.toBeNull();
      expect(result.uptimePercent).toBeGreaterThan(95);
      expect(result.uptimePercent).toBeLessThanOrEqual(100);
      expect(result.sampleCount).toBeGreaterThan(0);
      expect(result.totalOnlineMinutes! + result.totalOfflineMinutes!).toBeGreaterThan(0);
      expect(mockClickhouse.getDeviceUptimeAggregate).toHaveBeenCalledWith(
        'org-123',
        'device-123',
        expect.any(Date),
      );
    });

    it('measures ~50% uptime when only half the buckets have samples', async () => {
      mockDb.display.findFirst.mockResolvedValue({ id: 'device-123', lastHeartbeat: new Date() });
      mockClickhouse.getDeviceUptimeAggregate.mockResolvedValue(
        fullCoverageAggregate('device-123', 30, 0.5),
      );

      const result = await service.getDeviceUptime('org-123', 'device-123', 30);

      expect(result.measured).toBe(true);
      expect(result.uptimePercent).toBeGreaterThan(45);
      expect(result.uptimePercent).toBeLessThan(55);
    });

    it('returns INSUFFICIENT DATA (null %, not a fabricated number) when no samples exist', async () => {
      mockDb.display.findFirst.mockResolvedValue({ id: 'device-123', lastHeartbeat: null });
      mockClickhouse.getDeviceUptimeAggregate.mockResolvedValue({
        deviceId: 'device-123',
        upBuckets: 0,
        sampleCount: 0,
        firstSample: new Date(),
        lastSample: new Date(),
      });

      const result = await service.getDeviceUptime('org-123', 'device-123', 30);

      expect(result.measured).toBe(false);
      expect(result.uptimePercent).toBeNull();
      expect(result.totalOnlineMinutes).toBeNull();
      expect(result.totalOfflineMinutes).toBeNull();
      expect(result.sampleCount).toBe(0);
      expect(result.metricSource).toBe('insufficient_data');
    });

    it('returns INSUFFICIENT DATA when ClickHouse is unavailable (query returns null)', async () => {
      mockDb.display.findFirst.mockResolvedValue({ id: 'device-123', lastHeartbeat: null });
      mockClickhouse.getDeviceUptimeAggregate.mockResolvedValue(null);

      const result = await service.getDeviceUptime('org-123', 'device-123', 30);

      expect(result.measured).toBe(false);
      expect(result.uptimePercent).toBeNull();
      expect(result.metricSource).toBe('insufficient_data');
    });

    it('should throw NotFoundException for invalid device', async () => {
      mockDb.display.findFirst.mockResolvedValue(null);

      await expect(service.getDeviceUptime('org-123', 'invalid-id', 30)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUptimeSummary', () => {
    const coverageAggregate = (deviceId: string, upFraction: number, days = 30) => {
      const now = Date.now();
      const totalBuckets = Math.ceil((days * 24 * 60 * 60 * 1000) / (5 * 60 * 1000));
      return {
        deviceId,
        upBuckets: Math.round(totalBuckets * upFraction),
        sampleCount: Math.round(totalBuckets * upFraction),
        firstSample: new Date(now - days * 24 * 60 * 60 * 1000),
        lastSample: new Date(now),
      };
    };

    it('measures uptime per device and averages over MEASURED devices only', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: 'd1', nickname: 'Device 1', status: 'online' },
        { id: 'd2', nickname: 'Device 2', status: 'offline' },
      ]);
      // d1 has ~100% coverage; d2 has NO samples (absent from aggregates).
      mockClickhouse.getOrgUptimeAggregates.mockResolvedValue([coverageAggregate('d1', 1)]);

      const result = await service.getUptimeSummary('org-123', 30);

      expect(result.deviceCount).toBe(2);
      expect(result.onlineCount).toBe(1);
      expect(result.offlineCount).toBe(1);
      expect(result.measured).toBe(true);
      expect(result.measuredDeviceCount).toBe(1);
      expect(result.metricSource).toBe('clickhouse_health_samples');

      const d1 = result.devices.find((d) => d.id === 'd1');
      const d2 = result.devices.find((d) => d.id === 'd2');
      expect(d1?.measured).toBe(true);
      expect(d1?.uptimePercent).toBeGreaterThan(95);
      // d2 has no samples → insufficient data, NOT a fabricated number.
      expect(d2?.measured).toBe(false);
      expect(d2?.uptimePercent).toBeNull();
      // Average is over the single measured device (d1), not diluted by d2.
      expect(result.avgUptimePercent).toBe(d1?.uptimePercent);
    });

    it('returns INSUFFICIENT DATA for the org when no device has samples', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: 'd1', nickname: 'Device 1', status: 'online' },
      ]);
      mockClickhouse.getOrgUptimeAggregates.mockResolvedValue([]); // reachable, no rows

      const result = await service.getUptimeSummary('org-123', 30);

      expect(result.measured).toBe(false);
      expect(result.measuredDeviceCount).toBe(0);
      expect(result.avgUptimePercent).toBeNull();
      expect(result.metricSource).toBe('insufficient_data');
      expect(result.devices[0].uptimePercent).toBeNull();
    });

    it('returns INSUFFICIENT DATA when ClickHouse is unavailable', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: 'd1', nickname: 'Device 1', status: 'online' },
      ]);
      mockClickhouse.getOrgUptimeAggregates.mockResolvedValue(null); // CH down

      const result = await service.getUptimeSummary('org-123', 30);

      expect(result.measured).toBe(false);
      expect(result.avgUptimePercent).toBeNull();
      expect(result.metricSource).toBe('insufficient_data');
    });

    it('should handle empty device list', async () => {
      mockDb.display.findMany.mockResolvedValue([]);

      const result = await service.getUptimeSummary('org-123', 30);

      expect(result.deviceCount).toBe(0);
      expect(result.onlineCount).toBe(0);
      expect(result.offlineCount).toBe(0);
      expect(result.avgUptimePercent).toBeNull();
      expect(result.measured).toBe(false);
      expect(result.devices).toEqual([]);
    });

    it('should use "Unnamed Device" for null nicknames', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: 'd1', nickname: null, status: 'online' },
      ]);

      const result = await service.getUptimeSummary('org-123', 30);

      expect(result.devices[0].nickname).toBe('Unnamed Device');
    });
  });

  describe('exportAnalytics', () => {
    it('should return combined analytics data', async () => {
      // Mock all the sub-queries
      mockDb.display.findMany.mockResolvedValue([]);
      mockDb.display.count.mockResolvedValue(0);
      mockDb.content.findMany.mockResolvedValue([]);
      mockDb.content.groupBy.mockResolvedValue([]);
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: { id: 0 } });
      mockDb.content.count.mockResolvedValue(0);
      mockDb.playlist.findMany.mockResolvedValue([]);
      mockDb.playlist.count.mockResolvedValue(0);
      mockDb.contentImpression.groupBy.mockResolvedValue([]);
      mockDb.contentImpression.findMany.mockResolvedValue([]);
      mockDb.contentImpression.count.mockResolvedValue(0);

      const result = await service.exportAnalytics('org-123', 'month');

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('deviceMetrics');
      expect(result).toHaveProperty('contentPerformance');
      expect(result).toHaveProperty('usageTrends');
      expect(result).toHaveProperty('deviceDistribution');
      expect(result).toHaveProperty('bandwidthUsage');
      expect(result).toHaveProperty('playlistPerformance');
      expect(result.summary.uptimePercentSource).toBe('current_online_ratio');
      expect(result.bandwidthUsage[0]?.metricSource).toBe('content_size_device_count_estimate');
    });

    it('should respect range parameter', async () => {
      mockDb.display.findMany.mockResolvedValue([
        { id: '1', status: 'online', lastHeartbeat: new Date(), createdAt: new Date('2025-01-01') },
      ]);
      mockDb.display.count.mockResolvedValue(1);
      mockDb.content.findMany.mockResolvedValue([]);
      mockDb.content.groupBy.mockResolvedValue([]);
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: { id: 0 } });
      mockDb.content.count.mockResolvedValue(0);
      mockDb.playlist.findMany.mockResolvedValue([]);
      mockDb.playlist.count.mockResolvedValue(0);
      mockDb.contentImpression.groupBy.mockResolvedValue([]);
      mockDb.contentImpression.findMany.mockResolvedValue([]);
      mockDb.contentImpression.count.mockResolvedValue(0);

      const weekResult = await service.exportAnalytics('org-123', 'week');
      expect(weekResult.deviceMetrics.length).toBe(7);

      const monthResult = await service.exportAnalytics('org-123', 'month');
      expect(monthResult.deviceMetrics.length).toBe(30);
    });

    it('should return empty data for org with no resources', async () => {
      mockDb.display.findMany.mockResolvedValue([]);
      mockDb.display.count.mockResolvedValue(0);
      mockDb.content.findMany.mockResolvedValue([]);
      mockDb.content.groupBy.mockResolvedValue([]);
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: { id: 0 } });
      mockDb.content.count.mockResolvedValue(0);
      mockDb.playlist.findMany.mockResolvedValue([]);
      mockDb.playlist.count.mockResolvedValue(0);
      mockDb.contentImpression.groupBy.mockResolvedValue([]);
      mockDb.contentImpression.findMany.mockResolvedValue([]);
      mockDb.contentImpression.count.mockResolvedValue(0);

      const result = await service.exportAnalytics('org-123', 'month');

      expect(result.summary.totalDevices).toBe(0);
      expect(result.deviceMetrics).toEqual([]);
      expect(result.contentPerformance).toEqual([]);
      expect(result.playlistPerformance).toEqual([]);
    });
  });
});

import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { DatabaseService } from '../database/database.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      display: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      content: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { fileSize: 0 }, _count: { id: 0 } }),
        count: jest.fn().mockResolvedValue(0),
      },
      playlist: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    service = new AnalyticsService(mockDb as DatabaseService);
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
    it('should return empty array when no content', async () => {
      const result = await service.getContentPerformance('org-123', 'month');
      expect(result).toEqual([]);
    });

    it('should return content with views', async () => {
      mockDb.content.findMany.mockResolvedValue([
        {
          name: 'Test Content',
          _count: { playlistItems: 3 },
          playlistItems: [{ playlist: { _count: { assignedDisplays: 2 } } }],
        },
      ]);

      const result = await service.getContentPerformance('org-123', 'month');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Content');
      expect(result[0].views).toBeGreaterThan(0);
    });
  });

  describe('getUsageTrends', () => {
    it('should return trend data points', async () => {
      mockDb.content.groupBy.mockResolvedValue([
        { type: 'video', _count: { id: 5 } },
        { type: 'image', _count: { id: 3 } },
      ]);

      const result = await service.getUsageTrends('org-123', 'week');
      expect(result.length).toBe(7);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('video');
      expect(result[0]).toHaveProperty('image');
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

    it('should return zero bandwidth when no devices', async () => {
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1048576 }, _count: { id: 1 } });
      mockDb.display.count.mockResolvedValue(0);

      const result = await service.getBandwidthUsage('org-123', 'week');
      expect(result.length).toBe(7);
      expect(result[0].average).toBe(0);
    });
  });

  describe('getPlaylistPerformance', () => {
    it('should return empty array when no playlists', async () => {
      const result = await service.getPlaylistPerformance('org-123', 'month');
      expect(result).toEqual([]);
    });

    it('should return playlist stats', async () => {
      mockDb.playlist.findMany.mockResolvedValue([
        {
          name: 'Test Playlist',
          _count: { items: 5, assignedDisplays: 3, schedules: 2 },
        },
      ]);

      const result = await service.getPlaylistPerformance('org-123', 'month');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Playlist');
      expect(result[0].plays).toBeGreaterThan(0);
      expect(result[0].uniqueDevices).toBe(3);
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
      expect(result.uptimePercent).toBe(0);
    });

    it('should return KPI summary', async () => {
      mockDb.display.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // online
      mockDb.content.count.mockResolvedValue(50);
      mockDb.playlist.count.mockResolvedValue(5);
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 1024000 } });

      const result = await service.getSummary('org-123');
      expect(result.totalDevices).toBe(10);
      expect(result.onlineDevices).toBe(8);
      expect(result.uptimePercent).toBe(80);
      expect(result.totalContent).toBe(50);
      expect(result.totalPlaylists).toBe(5);
      expect(result.totalContentSize).toBe(1024000);
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
      mockDb.content.groupBy.mockResolvedValue([
        { type: 'video', _count: { id: 5 } },
        { type: 'image', _count: { id: 3 } },
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

    it('getUsageTrends should use fixed multipliers', async () => {
      mockDb.content.groupBy.mockResolvedValue([
        { type: 'video', _count: { id: 1 } },
      ]);

      const result = await service.getUsageTrends('org-123', 'week');
      // With 1 video content, each day should have video = 1 * 25 = 25
      expect(result[0].video).toBe(25);
      expect(result[0].image).toBe(0);
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
    it('should return uptime data for a device', async () => {
      const now = new Date();
      mockDb.display.findFirst.mockResolvedValue({
        id: 'device-123',
        nickname: 'Test Device',
        status: 'online',
        lastHeartbeat: now,
      });

      const result = await service.getDeviceUptime('org-123', 'device-123', 30);

      expect(result.deviceId).toBe('device-123');
      expect(result.uptimePercent).toBe(95); // Online device gets 95%
      expect(result.totalOnlineMinutes).toBeGreaterThan(0);
      expect(result.totalOfflineMinutes).toBeGreaterThan(0);
      expect(result.lastHeartbeat).toEqual(now);
    });

    it('should throw NotFoundException for invalid device', async () => {
      mockDb.display.findFirst.mockResolvedValue(null);

      await expect(service.getDeviceUptime('org-123', 'invalid-id', 30)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should calculate lower uptime for offline devices', async () => {
      const staleHeartbeat = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      mockDb.display.findFirst.mockResolvedValue({
        id: 'device-123',
        nickname: 'Test Device',
        status: 'offline',
        lastHeartbeat: staleHeartbeat,
      });

      const result = await service.getDeviceUptime('org-123', 'device-123', 30);

      expect(result.uptimePercent).toBe(20); // Offline device gets 20%
    });

    it('should calculate medium uptime for device with online status but stale heartbeat', async () => {
      const staleHeartbeat = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      mockDb.display.findFirst.mockResolvedValue({
        id: 'device-123',
        nickname: 'Test Device',
        status: 'online',
        lastHeartbeat: staleHeartbeat,
      });

      const result = await service.getDeviceUptime('org-123', 'device-123', 30);

      expect(result.uptimePercent).toBe(80); // Online status but stale heartbeat gets 80%
    });

    it('should use correct days parameter for calculations', async () => {
      const now = new Date();
      mockDb.display.findFirst.mockResolvedValue({
        id: 'device-123',
        nickname: 'Test Device',
        status: 'online',
        lastHeartbeat: now,
      });

      const result7Days = await service.getDeviceUptime('org-123', 'device-123', 7);
      const result30Days = await service.getDeviceUptime('org-123', 'device-123', 30);

      // Both have 95% uptime, but total minutes differ based on days
      expect(result7Days.totalOnlineMinutes + result7Days.totalOfflineMinutes).toBe(7 * 24 * 60);
      expect(result30Days.totalOnlineMinutes + result30Days.totalOfflineMinutes).toBe(30 * 24 * 60);
    });
  });

  describe('getUptimeSummary', () => {
    it('should return aggregated uptime data for all devices', async () => {
      const now = new Date();
      mockDb.display.findMany.mockResolvedValue([
        { id: 'd1', nickname: 'Device 1', status: 'online', lastHeartbeat: now },
        { id: 'd2', nickname: 'Device 2', status: 'offline', lastHeartbeat: null },
      ]);

      const result = await service.getUptimeSummary('org-123', 30);

      expect(result.deviceCount).toBe(2);
      expect(result.onlineCount).toBe(1);
      expect(result.offlineCount).toBe(1);
      expect(result.devices).toHaveLength(2);
    });

    it('should handle empty device list', async () => {
      mockDb.display.findMany.mockResolvedValue([]);

      const result = await service.getUptimeSummary('org-123', 30);

      expect(result.deviceCount).toBe(0);
      expect(result.onlineCount).toBe(0);
      expect(result.offlineCount).toBe(0);
      expect(result.avgUptimePercent).toBe(0);
      expect(result.devices).toEqual([]);
    });

    it('should calculate correct average uptime', async () => {
      const now = new Date();
      const staleHeartbeat = new Date(Date.now() - 10 * 60 * 1000);
      mockDb.display.findMany.mockResolvedValue([
        { id: 'd1', nickname: 'Online Device', status: 'online', lastHeartbeat: now }, // 95%
        { id: 'd2', nickname: 'Offline Device', status: 'offline', lastHeartbeat: staleHeartbeat }, // 20%
      ]);

      const result = await service.getUptimeSummary('org-123', 30);

      // Average of 95 and 20 = 57.5
      expect(result.avgUptimePercent).toBe(57.5);
    });

    it('should use "Unnamed Device" for null nicknames', async () => {
      const now = new Date();
      mockDb.display.findMany.mockResolvedValue([
        { id: 'd1', nickname: null, status: 'online', lastHeartbeat: now },
      ]);

      const result = await service.getUptimeSummary('org-123', 30);

      expect(result.devices[0].nickname).toBe('Unnamed Device');
    });

    it('should return per-device uptime percentages', async () => {
      const now = new Date();
      mockDb.display.findMany.mockResolvedValue([
        { id: 'd1', nickname: 'Device 1', status: 'online', lastHeartbeat: now },
        { id: 'd2', nickname: 'Device 2', status: 'offline', lastHeartbeat: null },
      ]);

      const result = await service.getUptimeSummary('org-123', 30);

      const device1 = result.devices.find((d) => d.id === 'd1');
      const device2 = result.devices.find((d) => d.id === 'd2');

      expect(device1?.uptimePercent).toBe(95);
      expect(device2?.uptimePercent).toBe(20);
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

      const result = await service.exportAnalytics('org-123', 'month');

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('deviceMetrics');
      expect(result).toHaveProperty('contentPerformance');
      expect(result).toHaveProperty('usageTrends');
      expect(result).toHaveProperty('deviceDistribution');
      expect(result).toHaveProperty('bandwidthUsage');
      expect(result).toHaveProperty('playlistPerformance');
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

      const result = await service.exportAnalytics('org-123', 'month');

      expect(result.summary.totalDevices).toBe(0);
      expect(result.deviceMetrics).toEqual([]);
      expect(result.contentPerformance).toEqual([]);
      expect(result.playlistPerformance).toEqual([]);
    });
  });
});

import { AnalyticsService } from './analytics.service';
import { DatabaseService } from '../database/database.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      display: {
        findMany: jest.fn().mockResolvedValue([]),
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
});

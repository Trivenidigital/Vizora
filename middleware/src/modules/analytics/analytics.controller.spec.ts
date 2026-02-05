import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockAnalyticsService = {
      getDeviceMetrics: jest.fn(),
      getContentPerformance: jest.fn(),
      getUsageTrends: jest.fn(),
      getDeviceDistribution: jest.fn(),
      getBandwidthUsage: jest.fn(),
      getPlaylistPerformance: jest.fn(),
      getSummary: jest.fn(),
      exportAnalytics: jest.fn(),
      getDeviceUptime: jest.fn(),
      getUptimeSummary: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockAnalyticsService }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDeviceMetrics', () => {
    it('should return device metrics', async () => {
      const mockData = [{ date: 'Jan 1', mobile: 90, tablet: 95, desktop: 99 }];
      mockAnalyticsService.getDeviceMetrics.mockResolvedValue(mockData);

      const result = await controller.getDeviceMetrics(organizationId, 'month');

      expect(result).toEqual(mockData);
      expect(mockAnalyticsService.getDeviceMetrics).toHaveBeenCalledWith(organizationId, 'month');
    });
  });

  describe('getContentPerformance', () => {
    it('should return content performance', async () => {
      const mockData = [{ title: 'Test', views: 100 }];
      mockAnalyticsService.getContentPerformance.mockResolvedValue(mockData);

      const result = await controller.getContentPerformance(organizationId, 'month');

      expect(result).toEqual(mockData);
    });
  });

  describe('getUsageTrends', () => {
    it('should return usage trends', async () => {
      const mockData = [{ date: 'Jan 1', video: 100, image: 50, text: 20, interactive: 10 }];
      mockAnalyticsService.getUsageTrends.mockResolvedValue(mockData);

      const result = await controller.getUsageTrends(organizationId, 'month');

      expect(result).toEqual(mockData);
      expect(mockAnalyticsService.getUsageTrends).toHaveBeenCalledWith(organizationId, 'month');
    });
  });

  describe('getDeviceDistribution', () => {
    it('should return device distribution', async () => {
      const mockData = [{ name: 'Online', value: 5, color: '#10B981' }];
      mockAnalyticsService.getDeviceDistribution.mockResolvedValue(mockData);

      const result = await controller.getDeviceDistribution(organizationId);

      expect(result).toEqual(mockData);
      expect(mockAnalyticsService.getDeviceDistribution).toHaveBeenCalledWith(organizationId);
    });
  });

  describe('getBandwidthUsage', () => {
    it('should return bandwidth usage', async () => {
      const mockData = [{ time: 'Jan 1', current: 100, average: 80, peak: 150 }];
      mockAnalyticsService.getBandwidthUsage.mockResolvedValue(mockData);

      const result = await controller.getBandwidthUsage(organizationId, 'month');

      expect(result).toEqual(mockData);
      expect(mockAnalyticsService.getBandwidthUsage).toHaveBeenCalledWith(organizationId, 'month');
    });
  });

  describe('getPlaylistPerformance', () => {
    it('should return playlist performance', async () => {
      const mockData = [{ name: 'Test Playlist', plays: 50, engagement: 75 }];
      mockAnalyticsService.getPlaylistPerformance.mockResolvedValue(mockData);

      const result = await controller.getPlaylistPerformance(organizationId, 'month');

      expect(result).toEqual(mockData);
      expect(mockAnalyticsService.getPlaylistPerformance).toHaveBeenCalledWith(organizationId, 'month');
    });
  });

  describe('getSummary', () => {
    it('should return analytics summary', async () => {
      const mockData = { totalDevices: 10, onlineDevices: 8, uptimePercent: 80 };
      mockAnalyticsService.getSummary.mockResolvedValue(mockData);

      const result = await controller.getSummary(organizationId);

      expect(result).toEqual(mockData);
      expect(mockAnalyticsService.getSummary).toHaveBeenCalledWith(organizationId);
    });
  });

  describe('getDeviceUptime', () => {
    it('should return device uptime data', async () => {
      const mockData = {
        deviceId: 'device-123',
        uptimePercent: 95,
        totalOnlineMinutes: 40680,
        totalOfflineMinutes: 2520,
        lastHeartbeat: new Date().toISOString(),
      };
      mockAnalyticsService.getDeviceUptime.mockResolvedValue(mockData);

      const result = await controller.getDeviceUptime('device-123', undefined, organizationId);

      expect(result).toEqual(mockData);
      expect(mockAnalyticsService.getDeviceUptime).toHaveBeenCalledWith(organizationId, 'device-123', 30);
    });

    it('should parse days query parameter', async () => {
      const mockData = { deviceId: 'device-123', uptimePercent: 95 };
      mockAnalyticsService.getDeviceUptime.mockResolvedValue(mockData);

      await controller.getDeviceUptime('device-123', '7', organizationId);

      expect(mockAnalyticsService.getDeviceUptime).toHaveBeenCalledWith(organizationId, 'device-123', 7);
    });
  });

  describe('getUptimeSummary', () => {
    it('should return uptime summary', async () => {
      const mockData = {
        avgUptimePercent: 85,
        deviceCount: 10,
        onlineCount: 8,
        offlineCount: 2,
        devices: [{ id: 'd1', nickname: 'Device 1', uptimePercent: 95 }],
      };
      mockAnalyticsService.getUptimeSummary.mockResolvedValue(mockData);

      const result = await controller.getUptimeSummary(undefined, organizationId);

      expect(result).toEqual(mockData);
      expect(mockAnalyticsService.getUptimeSummary).toHaveBeenCalledWith(organizationId, 30);
    });

    it('should parse days query parameter', async () => {
      const mockData = { avgUptimePercent: 85, deviceCount: 5, onlineCount: 4, offlineCount: 1, devices: [] };
      mockAnalyticsService.getUptimeSummary.mockResolvedValue(mockData);

      await controller.getUptimeSummary('14', organizationId);

      expect(mockAnalyticsService.getUptimeSummary).toHaveBeenCalledWith(organizationId, 14);
    });
  });
});

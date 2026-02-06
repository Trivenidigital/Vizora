import { PlatformStatsService } from './platform-stats.service';
import { DatabaseService } from '../../database/database.service';

describe('PlatformStatsService', () => {
  let service: PlatformStatsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      organization: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
      display: {
        count: jest.fn(),
      },
      content: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      playlist: {
        count: jest.fn(),
      },
      schedule: {
        count: jest.fn(),
      },
      apiKey: {
        count: jest.fn(),
      },
      billingTransaction: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    service = new PlatformStatsService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return platform overview statistics', async () => {
      mockDb.organization.count.mockResolvedValueOnce(100).mockResolvedValueOnce(80);
      mockDb.user.count.mockResolvedValue(500);
      mockDb.display.count.mockResolvedValueOnce(1000).mockResolvedValueOnce(800);
      mockDb.content.count.mockResolvedValue(5000);
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: 10240000 } });
      mockDb.billingTransaction.aggregate.mockResolvedValue({ _sum: { amount: 500000 } });

      const result = await service.getOverview();

      expect(result.totalOrganizations).toBe(100);
      expect(result.totalUsers).toBe(500);
      expect(result.totalDisplays).toBe(1000);
      expect(result.onlineDisplays).toBe(800);
      expect(result.totalContent).toBe(5000);
      expect(result.totalStorageBytes).toBe(10240000);
      expect(result.totalRevenue).toBe(500000);
      expect(result.activeSubscriptions).toBe(80);
    });

    it('should handle zero values gracefully', async () => {
      mockDb.organization.count.mockResolvedValue(0);
      mockDb.user.count.mockResolvedValue(0);
      mockDb.display.count.mockResolvedValue(0);
      mockDb.content.count.mockResolvedValue(0);
      mockDb.content.aggregate.mockResolvedValue({ _sum: { fileSize: null } });
      mockDb.billingTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const result = await service.getOverview();

      expect(result.totalStorageBytes).toBe(0);
      expect(result.totalRevenue).toBe(0);
    });
  });

  describe('getRevenue', () => {
    it('should return revenue statistics for a period', async () => {
      mockDb.billingTransaction.findMany.mockResolvedValue([
        { amount: 1000, currency: 'usd', provider: 'stripe', type: 'subscription' },
        { amount: 2000, currency: 'usd', provider: 'stripe', type: 'subscription' },
        { amount: 500, currency: 'inr', provider: 'razorpay', type: 'one_time' },
      ]);

      const result = await service.getRevenue('month');

      expect(result.period).toBe('month');
      expect(result.totalRevenue).toBe(3500);
      expect(result.mrr).toBe(3000);
      expect(result.arr).toBe(36000);
      expect(result.transactionCount).toBe(3);
      expect(result.byCurrency.usd).toBe(3000);
      expect(result.byCurrency.inr).toBe(500);
      expect(result.byProvider.stripe).toBe(3000);
      expect(result.byProvider.razorpay).toBe(500);
    });

    it('should handle empty transactions', async () => {
      mockDb.billingTransaction.findMany.mockResolvedValue([]);

      const result = await service.getRevenue('month');

      expect(result.totalRevenue).toBe(0);
      expect(result.transactionCount).toBe(0);
    });
  });

  describe('getSignups', () => {
    it('should return signup statistics', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      mockDb.organization.findMany.mockResolvedValue([
        { createdAt: today, subscriptionTier: 'free' },
        { createdAt: today, subscriptionTier: 'pro' },
        { createdAt: yesterday, subscriptionTier: 'free' },
      ]);

      const result = await service.getSignups('month');

      expect(result.period).toBe('month');
      expect(result.total).toBe(3);
      expect(result.byPlan.free).toBe(2);
      expect(result.byPlan.pro).toBe(1);
    });
  });

  describe('getChurn', () => {
    it('should return churn statistics', async () => {
      mockDb.organization.findMany.mockResolvedValue([
        { subscriptionTier: 'pro' },
        { subscriptionTier: 'basic' },
      ]);
      mockDb.organization.count.mockResolvedValue(100);

      const result = await service.getChurn('month');

      expect(result.period).toBe('month');
      expect(result.churned).toBe(2);
      expect(result.churnRate).toBe(2);
      expect(result.byPlan.pro).toBe(1);
      expect(result.byPlan.basic).toBe(1);
    });

    it('should handle zero active organizations', async () => {
      mockDb.organization.findMany.mockResolvedValue([]);
      mockDb.organization.count.mockResolvedValue(0);

      const result = await service.getChurn('month');

      expect(result.churnRate).toBe(0);
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      mockDb.display.count.mockResolvedValueOnce(800).mockResolvedValueOnce(1000);
      mockDb.content.count.mockResolvedValue(5000);
      mockDb.schedule.count.mockResolvedValue(200);
      mockDb.apiKey.count.mockResolvedValue(50);

      const result = await service.getUsageStats();

      expect(result.displaysOnline).toBe(800);
      expect(result.displaysTotal).toBe(1000);
      expect(result.onlinePercentage).toBe(80);
      expect(result.contentItems).toBe(5000);
      expect(result.activeSchedules).toBe(200);
      expect(result.apiKeysActive).toBe(50);
    });

    it('should handle zero total displays', async () => {
      mockDb.display.count.mockResolvedValue(0);
      mockDb.content.count.mockResolvedValue(0);
      mockDb.schedule.count.mockResolvedValue(0);
      mockDb.apiKey.count.mockResolvedValue(0);

      const result = await service.getUsageStats();

      expect(result.onlinePercentage).toBe(0);
    });
  });

  describe('getByPlan', () => {
    it('should return breakdown by plan', async () => {
      mockDb.organization.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(50)  // free
        .mockResolvedValueOnce(30)  // basic
        .mockResolvedValueOnce(15)  // pro
        .mockResolvedValueOnce(5);  // enterprise
      mockDb.user.count.mockResolvedValue(10);
      mockDb.display.count.mockResolvedValue(20);

      const result = await service.getByPlan();

      expect(result).toHaveLength(4);
      expect(result[0].plan).toBe('free');
      expect(result[0].percentage).toBe(50);
    });
  });

  describe('getGeographic', () => {
    it('should return geographic distribution', async () => {
      mockDb.organization.findMany.mockResolvedValue([
        { country: 'US', _count: { users: 100 } },
        { country: 'US', _count: { users: 50 } },
        { country: 'IN', _count: { users: 30 } },
        { country: 'UK', _count: { users: 20 } },
      ]);

      const result = await service.getGeographic();

      expect(result.byCountry).toHaveLength(3);
      expect(result.byCountry[0].country).toBe('US');
      expect(result.byCountry[0].organizations).toBe(2);
      expect(result.byCountry[0].users).toBe(150);
    });

    it('should sort by organization count descending', async () => {
      mockDb.organization.findMany.mockResolvedValue([
        { country: 'IN', _count: { users: 10 } },
        { country: 'US', _count: { users: 10 } },
        { country: 'US', _count: { users: 10 } },
      ]);

      const result = await service.getGeographic();

      expect(result.byCountry[0].country).toBe('US');
      expect(result.byCountry[1].country).toBe('IN');
    });
  });
});

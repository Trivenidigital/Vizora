import { Test, TestingModule } from '@nestjs/testing';
import { ContinuousHealthMonitorService } from './continuous-health-monitor.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

describe('ContinuousHealthMonitorService', () => {
  let service: ContinuousHealthMonitorService;
  let mockDb: Partial<DatabaseService>;
  let mockRedis: Partial<RedisService>;

  beforeEach(async () => {
    mockDb = {
      $queryRaw: jest.fn().mockResolvedValue([{ count: 1n }]),
    };

    mockRedis = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, responseTime: 3 }),
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContinuousHealthMonitorService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ContinuousHealthMonitorService>(ContinuousHealthMonitorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have no latest result initially', () => {
    expect(service.latest).toBeNull();
  });

  it('should return empty history initially', () => {
    expect(service.getHistory()).toEqual([]);
  });

  it('should return default metrics when no history', () => {
    const metrics = service.getMetrics();
    expect(metrics.avg_latency_ms).toBe(0);
    expect(metrics.uptime_pct).toBe(100);
    expect(metrics.checks_count).toBe(0);
  });

  describe('runHealthCheck', () => {
    it('should return a ContinuousHealthResult with all checks', async () => {
      const result = await service.runHealthCheck();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.overall).toBeDefined();
      expect(['healthy', 'warning', 'degraded', 'critical']).toContain(result.overall);
      expect(result.checks.api_latency).toBeDefined();
      expect(result.checks.database).toBeDefined();
      expect(result.checks.redis).toBeDefined();
      expect(result.checks.error_rate).toBeDefined();
      expect(result.checks.notification_latency).toBeDefined();
      expect(result.checks.ssl).toBeDefined();
    });

    it('should store result in latest', async () => {
      await service.runHealthCheck();
      expect(service.latest).not.toBeNull();
    });

    it('should add result to history', async () => {
      await service.runHealthCheck();
      expect(service.getHistory().length).toBe(1);
    });

    it('should cache result in Redis', async () => {
      await service.runHealthCheck();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'vizora:health:latest',
        expect.any(String),
        600,
      );
    });

    it('should report database and redis checks with valid status', async () => {
      const result = await service.runHealthCheck();
      // DB and Redis mocks are healthy, so those should not be critical
      expect(result.checks.database.status).not.toBe('critical');
      expect(result.checks.redis.status).not.toBe('critical');
    });

    it('should report critical when database is unreachable', async () => {
      (mockDb.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const result = await service.runHealthCheck();
      expect(result.checks.database.status).toBe('critical');
      expect(result.overall).not.toBe('healthy');
    });
  });

  describe('recordError', () => {
    it('should track 5xx errors', async () => {
      service.recordError(500);
      service.recordError(502);
      service.recordError(503);

      const result = await service.runHealthCheck();
      expect(result.checks.error_rate.value).toBe(3);
    });

    it('should track notable 4xx errors (excluding 401)', async () => {
      service.recordError(400);
      service.recordError(401); // excluded
      service.recordError(403);

      const result = await service.runHealthCheck();
      // error_rate.value tracks 5xx count specifically
      expect(result.checks.error_rate.message).toContain('2 notable 4xx');
    });

    it('should report critical when >5 5xx errors', async () => {
      for (let i = 0; i < 6; i++) service.recordError(500);

      const result = await service.runHealthCheck();
      expect(result.checks.error_rate.status).toBe('critical');
    });
  });

  describe('getMetrics', () => {
    it('should calculate averages after multiple checks', async () => {
      await service.runHealthCheck();
      await service.runHealthCheck();

      const metrics = service.getMetrics();
      expect(metrics.checks_count).toBe(2);
      expect(metrics.avg_latency_ms).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime_pct).toBeGreaterThanOrEqual(0);
    });
  });
});

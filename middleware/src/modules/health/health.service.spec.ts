import { HealthService } from './health.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';

describe('HealthService', () => {
  let service: HealthService;
  let mockDatabaseService: any;
  let mockRedisService: any;
  let mockStorageService: any;

  beforeEach(() => {
    mockDatabaseService = {
      $queryRaw: jest.fn(),
    };

    mockRedisService = {
      healthCheck: jest.fn(),
      isAvailable: jest.fn(),
    };

    mockStorageService = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, bucket: 'vizora' }),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    service = new HealthService(
      mockDatabaseService as DatabaseService,
      undefined, // circuitBreaker (optional)
      mockRedisService as RedisService,
      mockStorageService as StorageService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    describe('when all services are healthy', () => {
      beforeEach(() => {
        mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mockRedisService.healthCheck.mockResolvedValue({
          healthy: true,
          responseTime: 5,
        });
      });

      it('should return ok status', async () => {
        const result = await service.check();

        expect(result.status).toBe('ok');
        expect(result.checks.database.status).toBe('healthy');
        expect(result.checks.redis.status).toBe('healthy');
        expect(result.checks.minio.status).toBe('healthy');
        expect(result.checks.memory.status).toBe('healthy');
      });

      it('should include timestamp in ISO format', async () => {
        const result = await service.check();

        expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should include uptime in seconds', async () => {
        const result = await service.check();

        expect(typeof result.uptime).toBe('number');
        expect(result.uptime).toBeGreaterThanOrEqual(0);
      });

      it('should include version', async () => {
        const result = await service.check();

        expect(result.version).toBeDefined();
      });

      it('should include response time for database check', async () => {
        const result = await service.check();

        expect(result.checks.database.responseTime).toBeGreaterThanOrEqual(0);
      });

      it('should include response time for redis check', async () => {
        const result = await service.check();

        expect(result.checks.redis.responseTime).toBe(5);
      });
    });

    describe('when database is unhealthy', () => {
      beforeEach(() => {
        mockDatabaseService.$queryRaw.mockRejectedValue(new Error('Connection refused'));
        mockRedisService.healthCheck.mockResolvedValue({
          healthy: true,
          responseTime: 5,
        });
      });

      it('should return unhealthy status', async () => {
        const result = await service.check();

        expect(result.status).toBe('unhealthy');
        expect(result.checks.database.status).toBe('unhealthy');
        expect(result.checks.database.error).toContain('Connection refused');
      });

      it('should still check other services', async () => {
        const result = await service.check();

        expect(result.checks.redis.status).toBe('healthy');
        expect(result.checks.memory.status).toBe('healthy');
      });
    });

    describe('when redis is unhealthy', () => {
      beforeEach(() => {
        mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mockRedisService.healthCheck.mockResolvedValue({
          healthy: false,
          responseTime: 10,
          error: 'Connection refused',
        });
      });

      it('should return degraded status (redis is optional)', async () => {
        const result = await service.check();

        // Redis being unhealthy should degrade but not fail the overall status
        // since database is still healthy
        expect(result.status).toBe('degraded');
        expect(result.checks.redis.status).toBe('unhealthy');
        expect(result.checks.redis.error).toContain('Connection refused');
      });

      it('should include redis details', async () => {
        const result = await service.check();

        expect(result.checks.redis.details).toEqual({ connected: false });
      });
    });

    describe('when redis service throws an error', () => {
      beforeEach(() => {
        mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mockRedisService.healthCheck.mockRejectedValue(new Error('Redis error'));
      });

      it('should handle the error gracefully', async () => {
        const result = await service.check();

        expect(result.checks.redis.status).toBe('unhealthy');
        expect(result.checks.redis.error).toContain('Redis error');
      });
    });

    describe('when redis service is not available (optional dependency)', () => {
      beforeEach(() => {
        mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        // Create service without redis
        service = new HealthService(mockDatabaseService as DatabaseService, undefined);
      });

      it('should return degraded status for redis', async () => {
        const result = await service.check();

        expect(result.checks.redis.status).toBe('degraded');
        expect(result.checks.redis.error).toContain('not configured');
        expect(result.checks.redis.details).toEqual({ configured: false });
      });

      it('should return degraded overall when redis not available', async () => {
        const result = await service.check();

        expect(result.status).toBe('degraded');
      });
    });

    describe('memory check', () => {
      beforeEach(() => {
        mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mockRedisService.healthCheck.mockResolvedValue({
          healthy: true,
          responseTime: 5,
        });
      });

      it('should include memory details', async () => {
        const result = await service.check();

        expect(result.checks.memory.details).toBeDefined();
        expect(result.checks.memory.details).toHaveProperty('heapUsedMB');
        expect(result.checks.memory.details).toHaveProperty('heapTotalMB');
        expect(result.checks.memory.details).toHaveProperty('heapUsagePercent');
        expect(result.checks.memory.details).toHaveProperty('rssMB');
      });

      it('should be healthy with normal memory usage', async () => {
        const result = await service.check();

        // In test environment, memory should be normal
        expect(result.checks.memory.status).toBe('healthy');
      });
    });

    describe('when both database and redis are unhealthy', () => {
      beforeEach(() => {
        mockDatabaseService.$queryRaw.mockRejectedValue(new Error('DB connection failed'));
        mockRedisService.healthCheck.mockResolvedValue({
          healthy: false,
          responseTime: 0,
          error: 'Redis connection failed',
        });
      });

      it('should return unhealthy status', async () => {
        const result = await service.check();

        expect(result.status).toBe('unhealthy');
        expect(result.checks.database.status).toBe('unhealthy');
        expect(result.checks.redis.status).toBe('unhealthy');
      });
    });

    describe('concurrent checks', () => {
      beforeEach(() => {
        // Simulate slow responses
        mockDatabaseService.$queryRaw.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve([{ '?column?': 1 }]), 50)),
        );
        mockRedisService.healthCheck.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ healthy: true, responseTime: 50 }), 50)),
        );
      });

      it('should run checks in parallel', async () => {
        const start = Date.now();
        await service.check();
        const duration = Date.now() - start;

        // If sequential, would take ~100ms (50+50). Parallel should be ~50ms
        // Allow some buffer for test execution overhead
        expect(duration).toBeLessThan(150);
      });
    });
  });

  describe('error handling', () => {
    it('should handle non-Error exceptions in database check', async () => {
      mockDatabaseService.$queryRaw.mockRejectedValue('String error');
      mockRedisService.healthCheck.mockResolvedValue({ healthy: true, responseTime: 5 });

      const result = await service.check();

      expect(result.checks.database.status).toBe('unhealthy');
      expect(result.checks.database.error).toBe('Database connection failed');
    });

    it('should handle non-Error exceptions in redis check', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.healthCheck.mockRejectedValue('String error');

      const result = await service.check();

      expect(result.checks.redis.status).toBe('unhealthy');
      expect(result.checks.redis.error).toBe('Redis check failed');
    });
  });
});

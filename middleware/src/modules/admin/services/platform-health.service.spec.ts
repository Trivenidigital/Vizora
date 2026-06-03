import { PlatformHealthService } from './platform-health.service';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../redis/redis.service';
import * as http from 'http';
import { EventEmitter } from 'events';

jest.mock('http', () => ({
  request: jest.fn(),
}));

describe('PlatformHealthService', () => {
  let service: PlatformHealthService;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(() => {
    mockDb = {
      $queryRaw: jest.fn(),
      adminAuditLog: {
        count: jest.fn(),
      },
    };

    mockRedis = {
      healthCheck: jest.fn(),
    };

    service = new PlatformHealthService(
      mockDb as DatabaseService,
      mockRedis as RedisService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockHttpStatus(statusCode = 200) {
    const request = new EventEmitter() as http.ClientRequest;
    request.end = jest.fn();
    request.destroy = jest.fn();

    const requestSpy = http.request as jest.MockedFunction<typeof http.request>;
    requestSpy.mockImplementation(((
      _options: http.RequestOptions,
      callback?: (res: http.IncomingMessage) => void,
    ) => {
      callback?.({ statusCode } as http.IncomingMessage);
      return request;
    }) as typeof http.request);

    return { requestSpy };
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkDatabase', () => {
    it('should return healthy status when database is connected', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.checkDatabase();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status when database fails', async () => {
      mockDb.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkDatabase();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('checkRedis', () => {
    it('should return Redis health check result', async () => {
      mockRedis.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 5,
      });

      const result = await service.checkRedis();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBe(5);
    });

    it('should handle Redis connection failure', async () => {
      mockRedis.healthCheck.mockResolvedValue({
        healthy: false,
        responseTime: 100,
        error: 'Redis not available',
      });

      const result = await service.checkRedis();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Redis not available');
    });
  });

  describe('getOverallHealth', () => {
    it('should return healthy when all services are up', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.healthCheck.mockResolvedValue({ healthy: true, responseTime: 5 });

      // Mock checkServicePort to return healthy
      jest.spyOn(service, 'checkServicePort').mockResolvedValue({
        name: 'middleware',
        port: 3000,
        status: 'healthy',
        responseTime: 10,
      });

      const result = await service.getOverallHealth();

      expect(result.overall).toBe('healthy');
      expect(result.services.database.healthy).toBe(true);
      expect(result.services.redis.healthy).toBe(true);
    });

    it('should return unhealthy when database is down', async () => {
      mockDb.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedis.healthCheck.mockResolvedValue({ healthy: true, responseTime: 5 });

      jest.spyOn(service, 'checkServicePort').mockResolvedValue({
        name: 'middleware',
        port: 3000,
        status: 'healthy',
        responseTime: 10,
      });

      const result = await service.getOverallHealth();

      expect(result.overall).toBe('unhealthy');
    });

    it('should return degraded when Redis is down', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.healthCheck.mockResolvedValue({ healthy: false, responseTime: 100, error: 'Redis down' });

      jest.spyOn(service, 'checkServicePort').mockResolvedValue({
        name: 'middleware',
        port: 3000,
        status: 'healthy',
        responseTime: 10,
      });

      const result = await service.getOverallHealth();

      expect(result.overall).toBe('degraded');
    });

    it('should return degraded when web is down', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.healthCheck.mockResolvedValue({ healthy: true, responseTime: 5 });

      jest.spyOn(service, 'checkServicePort')
        .mockResolvedValueOnce({
          name: 'middleware',
          port: 3000,
          status: 'healthy',
          responseTime: 10,
        })
        .mockResolvedValueOnce({
          name: 'web',
          port: 3001,
          status: 'unhealthy',
          responseTime: 10,
          error: 'Connection refused',
        })
        .mockResolvedValueOnce({
          name: 'realtime',
          port: 3002,
          status: 'healthy',
          responseTime: 10,
        });

      const result = await service.getOverallHealth();

      expect(result.overall).toBe('degraded');
      expect(result.services.web.status).toBe('unhealthy');
    });

    it('should return degraded when realtime is down', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.healthCheck.mockResolvedValue({ healthy: true, responseTime: 5 });

      jest.spyOn(service, 'checkServicePort')
        .mockResolvedValueOnce({
          name: 'middleware',
          port: 3000,
          status: 'healthy',
          responseTime: 10,
        })
        .mockResolvedValueOnce({
          name: 'web',
          port: 3001,
          status: 'healthy',
          responseTime: 10,
        })
        .mockResolvedValueOnce({
          name: 'realtime',
          port: 3002,
          status: 'unhealthy',
          responseTime: 10,
          error: 'Connection refused',
        });

      const result = await service.getOverallHealth();

      expect(result.overall).toBe('degraded');
      expect(result.services.realtime.status).toBe('unhealthy');
    });
  });

  describe('getServiceStatus', () => {
    it('should return status for all services', async () => {
      jest.spyOn(service, 'checkServicePort').mockResolvedValue({
        name: 'test',
        port: 3000,
        status: 'healthy',
        responseTime: 10,
      });

      const result = await service.getServiceStatus();

      expect(result).toHaveLength(3);
    });
  });

  describe('checkServicePort', () => {
    it('probes middleware at the versioned health path', async () => {
      const { requestSpy } = mockHttpStatus();

      const result = await service.checkServicePort('middleware', 3000);

      expect(result.status).toBe('healthy');
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'localhost',
          port: 3000,
          path: '/api/v1/health',
          method: 'GET',
        }),
        expect.any(Function),
      );
    });

    it('probes realtime at the prefixed gateway health path', async () => {
      const { requestSpy } = mockHttpStatus();

      const result = await service.checkServicePort('realtime', 3002);

      expect(result.status).toBe('healthy');
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'localhost',
          port: 3002,
          path: '/api/health',
          method: 'GET',
        }),
        expect.any(Function),
      );
    });

    it('probes web at the root page used by its container healthcheck', async () => {
      const { requestSpy } = mockHttpStatus();

      const result = await service.checkServicePort('web', 3001);

      expect(result.status).toBe('healthy');
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'localhost',
          port: 3001,
          path: '/',
          method: 'GET',
        }),
        expect.any(Function),
      );
    });

    it('keeps the legacy /health fallback for unknown service names', async () => {
      const { requestSpy } = mockHttpStatus();

      const result = await service.checkServicePort('custom-service', 3999);

      expect(result.status).toBe('healthy');
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'localhost',
          port: 3999,
          path: '/health',
          method: 'GET',
        }),
        expect.any(Function),
      );
    });
  });

  describe('getErrorRates', () => {
    it('should return error rate statistics', async () => {
      mockDb.adminAuditLog.count
        .mockResolvedValueOnce(100) // total actions
        .mockResolvedValueOnce(5); // error actions

      const result = await service.getErrorRates(24);

      expect(result.period).toBe('24h');
      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.errorRate).toBeDefined();
      expect(result.byType).toBeDefined();
    });
  });

  describe('getUptimeHistory', () => {
    it('should return uptime history for specified days', async () => {
      const result = await service.getUptimeHistory(7);

      expect(result).toHaveLength(7);
      expect(result[0].date).toBeDefined();
      expect(result[0].uptimePercent).toBeGreaterThanOrEqual(99);
      expect(result[0].downtime).toBeDefined();
    });

    it('should return history in chronological order', async () => {
      const result = await service.getUptimeHistory(3);

      const dates = result.map((h) => new Date(h.date).getTime());
      expect(dates[0]).toBeLessThan(dates[1]);
      expect(dates[1]).toBeLessThan(dates[2]);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthService>;

  const mockHealthyResponse = {
    status: 'ok' as const,
    timestamp: '2026-02-01T10:00:00.000Z',
    uptime: 3600,
    version: '1.0.0',
    checks: {
      database: { status: 'healthy' as const, responseTime: 5 },
      redis: { status: 'healthy' as const, responseTime: 3 },
      memory: {
        status: 'healthy' as const,
        responseTime: 0,
        details: {
          heapUsedMB: 50,
          heapTotalMB: 100,
          heapUsagePercent: 50,
          rssMB: 120,
        },
      },
    },
  };

  const mockUnhealthyResponse = {
    status: 'unhealthy' as const,
    timestamp: '2026-02-01T10:00:00.000Z',
    uptime: 3600,
    version: '1.0.0',
    checks: {
      database: { status: 'unhealthy' as const, responseTime: 100, error: 'Connection refused' },
      redis: { status: 'healthy' as const, responseTime: 3 },
      memory: { status: 'healthy' as const, responseTime: 0 },
    },
  };

  const mockDegradedResponse = {
    status: 'degraded' as const,
    timestamp: '2026-02-01T10:00:00.000Z',
    uptime: 3600,
    version: '1.0.0',
    checks: {
      database: { status: 'healthy' as const, responseTime: 5 },
      redis: { status: 'unhealthy' as const, responseTime: 10, error: 'Connection refused' },
      memory: { status: 'healthy' as const, responseTime: 0 },
    },
  };

  beforeEach(async () => {
    const mockHealthService = {
      check: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get(HealthService);
  });

  describe('health', () => {
    it('should return ok status', async () => {
      const result = await controller.health();

      expect(result.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const result = await controller.health();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('ready', () => {
    it('should return health response when healthy', async () => {
      healthService.check.mockResolvedValue(mockHealthyResponse);

      const result = await controller.ready();

      expect(result).toEqual(mockHealthyResponse);
      expect(result.status).toBe('ok');
    });

    it('should return health response when degraded', async () => {
      healthService.check.mockResolvedValue(mockDegradedResponse);

      const result = await controller.ready();

      expect(result).toEqual(mockDegradedResponse);
      expect(result.status).toBe('degraded');
    });

    it('should throw SERVICE_UNAVAILABLE when unhealthy', async () => {
      healthService.check.mockResolvedValue(mockUnhealthyResponse);

      await expect(controller.ready()).rejects.toThrow(HttpException);

      try {
        await controller.ready();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect((error as HttpException).getResponse()).toEqual(mockUnhealthyResponse);
      }
    });

    it('should include all checks in response', async () => {
      healthService.check.mockResolvedValue(mockHealthyResponse);

      const result = await controller.ready();

      expect(result.checks).toBeDefined();
      expect(result.checks.database).toBeDefined();
      expect(result.checks.redis).toBeDefined();
      expect(result.checks.memory).toBeDefined();
    });

    it('should include uptime and version', async () => {
      healthService.check.mockResolvedValue(mockHealthyResponse);

      const result = await controller.ready();

      expect(result.uptime).toBe(3600);
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('live', () => {
    it('should return ok status', async () => {
      const result = await controller.live();

      expect(result.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const result = await controller.live();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should always succeed (liveness check)', async () => {
      // Liveness should work even if health service is unavailable
      const result = await controller.live();

      expect(result.status).toBe('ok');
    });
  });
});

import { HealthService } from './health.service';
import { DatabaseService } from '../database/database.service';

describe('HealthService', () => {
  let service: HealthService;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockDatabaseService = {
      $queryRaw: jest.fn(),
    };

    service = new HealthService(mockDatabaseService as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return ok status when all checks pass', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.memory.status).toBe('healthy');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
    });

    it('should return unhealthy status when database fails', async () => {
      mockDatabaseService.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('unhealthy');
      expect(result.checks.database.error).toContain('Connection refused');
    });

    it('should include response time for database check', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result.checks.database.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include uptime in seconds', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include ISO timestamp', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include memory check', async () => {
      mockDatabaseService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result.checks.memory).toBeDefined();
      expect(result.checks.memory.status).toBe('healthy');
    });
  });
});

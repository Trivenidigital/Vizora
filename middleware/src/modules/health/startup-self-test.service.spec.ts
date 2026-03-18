import { Test, TestingModule } from '@nestjs/testing';
import { StartupSelfTestService } from './startup-self-test.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';

describe('StartupSelfTestService', () => {
  let service: StartupSelfTestService;
  let mockDb: Partial<DatabaseService>;
  let mockRedis: Partial<RedisService>;
  let mockStorage: Partial<StorageService>;

  beforeEach(async () => {
    mockDb = {
      $queryRaw: jest.fn().mockResolvedValue([{ count: 1n }]),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 1n }]),
    };

    mockRedis = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, responseTime: 2 }),
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue('ok'),
      del: jest.fn().mockResolvedValue(undefined),
    };

    mockStorage = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, bucket: 'vizora-assets' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartupSelfTestService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: RedisService, useValue: mockRedis },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<StartupSelfTestService>(StartupSelfTestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have no result before running', () => {
    expect(service.result).toBeNull();
    expect(service.isRunning).toBe(false);
  });

  describe('runSelfTest', () => {
    it('should return a SelfTestResult with all check categories', async () => {
      const result = await service.runSelfTest();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      expect(result.results.database).toBeDefined();
      expect(result.results.redis).toBeDefined();
      expect(result.results.minio).toBeDefined();
      expect(result.results.api_endpoints).toBeDefined();
      expect(result.results.templates).toBeDefined();
      expect(result.results.email).toBeDefined();
      expect(result.results.billing).toBeDefined();
      expect(result.results.id_consistency).toBeDefined();
    });

    it('should pass database check when DB is healthy', async () => {
      const result = await service.runSelfTest();
      expect(result.results.database.passed).toBe(true);
      expect(result.results.database.message).toContain('Database connected');
    });

    it('should fail database check when DB query fails', async () => {
      (mockDb.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const result = await service.runSelfTest();
      expect(result.results.database.passed).toBe(false);
      expect(result.results.database.message).toContain('Connection refused');
    });

    it('should pass redis check when Redis is healthy', async () => {
      const result = await service.runSelfTest();
      expect(result.results.redis.passed).toBe(true);
      expect(result.results.redis.message).toContain('Redis connected');
    });

    it('should fail redis check when SET/GET cycle fails', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue('wrong');

      const result = await service.runSelfTest();
      expect(result.results.redis.passed).toBe(false);
      expect(result.results.redis.message).toContain('SET/GET cycle failed');
    });

    it('should pass minio check when storage is healthy', async () => {
      const result = await service.runSelfTest();
      expect(result.results.minio.passed).toBe(true);
      expect(result.results.minio.message).toContain('MinIO connected');
    });

    it('should fail minio check when storage is unhealthy', async () => {
      (mockStorage.healthCheck as jest.Mock).mockResolvedValue({
        healthy: false,
        bucket: 'vizora-assets',
        error: 'Bucket not found',
      });

      const result = await service.runSelfTest();
      expect(result.results.minio.passed).toBe(false);
      expect(result.results.minio.message).toContain('Bucket not found');
    });

    it('should include failures array in api_endpoints result', async () => {
      const result = await service.runSelfTest();
      expect(result.results.api_endpoints.failures).toBeDefined();
      expect(Array.isArray(result.results.api_endpoints.failures)).toBe(true);
    });

    it('should include count in templates result', async () => {
      const result = await service.runSelfTest();
      expect(typeof result.results.templates.count).toBe('number');
    });

    it('should include configured flag in email result', async () => {
      const result = await service.runSelfTest();
      expect(typeof result.results.email.configured).toBe('boolean');
    });

    it('should include stripe and razorpay flags in billing result', async () => {
      const result = await service.runSelfTest();
      expect(typeof result.results.billing.stripe).toBe('boolean');
      expect(typeof result.results.billing.razorpay).toBe('boolean');
    });

    it('should include mismatches array in id_consistency result', async () => {
      const result = await service.runSelfTest();
      expect(result.results.id_consistency.mismatches).toBeDefined();
      expect(Array.isArray(result.results.id_consistency.mismatches)).toBe(true);
    });

    it('should store result after running', async () => {
      await service.runSelfTest();
      expect(service.result).not.toBeNull();
      expect(service.isRunning).toBe(false);
    });

    it('should set passed=false if any check fails', async () => {
      (mockDb.$queryRaw as jest.Mock).mockRejectedValue(new Error('fail'));

      const result = await service.runSelfTest();
      expect(result.passed).toBe(false);
    });
  });
});

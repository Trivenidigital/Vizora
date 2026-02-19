import { Test, TestingModule } from '@nestjs/testing';
import { HeartbeatService } from './heartbeat.service';
import { RedisService } from './redis.service';
import { DatabaseService } from '../database/database.service';

describe('HeartbeatService', () => {
  let service: HeartbeatService;

  const mockRedisService = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    increment: jest.fn().mockResolvedValue(1),
  };

  const mockDatabaseService = {
    display: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    contentImpression: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeartbeatService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<HeartbeatService>(HeartbeatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processHeartbeat', () => {
    it('should store heartbeat in Redis with 5-minute TTL', async () => {
      const data = {
        metrics: { cpuUsage: 50, memoryUsage: 60 },
        currentContent: { contentId: 'c-1' },
      };

      await service.processHeartbeat('device-1', data as any);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'heartbeat:device-1:latest',
        expect.any(String),
        300,
      );
    });

    it('should include device ID and timestamp in stored data', async () => {
      await service.processHeartbeat('device-1', {} as any);

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData.deviceId).toBe('device-1');
      expect(storedData.timestamp).toBeDefined();
      expect(typeof storedData.timestamp).toBe('number');
    });

    it('should include metrics and currentContent in stored data', async () => {
      const data = {
        metrics: { cpuUsage: 75 },
        currentContent: { contentId: 'c-2', status: 'playing' },
      };

      await service.processHeartbeat('device-1', data as any);

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData.metrics).toEqual({ cpuUsage: 75 });
      expect(storedData.currentContent).toEqual({ contentId: 'c-2', status: 'playing' });
    });

    it('should not throw when Redis fails', async () => {
      mockRedisService.set.mockRejectedValueOnce(new Error('Redis down'));

      await expect(
        service.processHeartbeat('device-1', {} as any),
      ).resolves.not.toThrow();
    });
  });

  describe('logImpression', () => {
    it('should increment daily impression counter in Redis', async () => {
      await service.logImpression('device-1', { contentId: 'c-1' } as any);

      expect(mockRedisService.increment).toHaveBeenCalledWith(
        expect.stringMatching(/^stats:device:device-1:impressions:\d{4}-\d{2}-\d{2}$/),
        86400,
      );
    });

    it('should persist impression to database when device exists', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        organizationId: 'org-1',
      });

      const data = {
        contentId: 'c-1',
        playlistId: 'p-1',
        duration: 10,
        completionPercentage: 100,
      };

      await service.logImpression('device-1', data as any);

      expect(mockDatabaseService.contentImpression.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          contentId: 'c-1',
          displayId: 'device-1',
          playlistId: 'p-1',
          duration: 10,
          completionPercentage: 100,
        }),
      });
    });

    it('should not persist impression when device not found', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValueOnce(null);

      await service.logImpression('device-1', { contentId: 'c-1' } as any);

      expect(mockDatabaseService.contentImpression.create).not.toHaveBeenCalled();
    });

    it('should handle null optional fields gracefully', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        organizationId: 'org-1',
      });

      await service.logImpression('device-1', { contentId: 'c-1' } as any);

      expect(mockDatabaseService.contentImpression.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          playlistId: null,
          duration: null,
          completionPercentage: null,
        }),
      });
    });

    it('should not throw when Redis increment fails', async () => {
      mockRedisService.increment.mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        service.logImpression('device-1', { contentId: 'c-1' } as any),
      ).resolves.not.toThrow();
    });

    it('should not throw when database create fails', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        organizationId: 'org-1',
      });
      mockDatabaseService.contentImpression.create.mockRejectedValueOnce(
        new Error('DB constraint violation'),
      );

      await expect(
        service.logImpression('device-1', { contentId: 'c-1' } as any),
      ).resolves.not.toThrow();
    });
  });

  describe('logError', () => {
    it('should store error in Redis with 1-hour TTL', async () => {
      const data = { contentId: 'c-1', errorType: 'load_failed', errorMessage: 'timeout' };

      await service.logError('device-1', data as any);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'errors:device:device-1',
        expect.any(String),
        3600,
      );
    });

    it('should append error to existing errors list', async () => {
      const existingErrors = [
        { deviceId: 'device-1', errorType: 'old_error', timestamp: 1000 },
      ];
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(existingErrors));

      const data = { contentId: 'c-1', errorType: 'new_error' };

      await service.logError('device-1', data as any);

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData).toHaveLength(2);
      expect(storedData[0].errorType).toBe('old_error');
      expect(storedData[1].errorType).toBe('new_error');
    });

    it('should keep only last 10 errors', async () => {
      const existingErrors = Array.from({ length: 10 }, (_, i) => ({
        deviceId: 'device-1',
        errorType: `error_${i}`,
        timestamp: i * 1000,
      }));
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(existingErrors));

      const data = { contentId: 'c-1', errorType: 'new_error' };

      await service.logError('device-1', data as any);

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData).toHaveLength(10);
      // First entry should be error_1 (error_0 was shifted out)
      expect(storedData[0].errorType).toBe('error_1');
      expect(storedData[9].errorType).toBe('new_error');
    });

    it('should handle empty existing errors', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      await service.logError('device-1', { contentId: 'c-1', errorType: 'test' } as any);

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData).toHaveLength(1);
    });

    it('should include device ID and timestamp in stored error', async () => {
      const data = { contentId: 'c-1', errorType: 'decode_error' };

      await service.logError('device-1', data as any);

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData[0].deviceId).toBe('device-1');
      expect(storedData[0].timestamp).toBeDefined();
    });

    it('should not throw when Redis fails', async () => {
      mockRedisService.get.mockRejectedValueOnce(new Error('Redis down'));

      await expect(
        service.logError('device-1', { contentId: 'c-1', errorType: 'test' } as any),
      ).resolves.not.toThrow();
    });
  });

  describe('getDeviceHealth', () => {
    it('should return offline status when no heartbeat found', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      const result = await service.getDeviceHealth('device-1');

      expect(result.status).toBe('offline');
      expect(result.lastSeen).toBeNull();
    });

    it('should return online status when heartbeat is recent (< 60s)', async () => {
      const heartbeat = {
        deviceId: 'device-1',
        timestamp: Date.now() - 30000, // 30 seconds ago
        metrics: { cpuUsage: 50 },
        currentContent: { contentId: 'c-1' },
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(heartbeat));

      const result = await service.getDeviceHealth('device-1');

      expect(result.status).toBe('online');
      expect(result.lastSeen).toBeDefined();
      expect(result.metrics).toEqual({ cpuUsage: 50 });
      expect(result.currentContent).toEqual({ contentId: 'c-1' });
    });

    it('should return offline status when heartbeat is stale (> 60s)', async () => {
      const heartbeat = {
        deviceId: 'device-1',
        timestamp: Date.now() - 120000, // 2 minutes ago
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(heartbeat));

      const result = await service.getDeviceHealth('device-1');

      expect(result.status).toBe('offline');
      expect(result.lastSeen).toBeDefined();
    });

    it('should return unknown status on Redis error', async () => {
      mockRedisService.get.mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await service.getDeviceHealth('device-1');

      expect(result.status).toBe('unknown');
      expect(result.lastSeen).toBeNull();
      expect(result.error).toContain('Redis connection failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockRedisService.get.mockRejectedValueOnce('string error');

      const result = await service.getDeviceHealth('device-1');

      expect(result.status).toBe('unknown');
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('getDeviceStats', () => {
    it('should return impressions count and errors', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('42') // impressions
        .mockResolvedValueOnce(
          JSON.stringify([
            { errorType: 'load_failed', timestamp: Date.now() },
            { errorType: 'timeout', timestamp: Date.now() },
          ]),
        );

      const result = await service.getDeviceStats('device-1');

      expect(result.impressions).toBe(42);
      expect(result.errors).toBe(2);
      expect(result.recentErrors).toHaveLength(2);
    });

    it('should return 0 impressions when no counter exists', async () => {
      mockRedisService.get
        .mockResolvedValueOnce(null) // no impressions
        .mockResolvedValueOnce(null); // no errors

      const result = await service.getDeviceStats('device-1');

      expect(result.impressions).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.recentErrors).toHaveLength(0);
    });

    it('should return only last 5 recent errors', async () => {
      const errors = Array.from({ length: 8 }, (_, i) => ({
        errorType: `error_${i}`,
        timestamp: i * 1000,
      }));
      mockRedisService.get
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce(JSON.stringify(errors));

      const result = await service.getDeviceStats('device-1');

      expect(result.recentErrors).toHaveLength(5);
      // Should return the last 5 (indices 3-7)
      expect(result.recentErrors[0].errorType).toBe('error_3');
    });

    it('should return defaults on Redis error', async () => {
      mockRedisService.get.mockRejectedValueOnce(new Error('Redis down'));

      const result = await service.getDeviceStats('device-1');

      expect(result.impressions).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.recentErrors).toHaveLength(0);
    });

    it('should handle non-Error exception', async () => {
      mockRedisService.get.mockRejectedValueOnce('string error');

      const result = await service.getDeviceStats('device-1');

      expect(result.impressions).toBe(0);
    });
  });
});

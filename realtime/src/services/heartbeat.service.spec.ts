import { Test, TestingModule } from '@nestjs/testing';
import { DEVICE_OFFLINE_THRESHOLD_MS } from '@vizora/database';
import { HeartbeatService } from './heartbeat.service';
import { RedisService } from './redis.service';
import { ClickHouseService } from './clickhouse.service';
import { DatabaseService } from '../database/database.service';

describe('HeartbeatService', () => {
  let service: HeartbeatService;

  const mockRedisService = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    increment: jest.fn().mockResolvedValue(1),
  };

  const mockClickHouseService = {
    enqueueDeviceHealthSample: jest.fn(),
  };

  const mockDatabaseService = {
    display: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    contentImpression: {
      create: jest.fn().mockResolvedValue({}),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeartbeatService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: ClickHouseService, useValue: mockClickHouseService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<HeartbeatService>(HeartbeatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('appVersion persistence (TV2 — which build is each screen running)', () => {
    const sqlOf = (call: any[]) => (call[0] as string[]).join('?');

    it('persists the reported appVersion onto the device row', async () => {
      await service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any);

      expect(mockDatabaseService.$executeRaw).toHaveBeenCalledTimes(1);
      const call = mockDatabaseService.$executeRaw.mock.calls[0];
      expect(call).toContain('1.3.12');
      expect(call).toContain('device-1');
    });

    it('MERGES into metadata rather than replacing it, in a single statement', async () => {
      // A read-modify-write would clobber concurrent writers owning other keys —
      // the bug FeatureFlagsService.setFlags was rewritten to fix.
      await service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any);

      const sql = sqlOf(mockDatabaseService.$executeRaw.mock.calls[0]);
      expect(sql).toMatch(/\|\|/);                       // jsonb shallow-merge
      expect(sql).toMatch(/COALESCE\("metadata"/);        // null-safe
      expect(sql).toMatch(/jsonb_build_object\('appVersion'/);
      expect(mockDatabaseService.display.findUnique).not.toHaveBeenCalled();
    });

    it('does NOT write again while the version is unchanged', async () => {
      // Heartbeats arrive every 15s; the version changes once per upgrade.
      for (let i = 0; i < 5; i++) {
        await service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any);
      }
      expect(mockDatabaseService.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('writes again when the device reports a new version', async () => {
      await service.processHeartbeat('device-1', { appVersion: '1.3.11' } as any);
      await service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any);

      expect(mockDatabaseService.$executeRaw).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.$executeRaw.mock.calls[1]).toContain('1.3.12');
    });

    it('dedups per device, not globally', async () => {
      await service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any);
      await service.processHeartbeat('device-2', { appVersion: '1.3.12' } as any);

      expect(mockDatabaseService.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('skips the write when the device reports no version', async () => {
      await service.processHeartbeat('device-1', { metrics: { cpuUsage: 1 } } as any);
      await service.processHeartbeat('device-1', { appVersion: '   ' } as any);

      expect(mockDatabaseService.$executeRaw).not.toHaveBeenCalled();
    });

    it('refuses an over-long version rather than writing it into JSONB', async () => {
      await service.processHeartbeat('device-1', { appVersion: 'v'.repeat(65) } as any);
      expect(mockDatabaseService.$executeRaw).not.toHaveBeenCalled();
    });

    it('is fail-open: a write failure neither throws nor is cached as done', async () => {
      mockDatabaseService.$executeRaw.mockRejectedValueOnce(new Error('db down'));

      // Must not throw — a failed heartbeat is what the offline scanner turns
      // into a false "device offline".
      await expect(
        service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any),
      ).resolves.toBeUndefined();

      // Redis + ClickHouse still ran.
      expect(mockRedisService.set).toHaveBeenCalled();

      // Not cached, so the next heartbeat retries.
      await service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any);
      expect(mockDatabaseService.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('forgetDevice clears the dedup so a reconnecting device re-persists', async () => {
      await service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any);
      expect(mockDatabaseService.$executeRaw).toHaveBeenCalledTimes(1);

      service.forgetDevice('device-1');

      await service.processHeartbeat('device-1', { appVersion: '1.3.12' } as any);
      expect(mockDatabaseService.$executeRaw).toHaveBeenCalledTimes(2);
    });
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

    it('enqueues a ClickHouse device-health sample when organizationId is provided', async () => {
      const data = {
        metrics: { cpuUsage: 42, memoryUsage: 71, temperature: 55 },
        currentContent: { contentId: 'c-1' },
      };

      await service.processHeartbeat('device-1', data as any, 'org-1');

      expect(mockClickHouseService.enqueueDeviceHealthSample).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'device-1',
          organizationId: 'org-1',
          cpu: 42,
          memory: 71,
          temperature: 55,
          status: 'online',
        }),
      );
    });

    it('does NOT enqueue a ClickHouse sample when organizationId is absent', async () => {
      await service.processHeartbeat('device-1', {} as any);

      expect(mockClickHouseService.enqueueDeviceHealthSample).not.toHaveBeenCalled();
    });

    it('still writes Redis + does not throw when the ClickHouse writer throws (fail-open)', async () => {
      mockClickHouseService.enqueueDeviceHealthSample.mockImplementationOnce(() => {
        throw new Error('clickhouse buffer error');
      });

      await expect(
        service.processHeartbeat('device-1', {} as any, 'org-1'),
      ).resolves.not.toThrow();

      // Redis heartbeat still stored despite the ClickHouse writer throwing.
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'heartbeat:device-1:latest',
        expect.any(String),
        300,
      );
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

    it('should persist impression without display lookup when organization context is provided', async () => {
      const data = {
        contentId: 'c-1',
        playlistId: 'p-1',
      };

      await service.logImpression('device-1', data as any, 'org-from-socket');

      expect(mockDatabaseService.display.findUnique).not.toHaveBeenCalled();
      expect(mockDatabaseService.contentImpression.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-from-socket',
          contentId: 'c-1',
          displayId: 'device-1',
          playlistId: 'p-1',
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

    it('should redact device tokens before storing errors', async () => {
      const data = {
        contentId: 'c-1',
        errorType: 'decode_error',
        errorMessage: 'failed /api/v1/device-content/c-1/file?token=device-jwt',
        context: {
          url: '/api/v1/device-content/c-1/file?variant=original&token=device-jwt',
        },
      };

      await service.logError('device-1', data as any);

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData[0].errorMessage).toBe(
        'failed /api/v1/device-content/c-1/file?token=[redacted]',
      );
      expect(storedData[0].context.url).toBe(
        '/api/v1/device-content/c-1/file?variant=original&token=[redacted]',
      );
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

    it('should return online status when heartbeat is within the offline threshold', async () => {
      const heartbeat = {
        deviceId: 'device-1',
        timestamp: Date.now() - 30000, // 30s ago — well inside the threshold
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

    it('should return offline status when heartbeat is older than the shared offline threshold', async () => {
      const heartbeat = {
        deviceId: 'device-1',
        timestamp: Date.now() - (DEVICE_OFFLINE_THRESHOLD_MS + 30000), // clearly past
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(heartbeat));

      const result = await service.getDeviceHealth('device-1');

      expect(result.status).toBe('offline');
      expect(result.lastSeen).toBeDefined();
    });

    it('uses the shared 120s threshold — a 90s-stale device now reads online (was offline at 60s)', async () => {
      // Regression guard for the unification: 60–120s-stale devices previously
      // read offline here while the middleware cron read them online. Both now
      // route through DEVICE_OFFLINE_THRESHOLD_MS (120s).
      expect(DEVICE_OFFLINE_THRESHOLD_MS).toBe(120000);
      const heartbeat = {
        deviceId: 'device-1',
        timestamp: Date.now() - 90000, // 90s ago — between the old 60s and new 120s
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(heartbeat));

      const result = await service.getDeviceHealth('device-1');

      expect(result.status).toBe('online');
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

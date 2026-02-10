import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { RedisService } from './redis.service';
import { DatabaseService } from '../database/database.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const mockRedisService = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    getRedis: jest.fn().mockReturnValue({
      scan: jest.fn().mockResolvedValue(['0', []]),
    }),
  };

  const mockDatabaseService = {
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should start the periodic notification check', async () => {
      await service.onModuleInit();
      expect((service as any).intervalId).toBeDefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear the interval', async () => {
      await service.onModuleInit();
      expect((service as any).intervalId).toBeDefined();

      await service.onModuleDestroy();
      expect((service as any).intervalId).toBeNull();
    });

    it('should handle being called without init', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('scheduleOfflineNotification', () => {
    it('should store notification data in Redis with 5-minute TTL', async () => {
      await service.scheduleOfflineNotification('device-1', 'Test Device', 'org-1');

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'notify:offline:device-1',
        expect.any(String),
        300,
      );
    });

    it('should store correct notification data', async () => {
      await service.scheduleOfflineNotification('device-1', 'Test Device', 'org-1');

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData.deviceId).toBe('device-1');
      expect(storedData.deviceName).toBe('Test Device');
      expect(storedData.organizationId).toBe('org-1');
      expect(storedData.scheduledFor).toBeGreaterThan(storedData.disconnectedAt);
    });

    it('should schedule notification for 2 minutes in the future', async () => {
      const before = Date.now();
      await service.scheduleOfflineNotification('device-1', 'Test', 'org-1');

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      const delay = storedData.scheduledFor - storedData.disconnectedAt;
      expect(delay).toBe(120000); // 2 minutes
    });
  });

  describe('cancelOfflineNotification', () => {
    it('should delete the notification key and return true when it exists', async () => {
      mockRedisService.exists.mockResolvedValueOnce(true);

      const result = await service.cancelOfflineNotification('device-1');

      expect(result).toBe(true);
      expect(mockRedisService.delete).toHaveBeenCalledWith('notify:offline:device-1');
    });

    it('should return false when notification does not exist', async () => {
      mockRedisService.exists.mockResolvedValueOnce(false);

      const result = await service.cancelOfflineNotification('device-1');

      expect(result).toBe(false);
      expect(mockRedisService.delete).not.toHaveBeenCalled();
    });
  });

  describe('wasDeviceOfflineLong', () => {
    it('should return false when no notification exists', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      const result = await service.wasDeviceOfflineLong('device-1');

      expect(result).toBe(false);
    });

    it('should return true when scheduled time has passed', async () => {
      const data = {
        deviceId: 'device-1',
        scheduledFor: Date.now() - 1000, // already past
        disconnectedAt: Date.now() - 121000,
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(data));

      const result = await service.wasDeviceOfflineLong('device-1');

      expect(result).toBe(true);
    });

    it('should return false when scheduled time has not passed', async () => {
      const data = {
        deviceId: 'device-1',
        scheduledFor: Date.now() + 60000, // 1 minute in future
        disconnectedAt: Date.now(),
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(data));

      const result = await service.wasDeviceOfflineLong('device-1');

      expect(result).toBe(false);
    });

    it('should return false when JSON parsing fails', async () => {
      mockRedisService.get.mockResolvedValueOnce('invalid json');

      const result = await service.wasDeviceOfflineLong('device-1');

      expect(result).toBe(false);
    });
  });

  describe('checkPendingNotifications', () => {
    it('should process notifications that are due', async () => {
      const data = {
        deviceId: 'device-1',
        deviceName: 'Test Device',
        organizationId: 'org-1',
        scheduledFor: Date.now() - 1000, // already due
        disconnectedAt: Date.now() - 121000,
      };
      mockRedisService.getRedis.mockReturnValue({
        scan: jest.fn().mockResolvedValue(['0', ['notify:offline:device-1']]),
      });
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(data));

      await service.checkPendingNotifications();

      expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Device Offline',
          type: 'device_offline',
          severity: 'warning',
          organizationId: 'org-1',
        }),
      });
      expect(mockRedisService.delete).toHaveBeenCalled();
    });

    it('should not process notifications that are not yet due', async () => {
      const data = {
        deviceId: 'device-1',
        deviceName: 'Test Device',
        organizationId: 'org-1',
        scheduledFor: Date.now() + 60000, // 1 minute in future
        disconnectedAt: Date.now(),
      };
      mockRedisService.getRedis.mockReturnValue({
        scan: jest.fn().mockResolvedValue(['0', ['notify:offline:device-1']]),
      });
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(data));

      await service.checkPendingNotifications();

      expect(mockDatabaseService.notification.create).not.toHaveBeenCalled();
    });

    it('should skip entries where get returns null', async () => {
      mockRedisService.getRedis.mockReturnValue({
        scan: jest.fn().mockResolvedValue(['0', ['notify:offline:device-1']]),
      });
      mockRedisService.get.mockResolvedValueOnce(null);

      await service.checkPendingNotifications();

      expect(mockDatabaseService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle scan errors gracefully', async () => {
      mockRedisService.getRedis.mockReturnValue({
        scan: jest.fn().mockRejectedValue(new Error('Redis error')),
      });

      await expect(service.checkPendingNotifications()).resolves.not.toThrow();
    });

    it('should handle individual key processing errors', async () => {
      mockRedisService.getRedis.mockReturnValue({
        scan: jest.fn().mockResolvedValue(['0', ['notify:offline:device-1']]),
      });
      mockRedisService.get.mockResolvedValueOnce('invalid json{{{');

      await expect(service.checkPendingNotifications()).resolves.not.toThrow();
    });
  });

  describe('createOnlineNotification', () => {
    it('should create an online notification in the database', async () => {
      await service.createOnlineNotification('device-1', 'Test Device', 'org-1');

      expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Device Online',
          message: expect.stringContaining('Test Device'),
          type: 'device_online',
          severity: 'info',
          organizationId: 'org-1',
          metadata: expect.objectContaining({
            deviceId: 'device-1',
            deviceName: 'Test Device',
          }),
        }),
      });
    });
  });

  describe('getNotificationForEmit', () => {
    it('should query database by notification ID', async () => {
      mockDatabaseService.notification.findUnique.mockResolvedValueOnce({
        id: 'notif-1',
        title: 'Test',
      });

      const result = await service.getNotificationForEmit('notif-1');

      expect(mockDatabaseService.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
      expect(result).toEqual({ id: 'notif-1', title: 'Test' });
    });

    it('should return null when notification not found', async () => {
      const result = await service.getNotificationForEmit('nonexistent');

      expect(result).toBeNull();
    });
  });
});

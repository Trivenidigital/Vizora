import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DatabaseService } from '../database/database.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let db: any;

  const organizationId = 'org-123';

  const mockNotification = {
    id: 'notif-1',
    title: 'Test Notification',
    message: 'This is a test notification',
    type: 'system',
    severity: 'info',
    read: false,
    dismissedAt: null,
    metadata: null,
    organizationId,
    userId: null,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    db = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    service = new NotificationsService(db as unknown as DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification with default values', async () => {
      const createDto = {
        title: 'New Notification',
        message: 'Message body',
        organizationId,
      };
      db.notification.create.mockResolvedValue({
        id: 'notif-new',
        ...createDto,
        type: 'system',
        severity: 'info',
        read: false,
        dismissedAt: null,
        createdAt: new Date(),
      });

      const result = await service.create(createDto);

      expect(result.id).toBe('notif-new');
      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Notification',
          message: 'Message body',
          type: 'system',
          severity: 'info',
          organizationId,
        }),
      });
    });

    it('should create a notification with custom type and severity', async () => {
      const createDto = {
        title: 'Device Alert',
        message: 'Device went offline',
        type: 'device_offline',
        severity: 'warning',
        organizationId,
      };
      db.notification.create.mockResolvedValue({ id: 'notif-2', ...createDto });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'device_offline',
          severity: 'warning',
        }),
      });
    });

    it('should create a notification with metadata', async () => {
      const createDto = {
        title: 'Device Alert',
        message: 'Device went offline',
        metadata: { deviceId: 'device-123', deviceName: 'Lobby Screen' },
        organizationId,
      };
      db.notification.create.mockResolvedValue({ id: 'notif-3', ...createDto });

      await service.create(createDto);

      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { deviceId: 'device-123', deviceName: 'Lobby Screen' },
        }),
      });
    });

    it('should create a notification with userId', async () => {
      const createDto = {
        title: 'User Alert',
        message: 'Personal notification',
        userId: 'user-123',
        organizationId,
      };
      db.notification.create.mockResolvedValue({ id: 'notif-4', ...createDto });

      await service.create(createDto);

      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      db.notification.findMany.mockResolvedValue([mockNotification]);
      db.notification.count.mockResolvedValue(1);

      const result = await service.findAll(organizationId, {}, { page: 1, limit: 10 });

      expect(result.data).toEqual([mockNotification]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter by read status', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await service.findAll(organizationId, { read: false }, { page: 1, limit: 10 });

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, read: false },
        }),
      );
    });

    it('should filter by severity', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await service.findAll(organizationId, { severity: 'warning' }, { page: 1, limit: 10 });

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, severity: 'warning' },
        }),
      );
    });

    it('should ignore invalid severity filter', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await service.findAll(organizationId, { severity: 'invalid' }, { page: 1, limit: 10 });

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId },
        }),
      );
    });

    it('should use default pagination values', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await service.findAll(organizationId, {});

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should handle pagination offset correctly', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await service.findAll(organizationId, {}, { page: 3, limit: 5 });

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should combine multiple filters', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await service.findAll(organizationId, { read: true, severity: 'critical' });

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, read: true, severity: 'critical' },
        }),
      );
    });

    it('should order by createdAt descending', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await service.findAll(organizationId);

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      db.notification.findFirst.mockResolvedValue(mockNotification);

      const result = await service.findOne(organizationId, 'notif-1');

      expect(result).toEqual(mockNotification);
      expect(db.notification.findFirst).toHaveBeenCalledWith({
        where: { id: 'notif-1', organizationId },
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      db.notification.findFirst.mockResolvedValue(null);

      await expect(service.findOne(organizationId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      db.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(organizationId);

      expect(result).toBe(5);
      expect(db.notification.count).toHaveBeenCalledWith({
        where: {
          organizationId,
          read: false,
          dismissedAt: null,
        },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      db.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(organizationId);

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      db.notification.findFirst.mockResolvedValue(mockNotification);
      db.notification.update.mockResolvedValue({ ...mockNotification, read: true });

      const result = await service.markAsRead(organizationId, 'notif-1');

      expect(result.read).toBe(true);
      expect(db.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { read: true },
      });
    });

    it('should throw NotFoundException for nonexistent notification', async () => {
      db.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead(organizationId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 10 });

      const result = await service.markAllAsRead(organizationId);

      expect(result.updated).toBe(10);
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: { organizationId, read: false },
        data: { read: true },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead(organizationId);

      expect(result.updated).toBe(0);
    });
  });

  describe('dismiss', () => {
    it('should dismiss a notification', async () => {
      const dismissedAt = new Date();
      db.notification.findFirst.mockResolvedValue(mockNotification);
      db.notification.update.mockResolvedValue({ ...mockNotification, dismissedAt });

      const result = await service.dismiss(organizationId, 'notif-1');

      expect(result.dismissedAt).toBeDefined();
      expect(db.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { dismissedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException for nonexistent notification', async () => {
      db.notification.findFirst.mockResolvedValue(null);

      await expect(service.dismiss(organizationId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createDeviceOfflineNotification', () => {
    it('should create a device offline notification', async () => {
      db.notification.create.mockResolvedValue({
        id: 'notif-offline',
        title: 'Device Offline',
        message: 'Device "Lobby Screen" has gone offline.',
        type: 'device_offline',
        severity: 'warning',
        metadata: { deviceId: 'device-123', deviceName: 'Lobby Screen' },
        organizationId,
      });

      const result = await service.createDeviceOfflineNotification(
        'device-123',
        'Lobby Screen',
        organizationId,
      );

      expect(result.type).toBe('device_offline');
      expect(result.severity).toBe('warning');
      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Device Offline',
          type: 'device_offline',
          severity: 'warning',
          metadata: { deviceId: 'device-123', deviceName: 'Lobby Screen' },
        }),
      });
    });
  });

  describe('createDeviceOnlineNotification', () => {
    it('should create a device online notification', async () => {
      db.notification.create.mockResolvedValue({
        id: 'notif-online',
        title: 'Device Online',
        message: 'Device "Lobby Screen" is back online.',
        type: 'device_online',
        severity: 'info',
        metadata: { deviceId: 'device-123', deviceName: 'Lobby Screen' },
        organizationId,
      });

      const result = await service.createDeviceOnlineNotification(
        'device-123',
        'Lobby Screen',
        organizationId,
      );

      expect(result.type).toBe('device_online');
      expect(result.severity).toBe('info');
      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Device Online',
          type: 'device_online',
          severity: 'info',
        }),
      });
    });
  });

  describe('createContentExpiredNotification', () => {
    it('should create a content expired notification', async () => {
      db.notification.create.mockResolvedValue({
        id: 'notif-expired',
        title: 'Content Expired',
        type: 'content_expired',
        severity: 'warning',
        organizationId,
      });

      const result = await service.createContentExpiredNotification(
        'content-123',
        'Promo Banner',
        organizationId,
      );

      expect(result.type).toBe('content_expired');
      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'content_expired',
          metadata: { contentId: 'content-123', contentName: 'Promo Banner' },
        }),
      });
    });
  });

  describe('createSystemNotification', () => {
    it('should create a system notification with default severity', async () => {
      db.notification.create.mockResolvedValue({
        id: 'notif-system',
        title: 'System Update',
        type: 'system',
        severity: 'info',
        organizationId,
      });

      const result = await service.createSystemNotification(
        'System Update',
        'A new version is available',
        organizationId,
      );

      expect(result.type).toBe('system');
      expect(result.severity).toBe('info');
    });

    it('should create a system notification with custom severity', async () => {
      db.notification.create.mockResolvedValue({
        id: 'notif-critical',
        title: 'Critical Alert',
        type: 'system',
        severity: 'critical',
        organizationId,
      });

      const result = await service.createSystemNotification(
        'Critical Alert',
        'Immediate attention required',
        organizationId,
        'critical',
      );

      expect(result.severity).toBe('critical');
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old dismissed notifications', async () => {
      db.notification.deleteMany.mockResolvedValue({ count: 50 });

      const result = await service.cleanupOldNotifications(30);

      expect(result.deleted).toBe(50);
      expect(db.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          dismissedAt: { not: null, lt: expect.any(Date) },
        },
      });
    });

    it('should use default days parameter', async () => {
      db.notification.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOldNotifications();

      expect(db.notification.deleteMany).toHaveBeenCalled();
    });
  });
});

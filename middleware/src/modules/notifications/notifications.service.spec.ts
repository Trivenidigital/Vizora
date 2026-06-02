import { NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { DatabaseService } from '../database/database.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let db: any;
  let mockHttpService: any;

  const organizationId = 'org-123';
  const userId = 'user-123';
  const visibleNotificationWhere = (extra: Record<string, unknown> = {}) => ({
    organizationId,
    dismissedAt: null,
    OR: [{ userId: null }, { userId }],
    ...extra,
  });
  const scopedNotificationWhere = (extra: Record<string, unknown> = {}) => ({
    organizationId,
    OR: [{ userId: null }, { userId }],
    ...extra,
  });

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
      user: {
        findFirst: jest.fn(),
      },
    };

    mockHttpService = {
      post: jest.fn().mockReturnValue(of({ data: { success: true } })),
    };

    service = new NotificationsService(
      db as unknown as DatabaseService,
      mockHttpService,
    );
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
      db.user.findFirst.mockResolvedValue({ id: 'user-123', organizationId });
      db.notification.create.mockResolvedValue({ id: 'notif-4', ...createDto });

      await service.create(createDto);

      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
        }),
      });
    });

    it('broadcasts the new notification to the realtime gateway', async () => {
      const created = { id: 'notif-1', title: 'Test', organizationId };
      db.notification.create.mockResolvedValue(created);

      const prevSecret = process.env.INTERNAL_API_SECRET;
      process.env.INTERNAL_API_SECRET = 'test-internal-secret';
      try {
        await service.create({ title: 'Test', message: 'Hello', organizationId });
      } finally {
        if (prevSecret === undefined) {
          delete process.env.INTERNAL_API_SECRET;
        } else {
          process.env.INTERNAL_API_SECRET = prevSecret;
        }
      }

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/broadcast'),
        { organizationId, notification: created },
        expect.objectContaining({
          headers: { 'x-internal-api-key': 'test-internal-secret' },
        }),
      );
    });

    it('does not broadcast when INTERNAL_API_SECRET is unset', async () => {
      db.notification.create.mockResolvedValue({ id: 'notif-1' });

      const prevSecret = process.env.INTERNAL_API_SECRET;
      delete process.env.INTERNAL_API_SECRET;
      try {
        await service.create({ title: 'Test', message: 'Hello', organizationId });
      } finally {
        if (prevSecret !== undefined) {
          process.env.INTERNAL_API_SECRET = prevSecret;
        }
      }

      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('does not throw when the realtime broadcast fails (fire-and-forget)', async () => {
      db.notification.create.mockResolvedValue({ id: 'notif-1' });
      // The realtime call is firstValueFrom(httpService.post(...)); model the
      // real failure mode as a rejected observable, not a synchronous throw.
      mockHttpService.post.mockReturnValue(throwError(() => new Error('realtime down')));

      const prevSecret = process.env.INTERNAL_API_SECRET;
      process.env.INTERNAL_API_SECRET = 'test-internal-secret';
      try {
        await expect(
          service.create({ title: 'Test', message: 'Hello', organizationId }),
        ).resolves.toEqual({ id: 'notif-1' });
      } finally {
        if (prevSecret === undefined) {
          delete process.env.INTERNAL_API_SECRET;
        } else {
          process.env.INTERNAL_API_SECRET = prevSecret;
        }
      }
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      db.notification.findMany.mockResolvedValue([mockNotification]);
      db.notification.count.mockResolvedValue(1);

      const result = await (service as any).findAll(
        organizationId,
        userId,
        {},
        { page: 1, limit: 10 },
      );

      expect(result.data).toEqual([mockNotification]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter by read status', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await (service as any).findAll(
        organizationId,
        userId,
        { read: false },
        { page: 1, limit: 10 },
      );

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: visibleNotificationWhere({ read: false }),
        }),
      );
    });

    it('should filter dismissed notifications before pagination and hide other users personal rows', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await (service as any).findAll(organizationId, userId, {}, { page: 2, limit: 5 });

      const expectedWhere = visibleNotificationWhere();
      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          skip: 5,
          take: 5,
        }),
      );
      expect(db.notification.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('should filter by severity', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await (service as any).findAll(
        organizationId,
        userId,
        { severity: 'warning' },
        { page: 1, limit: 10 },
      );

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: visibleNotificationWhere({ severity: 'warning' }),
        }),
      );
    });

    it('should ignore invalid severity filter', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await (service as any).findAll(
        organizationId,
        userId,
        { severity: 'invalid' },
        { page: 1, limit: 10 },
      );

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: visibleNotificationWhere(),
        }),
      );
    });

    it('should use default pagination values', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await (service as any).findAll(organizationId, userId, {});

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

      await (service as any).findAll(organizationId, userId, {}, { page: 3, limit: 5 });

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

      await (service as any).findAll(organizationId, userId, {
        read: true,
        severity: 'critical',
      });

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: visibleNotificationWhere({ read: true, severity: 'critical' }),
        }),
      );
    });

    it('should order by createdAt descending', async () => {
      db.notification.findMany.mockResolvedValue([]);
      db.notification.count.mockResolvedValue(0);

      await (service as any).findAll(organizationId, userId);

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

      const result = await (service as any).findOne(organizationId, userId, 'notif-1');

      expect(result).toEqual(mockNotification);
      expect(db.notification.findFirst).toHaveBeenCalledWith({
        where: visibleNotificationWhere({ id: 'notif-1' }),
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      db.notification.findFirst.mockResolvedValue(null);

      await expect((service as any).findOne(organizationId, userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      db.notification.count.mockResolvedValue(5);

      const result = await (service as any).getUnreadCount(organizationId, userId);

      expect(result).toBe(5);
      expect(db.notification.count).toHaveBeenCalledWith({
        where: visibleNotificationWhere({ read: false }),
      });
    });

    it('should return 0 when no unread notifications', async () => {
      db.notification.count.mockResolvedValue(0);

      const result = await (service as any).getUnreadCount(organizationId, userId);

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 1 });
      db.notification.findFirst.mockResolvedValue({ ...mockNotification, read: true });

      const result = await (service as any).markAsRead(organizationId, userId, 'notif-1');

      expect(result.read).toBe(true);
      expect(db.notification.findFirst).toHaveBeenCalledWith({
        where: visibleNotificationWhere({ id: 'notif-1' }),
      });
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: visibleNotificationWhere({ id: 'notif-1' }),
        data: { read: true },
      });
    });

    it('should throw NotFoundException for nonexistent notification', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        (service as any).markAsRead(organizationId, userId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 10 });

      const result = await (service as any).markAllAsRead(organizationId, userId);

      expect(result.updated).toBe(10);
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: visibleNotificationWhere({ read: false }),
        data: { read: true },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await (service as any).markAllAsRead(organizationId, userId);

      expect(result.updated).toBe(0);
    });
  });

  describe('dismiss', () => {
    it('should dismiss a notification', async () => {
      const dismissedAt = new Date();
      db.notification.updateMany.mockResolvedValue({ count: 1 });
      db.notification.findFirst.mockResolvedValue({ ...mockNotification, dismissedAt });

      const result = await (service as any).dismiss(organizationId, userId, 'notif-1');

      expect(result.dismissedAt).toBeDefined();
      expect(db.notification.findFirst).toHaveBeenCalledWith({
        where: scopedNotificationWhere({ id: 'notif-1' }),
      });
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: visibleNotificationWhere({ id: 'notif-1' }),
        data: { dismissedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException for nonexistent notification', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        (service as any).dismiss(organizationId, userId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // createDeviceOfflineNotification test removed in O7 — the helper itself
  // was deleted; offline notifications now flow through AlertRuleEvaluator
  // (covered by middleware/src/modules/notifications/alert-rules/alert-rule.evaluator.spec.ts).


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
    it('should delete old dismissed notifications scoped to one org', async () => {
      db.notification.deleteMany.mockResolvedValue({ count: 50 });

      const result = await service.cleanupOldNotifications('org-123', 30);

      expect(result.deleted).toBe(50);
      expect(db.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          dismissedAt: { not: null, lt: expect.any(Date) },
        },
      });
    });

    it('should use default days parameter when only orgId provided', async () => {
      db.notification.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOldNotifications('org-123');

      expect(db.notification.deleteMany).toHaveBeenCalled();
    });

    it('throws when organizationId is missing — prevents cross-tenant wipe', async () => {
      await expect(
        service.cleanupOldNotifications('' as string, 30),
      ).rejects.toThrow(/requires an organizationId/);
      expect(db.notification.deleteMany).not.toHaveBeenCalled();
    });
  });
});

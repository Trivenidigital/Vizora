import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockNotificationsService: jest.Mocked<NotificationsService>;

  const organizationId = 'org-123';

  const mockNotification = {
    id: 'notif-1',
    title: 'Test Notification',
    message: 'Test message',
    type: 'system',
    severity: 'info',
    read: false,
    dismissedAt: null,
    metadata: null,
    organizationId,
    userId: null,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    mockNotificationsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      dismiss: jest.fn(),
      createDeviceOfflineNotification: jest.fn(),
      createDeviceOnlineNotification: jest.fn(),
      createContentExpiredNotification: jest.fn(),
      createSystemNotification: jest.fn(),
      cleanupOldNotifications: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const createDto = {
        title: 'New Notification',
        message: 'Test message',
      };
      mockNotificationsService.create.mockResolvedValue({
        id: 'notif-new',
        ...createDto,
        type: 'system',
        severity: 'info',
        organizationId,
      } as any);

      const result = await controller.create(organizationId, createDto);

      expect(result.id).toBe('notif-new');
      expect(mockNotificationsService.create).toHaveBeenCalledWith({
        ...createDto,
        organizationId,
      });
    });

    it('should create a notification with custom type and severity', async () => {
      const createDto = {
        title: 'Alert',
        message: 'Critical issue',
        type: 'system',
        severity: 'critical',
      };
      mockNotificationsService.create.mockResolvedValue({
        id: 'notif-critical',
        ...createDto,
        organizationId,
      } as any);

      const result = await controller.create(organizationId, createDto);

      expect(result).toBeDefined();
      expect(mockNotificationsService.create).toHaveBeenCalledWith({
        ...createDto,
        organizationId,
      });
    });
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 20 };

    it('should return paginated notifications', async () => {
      const expectedResult = {
        data: [mockNotification],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockNotificationsService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
        organizationId,
        {},
        pagination,
      );
    });

    it('should filter by read=true', async () => {
      mockNotificationsService.findAll.mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(organizationId, pagination as any, 'true');

      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
        organizationId,
        { read: true },
        pagination,
      );
    });

    it('should filter by read=false', async () => {
      mockNotificationsService.findAll.mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(organizationId, pagination as any, 'false');

      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
        organizationId,
        { read: false },
        pagination,
      );
    });

    it('should filter by severity', async () => {
      mockNotificationsService.findAll.mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(organizationId, pagination as any, undefined, 'warning');

      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
        organizationId,
        { severity: 'warning' },
        pagination,
      );
    });

    it('should combine read and severity filters', async () => {
      mockNotificationsService.findAll.mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(organizationId, pagination as any, 'false', 'critical');

      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(
        organizationId,
        { read: false, severity: 'critical' },
        pagination,
      );
    });

    it('should handle empty results', async () => {
      const expectedResult = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      mockNotificationsService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(organizationId);

      expect(result).toEqual({ count: 5 });
      expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith(organizationId);
    });

    it('should return zero when no unread notifications', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(0);

      const result = await controller.getUnreadCount(organizationId);

      expect(result).toEqual({ count: 0 });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({ updated: 10 });

      const result = await controller.markAllAsRead(organizationId);

      expect(result).toEqual({ updated: 10 });
      expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith(organizationId);
    });

    it('should return 0 when no unread notifications', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({ updated: 0 });

      const result = await controller.markAllAsRead(organizationId);

      expect(result).toEqual({ updated: 0 });
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      mockNotificationsService.markAsRead.mockResolvedValue({
        ...mockNotification,
        read: true,
      } as any);

      const result = await controller.markAsRead(organizationId, 'notif-1');

      expect(result.read).toBe(true);
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(
        organizationId,
        'notif-1',
      );
    });

    it('should propagate NotFoundException', async () => {
      mockNotificationsService.markAsRead.mockRejectedValue(new NotFoundException());

      await expect(
        controller.markAsRead(organizationId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('dismiss', () => {
    it('should dismiss a notification', async () => {
      const dismissedAt = new Date();
      mockNotificationsService.dismiss.mockResolvedValue({
        ...mockNotification,
        dismissedAt,
      } as any);

      const result = await controller.dismiss(organizationId, 'notif-1');

      expect(result.dismissedAt).toEqual(dismissedAt);
      expect(mockNotificationsService.dismiss).toHaveBeenCalledWith(
        organizationId,
        'notif-1',
      );
    });

    it('should propagate NotFoundException', async () => {
      mockNotificationsService.dismiss.mockRejectedValue(new NotFoundException());

      await expect(
        controller.dismiss(organizationId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

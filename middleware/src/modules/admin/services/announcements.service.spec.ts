import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AnnouncementsService, CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.service';
import { DatabaseService } from '../../database/database.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let mockDb: any;

  const mockAnnouncement = {
    id: 'ann-123',
    title: 'Test Announcement',
    message: 'This is a test announcement',
    type: 'info',
    targetAudience: 'all',
    targetPlans: [],
    startsAt: new Date(),
    expiresAt: null,
    isActive: false,
    isDismissible: true,
    linkUrl: null,
    linkText: null,
    createdBy: 'admin-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDb = {
      systemAnnouncement: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new AnnouncementsService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all announcements', async () => {
      mockDb.systemAnnouncement.findMany.mockResolvedValue([mockAnnouncement]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Announcement');
    });
  });

  describe('findActive', () => {
    it('should return active announcements', async () => {
      mockDb.systemAnnouncement.findMany.mockResolvedValue([{ ...mockAnnouncement, isActive: true }]);

      const result = await service.findActive();

      expect(result).toHaveLength(1);
      expect(mockDb.systemAnnouncement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });
  });

  describe('findActiveForPlan', () => {
    it('should return announcements for all audience', async () => {
      mockDb.systemAnnouncement.findMany.mockResolvedValue([{ ...mockAnnouncement, isActive: true }]);

      const result = await service.findActiveForPlan('pro', false);

      expect(result).toHaveLength(1);
    });

    it('should return admin-only announcements for admins', async () => {
      mockDb.systemAnnouncement.findMany.mockResolvedValue([
        { ...mockAnnouncement, isActive: true, targetAudience: 'admins' },
      ]);

      const result = await service.findActiveForPlan('pro', true);

      expect(result).toHaveLength(1);
    });

    it('should filter plan-specific announcements', async () => {
      mockDb.systemAnnouncement.findMany.mockResolvedValue([
        { ...mockAnnouncement, isActive: true, targetAudience: 'specific_plans', targetPlans: ['pro', 'enterprise'] },
      ]);

      const resultPro = await service.findActiveForPlan('pro', false);
      expect(resultPro).toHaveLength(1);

      const resultFree = await service.findActiveForPlan('free', false);
      expect(resultFree).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return announcement by id', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue(mockAnnouncement);

      const result = await service.findOne('ann-123');

      expect(result).toEqual(mockAnnouncement);
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create announcement', async () => {
      mockDb.systemAnnouncement.create.mockResolvedValue(mockAnnouncement);

      const dto: CreateAnnouncementDto = {
        title: 'Test Announcement',
        message: 'This is a test',
        startsAt: new Date(),
      };

      const result = await service.create(dto, 'admin-123');

      expect(result.title).toBe('Test Announcement');
    });

    it('should throw if expiresAt is before startsAt', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);

      const dto: CreateAnnouncementDto = {
        title: 'Test',
        message: 'Test',
        startsAt: now,
        expiresAt: past,
      };

      await expect(service.create(dto, 'admin-123')).rejects.toThrow(BadRequestException);
    });

    it('should require targetPlans for specific_plans audience', async () => {
      const dto: CreateAnnouncementDto = {
        title: 'Test',
        message: 'Test',
        startsAt: new Date(),
        targetAudience: 'specific_plans',
        targetPlans: [],
      };

      await expect(service.create(dto, 'admin-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update announcement', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue(mockAnnouncement);
      mockDb.systemAnnouncement.update.mockResolvedValue({ ...mockAnnouncement, title: 'Updated' });

      const dto: UpdateAnnouncementDto = { title: 'Updated' };
      const result = await service.update('ann-123', dto);

      expect(result.title).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should delete announcement', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue(mockAnnouncement);
      mockDb.systemAnnouncement.delete.mockResolvedValue(mockAnnouncement);

      const result = await service.delete('ann-123');

      expect(result.deleted).toBe(true);
      expect(result.id).toBe('ann-123');
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue(null);

      await expect(service.delete('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it('should publish announcement', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue(mockAnnouncement);
      mockDb.systemAnnouncement.update.mockResolvedValue({ ...mockAnnouncement, isActive: true });

      const result = await service.publish('ann-123');

      expect(result.isActive).toBe(true);
    });

    it('should throw if already published', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue({ ...mockAnnouncement, isActive: true });

      await expect(service.publish('ann-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unpublish', () => {
    it('should unpublish announcement', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue({ ...mockAnnouncement, isActive: true });
      mockDb.systemAnnouncement.update.mockResolvedValue({ ...mockAnnouncement, isActive: false });

      const result = await service.unpublish('ann-123');

      expect(result.isActive).toBe(false);
    });

    it('should throw if already unpublished', async () => {
      mockDb.systemAnnouncement.findUnique.mockResolvedValue(mockAnnouncement);

      await expect(service.unpublish('ann-123')).rejects.toThrow(BadRequestException);
    });
  });
});

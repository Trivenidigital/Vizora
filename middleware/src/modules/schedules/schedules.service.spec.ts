import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesService } from './schedules.service';
import { DatabaseService } from '../database/database.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('SchedulesService', () => {
  let service: SchedulesService;
  let databaseService: jest.Mocked<DatabaseService>;

  const mockOrganizationId = 'org-123';
  const mockScheduleId = 'schedule-123';
  const mockDisplayId = 'display-123';
  const mockPlaylistId = 'playlist-123';

  const mockSchedule = {
    id: mockScheduleId,
    name: 'Test Schedule',
    playlistId: mockPlaylistId,
    displayId: mockDisplayId,
    displayGroupId: null,
    startDate: new Date('2026-01-27T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    priority: 5,
    isActive: true,
    organizationId: mockOrganizationId,
    createdAt: new Date('2026-01-27T10:00:00Z'),
    updatedAt: new Date('2026-01-27T10:00:00Z'),
  };

  beforeEach(async () => {
    const mockDatabaseService = {
      schedule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
    databaseService = module.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateScheduleDto = {
      name: 'Test Schedule',
      playlistId: mockPlaylistId,
      displayId: mockDisplayId,
      startDate: '2026-01-27T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z',
      startTime: '09:00',
      endTime: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5],
      priority: 5,
      isActive: true,
    };

    it('should create a schedule with displayId successfully', async () => {
      const mockCreatedSchedule = {
        ...mockSchedule,
        playlist: { id: mockPlaylistId, name: 'Test Playlist' },
        display: { id: mockDisplayId, nickname: 'Test Display' },
        displayGroup: null,
      };

      databaseService.schedule.create.mockResolvedValue(mockCreatedSchedule);

      const result = await service.create(mockOrganizationId, createDto);

      expect(databaseService.schedule.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          startDate: new Date('2026-01-27T00:00:00Z'),
          endDate: new Date('2026-12-31T23:59:59Z'),
          organizationId: mockOrganizationId,
        },
        include: {
          playlist: true,
          display: true,
          displayGroup: true,
        },
      });
      expect(result).toEqual(mockCreatedSchedule);
    });

    it('should create a schedule with displayGroupId successfully', async () => {
      const createDtoWithGroup: CreateScheduleDto = {
        ...createDto,
        displayId: undefined,
        displayGroupId: 'group-123',
      };

      const mockCreatedSchedule = {
        ...mockSchedule,
        displayId: null,
        displayGroupId: 'group-123',
        playlist: { id: mockPlaylistId },
        display: null,
        displayGroup: { id: 'group-123' },
      };

      databaseService.schedule.create.mockResolvedValue(mockCreatedSchedule);

      const result = await service.create(mockOrganizationId, createDtoWithGroup);

      expect(result.displayGroupId).toBe('group-123');
      expect(result.displayId).toBeNull();
    });

    it('should throw BadRequestException if neither displayId nor displayGroupId provided', async () => {
      const invalidDto: CreateScheduleDto = {
        ...createDto,
        displayId: undefined,
      };

      await expect(
        service.create(mockOrganizationId, invalidDto)
      ).rejects.toThrow(BadRequestException);

      expect(databaseService.schedule.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if both displayId and displayGroupId provided', async () => {
      const invalidDto: CreateScheduleDto = {
        ...createDto,
        displayGroupId: 'group-123',
      };

      await expect(
        service.create(mockOrganizationId, invalidDto)
      ).rejects.toThrow(BadRequestException);

      expect(databaseService.schedule.create).not.toHaveBeenCalled();
    });

    it('should handle schedule without end date', async () => {
      const createDtoNoEndDate: CreateScheduleDto = {
        ...createDto,
        endDate: undefined,
      };

      const mockCreatedSchedule = {
        ...mockSchedule,
        endDate: null,
        playlist: {},
        display: {},
        displayGroup: null,
      };

      databaseService.schedule.create.mockResolvedValue(mockCreatedSchedule);

      const result = await service.create(mockOrganizationId, createDtoNoEndDate);

      expect(databaseService.schedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          endDate: null,
        }),
        include: expect.any(Object),
      });
      expect(result.endDate).toBeNull();
    });
  });

  describe('findAll', () => {
    const pagination: PaginationDto = { page: 1, limit: 10 };

    it('should return paginated schedules for an organization', async () => {
      const mockSchedules = [mockSchedule];
      databaseService.schedule.findMany.mockResolvedValue(mockSchedules);
      databaseService.schedule.count.mockResolvedValue(1);

      const result = await service.findAll(mockOrganizationId, pagination);

      expect(databaseService.schedule.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        skip: 0,
        take: 10,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          playlist: {
            include: {
              _count: {
                select: { items: true },
              },
            },
          },
          display: true,
          displayGroup: true,
        },
      });
      expect(result.data).toEqual(mockSchedules);
      expect(result.meta.total).toBe(1);
    });

    it('should filter schedules by displayId', async () => {
      databaseService.schedule.findMany.mockResolvedValue([mockSchedule]);
      databaseService.schedule.count.mockResolvedValue(1);

      await service.findAll(mockOrganizationId, pagination, { displayId: mockDisplayId });

      expect(databaseService.schedule.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId, displayId: mockDisplayId },
        skip: 0,
        take: 10,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: expect.any(Object),
      });
    });

    it('should filter schedules by isActive', async () => {
      databaseService.schedule.findMany.mockResolvedValue([mockSchedule]);
      databaseService.schedule.count.mockResolvedValue(1);

      await service.findAll(mockOrganizationId, pagination, { isActive: true });

      expect(databaseService.schedule.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId, isActive: true },
        skip: 0,
        take: 10,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: expect.any(Object),
      });
    });

    it('should return empty list when no schedules exist', async () => {
      databaseService.schedule.findMany.mockResolvedValue([]);
      databaseService.schedule.count.mockResolvedValue(0);

      const result = await service.findAll(mockOrganizationId, pagination);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findOne', () => {
    const mockScheduleWithRelations = {
      ...mockSchedule,
      playlist: {
        id: mockPlaylistId,
        items: [],
      },
      display: { id: mockDisplayId },
      displayGroup: null,
    };

    it('should return a schedule by ID for the organization', async () => {
      databaseService.schedule.findFirst.mockResolvedValue(mockScheduleWithRelations);

      const result = await service.findOne(mockOrganizationId, mockScheduleId);

      expect(databaseService.schedule.findFirst).toHaveBeenCalledWith({
        where: { id: mockScheduleId, organizationId: mockOrganizationId },
        include: {
          playlist: {
            include: {
              items: {
                include: {
                  content: true,
                },
                orderBy: {
                  order: 'asc',
                },
              },
            },
          },
          display: true,
          displayGroup: {
            include: {
              displays: {
                include: {
                  display: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(mockScheduleWithRelations);
    });

    it('should throw NotFoundException if schedule not found', async () => {
      databaseService.schedule.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockOrganizationId, mockScheduleId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActiveSchedules', () => {
    it('should return active schedules for a display', async () => {
      const mockActiveSchedules = [
        {
          ...mockSchedule,
          playlist: {
            id: mockPlaylistId,
            items: [],
          },
        },
      ];

      databaseService.schedule.findMany.mockResolvedValue(mockActiveSchedules);

      const result = await service.findActiveSchedules(mockDisplayId);

      expect(databaseService.schedule.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockActiveSchedules);
    });

    it('should filter by current date, time, and day of week', async () => {
      databaseService.schedule.findMany.mockResolvedValue([]);

      await service.findActiveSchedules(mockDisplayId);

      const callArgs = databaseService.schedule.findMany.mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
      expect(callArgs.where.startDate).toHaveProperty('lte');
      expect(callArgs.where.daysOfWeek).toHaveProperty('has');
      expect(callArgs.orderBy).toEqual({ priority: 'desc' });
    });
  });

  describe('update', () => {
    const mockScheduleWithRelations = {
      ...mockSchedule,
      playlist: {},
      display: {},
      displayGroup: null,
    };

    it('should update a schedule successfully', async () => {
      const updateDto: UpdateScheduleDto = {
        name: 'Updated Schedule',
        priority: 10,
      };

      databaseService.schedule.findFirst.mockResolvedValue(mockScheduleWithRelations);
      databaseService.schedule.update.mockResolvedValue({
        ...mockSchedule,
        name: 'Updated Schedule',
        priority: 10,
        playlist: {},
        display: {},
        displayGroup: null,
      });

      const result = await service.update(mockOrganizationId, mockScheduleId, updateDto);

      expect(databaseService.schedule.findFirst).toHaveBeenCalled();
      expect(databaseService.schedule.update).toHaveBeenCalledWith({
        where: { id: mockScheduleId },
        data: updateDto,
        include: {
          playlist: true,
          display: true,
          displayGroup: true,
        },
      });
      expect(result.name).toBe('Updated Schedule');
      expect(result.priority).toBe(10);
    });

    it('should throw NotFoundException if schedule not found', async () => {
      databaseService.schedule.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockOrganizationId, mockScheduleId, {})
      ).rejects.toThrow(NotFoundException);

      expect(databaseService.schedule.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if both displayId and displayGroupId provided', async () => {
      const updateDto: UpdateScheduleDto = {
        displayId: mockDisplayId,
        displayGroupId: 'group-123',
      };

      databaseService.schedule.findFirst.mockResolvedValue(mockScheduleWithRelations);

      await expect(
        service.update(mockOrganizationId, mockScheduleId, updateDto)
      ).rejects.toThrow(BadRequestException);

      expect(databaseService.schedule.update).not.toHaveBeenCalled();
    });
  });

  describe('duplicate', () => {
    const mockScheduleWithRelations = {
      ...mockSchedule,
      playlist: {
        id: mockPlaylistId,
        items: [],
      },
      display: { id: mockDisplayId },
      displayGroup: null,
    };

    it('should duplicate a schedule successfully', async () => {
      const duplicatedSchedule = {
        id: 'schedule-456',
        name: 'Test Schedule (Copy)',
        playlistId: mockPlaylistId,
        displayId: mockDisplayId,
        displayGroupId: null,
        isActive: false,
        organizationId: mockOrganizationId,
        playlist: { id: mockPlaylistId, name: 'Test Playlist' },
        display: { id: mockDisplayId, nickname: 'Test Display' },
        displayGroup: null,
      };

      databaseService.schedule.findFirst.mockResolvedValue(mockScheduleWithRelations);
      databaseService.schedule.create.mockResolvedValue(duplicatedSchedule);

      const result = await service.duplicate(mockOrganizationId, mockScheduleId);

      expect(databaseService.schedule.findFirst).toHaveBeenCalled();
      expect(databaseService.schedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Schedule (Copy)',
          playlistId: mockPlaylistId,
          displayId: mockDisplayId,
          isActive: false,
          organizationId: mockOrganizationId,
        }),
        include: {
          playlist: true,
          display: true,
          displayGroup: true,
        },
      });
      expect(result).toEqual(duplicatedSchedule);
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if schedule not found', async () => {
      databaseService.schedule.findFirst.mockResolvedValue(null);

      await expect(
        service.duplicate(mockOrganizationId, 'invalid-id')
      ).rejects.toThrow(NotFoundException);

      expect(databaseService.schedule.create).not.toHaveBeenCalled();
    });
  });

  describe('checkConflicts', () => {
    it('should return no conflicts when no overlapping schedules exist', async () => {
      databaseService.schedule.findMany.mockResolvedValue([]);

      const result = await service.checkConflicts('org-123', {
        displayId: 'display-1',
        daysOfWeek: [1, 2, 3],
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect time overlap conflicts', async () => {
      databaseService.schedule.findMany.mockResolvedValue([
        {
          id: 'schedule-1',
          name: 'Existing Schedule',
          startTime: '09:30',
          endTime: '10:30',
          daysOfWeek: [1, 2],
          playlist: { id: 'p-1', name: 'Playlist 1' },
          display: { id: 'display-1', nickname: 'Display 1' },
          displayGroup: null,
        },
      ]);

      const result = await service.checkConflicts('org-123', {
        displayId: 'display-1',
        daysOfWeek: [1, 2, 3],
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].name).toBe('Existing Schedule');
    });

    it('should not flag non-overlapping times', async () => {
      databaseService.schedule.findMany.mockResolvedValue([
        {
          id: 'schedule-1',
          name: 'Earlier Schedule',
          startTime: '07:00',
          endTime: '08:00',
          daysOfWeek: [1, 2],
          playlist: { id: 'p-1', name: 'Playlist 1' },
          display: { id: 'display-1', nickname: 'Display 1' },
          displayGroup: null,
        },
      ]);

      const result = await service.checkConflicts('org-123', {
        displayId: 'display-1',
        daysOfWeek: [1, 2, 3],
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.hasConflicts).toBe(false);
    });

    it('should exclude specified schedule from conflicts', async () => {
      databaseService.schedule.findMany.mockResolvedValue([]);

      await service.checkConflicts('org-123', {
        displayId: 'display-1',
        daysOfWeek: [1],
        startTime: '09:00',
        endTime: '10:00',
        excludeScheduleId: 'schedule-1',
      });

      expect(databaseService.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'schedule-1' },
          }),
        }),
      );
    });

    it('should treat all-day schedules (null times) as always conflicting', async () => {
      databaseService.schedule.findMany.mockResolvedValue([
        {
          id: 'schedule-allday',
          name: 'All Day Schedule',
          startTime: null,
          endTime: null,
          daysOfWeek: [1, 2, 3],
          playlist: { id: 'p-1', name: 'Playlist 1' },
          display: { id: 'display-1', nickname: 'Display 1' },
          displayGroup: null,
        },
      ]);

      const result = await service.checkConflicts('org-123', {
        displayId: 'display-1',
        daysOfWeek: [1, 2, 3],
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].name).toBe('All Day Schedule');
    });

    it('should not flag adjacent time slots as conflicts (10:00 end vs 10:00 start)', async () => {
      databaseService.schedule.findMany.mockResolvedValue([
        {
          id: 'schedule-1',
          name: 'Morning Schedule',
          startTime: '10:00',
          endTime: '11:00',
          daysOfWeek: [1, 2],
          playlist: { id: 'p-1', name: 'Playlist 1' },
          display: { id: 'display-1', nickname: 'Display 1' },
          displayGroup: null,
        },
      ]);

      const result = await service.checkConflicts('org-123', {
        displayId: 'display-1',
        daysOfWeek: [1, 2],
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect multiple conflicts on the same display', async () => {
      databaseService.schedule.findMany.mockResolvedValue([
        {
          id: 'schedule-1',
          name: 'Morning Meeting',
          startTime: '09:00',
          endTime: '10:00',
          daysOfWeek: [1],
          playlist: { id: 'p-1', name: 'Playlist 1' },
          display: { id: 'display-1', nickname: 'Display 1' },
          displayGroup: null,
        },
        {
          id: 'schedule-2',
          name: 'Training Session',
          startTime: '09:30',
          endTime: '10:30',
          daysOfWeek: [1],
          playlist: { id: 'p-2', name: 'Playlist 2' },
          display: { id: 'display-1', nickname: 'Display 1' },
          displayGroup: null,
        },
      ]);

      const result = await service.checkConflicts('org-123', {
        displayId: 'display-1',
        daysOfWeek: [1],
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(2);
    });

    it('should filter by displayGroupId when provided', async () => {
      databaseService.schedule.findMany.mockResolvedValue([]);

      await service.checkConflicts('org-123', {
        displayGroupId: 'group-1',
        daysOfWeek: [1, 2],
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(databaseService.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            displayGroupId: 'group-1',
          }),
        }),
      );
    });

    it('should treat requests without times as always conflicting', async () => {
      databaseService.schedule.findMany.mockResolvedValue([
        {
          id: 'schedule-1',
          name: 'Timed Schedule',
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          playlist: { id: 'p-1', name: 'Playlist 1' },
          display: { id: 'display-1', nickname: 'Display 1' },
          displayGroup: null,
        },
      ]);

      const result = await service.checkConflicts('org-123', {
        displayId: 'display-1',
        daysOfWeek: [1, 2, 3],
      });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe('remove', () => {
    const mockScheduleWithRelations = {
      ...mockSchedule,
      playlist: {},
      display: {},
      displayGroup: null,
    };

    it('should delete a schedule successfully', async () => {
      databaseService.schedule.findFirst.mockResolvedValue(mockScheduleWithRelations);
      databaseService.schedule.delete.mockResolvedValue(mockSchedule);

      const result = await service.remove(mockOrganizationId, mockScheduleId);

      expect(databaseService.schedule.findFirst).toHaveBeenCalled();
      expect(databaseService.schedule.delete).toHaveBeenCalledWith({
        where: { id: mockScheduleId },
      });
      expect(result).toEqual(mockSchedule);
    });

    it('should throw NotFoundException if schedule not found', async () => {
      databaseService.schedule.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(mockOrganizationId, mockScheduleId)
      ).rejects.toThrow(NotFoundException);

      expect(databaseService.schedule.delete).not.toHaveBeenCalled();
    });
  });
});

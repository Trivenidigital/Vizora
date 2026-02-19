import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

describe('SchedulesController', () => {
  let controller: SchedulesController;
  let mockSchedulesService: jest.Mocked<SchedulesService>;
  let mockJwtService: any;

  const organizationId = 'org-123';

  const createMockRequest = (token?: string) => ({
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
    },
  });

  beforeEach(async () => {
    mockSchedulesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findActiveSchedules: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      duplicate: jest.fn(),
      checkConflicts: jest.fn(),
      remove: jest.fn(),
    } as any;

    mockJwtService = {
      verify: jest.fn().mockReturnValue({ type: 'device', sub: 'device-123' }),
      verifyAsync: jest.fn().mockResolvedValue({ type: 'device', sub: 'device-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [
        { provide: SchedulesService, useValue: mockSchedulesService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
      ],
    }).compile();

    controller = module.get<SchedulesController>(SchedulesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createScheduleDto = {
      name: 'Morning Schedule',
      playlistId: 'playlist-123',
      displayId: 'display-123',
      startTime: 540,   // 09:00
      endTime: 1020,    // 17:00
      daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    };

    it('should create a schedule', async () => {
      const expectedSchedule = { id: 'schedule-123', ...createScheduleDto };
      mockSchedulesService.create.mockResolvedValue(expectedSchedule as any);

      const result = await controller.create(organizationId, createScheduleDto as any);

      expect(result).toEqual(expectedSchedule);
      expect(mockSchedulesService.create).toHaveBeenCalledWith(organizationId, createScheduleDto);
    });
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 10 };

    it('should return all schedules with pagination', async () => {
      const expectedResult = {
        data: [{ id: 'schedule-1' }, { id: 'schedule-2' }],
        total: 2,
      };
      mockSchedulesService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: undefined,
        isActive: undefined,
      });
    });

    it('should pass displayId filter', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(
        organizationId,
        pagination as any,
        'display-123',
        undefined,
        undefined,
      );

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: 'display-123',
        displayGroupId: undefined,
        isActive: undefined,
      });
    });

    it('should pass displayGroupId filter', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(
        organizationId,
        pagination as any,
        undefined,
        'group-123',
        undefined,
      );

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: 'group-123',
        isActive: undefined,
      });
    });

    it('should convert isActive "true" to boolean true', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(
        organizationId,
        pagination as any,
        undefined,
        undefined,
        'true',
      );

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: undefined,
        isActive: true,
      });
    });

    it('should convert isActive "false" to boolean false', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(
        organizationId,
        pagination as any,
        undefined,
        undefined,
        'false',
      );

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: undefined,
        isActive: false,
      });
    });

    it('should treat other isActive values as undefined', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(
        organizationId,
        pagination as any,
        undefined,
        undefined,
        'invalid',
      );

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: undefined,
        isActive: undefined,
      });
    });
  });

  describe('findActiveSchedules', () => {
    it('should return active schedules for a display with valid device JWT', async () => {
      const expectedResult = [
        { id: 'schedule-1', playlistId: 'playlist-1' },
        { id: 'schedule-2', playlistId: 'playlist-2' },
      ];
      mockSchedulesService.findActiveSchedules.mockResolvedValue(expectedResult as any);

      const mockReq = createMockRequest('valid-device-token');
      const result = await controller.findActiveSchedules('display-123', mockReq as any);

      expect(result).toEqual(expectedResult);
      expect(mockSchedulesService.findActiveSchedules).toHaveBeenCalledWith('display-123');
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-device-token', {
        secret: process.env.DEVICE_JWT_SECRET,
      });
    });

    it('should work with valid device JWT (public endpoint)', async () => {
      mockSchedulesService.findActiveSchedules.mockResolvedValue([]);

      const mockReq = createMockRequest('valid-device-token');
      const result = await controller.findActiveSchedules('display-456', mockReq as any);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a schedule by id', async () => {
      const expectedSchedule = {
        id: 'schedule-123',
        name: 'Test Schedule',
        playlist: { id: 'playlist-1', name: 'Test Playlist' },
      };
      mockSchedulesService.findOne.mockResolvedValue(expectedSchedule as any);

      const result = await controller.findOne(organizationId, 'schedule-123');

      expect(result).toEqual(expectedSchedule);
      expect(mockSchedulesService.findOne).toHaveBeenCalledWith(organizationId, 'schedule-123');
    });
  });

  describe('update', () => {
    it('should update a schedule', async () => {
      const updateDto = { name: 'Updated Schedule Name', isActive: false };
      const expectedSchedule = { id: 'schedule-123', ...updateDto };
      mockSchedulesService.update.mockResolvedValue(expectedSchedule as any);

      const result = await controller.update(organizationId, 'schedule-123', updateDto as any);

      expect(result).toEqual(expectedSchedule);
      expect(mockSchedulesService.update).toHaveBeenCalledWith(
        organizationId,
        'schedule-123',
        updateDto,
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate a schedule', async () => {
      const expectedSchedule = {
        id: 'schedule-456',
        name: 'Morning Schedule (Copy)',
        playlistId: 'playlist-123',
        displayId: 'display-123',
        isActive: false,
        playlist: { id: 'playlist-123', name: 'Test Playlist' },
        display: { id: 'display-123', nickname: 'Test Display' },
        displayGroup: null,
      };
      mockSchedulesService.duplicate.mockResolvedValue(expectedSchedule as any);

      const result = await controller.duplicate(organizationId, 'schedule-123');

      expect(result).toEqual(expectedSchedule);
      expect(mockSchedulesService.duplicate).toHaveBeenCalledWith(organizationId, 'schedule-123');
    });
  });

  describe('checkConflicts', () => {
    it('should check for schedule conflicts', async () => {
      const checkConflictsDto = {
        displayId: 'display-123',
        daysOfWeek: [1, 2, 3],
        startTime: 540,   // 09:00
        endTime: 600,     // 10:00
      };
      const expectedResult = {
        hasConflicts: false,
        conflicts: [],
      };
      mockSchedulesService.checkConflicts.mockResolvedValue(expectedResult as any);

      const result = await controller.checkConflicts(organizationId, checkConflictsDto as any);

      expect(result).toEqual(expectedResult);
      expect(mockSchedulesService.checkConflicts).toHaveBeenCalledWith(
        organizationId,
        checkConflictsDto,
      );
    });

    it('should return conflicts when they exist', async () => {
      const checkConflictsDto = {
        displayId: 'display-123',
        daysOfWeek: [1, 2],
        startTime: 540,   // 09:00
        endTime: 600,     // 10:00
      };
      const expectedResult = {
        hasConflicts: true,
        conflicts: [
          {
            id: 'schedule-1',
            name: 'Existing Schedule',
            startTime: 570,   // 09:30
            endTime: 630,     // 10:30
            daysOfWeek: [1, 2],
            playlist: { id: 'p-1', name: 'Playlist 1' },
            display: { id: 'display-123', nickname: 'Display 1' },
            displayGroup: null,
          },
        ],
      };
      mockSchedulesService.checkConflicts.mockResolvedValue(expectedResult as any);

      const result = await controller.checkConflicts(organizationId, checkConflictsDto as any);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('should remove a schedule', async () => {
      mockSchedulesService.remove.mockResolvedValue(undefined);

      await controller.remove(organizationId, 'schedule-123');

      expect(mockSchedulesService.remove).toHaveBeenCalledWith(organizationId, 'schedule-123');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

describe('SchedulesController', () => {
  let controller: SchedulesController;
  let mockSchedulesService: jest.Mocked<SchedulesService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockSchedulesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findActiveSchedules: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      duplicate: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [{ provide: SchedulesService, useValue: mockSchedulesService }],
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
      startTime: '09:00',
      endTime: '17:00',
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
    it('should return active schedules for a display (public endpoint)', async () => {
      const expectedResult = [
        { id: 'schedule-1', playlistId: 'playlist-1' },
        { id: 'schedule-2', playlistId: 'playlist-2' },
      ];
      mockSchedulesService.findActiveSchedules.mockResolvedValue(expectedResult as any);

      const result = await controller.findActiveSchedules('display-123');

      expect(result).toEqual(expectedResult);
      expect(mockSchedulesService.findActiveSchedules).toHaveBeenCalledWith('display-123');
    });

    it('should work without authentication (public endpoint)', async () => {
      mockSchedulesService.findActiveSchedules.mockResolvedValue([]);

      const result = await controller.findActiveSchedules('display-456');

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

  describe('remove', () => {
    it('should remove a schedule', async () => {
      mockSchedulesService.remove.mockResolvedValue(undefined);

      await controller.remove(organizationId, 'schedule-123');

      expect(mockSchedulesService.remove).toHaveBeenCalledWith(organizationId, 'schedule-123');
    });
  });
});

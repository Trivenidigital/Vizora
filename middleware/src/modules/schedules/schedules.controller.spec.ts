import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { ScheduleQueryDto } from './dto/schedule-query.dto';
import { SubscriptionActiveGuard } from '../billing/guards/subscription-active.guard';
import { DatabaseService } from '../database/database.service';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';

describe('SchedulesController', () => {
  let controller: SchedulesController;
  let mockSchedulesService: jest.Mocked<SchedulesService>;
  let mockJwtService: any;
  let mockDatabaseService: any;

  const organizationId = 'org-123';
  const hashToken = (token: string) =>
    createHash('sha256').update(token).digest('hex');

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
      verify: jest.fn().mockReturnValue({
        type: 'device',
        sub: 'display-123',
        deviceIdentifier: 'DEVICE-123',
        organizationId,
      }),
      verifyAsync: jest.fn().mockResolvedValue({
        type: 'device',
        sub: 'display-123',
        deviceIdentifier: 'DEVICE-123',
        organizationId,
      }),
    };

    mockDatabaseService = {
      display: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'display-123',
          organizationId,
          isDisabled: false,
          jwtToken: hashToken('valid-device-token'),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [
        { provide: SchedulesService, useValue: mockSchedulesService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
        { provide: DatabaseService, useValue: mockDatabaseService },
        SubscriptionActiveGuard,
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

      const result = await controller.findAll(organizationId, { ...pagination });

      expect(result).toEqual(expectedResult);
      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: undefined,
        isActive: undefined,
      });
    });

    it('should pass displayId filter', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(organizationId, { ...pagination, displayId: 'display-123' });

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: 'display-123',
        displayGroupId: undefined,
        isActive: undefined,
      });
    });

    it('should pass displayGroupId filter', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(organizationId, { ...pagination, displayGroupId: 'group-123' });

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: 'group-123',
        isActive: undefined,
      });
    });

    it('should convert isActive "true" to boolean true', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(organizationId, { ...pagination, isActive: 'true' });

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: undefined,
        isActive: true,
      });
    });

    it('should convert isActive "false" to boolean false', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(organizationId, { ...pagination, isActive: 'false' });

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: undefined,
        isActive: false,
      });
    });

    // ScheduleQueryDto's @IsIn(['true','false']) means a value like this is a 400
    // before the handler runs; this pins the handler's own defensive fallback so a
    // non-literal can never be coerced into a filter that quietly matches nothing.
    it('should treat other isActive values as undefined', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      await controller.findAll(organizationId, { ...pagination, isActive: 'invalid' });

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(organizationId, pagination, {
        displayId: undefined,
        displayGroupId: undefined,
        isActive: undefined,
      });
    });

    // REGRESSION PIN. All three schedule filters used to be bare `@Query('displayId')`
    // parameters beside `@Query() pagination: PaginationDto`. The global ValidationPipe
    // runs with whitelist + forbidNonWhitelisted, so PaginationDto validated the WHOLE
    // query object and every filter key was an unknown property:
    //   GET /api/v1/schedules?page=1&limit=10&isActive=true
    //   -> 400 ["property isActive should not exist"]
    // The fix is that the filters are DECLARED on ScheduleQueryDto. This test is typed
    // as that DTO, so dropping a field from it breaks compilation here, and it asserts
    // each declared filter is forwarded -- isActive still as a real boolean.
    it('forwards every filter declared on ScheduleQueryDto to the service instead of dropping it', async () => {
      mockSchedulesService.findAll.mockResolvedValue({ data: [], total: 0 } as any);

      const query: ScheduleQueryDto = {
        page: 3,
        limit: 25,
        displayId: 'display-777',
        displayGroupId: 'group-777',
        isActive: 'true',
      };

      await controller.findAll(organizationId, query);

      expect(mockSchedulesService.findAll).toHaveBeenCalledWith(
        organizationId,
        { page: 3, limit: 25 },
        {
          displayId: 'display-777',
          displayGroupId: 'group-777',
          isActive: true,
        },
      );

      // Not just "shape matches": prove nothing was dropped on the way through, and
      // that isActive arrives as a boolean rather than the raw query string.
      const filters = mockSchedulesService.findAll.mock.calls[0][2]!;
      expect(filters.displayId).toBe(query.displayId);
      expect(filters.displayGroupId).toBe(query.displayGroupId);
      expect(filters.isActive).toBe(true);
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
      expect(mockSchedulesService.findActiveSchedules).toHaveBeenCalledWith('display-123', organizationId);
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-device-token', {
        secret: process.env.DEVICE_JWT_SECRET,
        algorithms: ['HS256'],
      });
    });

    it('should work with valid device JWT (public endpoint)', async () => {
      mockJwtService.verify.mockReturnValueOnce({
        type: 'device',
        sub: 'display-456',
        deviceIdentifier: 'DEVICE-456',
        organizationId,
      });
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        id: 'display-456',
        organizationId,
        isDisabled: false,
        jwtToken: hashToken('valid-device-token'),
      });
      mockSchedulesService.findActiveSchedules.mockResolvedValue([]);

      const mockReq = createMockRequest('valid-device-token');
      const result = await controller.findActiveSchedules('display-456', mockReq as any);

      expect(result).toEqual([]);
    });

    it('should reject a signed schedule token that is not the current stored token', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        id: 'display-123',
        organizationId,
        isDisabled: false,
        jwtToken: hashToken('current-device-token'),
      });

      const mockReq = createMockRequest('stale-device-token');

      await expect(controller.findActiveSchedules('display-123', mockReq as any)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockSchedulesService.findActiveSchedules).not.toHaveBeenCalled();
    });

    it('should reject a device JWT for a different display', async () => {
      mockJwtService.verify.mockReturnValueOnce({
        type: 'device',
        sub: 'display-999',
        deviceIdentifier: 'DEVICE-999',
        organizationId,
      });

      const mockReq = createMockRequest('valid-device-token');

      await expect(controller.findActiveSchedules('display-456', mockReq as any))
        .rejects.toThrow('Device token does not match requested display');
      expect(mockSchedulesService.findActiveSchedules).not.toHaveBeenCalled();
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

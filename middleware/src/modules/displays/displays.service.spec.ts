import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { DisplaysService } from './displays.service';
import { DatabaseService } from '../database/database.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('DisplaysService', () => {
  let service: DisplaysService;
  let databaseService: jest.Mocked<DatabaseService>;

  const mockOrganizationId = 'org-123';
  const mockDisplayId = 'display-123';
  const mockDeviceIdentifier = 'device-abc-123';

  const mockDisplay = {
    id: mockDisplayId,
    deviceIdentifier: mockDeviceIdentifier,
    nickname: 'Test Display',
    organizationId: mockOrganizationId,
    status: 'online',
    orientation: 'landscape',
    resolution: '1920x1080',
    timezone: 'America/New_York',
    lastHeartbeat: new Date('2026-01-27T12:00:00Z'),
    createdAt: new Date('2026-01-27T10:00:00Z'),
    updatedAt: new Date('2026-01-27T12:00:00Z'),
  };

  beforeEach(async () => {
    const mockDatabaseService = {
      display: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const mockCircuitBreakerService = {
      execute: jest.fn().mockImplementation((name, fn) => fn()),
      executeWithFallback: jest.fn().mockImplementation((name, fn, fallback) => fn().catch(fallback)),
      getCircuitState: jest.fn().mockReturnValue('CLOSED'),
      getCircuitStats: jest.fn().mockReturnValue({ state: 'CLOSED', failures: 0, successes: 0, recentFailures: 0 }),
      resetCircuit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisplaysService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreakerService,
        },
      ],
    }).compile();

    service = module.get<DisplaysService>(DisplaysService);
    databaseService = module.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateDisplayDto = {
      deviceId: mockDeviceIdentifier,
      name: 'Test Display',
      orientation: 'landscape',
      resolution: '1920x1080',
      timezone: 'America/New_York',
    };

    it('should create a new display successfully', async () => {
      databaseService.display.findUnique.mockResolvedValue(null);
      databaseService.display.create.mockResolvedValue(mockDisplay);

      const result = await service.create(mockOrganizationId, createDto);

      expect(databaseService.display.findUnique).toHaveBeenCalledWith({
        where: { deviceIdentifier: mockDeviceIdentifier },
      });
      expect(databaseService.display.create).toHaveBeenCalledWith({
        data: {
          deviceIdentifier: mockDeviceIdentifier,
          nickname: 'Test Display',
          orientation: 'landscape',
          resolution: '1920x1080',
          timezone: 'America/New_York',
          organizationId: mockOrganizationId,
        },
      });
      expect(result).toEqual(mockDisplay);
    });

    it('should throw ConflictException if device ID already exists', async () => {
      databaseService.display.findUnique.mockResolvedValue(mockDisplay);

      await expect(
        service.create(mockOrganizationId, createDto)
      ).rejects.toThrow(ConflictException);

      expect(databaseService.display.findUnique).toHaveBeenCalledWith({
        where: { deviceIdentifier: mockDeviceIdentifier },
      });
      expect(databaseService.display.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const pagination: PaginationDto = { page: 1, limit: 10 };
    const mockDisplays = [mockDisplay];

    it('should return paginated displays for an organization', async () => {
      databaseService.display.findMany.mockResolvedValue(mockDisplays);
      databaseService.display.count.mockResolvedValue(1);

      const result = await service.findAll(mockOrganizationId, pagination);

      expect(databaseService.display.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });
      expect(databaseService.display.count).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
      });
      expect(result.data).toEqual(mockDisplays);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should handle pagination correctly for page 2', async () => {
      const page2Pagination = { page: 2, limit: 10 };
      databaseService.display.findMany.mockResolvedValue([]);
      databaseService.display.count.mockResolvedValue(15);

      const result = await service.findAll(mockOrganizationId, page2Pagination);

      expect(databaseService.display.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });
      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should return empty list when no displays exist', async () => {
      databaseService.display.findMany.mockResolvedValue([]);
      databaseService.display.count.mockResolvedValue(0);

      const result = await service.findAll(mockOrganizationId, pagination);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findOne', () => {
    const mockDisplayWithRelations = {
      ...mockDisplay,
      tags: [],
      groups: [],
      schedules: [],
    };

    it('should return a display by ID for the organization', async () => {
      databaseService.display.findFirst.mockResolvedValue(mockDisplayWithRelations);

      const result = await service.findOne(mockOrganizationId, mockDisplayId);

      expect(databaseService.display.findFirst).toHaveBeenCalledWith({
        where: { id: mockDisplayId, organizationId: mockOrganizationId },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          groups: {
            include: {
              displayGroup: true,
            },
          },
          schedules: {
            where: { isActive: true },
            include: {
              playlist: true,
            },
          },
        },
      });
      expect(result).toEqual(mockDisplayWithRelations);
    });

    it('should throw NotFoundException if display not found', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockOrganizationId, mockDisplayId)
      ).rejects.toThrow(NotFoundException);

      expect(databaseService.display.findFirst).toHaveBeenCalled();
    });

    it('should throw NotFoundException if display belongs to different organization', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('different-org', mockDisplayId)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const mockDisplayWithRelations = {
      ...mockDisplay,
      tags: [],
      groups: [],
      schedules: [],
    };

    it('should update a display successfully', async () => {
      const updateDto: UpdateDisplayDto = {
        name: 'Updated Display',
        orientation: 'portrait',
      };

      databaseService.display.findFirst.mockResolvedValue(mockDisplayWithRelations);
      databaseService.display.update.mockResolvedValue({
        ...mockDisplay,
        nickname: 'Updated Display',
        orientation: 'portrait',
      });

      const result = await service.update(mockOrganizationId, mockDisplayId, updateDto);

      expect(databaseService.display.findFirst).toHaveBeenCalled();
      expect(databaseService.display.update).toHaveBeenCalledWith({
        where: { id: mockDisplayId },
        data: {
          orientation: 'portrait',
          nickname: 'Updated Display',
        },
      });
      expect(result.nickname).toBe('Updated Display');
    });

    it('should throw NotFoundException if display not found', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockOrganizationId, mockDisplayId, {})
      ).rejects.toThrow(NotFoundException);

      expect(databaseService.display.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if new deviceId already exists', async () => {
      const updateDto: UpdateDisplayDto = {
        deviceId: 'existing-device-id',
      };

      databaseService.display.findFirst
        .mockResolvedValueOnce(mockDisplayWithRelations) // For findOne check
        .mockResolvedValueOnce(mockDisplay); // For deviceId conflict check

      await expect(
        service.update(mockOrganizationId, mockDisplayId, updateDto)
      ).rejects.toThrow(ConflictException);

      expect(databaseService.display.update).not.toHaveBeenCalled();
    });

    it('should allow updating deviceId if not conflicting', async () => {
      const updateDto: UpdateDisplayDto = {
        deviceId: 'new-device-id',
      };

      databaseService.display.findFirst
        .mockResolvedValueOnce(mockDisplayWithRelations) // For findOne check
        .mockResolvedValueOnce(null); // No conflict

      databaseService.display.update.mockResolvedValue({
        ...mockDisplay,
        deviceIdentifier: 'new-device-id',
      });

      const result = await service.update(mockOrganizationId, mockDisplayId, updateDto);

      expect(databaseService.display.update).toHaveBeenCalledWith({
        where: { id: mockDisplayId },
        data: {
          deviceIdentifier: 'new-device-id',
        },
      });
      expect(result.deviceIdentifier).toBe('new-device-id');
    });
  });

  describe('updateHeartbeat', () => {
    it('should update display heartbeat and status to online', async () => {
      const updatedDisplay = {
        ...mockDisplay,
        lastHeartbeat: new Date(),
        status: 'online',
      };
      databaseService.display.update.mockResolvedValue(updatedDisplay);

      const result = await service.updateHeartbeat(mockDeviceIdentifier);

      expect(databaseService.display.update).toHaveBeenCalledWith({
        where: { deviceIdentifier: mockDeviceIdentifier },
        data: {
          lastHeartbeat: expect.any(Date),
          status: 'online',
        },
      });
      expect(result.status).toBe('online');
    });
  });

  describe('remove', () => {
    const mockDisplayWithRelations = {
      ...mockDisplay,
      tags: [],
      groups: [],
      schedules: [],
    };

    it('should delete a display successfully', async () => {
      databaseService.display.findFirst.mockResolvedValue(mockDisplayWithRelations);
      databaseService.display.delete.mockResolvedValue(mockDisplay);

      const result = await service.remove(mockOrganizationId, mockDisplayId);

      expect(databaseService.display.findFirst).toHaveBeenCalled();
      expect(databaseService.display.delete).toHaveBeenCalledWith({
        where: { id: mockDisplayId },
      });
      expect(result).toEqual(mockDisplay);
    });

    it('should throw NotFoundException if display not found', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(mockOrganizationId, mockDisplayId)
      ).rejects.toThrow(NotFoundException);

      expect(databaseService.display.delete).not.toHaveBeenCalled();
    });
  });
});

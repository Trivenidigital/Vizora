import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { of } from 'rxjs';
import { DisplaysService } from './displays.service';
import { DatabaseService } from '../database/database.service';
import { CircuitBreakerService, CircuitState } from '../common/services/circuit-breaker.service';
import { StorageService } from '../storage/storage.service';
import {
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('DisplaysService', () => {
  let service: DisplaysService;
  let databaseService: jest.Mocked<DatabaseService>;
  let httpService: jest.Mocked<HttpService>;

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
    process.env.INTERNAL_API_SECRET = 'test-internal-secret';

    const mockDatabaseService = {
      display: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      content: {
        findFirst: jest.fn(),
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
        {
          provide: StorageService,
          useValue: {
            healthCheck: jest.fn().mockResolvedValue({ healthy: true, bucket: 'vizora' }),
            getSignedUrl: jest.fn().mockResolvedValue('https://example.com/signed'),
            resolveUrl: jest.fn().mockImplementation((url) => url),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DisplaysService>(DisplaysService);
    databaseService = module.get(DatabaseService);
    httpService = module.get(HttpService);
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
      databaseService.display.create.mockResolvedValue(mockDisplay);

      const result = await service.create(mockOrganizationId, createDto);

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
      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      databaseService.display.create.mockRejectedValue(prismaError);

      await expect(
        service.create(mockOrganizationId, createDto)
      ).rejects.toThrow(ConflictException);

      expect(databaseService.display.create).toHaveBeenCalled();
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
      databaseService.display.updateMany.mockResolvedValue({ count: 1 });
      databaseService.display.findUnique.mockResolvedValue({
        ...mockDisplay,
        nickname: 'Updated Display',
        orientation: 'portrait',
      });

      const result = await service.update(mockOrganizationId, mockDisplayId, updateDto);

      expect(databaseService.display.findFirst).toHaveBeenCalled();
      expect(databaseService.display.updateMany).toHaveBeenCalledWith({
        where: { id: mockDisplayId, organizationId: mockOrganizationId },
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

      expect(databaseService.display.updateMany).not.toHaveBeenCalled();
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

      expect(databaseService.display.updateMany).not.toHaveBeenCalled();
    });

    it('should allow updating deviceId if not conflicting', async () => {
      const updateDto: UpdateDisplayDto = {
        deviceId: 'new-device-id',
      };

      databaseService.display.findFirst
        .mockResolvedValueOnce(mockDisplayWithRelations) // For findOne check
        .mockResolvedValueOnce(null); // No conflict

      databaseService.display.updateMany.mockResolvedValue({ count: 1 });
      databaseService.display.findUnique.mockResolvedValue({
        ...mockDisplay,
        deviceIdentifier: 'new-device-id',
      });

      const result = await service.update(mockOrganizationId, mockDisplayId, updateDto);

      expect(databaseService.display.updateMany).toHaveBeenCalledWith({
        where: { id: mockDisplayId, organizationId: mockOrganizationId },
        data: {
          deviceIdentifier: 'new-device-id',
        },
      });
      expect(result.deviceIdentifier).toBe('new-device-id');
    });
  });

  describe('updateHeartbeat', () => {
    it('should update display heartbeat and status to online', async () => {
      databaseService.display.findFirst.mockResolvedValue({
        id: mockDisplayId,
        status: 'online',
        nickname: 'Test Display',
        organizationId: mockOrganizationId,
      } as any);
      databaseService.display.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateHeartbeat(mockDeviceIdentifier);

      expect(databaseService.display.findFirst).toHaveBeenCalledWith({
        where: { deviceIdentifier: mockDeviceIdentifier },
        select: { id: true, status: true, nickname: true, organizationId: true },
      });
      expect(databaseService.display.updateMany).toHaveBeenCalledWith({
        where: { deviceIdentifier: mockDeviceIdentifier },
        data: {
          lastHeartbeat: expect.any(Date),
          status: 'online',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should emit device.online event on status transition from offline', async () => {
      databaseService.display.findFirst.mockResolvedValue({
        id: mockDisplayId,
        status: 'offline',
        nickname: 'Test Display',
        organizationId: mockOrganizationId,
      } as any);
      databaseService.display.updateMany.mockResolvedValue({ count: 1 });

      await service.updateHeartbeat(mockDeviceIdentifier);

      const eventEmitter = (service as any).eventEmitter;
      expect(eventEmitter.emit).toHaveBeenCalledWith('device.online', {
        deviceId: mockDisplayId,
        deviceName: 'Test Display',
        organizationId: mockOrganizationId,
      });
    });

    it('should not emit device.online event when already online', async () => {
      databaseService.display.findFirst.mockResolvedValue({
        id: mockDisplayId,
        status: 'online',
        nickname: 'Test Display',
        organizationId: mockOrganizationId,
      } as any);
      databaseService.display.updateMany.mockResolvedValue({ count: 1 });

      await service.updateHeartbeat(mockDeviceIdentifier);

      const eventEmitter = (service as any).eventEmitter;
      expect(eventEmitter.emit).not.toHaveBeenCalledWith('device.online', expect.anything());
    });

    it('should throw NotFoundException if device not found', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(service.updateHeartbeat('unknown-device')).rejects.toThrow(
        NotFoundException,
      );
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
      databaseService.display.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.remove(mockOrganizationId, mockDisplayId);

      expect(databaseService.display.findFirst).toHaveBeenCalled();
      expect(databaseService.display.deleteMany).toHaveBeenCalledWith({
        where: { id: mockDisplayId, organizationId: mockOrganizationId },
      });
      expect(result).toEqual({ id: mockDisplayId });
    });

    it('should throw NotFoundException if display not found', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(mockOrganizationId, mockDisplayId)
      ).rejects.toThrow(NotFoundException);

      expect(databaseService.display.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('requestScreenshot', () => {
    const mockDisplayWithRelations = {
      ...mockDisplay,
      status: 'online',
      tags: [],
      groups: [],
      schedules: [],
    };

    it('should request screenshot successfully', async () => {
      databaseService.display.findFirst.mockResolvedValue(mockDisplayWithRelations);
      httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

      const result = await service.requestScreenshot(mockOrganizationId, mockDisplayId);

      expect(result).toHaveProperty('requestId');
      expect(typeof result.requestId).toBe('string');
      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/internal/command'),
        expect.objectContaining({
          deviceId: mockDisplayId,
          command: {
            type: 'screenshot',
            payload: expect.objectContaining({ requestId: expect.any(String) }),
          },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-internal-api-key': expect.any(String) }),
        }),
      );
    });

    it('should throw NotFoundException if display not found', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(
        service.requestScreenshot(mockOrganizationId, mockDisplayId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if device is offline', async () => {
      databaseService.display.findFirst.mockResolvedValue({
        ...mockDisplayWithRelations,
        status: 'offline',
      });

      await expect(
        service.requestScreenshot(mockOrganizationId, mockDisplayId)
      ).rejects.toThrow(ConflictException);
    });

    it('should throw error if display belongs to different organization', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(
        service.requestScreenshot('different-org', mockDisplayId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ServiceUnavailableException when INTERNAL_API_SECRET is missing', async () => {
      // Regression: previously threw a generic Error → unhandled by the
      // NestJS HTTP layer → the user got a bare 500 with no useful
      // message in error tracking. Now mapped to 503.
      const previousSecret = process.env.INTERNAL_API_SECRET;
      delete process.env.INTERNAL_API_SECRET;
      try {
        databaseService.display.findFirst.mockResolvedValue(mockDisplayWithRelations);
        await expect(
          service.requestScreenshot(mockOrganizationId, mockDisplayId)
        ).rejects.toThrow(ServiceUnavailableException);
      } finally {
        if (previousSecret !== undefined) {
          process.env.INTERNAL_API_SECRET = previousSecret;
        }
      }
    });

    it('should throw ServiceUnavailableException when realtime does not acknowledge screenshot delivery', async () => {
      databaseService.display.findFirst.mockResolvedValue(mockDisplayWithRelations);
      httpService.post.mockReturnValue(of({
        data: {
          success: false,
          message: 'Command delivery failed: ack_timeout',
        },
      }) as any);

      await expect(
        service.requestScreenshot(mockOrganizationId, mockDisplayId)
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('display commands', () => {
    beforeEach(() => {
      httpService.post.mockReturnValue(of({ data: { success: true } }) as any);
    });

    it('should send disable commands using realtime internal command DTO shape', async () => {
      databaseService.display.updateMany.mockResolvedValue({ count: 1 } as any);

      await service.disableDevice(mockDisplayId, mockOrganizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/internal/command'),
        {
          deviceId: mockDisplayId,
          command: {
            type: 'disable',
            payload: undefined,
          },
        },
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-internal-api-key': expect.any(String) }),
        }),
      );
    });

    it('should send enable commands using realtime internal command DTO shape', async () => {
      databaseService.display.updateMany.mockResolvedValue({ count: 1 } as any);

      await service.enableDevice(mockDisplayId, mockOrganizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/internal/command'),
        {
          deviceId: mockDisplayId,
          command: {
            type: 'enable',
            payload: undefined,
          },
        },
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-internal-api-key': expect.any(String) }),
        }),
      );
    });
  });

  describe('getLastScreenshot', () => {
    const mockDisplayWithRelations = {
      ...mockDisplay,
      tags: [],
      groups: [],
      schedules: [],
      lastScreenshot: JSON.stringify({
        url: 'https://example.com/screenshot.png',
        width: 1920,
        height: 1080,
      }),
      lastScreenshotAt: new Date('2026-02-05T10:00:00Z'),
    };

    it('should return screenshot data', async () => {
      databaseService.display.findFirst.mockResolvedValue(mockDisplayWithRelations);

      const result = await service.getLastScreenshot(mockOrganizationId, mockDisplayId);

      expect(result).toEqual({
        url: 'https://example.com/screenshot.png',
        width: 1920,
        height: 1080,
        capturedAt: new Date('2026-02-05T10:00:00Z'),
      });
    });

    it('should return null when no screenshot available', async () => {
      databaseService.display.findFirst.mockResolvedValue({
        ...mockDisplayWithRelations,
        lastScreenshot: null,
        lastScreenshotAt: null,
      });

      const result = await service.getLastScreenshot(mockOrganizationId, mockDisplayId);

      expect(result).toBeNull();
    });

    it('should throw NotFoundException if display not found', async () => {
      databaseService.display.findFirst.mockResolvedValue(null);

      await expect(
        service.getLastScreenshot(mockOrganizationId, mockDisplayId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle legacy plain URL format', async () => {
      databaseService.display.findFirst.mockResolvedValue({
        ...mockDisplayWithRelations,
        lastScreenshot: 'https://example.com/legacy-screenshot.png',
        lastScreenshotAt: new Date('2026-02-05T10:00:00Z'),
      });

      const result = await service.getLastScreenshot(mockOrganizationId, mockDisplayId);

      expect(result).toEqual({
        url: 'https://example.com/legacy-screenshot.png',
        capturedAt: new Date('2026-02-05T10:00:00Z'),
      });
    });
  });

  describe('saveScreenshot', () => {
    it('should save screenshot metadata', async () => {
      databaseService.display.update.mockResolvedValue(mockDisplay);

      await service.saveScreenshot(
        mockDisplayId,
        mockOrganizationId,
        'https://example.com/screenshot.png',
        1920,
        1080,
      );

      expect(databaseService.display.update).toHaveBeenCalledWith({
        where: { id: mockDisplayId, organizationId: mockOrganizationId },
        data: {
          lastScreenshot: JSON.stringify({
            url: 'https://example.com/screenshot.png',
            width: 1920,
            height: 1080,
          }),
          lastScreenshotAt: expect.any(Date),
        },
      });
    });

    it('should save screenshot without dimensions', async () => {
      databaseService.display.update.mockResolvedValue(mockDisplay);

      await service.saveScreenshot(
        mockDisplayId,
        mockOrganizationId,
        'https://example.com/screenshot.png',
      );

      expect(databaseService.display.update).toHaveBeenCalledWith({
        where: { id: mockDisplayId, organizationId: mockOrganizationId },
        data: {
          lastScreenshot: JSON.stringify({
            url: 'https://example.com/screenshot.png',
          }),
          lastScreenshotAt: expect.any(Date),
        },
      });
    });
  });

  describe('detectOfflineDevices', () => {
    it('should mark stale devices offline and emit device.offline events', async () => {
      const staleDevices = [
        { id: 'device-1', nickname: 'Lobby TV', deviceIdentifier: 'dev-1', organizationId: 'org-1' },
        { id: 'device-2', nickname: null, deviceIdentifier: 'dev-2', organizationId: 'org-1' },
      ];
      databaseService.display.findMany.mockResolvedValue(staleDevices as any);
      databaseService.display.updateMany.mockResolvedValue({ count: 2 });

      await service.detectOfflineDevices();

      expect(databaseService.display.findMany).toHaveBeenCalledWith({
        where: {
          status: 'online',
          lastHeartbeat: { lt: expect.any(Date) },
        },
        select: { id: true, nickname: true, deviceIdentifier: true, organizationId: true },
      });
      expect(databaseService.display.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['device-1', 'device-2'] } },
        data: { status: 'offline' },
      });
      const eventEmitter = (service as any).eventEmitter;
      expect(eventEmitter.emit).toHaveBeenCalledWith('device.offline', {
        deviceId: 'device-1', deviceName: 'Lobby TV', organizationId: 'org-1',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('device.offline', {
        deviceId: 'device-2', deviceName: 'dev-2', organizationId: 'org-1',
      });
    });

    it('should not update when no stale devices found', async () => {
      databaseService.display.findMany.mockResolvedValue([]);

      await service.detectOfflineDevices();

      expect(databaseService.display.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('resetStalePairingDevices', () => {
    it('resets displays stuck in status=pairing for >30 min back to offline', async () => {
      // Devices that were paired but never made first WebSocket connection
      // (device lost power / network / QR code never scanned). Stay in
      // 'pairing' forever and block re-pairing of the same deviceIdentifier
      // until the operator manually intervenes.
      const stalePairing = [
        { id: 'dev-stale-1', nickname: 'Foyer', deviceIdentifier: 'mac-1', organizationId: 'org-1' },
        { id: 'dev-stale-2', nickname: null, deviceIdentifier: 'mac-2', organizationId: 'org-1' },
      ];
      databaseService.display.findMany.mockResolvedValue(stalePairing as any);
      databaseService.display.updateMany.mockResolvedValue({ count: 2 });

      await service.resetStalePairingDevices();

      // Query uses updatedAt (not lastHeartbeat — pairing devices haven't
      // heartbeated yet by definition).
      expect(databaseService.display.findMany).toHaveBeenCalledWith({
        where: {
          status: 'pairing',
          updatedAt: { lt: expect.any(Date) },
        },
        select: { id: true, nickname: true, deviceIdentifier: true, organizationId: true },
      });
      expect(databaseService.display.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['dev-stale-1', 'dev-stale-2'] } },
        data: { status: 'offline' },
      });
    });

    it('no-ops when no stale pairing devices found', async () => {
      databaseService.display.findMany.mockResolvedValue([]);

      await service.resetStalePairingDevices();

      expect(databaseService.display.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('pushContent', () => {
    const mockContent = {
      id: 'content-123',
      name: 'Lunch Specials',
      type: 'image',
      url: 'minio://org/content.jpg',
      thumbnail: 'https://example.com/thumb.jpg',
      mimeType: 'image/jpeg',
      duration: 10,
      organizationId: mockOrganizationId,
    };

    beforeEach(() => {
      databaseService.display.findFirst.mockResolvedValue(mockDisplay as any);
      (databaseService as any).content.findFirst.mockResolvedValue(mockContent);
    });

    it('returns success when realtime accepts the content push', async () => {
      httpService.post.mockReturnValue(
        of({ data: { success: true, message: 'Content pushed to device' } } as any),
      );

      await expect(
        service.pushContent(mockOrganizationId, mockDisplayId, mockContent.id, 5),
      ).resolves.toEqual({ success: true, message: 'Content pushed to display' });
    });

    it('throws ServiceUnavailableException when realtime reports delivery failure', async () => {
      httpService.post.mockReturnValue(
        of({ data: { success: false, message: 'Content push failed: no_sockets' } } as any),
      );

      await expect(
        service.pushContent(mockOrganizationId, mockDisplayId, mockContent.id, 5),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('does not open the shared realtime circuit when realtime returns an application-level delivery failure', async () => {
      const realCircuitBreaker = new CircuitBreakerService();
      const serviceWithRealCircuit = new DisplaysService(
        databaseService,
        {} as any,
        httpService,
        realCircuitBreaker,
        {
          healthCheck: jest.fn(),
          getSignedUrl: jest.fn(),
          resolveUrl: jest.fn().mockImplementation((url) => url),
        } as any,
        { emit: jest.fn() } as any,
      );

      httpService.post.mockReturnValue(
        of({ data: { success: false, message: 'Content push failed: no_sockets' } } as any),
      );

      for (let attempt = 0; attempt < 6; attempt++) {
        await expect(
          serviceWithRealCircuit.pushContent(mockOrganizationId, mockDisplayId, mockContent.id, 5),
        ).rejects.toThrow(ServiceUnavailableException);
      }

      expect(realCircuitBreaker.getCircuitState('realtime-service')).toBe(CircuitState.CLOSED);
      expect(realCircuitBreaker.getCircuitStats('realtime-service').recentFailures).toBe(0);
      expect(httpService.post).toHaveBeenCalledTimes(6);
    });

    it('throws ServiceUnavailableException when internal realtime auth is not configured', async () => {
      delete process.env.INTERNAL_API_SECRET;

      await expect(
        service.pushContent(mockOrganizationId, mockDisplayId, mockContent.id, 5),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });
});

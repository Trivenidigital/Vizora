import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DisplaysController } from './displays.controller';
import { DisplaysService } from './displays.service';
import { DatabaseService } from '../database/database.service';

describe('DisplaysController', () => {
  let controller: DisplaysController;
  let mockDisplaysService: jest.Mocked<DisplaysService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockDisplaysService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      generatePairingToken: jest.fn(),
      updateHeartbeat: jest.fn(),
      remove: jest.fn(),
      pushContent: jest.fn(),
      getTags: jest.fn(),
      addTags: jest.fn(),
      removeTags: jest.fn(),
      requestScreenshot: jest.fn(),
      getLastScreenshot: jest.fn(),
    } as any;

    // Mock DatabaseService for QuotaGuard
    mockDatabaseService = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          screenQuota: 100,
          _count: { displays: 5 },
        }),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisplaysController],
      providers: [
        { provide: DisplaysService, useValue: mockDisplaysService },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: JwtService, useValue: { verify: jest.fn().mockReturnValue({ type: 'device', deviceIdentifier: 'device-123', sub: 'device-123' }), verifyAsync: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<DisplaysController>(DisplaysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDisplayDto = {
      nickname: 'Living Room Display',
      deviceIdentifier: 'device-abc123',
      location: 'Living Room',
    };

    it('should create a display', async () => {
      const expectedDisplay = { id: 'display-123', ...createDisplayDto };
      mockDisplaysService.create.mockResolvedValue(expectedDisplay as any);

      const result = await controller.create(organizationId, createDisplayDto as any);

      expect(result).toEqual(expectedDisplay);
      expect(mockDisplaysService.create).toHaveBeenCalledWith(organizationId, createDisplayDto);
    });
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 10 };

    it('should return all displays with pagination', async () => {
      const expectedResult = {
        data: [{ id: 'display-1' }, { id: 'display-2' }],
        total: 2,
      };
      mockDisplaysService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockDisplaysService.findAll).toHaveBeenCalledWith(organizationId, pagination);
    });

    it('should handle empty results', async () => {
      const expectedResult = { data: [], total: 0 };
      mockDisplaysService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a display by id', async () => {
      const expectedDisplay = { id: 'display-123', nickname: 'Test Display' };
      mockDisplaysService.findOne.mockResolvedValue(expectedDisplay as any);

      const result = await controller.findOne(organizationId, 'display-123');

      expect(result).toEqual(expectedDisplay);
      expect(mockDisplaysService.findOne).toHaveBeenCalledWith(organizationId, 'display-123');
    });
  });

  describe('update', () => {
    it('should update a display', async () => {
      const updateDto = { nickname: 'Updated Display Name' };
      const expectedDisplay = { id: 'display-123', ...updateDto };
      mockDisplaysService.update.mockResolvedValue(expectedDisplay as any);

      const result = await controller.update(organizationId, 'display-123', updateDto as any);

      expect(result).toEqual(expectedDisplay);
      expect(mockDisplaysService.update).toHaveBeenCalledWith(
        organizationId,
        'display-123',
        updateDto,
      );
    });
  });

  describe('generatePairingToken', () => {
    it('should generate a pairing token for a display', async () => {
      const expectedResult = { token: 'pairing-token-123', expiresAt: new Date().toISOString() };
      mockDisplaysService.generatePairingToken.mockResolvedValue(expectedResult as any);

      const result = await controller.generatePairingToken(organizationId, 'display-123');

      expect(result).toEqual(expectedResult);
      expect(mockDisplaysService.generatePairingToken).toHaveBeenCalledWith(
        organizationId,
        'display-123',
      );
    });
  });

  describe('heartbeat', () => {
    it('should update heartbeat for a device with valid JWT', async () => {
      const expectedResult = { success: true, lastSeen: new Date().toISOString() };
      mockDisplaysService.updateHeartbeat.mockResolvedValue(expectedResult as any);

      const mockReq = { headers: { authorization: 'Bearer valid-device-token' } };
      const result = await controller.heartbeat('device-123', mockReq as any);

      expect(result).toEqual(expectedResult);
      expect(mockDisplaysService.updateHeartbeat).toHaveBeenCalledWith('device-123');
    });

    it('should work with valid device JWT (public endpoint)', async () => {
      mockDisplaysService.updateHeartbeat.mockResolvedValue({ success: true } as any);

      const mockReq = { headers: { authorization: 'Bearer valid-device-token' } };
      const result = await controller.heartbeat('device-123', mockReq as any);

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('remove', () => {
    it('should remove a display', async () => {
      mockDisplaysService.remove.mockResolvedValue(undefined);

      await controller.remove(organizationId, 'display-123');

      expect(mockDisplaysService.remove).toHaveBeenCalledWith(organizationId, 'display-123');
    });
  });

  describe('pushContent', () => {
    it('should push content to a display', async () => {
      const expectedResult = { success: true, message: 'Content pushed to display' };
      mockDisplaysService.pushContent.mockResolvedValue(expectedResult as any);

      const result = await controller.pushContent(organizationId, 'display-123', {
        contentId: 'content-456',
        duration: 60,
      });

      expect(result).toEqual(expectedResult);
      expect(mockDisplaysService.pushContent).toHaveBeenCalledWith(
        organizationId,
        'display-123',
        'content-456',
        60,
      );
    });

    it('should push content without duration', async () => {
      const expectedResult = { success: true, message: 'Content pushed to display' };
      mockDisplaysService.pushContent.mockResolvedValue(expectedResult as any);

      const result = await controller.pushContent(organizationId, 'display-123', {
        contentId: 'content-456',
      });

      expect(result).toEqual(expectedResult);
      expect(mockDisplaysService.pushContent).toHaveBeenCalledWith(
        organizationId,
        'display-123',
        'content-456',
        undefined,
      );
    });
  });

  describe('getTags', () => {
    it('should return tags for a display', async () => {
      const expectedTags = [
        { id: 'tag-1', name: 'Lobby' },
        { id: 'tag-2', name: 'Floor 1' },
      ];
      mockDisplaysService.getTags.mockResolvedValue(expectedTags as any);

      const result = await controller.getTags(organizationId, 'display-123');

      expect(result).toEqual(expectedTags);
      expect(mockDisplaysService.getTags).toHaveBeenCalledWith(organizationId, 'display-123');
    });
  });

  describe('addTags', () => {
    it('should add tags to a display', async () => {
      const expectedTags = [
        { id: 'tag-1', name: 'Lobby' },
        { id: 'tag-2', name: 'Floor 1' },
      ];
      mockDisplaysService.addTags.mockResolvedValue(expectedTags as any);

      const result = await controller.addTags(organizationId, 'display-123', {
        tagIds: ['tag-1', 'tag-2'],
      });

      expect(result).toEqual(expectedTags);
      expect(mockDisplaysService.addTags).toHaveBeenCalledWith(
        organizationId,
        'display-123',
        ['tag-1', 'tag-2'],
      );
    });
  });

  describe('removeTags', () => {
    it('should remove tags from a display', async () => {
      const expectedResult = { success: true, removed: 2 };
      mockDisplaysService.removeTags.mockResolvedValue(expectedResult as any);

      const result = await controller.removeTags(organizationId, 'display-123', {
        tagIds: ['tag-1', 'tag-2'],
      });

      expect(result).toEqual(expectedResult);
      expect(mockDisplaysService.removeTags).toHaveBeenCalledWith(
        organizationId,
        'display-123',
        ['tag-1', 'tag-2'],
      );
    });
  });

  describe('requestScreenshot', () => {
    it('should request screenshot successfully', async () => {
      const expectedResult = { requestId: 'request-123' };
      mockDisplaysService.requestScreenshot.mockResolvedValue(expectedResult as any);

      const result = await controller.requestScreenshot('display-123', organizationId);

      expect(result).toEqual({
        requestId: 'request-123',
        status: 'pending',
      });
      expect(mockDisplaysService.requestScreenshot).toHaveBeenCalledWith(
        organizationId,
        'display-123',
      );
    });

    it('should handle errors when requesting screenshot', async () => {
      mockDisplaysService.requestScreenshot.mockRejectedValue(new Error('Device offline'));

      await expect(
        controller.requestScreenshot('display-123', organizationId)
      ).rejects.toThrow('Device offline');
    });
  });

  describe('getScreenshot', () => {
    it('should return screenshot data', async () => {
      const expectedScreenshot = {
        url: 'https://example.com/screenshot.png',
        capturedAt: new Date('2026-02-05T10:00:00Z'),
        width: 1920,
        height: 1080,
      };
      mockDisplaysService.getLastScreenshot.mockResolvedValue(expectedScreenshot as any);

      const result = await controller.getScreenshot('display-123', organizationId);

      expect(result).toEqual({
        url: 'https://example.com/screenshot.png',
        capturedAt: '2026-02-05T10:00:00.000Z',
        width: 1920,
        height: 1080,
      });
      expect(mockDisplaysService.getLastScreenshot).toHaveBeenCalledWith(
        organizationId,
        'display-123',
      );
    });

    it('should return null when no screenshot available', async () => {
      mockDisplaysService.getLastScreenshot.mockResolvedValue(null);

      const result = await controller.getScreenshot('display-123', organizationId);

      expect(result).toBeNull();
    });

    it('should handle errors when getting screenshot', async () => {
      mockDisplaysService.getLastScreenshot.mockRejectedValue(new Error('Display not found'));

      await expect(
        controller.getScreenshot('display-123', organizationId)
      ).rejects.toThrow('Display not found');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { DisplaysController } from './displays.controller';
import { DisplaysService } from './displays.service';

describe('DisplaysController', () => {
  let controller: DisplaysController;
  let mockDisplaysService: jest.Mocked<DisplaysService>;

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
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisplaysController],
      providers: [{ provide: DisplaysService, useValue: mockDisplaysService }],
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
    it('should update heartbeat for a device', async () => {
      const expectedResult = { success: true, lastSeen: new Date().toISOString() };
      mockDisplaysService.updateHeartbeat.mockResolvedValue(expectedResult as any);

      const result = await controller.heartbeat('device-123');

      expect(result).toEqual(expectedResult);
      expect(mockDisplaysService.updateHeartbeat).toHaveBeenCalledWith('device-123');
    });

    it('should work without authentication (public endpoint)', async () => {
      mockDisplaysService.updateHeartbeat.mockResolvedValue({ success: true } as any);

      // This is a public endpoint, so it should work without organizationId
      const result = await controller.heartbeat('device-456');

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
});

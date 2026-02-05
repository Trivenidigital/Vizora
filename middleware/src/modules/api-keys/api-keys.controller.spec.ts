import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let mockApiKeysService: jest.Mocked<ApiKeysService>;

  const organizationId = 'org-123';
  const userId = 'user-123';

  const mockApiKey = {
    id: 'key-123',
    name: 'Test API Key',
    prefix: 'vz_live_',
    scopes: ['read:all'],
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockApiKeysService = {
      create: jest.fn(),
      findAll: jest.fn(),
      validateKey: jest.fn(),
      revoke: jest.fn(),
      updateLastUsed: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [{ provide: ApiKeysService, useValue: mockApiKeysService }],
    }).compile();

    controller = module.get<ApiKeysController>(ApiKeysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Production API Key',
      scopes: ['read:content', 'write:content'],
    };

    it('should create an API key and return key with metadata', async () => {
      const expectedResult = {
        key: 'vz_live_abc123xyz',
        apiKey: mockApiKey,
      };
      mockApiKeysService.create.mockResolvedValue(expectedResult as any);

      const result = await controller.create(createDto, organizationId, userId);

      expect(result).toEqual(expectedResult);
      expect(mockApiKeysService.create).toHaveBeenCalledWith(
        organizationId,
        userId,
        createDto,
      );
    });

    it('should create key with default scopes when none provided', async () => {
      const minimalDto = { name: 'Minimal Key' };
      mockApiKeysService.create.mockResolvedValue({
        key: 'vz_live_xyz',
        apiKey: { ...mockApiKey, name: 'Minimal Key' },
      } as any);

      await controller.create(minimalDto, organizationId, userId);

      expect(mockApiKeysService.create).toHaveBeenCalledWith(
        organizationId,
        userId,
        minimalDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return all API keys for the organization', async () => {
      const expectedKeys = [mockApiKey, { ...mockApiKey, id: 'key-456' }];
      mockApiKeysService.findAll.mockResolvedValue(expectedKeys as any);

      const result = await controller.findAll(organizationId);

      expect(result).toEqual(expectedKeys);
      expect(mockApiKeysService.findAll).toHaveBeenCalledWith(organizationId);
    });

    it('should return empty array when no keys exist', async () => {
      mockApiKeysService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(organizationId);

      expect(result).toEqual([]);
    });
  });

  describe('revoke', () => {
    it('should revoke an API key and return success', async () => {
      mockApiKeysService.revoke.mockResolvedValue({ count: 1 } as any);

      const result = await controller.revoke('key-123', organizationId);

      expect(result).toEqual({ success: true });
      expect(mockApiKeysService.revoke).toHaveBeenCalledWith(
        organizationId,
        'key-123',
      );
    });

    it('should call revoke even if key does not exist', async () => {
      mockApiKeysService.revoke.mockResolvedValue({ count: 0 } as any);

      const result = await controller.revoke('non-existent', organizationId);

      expect(result).toEqual({ success: true });
      expect(mockApiKeysService.revoke).toHaveBeenCalledWith(
        organizationId,
        'non-existent',
      );
    });
  });
});

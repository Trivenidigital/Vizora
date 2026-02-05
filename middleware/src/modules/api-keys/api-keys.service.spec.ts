import * as crypto from 'crypto';
import { ApiKeysService } from './api-keys.service';
import { DatabaseService } from '../database/database.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let mockDatabaseService: any;

  const mockApiKey = {
    id: 'key-123',
    name: 'Test API Key',
    prefix: 'vz_live_',
    hashedKey: 'hashed-key-value',
    scopes: ['read:all'],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    organizationId: 'org-123',
    createdById: 'user-123',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockDatabaseService = {
      apiKey: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    service = new ApiKeysService(mockDatabaseService as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New API Key',
      scopes: ['read:content', 'write:content'],
    };

    it('should create an API key and return plain key with metadata', async () => {
      mockDatabaseService.apiKey.create.mockResolvedValue({
        ...mockApiKey,
        name: createDto.name,
        scopes: createDto.scopes,
      });

      const result = await service.create('org-123', 'user-123', createDto);

      expect(result).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.key).toMatch(/^vz_live_/);
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey.name).toBe(createDto.name);
      expect(result.apiKey.scopes).toEqual(createDto.scopes);
    });

    it('should store hashed key in database', async () => {
      mockDatabaseService.apiKey.create.mockResolvedValue(mockApiKey);

      await service.create('org-123', 'user-123', createDto);

      expect(mockDatabaseService.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: createDto.name,
          prefix: 'vz_live_',
          hashedKey: expect.any(String),
          scopes: createDto.scopes,
          organizationId: 'org-123',
          createdById: 'user-123',
        }),
      });

      // Verify hash is a valid SHA-256 hash (64 hex characters)
      const callArgs = mockDatabaseService.apiKey.create.mock.calls[0][0];
      expect(callArgs.data.hashedKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should use default scopes if none provided', async () => {
      mockDatabaseService.apiKey.create.mockResolvedValue(mockApiKey);

      await service.create('org-123', 'user-123', { name: 'No Scopes Key' });

      expect(mockDatabaseService.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scopes: ['read:all'],
        }),
      });
    });

    it('should set expiration date when provided', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
      mockDatabaseService.apiKey.create.mockResolvedValue(mockApiKey);

      await service.create('org-123', 'user-123', {
        name: 'Expiring Key',
        expiresAt: futureDate,
      });

      expect(mockDatabaseService.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: new Date(futureDate),
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all active API keys for an organization', async () => {
      mockDatabaseService.apiKey.findMany.mockResolvedValue([mockApiKey]);

      const result = await service.findAll('org-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockApiKey.id);
      expect(result[0].name).toBe(mockApiKey.name);
      expect(mockDatabaseService.apiKey.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should not return the hashedKey in response', async () => {
      mockDatabaseService.apiKey.findMany.mockResolvedValue([mockApiKey]);

      const result = await service.findAll('org-123');

      expect(result[0]).not.toHaveProperty('hashedKey');
    });
  });

  describe('validateKey', () => {
    const plainKey = 'vz_live_testkey123456789012345678901234';

    it('should return key record for valid key', async () => {
      const hashedKey = crypto.createHash('sha256').update(plainKey).digest('hex');
      mockDatabaseService.apiKey.findFirst.mockResolvedValue({
        ...mockApiKey,
        hashedKey,
      });

      const result = await service.validateKey(plainKey);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockApiKey.id);
      expect(mockDatabaseService.apiKey.findFirst).toHaveBeenCalledWith({
        where: {
          prefix: 'vz_live_',
          hashedKey,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        },
      });
    });

    it('should return null for non-existent key', async () => {
      mockDatabaseService.apiKey.findFirst.mockResolvedValue(null);

      const result = await service.validateKey('vz_live_invalid');

      expect(result).toBeNull();
    });

    it('should reject revoked keys', async () => {
      mockDatabaseService.apiKey.findFirst.mockResolvedValue(null);

      const result = await service.validateKey(plainKey);

      expect(result).toBeNull();
    });

    it('should reject expired keys', async () => {
      mockDatabaseService.apiKey.findFirst.mockResolvedValue(null);

      const result = await service.validateKey(plainKey);

      expect(result).toBeNull();
    });
  });

  describe('revoke', () => {
    it('should set revokedAt timestamp', async () => {
      mockDatabaseService.apiKey.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke('org-123', 'key-123');

      expect(mockDatabaseService.apiKey.updateMany).toHaveBeenCalledWith({
        where: { id: 'key-123', organizationId: 'org-123' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      mockDatabaseService.apiKey.update.mockResolvedValue(mockApiKey);

      await service.updateLastUsed('key-123');

      expect(mockDatabaseService.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });
});

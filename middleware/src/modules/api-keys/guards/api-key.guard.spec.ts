import { ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from '../api-keys.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockApiKeysService: jest.Mocked<ApiKeysService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  const mockApiKey = {
    id: 'key-123',
    name: 'Test API Key',
    prefix: 'vz_live_',
    hashedKey: 'hashed-key',
    scopes: ['read:all', 'write:content'],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    organizationId: 'org-123',
    createdById: 'user-123',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockApiKeysService = {
      create: jest.fn(),
      findAll: jest.fn(),
      validateKey: jest.fn(),
      revoke: jest.fn(),
      updateLastUsed: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockRequest = {
      headers: {},
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    guard = new ApiKeyGuard(mockApiKeysService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return false when no API key header is present', async () => {
      mockRequest.headers = {};

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
      expect(mockApiKeysService.validateKey).not.toHaveBeenCalled();
    });

    it('should return false when API key is invalid', async () => {
      mockRequest.headers = { 'x-api-key': 'vz_live_invalid' };
      mockApiKeysService.validateKey.mockResolvedValue(null);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
      expect(mockApiKeysService.validateKey).toHaveBeenCalledWith('vz_live_invalid');
    });

    it('should return true and set request context for valid API key', async () => {
      const validKey = 'vz_live_validkey12345678901234567890123';
      mockRequest.headers = { 'x-api-key': validKey };
      mockApiKeysService.validateKey.mockResolvedValue(mockApiKey);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockApiKeysService.validateKey).toHaveBeenCalledWith(validKey);
      expect(mockRequest.organizationId).toBe('org-123');
      expect(mockRequest.apiKeyScopes).toEqual(['read:all', 'write:content']);
      expect(mockRequest.apiKeyId).toBe('key-123');
    });

    it('should update lastUsed timestamp for valid key', async () => {
      const validKey = 'vz_live_validkey12345678901234567890123';
      mockRequest.headers = { 'x-api-key': validKey };
      mockApiKeysService.validateKey.mockResolvedValue(mockApiKey);

      await guard.canActivate(mockExecutionContext);

      // Wait a tick for the fire-and-forget to execute
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockApiKeysService.updateLastUsed).toHaveBeenCalledWith('key-123');
    });

    it('should return false for revoked key', async () => {
      mockRequest.headers = { 'x-api-key': 'vz_live_revokedkey' };
      mockApiKeysService.validateKey.mockResolvedValue(null); // Revoked keys return null

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
    });

    it('should return false for expired key', async () => {
      mockRequest.headers = { 'x-api-key': 'vz_live_expiredkey' };
      mockApiKeysService.validateKey.mockResolvedValue(null); // Expired keys return null

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
    });

    it('should handle updateLastUsed errors silently', async () => {
      const validKey = 'vz_live_validkey12345678901234567890123';
      mockRequest.headers = { 'x-api-key': validKey };
      mockApiKeysService.validateKey.mockResolvedValue(mockApiKey);
      mockApiKeysService.updateLastUsed.mockRejectedValue(new Error('DB error'));

      // Should not throw and should return true
      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });
  });
});

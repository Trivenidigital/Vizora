import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SecurityAdminService, BlockIpDto } from './security-admin.service';
import { DatabaseService } from '../../database/database.service';

describe('SecurityAdminService', () => {
  let service: SecurityAdminService;
  let mockDb: any;

  const mockIpBlocklistEntry = {
    id: 'block-123',
    ipAddress: '192.168.1.100',
    reason: 'Suspicious activity',
    blockedBy: 'admin-123',
    expiresAt: null,
    isActive: true,
    createdAt: new Date(),
  };

  const mockApiKey = {
    id: 'key-123',
    name: 'Test API Key',
    prefix: 'vz_live_',
    scopes: ['read:all'],
    lastUsedAt: new Date(),
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date(),
    organization: {
      id: 'org-123',
      name: 'Test Org',
      slug: 'test-org',
    },
    createdBy: {
      id: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
  };

  beforeEach(() => {
    mockDb = {
      ipBlocklist: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      apiKey: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
      },
    };

    service = new SecurityAdminService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getIpBlocklist', () => {
    it('should return paginated blocklist entries', async () => {
      mockDb.ipBlocklist.findMany.mockResolvedValue([mockIpBlocklistEntry]);
      mockDb.ipBlocklist.count.mockResolvedValue(1);

      const result = await service.getIpBlocklist({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ipAddress).toBe('192.168.1.100');
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  describe('blockIp', () => {
    it('should block an IP address', async () => {
      mockDb.ipBlocklist.findUnique.mockResolvedValue(null);
      mockDb.ipBlocklist.upsert.mockResolvedValue(mockIpBlocklistEntry);

      const dto: BlockIpDto = {
        ipAddress: '192.168.1.100',
        reason: 'Suspicious activity',
      };

      const result = await service.blockIp(dto, 'admin-123');

      expect(result.ipAddress).toBe('192.168.1.100');
      expect(result.isActive).toBe(true);
    });

    it('should throw if IP already blocked', async () => {
      mockDb.ipBlocklist.findUnique.mockResolvedValue(mockIpBlocklistEntry);

      const dto: BlockIpDto = { ipAddress: '192.168.1.100' };

      await expect(service.blockIp(dto, 'admin-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid IP format', async () => {
      const dto: BlockIpDto = { ipAddress: 'invalid-ip' };

      await expect(service.blockIp(dto, 'admin-123')).rejects.toThrow(BadRequestException);
    });

    it('should accept valid CIDR notation', async () => {
      mockDb.ipBlocklist.findUnique.mockResolvedValue(null);
      mockDb.ipBlocklist.upsert.mockResolvedValue({
        ...mockIpBlocklistEntry,
        ipAddress: '192.168.1.0/24',
      });

      const dto: BlockIpDto = { ipAddress: '192.168.1.0/24' };

      const result = await service.blockIp(dto, 'admin-123');

      expect(result.ipAddress).toBe('192.168.1.0/24');
    });
  });

  describe('unblockIp', () => {
    it('should unblock an IP', async () => {
      mockDb.ipBlocklist.findUnique.mockResolvedValue(mockIpBlocklistEntry);
      mockDb.ipBlocklist.update.mockResolvedValue({ ...mockIpBlocklistEntry, isActive: false });

      const result = await service.unblockIp('block-123');

      expect(result.isActive).toBe(false);
    });

    it('should throw if entry not found', async () => {
      mockDb.ipBlocklist.findUnique.mockResolvedValue(null);

      await expect(service.unblockIp('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw if already unblocked', async () => {
      mockDb.ipBlocklist.findUnique.mockResolvedValue({ ...mockIpBlocklistEntry, isActive: false });

      await expect(service.unblockIp('block-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('isIpBlocked', () => {
    it('should return true for blocked IP', async () => {
      mockDb.ipBlocklist.findFirst.mockResolvedValue(mockIpBlocklistEntry);

      const result = await service.isIpBlocked('192.168.1.100');

      expect(result).toBe(true);
    });

    it('should return false for non-blocked IP', async () => {
      mockDb.ipBlocklist.findFirst.mockResolvedValue(null);

      const result = await service.isIpBlocked('192.168.1.200');

      expect(result).toBe(false);
    });
  });

  describe('getAllApiKeys', () => {
    it('should return paginated API keys across platform', async () => {
      mockDb.apiKey.findMany.mockResolvedValue([mockApiKey]);
      mockDb.apiKey.count.mockResolvedValue(1);

      const result = await service.getAllApiKeys({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test API Key');
      expect(result.data[0].organization.name).toBe('Test Org');
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      mockDb.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockDb.apiKey.update.mockResolvedValue({ ...mockApiKey, revokedAt: new Date() });

      const result = await service.revokeApiKey('key-123');

      expect(result.revoked).toBe(true);
      expect(result.keyId).toBe('key-123');
    });

    it('should throw if key not found', async () => {
      mockDb.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.revokeApiKey('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw if already revoked', async () => {
      mockDb.apiKey.findUnique.mockResolvedValue({ ...mockApiKey, revokedAt: new Date() });

      await expect(service.revokeApiKey('key-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFailedLogins', () => {
    it('should return failed login statistics', async () => {
      mockDb.auditLog.findMany.mockResolvedValue([
        { ipAddress: '192.168.1.1', changes: { email: 'test@example.com' } },
        { ipAddress: '192.168.1.1', changes: { email: 'test@example.com' } },
        { ipAddress: '192.168.1.2', changes: { email: 'other@example.com' } },
      ]);

      const result = await service.getFailedLogins(24);

      expect(result.period).toBe('24h');
      expect(result.totalAttempts).toBeGreaterThan(0);
    });
  });
});

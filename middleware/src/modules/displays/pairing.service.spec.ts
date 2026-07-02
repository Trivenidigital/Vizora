import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PairingService } from './pairing.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

// Mock QRCode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQRCode'),
}));

describe('PairingService', () => {
  let service: PairingService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let redisClient: {
    scan: jest.Mock;
    mget: jest.Mock;
    set: jest.Mock;
    eval: jest.Mock;
    zadd: jest.Mock;
    zrangebyscore: jest.Mock;
    zrem: jest.Mock;
    zremrangebyscore: jest.Mock;
    expire: jest.Mock;
  };

  const sensitiveDisplayFields = [
    'jwtToken',
    'pairingCode',
    'pairingCodeExpiresAt',
    'socketId',
  ];
  const pairingResultSelect = {
    id: true,
    nickname: true,
    deviceIdentifier: true,
    status: true,
  };
  const expectSelectToExcludeSensitiveDisplayFields = (
    select: Record<string, unknown>,
  ) => {
    for (const field of sensitiveDisplayFields) {
      expect(select).not.toHaveProperty(field);
    }
  };

  // In-memory store to simulate Redis behavior
  let redisStore: Map<
    string,
    { value: string; ttl: number; expiresAt: number }
  >;
  let redisSortedSets: Map<
    string,
    { values: Map<string, number>; expiresAt: number }
  >;

  beforeEach(() => {
    // Clear any interval from previous tests
    jest.useFakeTimers();

    redisStore = new Map();
    redisSortedSets = new Map();

    mockDatabaseService = {
      display: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          screenQuota: 100,
          _count: { displays: 0 },
        }),
      },
    } as any;

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as any;

    const getActiveSortedSet = (
      key: string,
    ): { values: Map<string, number>; expiresAt: number } | null => {
      const entry = redisSortedSets.get(key);
      if (!entry) return null;
      if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
        redisSortedSets.delete(key);
        return null;
      }
      return entry;
    };
    const parseScore = (score: string | number): number => {
      if (score === '-inf') return Number.NEGATIVE_INFINITY;
      if (score === '+inf') return Number.POSITIVE_INFINITY;
      return Number(score);
    };

    redisClient = {
      scan: jest
        .fn()
        .mockImplementation(
          async (
            cursor: string,
            _match: string,
            pattern: string,
            _count: string,
            _countVal: number,
          ) => {
            // Return all keys matching the pattern on first call
            const prefix = pattern.replace('*', '');
            const matchingKeys: string[] = [];
            for (const [key, entry] of redisStore.entries()) {
              if (key.startsWith(prefix)) {
                // Also check TTL
                if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
                  redisStore.delete(key);
                  continue;
                }
                matchingKeys.push(key);
              }
            }
            return ['0', matchingKeys];
          },
        ),
      mget: jest.fn().mockImplementation(async (...keys: string[]) => {
        return keys.map((key) => {
          const entry = redisStore.get(key);
          if (!entry) return null;
          if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
            redisStore.delete(key);
            return null;
          }
          return entry.value;
        });
      }),
      set: jest
        .fn()
        .mockImplementation(
          async (
            key: string,
            value: string,
            _ex: string,
            ttlSeconds: number,
            nx: string,
          ) => {
            if (nx === 'NX' && redisStore.has(key)) {
              return null;
            }
            const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
            redisStore.set(key, { value, ttl: ttlSeconds || 0, expiresAt });
            return 'OK';
          },
        ),
      eval: jest
        .fn()
        .mockImplementation(
          async (
            _script: string,
            _keyCount: number,
            key: string,
            claimToken: string,
          ) => {
            const entry = redisStore.get(key);
            if (entry?.value === claimToken) {
              redisStore.delete(key);
              return 1;
            }
            return 0;
          },
        ),
      zadd: jest
        .fn()
        .mockImplementation(
          async (key: string, score: number | string, member: string) => {
            const entry =
              getActiveSortedSet(key) ??
              { values: new Map<string, number>(), expiresAt: 0 };
            const existed = entry.values.has(member);
            entry.values.set(member, Number(score));
            redisSortedSets.set(key, entry);
            return existed ? 0 : 1;
          },
        ),
      zrangebyscore: jest
        .fn()
        .mockImplementation(
          async (
            key: string,
            minScore: string | number,
            maxScore: string | number,
          ) => {
            const entry = getActiveSortedSet(key);
            if (!entry) return [];
            const min = parseScore(minScore);
            const max = parseScore(maxScore);
            return Array.from(entry.values.entries())
              .filter(([, score]) => score >= min && score <= max)
              .sort(([, left], [, right]) => left - right)
              .map(([member]) => member);
          },
        ),
      zrem: jest.fn().mockImplementation(async (key: string, ...members: string[]) => {
        const entry = getActiveSortedSet(key);
        if (!entry) return 0;
        let removed = 0;
        for (const member of members) {
          if (entry.values.delete(member)) removed++;
        }
        return removed;
      }),
      zremrangebyscore: jest
        .fn()
        .mockImplementation(
          async (
            key: string,
            minScore: string | number,
            maxScore: string | number,
          ) => {
            const entry = getActiveSortedSet(key);
            if (!entry) return 0;
            const min = parseScore(minScore);
            const max = parseScore(maxScore);
            let removed = 0;
            for (const [member, score] of entry.values.entries()) {
              if (score >= min && score <= max) {
                entry.values.delete(member);
                removed++;
              }
            }
            return removed;
          },
        ),
      expire: jest.fn().mockImplementation(async (key: string, ttlSeconds: number) => {
        const entry = getActiveSortedSet(key);
        if (!entry) return 0;
        entry.expiresAt = Date.now() + ttlSeconds * 1000;
        redisSortedSets.set(key, entry);
        return 1;
      }),
    };

    // Create a mock RedisService that uses an in-memory Map to simulate Redis
    mockRedisService = {
      get: jest.fn().mockImplementation(async (key: string) => {
        const entry = redisStore.get(key);
        if (!entry) return null;
        // Check TTL expiration
        if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
          redisStore.delete(key);
          return null;
        }
        return entry.value;
      }),
      set: jest
        .fn()
        .mockImplementation(
          async (key: string, value: string, ttlSeconds?: number) => {
            const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
            redisStore.set(key, { value, ttl: ttlSeconds || 0, expiresAt });
            return true;
          },
        ),
      del: jest.fn().mockImplementation(async (key: string) => {
        redisStore.delete(key);
        return true;
      }),
      exists: jest.fn().mockImplementation(async (key: string) => {
        const entry = redisStore.get(key);
        if (!entry) return false;
        if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
          redisStore.delete(key);
          return false;
        }
        return true;
      }),
      getClient: jest.fn().mockReturnValue(redisClient),
      isAvailable: jest.fn().mockReturnValue(true),
      ping: jest.fn().mockResolvedValue(true),
      healthCheck: jest
        .fn()
        .mockResolvedValue({ healthy: true, responseTime: 1 }),
    } as any;

    const mockEventEmitter = { emit: jest.fn() } as any;
    service = new PairingService(
      mockDatabaseService,
      mockJwtService,
      mockRedisService,
      mockEventEmitter,
    );
  });

  afterEach(() => {
    // Trigger onModuleDestroy to clean up intervals
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  describe('requestPairingCode', () => {
    const mockRequestDto = {
      deviceIdentifier: 'device-123',
      nickname: 'Living Room Display',
      metadata: { hostname: 'display-001' },
    };

    it('should generate a pairing code successfully', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result).toHaveProperty('code');
      expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('expiresInSeconds');
      expect(result).toHaveProperty('pairingUrl');
    });

    it('should check existing pairing state with token and organization display select', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      await service.requestPairingCode(mockRequestDto);

      expect(mockDatabaseService.display.findUnique).toHaveBeenCalledWith({
        where: { deviceIdentifier: 'device-123' },
        select: { jwtToken: true, organizationId: true },
      });
    });

    it('should store pairing request in Redis with TTL', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        `pairing:${result.code}`,
        expect.any(String),
        300,
      );
    });

    it('should generate a 6-character alphanumeric code', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result.code).toHaveLength(6);
      expect(result.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });

    it('should exclude ambiguous characters from pairing code', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      // Generate many codes and check none contain ambiguous characters
      const codes = [];
      for (let i = 0; i < 100; i++) {
        const result = await service.requestPairingCode({
          ...mockRequestDto,
          deviceIdentifier: `device-${i}`,
        });
        codes.push(result.code);
      }

      const allCodes = codes.join('');
      // Character set is 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      // Should not contain 0, O, 1, I which are excluded for clarity
      // Also should not contain lowercase letters (all uppercase)
      expect(allCodes).not.toMatch(/[0OI1a-z]/);
    });

    it('should set expiration to 5 minutes', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result.expiresInSeconds).toBe(300); // 5 minutes
    });

    it('should throw if device is already paired', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'existing-display-id',
        jwtToken: 'existing-jwt-token',
      } as any);

      await expect(service.requestPairingCode(mockRequestDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.requestPairingCode(mockRequestDto)).rejects.toThrow(
        'Device is already paired',
      );
    });

    it('should allow unpaired devices (no jwt token)', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'existing-display-id',
        jwtToken: null, // Not paired
      } as any);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result).toHaveProperty('code');
    });

    it('should use default nickname if not provided', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode({
        deviceIdentifier: 'device-123',
        metadata: {},
      } as any);

      expect(result).toHaveProperty('code');
    });

    it('should include QR code data URL', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result.qrCode).toMatch(/^data:image\/png;base64/);
    });

    it('should include pairing URL in result', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result.pairingUrl).toContain(result.code);
      expect(result.pairingUrl).toContain('/dashboard/devices/pair');
    });

    it('should throw if Redis storage fails', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValueOnce(false);

      await expect(service.requestPairingCode(mockRequestDto)).rejects.toThrow(
        'Failed to store pairing request',
      );
    });
  });

  describe('checkPairingStatus', () => {
    beforeEach(async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);
      // Create a pairing request first
      await service.requestPairingCode({
        deviceIdentifier: 'device-123',
        nickname: 'Test Display',
        metadata: {},
      });
    });

    it('should throw NotFoundException for non-existent code', async () => {
      await expect(service.checkPairingStatus('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.checkPairingStatus('NONEXISTENT')).rejects.toThrow(
        'Pairing code not found or expired',
      );
    });

    it('should throw for expired code', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode({
        deviceIdentifier: 'device-456',
        nickname: 'Test',
        metadata: {},
      });

      // Advance time past expiration (5 minutes + 1 second)
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Either BadRequestException (expired) or NotFoundException (TTL expired in Redis)
      await expect(service.checkPairingStatus(result.code)).rejects.toThrow();
    });

    it('should return pending status for valid unpaired code', async () => {
      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'device-789',
        nickname: 'Test',
        metadata: {},
      });

      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const status = await service.checkPairingStatus(pairingResult.code);

      expect(status.status).toBe('pending');
      expect(status).toHaveProperty('expiresAt');
    });

    it('should return paired status when device is paired', async () => {
      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'device-paired',
        nickname: 'Test',
        metadata: {},
      });

      // completePairing sets plaintextToken on the Redis request
      mockDatabaseService.display.findUnique.mockResolvedValue(null);
      mockDatabaseService.display.create.mockResolvedValue({
        id: 'display-id',
        nickname: 'Test',
        deviceIdentifier: 'device-paired',
        status: 'pairing',
        organizationId: 'org-123',
      } as any);

      await service.completePairing('org-123', 'user-123', {
        code: pairingResult.code,
      });

      // Now checkPairingStatus reads the plaintext token from Redis
      mockDatabaseService.display.findUnique.mockClear();
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'display-id',
        organizationId: 'org-123',
      } as any);

      const status = await service.checkPairingStatus(pairingResult.code);

      expect(mockDatabaseService.display.findUnique).toHaveBeenCalledWith({
        where: { deviceIdentifier: 'device-paired' },
        select: { id: true, organizationId: true },
      });
      expect(status.status).toBe('paired');
      expect(status.deviceToken).toBe('mock-jwt-token'); // plaintext token from jwtService.sign mock
      expect(status.deviceId).toBe('display-id');
      expect(status.organizationId).toBe('org-123');
      // Contract v1.1 item 1: tenantId is the wire-boundary alias of organizationId
      // that the device binds its cache/playlist to. Must be present and equal.
      expect(status.tenantId).toBe('org-123');
      expect(status.tenantId).toBe(status.organizationId);
    });

    it('should clean up pairing request after successful pairing', async () => {
      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'device-cleanup',
        nickname: 'Test',
        metadata: {},
      });

      // completePairing sets plaintextToken on the Redis request
      mockDatabaseService.display.findUnique.mockResolvedValue(null);
      mockDatabaseService.display.create.mockResolvedValue({
        id: 'display-id',
        nickname: 'Test',
        deviceIdentifier: 'device-cleanup',
        status: 'pairing',
        organizationId: 'org-123',
      } as any);

      await service.completePairing('org-123', 'user-123', {
        code: pairingResult.code,
      });

      // Now checkPairingStatus should return paired and clean up
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'display-id',
        organizationId: 'org-123',
      } as any);

      // First check - should return paired and clean up
      await service.checkPairingStatus(pairingResult.code);

      // Second check - should throw not found
      await expect(
        service.checkPairingStatus(pairingResult.code),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('completePairing', () => {
    const organizationId = 'org-123';
    const userId = 'user-123';

    it('should complete pairing for new device', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null) // requestPairingCode check
        .mockResolvedValueOnce(null); // completePairing check

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'new-device',
        nickname: 'New Display',
        metadata: { hostname: 'display-new' },
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-display-id',
        nickname: 'New Display',
        deviceIdentifier: 'new-device',
        status: 'pairing',
      } as any);

      const result = await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
      });

      expect(result.success).toBe(true);
      expect(result.display).toHaveProperty('id');
      expect(mockDatabaseService.display.findUnique).toHaveBeenNthCalledWith(
        1,
        {
          where: { deviceIdentifier: 'new-device' },
          select: { jwtToken: true, organizationId: true },
        },
      );
      expect(mockDatabaseService.display.findUnique).toHaveBeenNthCalledWith(
        2,
        {
          where: { deviceIdentifier: 'new-device' },
          select: { id: true, location: true, organizationId: true },
        },
      );
      expect(mockDatabaseService.display.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: pairingResultSelect,
        }),
      );
      expect(redisClient.set).toHaveBeenCalledWith(
        `pairing-new-display-claim:${organizationId}`,
        expect.any(String),
        'EX',
        300,
        'NX',
      );
      expect(
        redisStore.has(`pairing-new-display-claim:${organizationId}`),
      ).toBe(false);
      const createArgs = mockDatabaseService.display.create.mock
        .calls[0][0] as any;
      expectSelectToExcludeSensitiveDisplayFields(createArgs.select);
    });

    it('should update existing unpaired device', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null) // requestPairingCode check
        .mockResolvedValueOnce({
          id: 'existing-display-id',
          location: 'Lobby',
          organizationId,
        } as any); // completePairing check

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'existing-device',
        nickname: 'Existing Display',
        metadata: {},
      });

      mockDatabaseService.display.update.mockResolvedValue({
        id: 'existing-display-id',
        nickname: 'Updated Display',
        deviceIdentifier: 'existing-device',
        status: 'pairing',
      } as any);

      const result = await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
        nickname: 'Updated Display',
      });

      expect(result.success).toBe(true);
      expect(mockDatabaseService.display.findUnique).toHaveBeenNthCalledWith(
        2,
        {
          where: { deviceIdentifier: 'existing-device' },
          select: { id: true, location: true, organizationId: true },
        },
      );
      expect(mockDatabaseService.display.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: pairingResultSelect,
        }),
      );
      const updateArgs = mockDatabaseService.display.update.mock
        .calls[0][0] as any;
      expectSelectToExcludeSensitiveDisplayFields(updateArgs.select);
    });

    it('should throw NotFoundException for non-existent code', async () => {
      await expect(
        service.completePairing(organizationId, userId, { code: 'INVALID' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for expired code', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'expiring-device',
        nickname: 'Test',
        metadata: {},
      });

      // Advance time past expiration
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      await expect(
        service.completePairing(organizationId, userId, {
          code: pairingResult.code,
        }),
      ).rejects.toThrow();
    });

    it('should generate JWT token for device', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'jwt-device',
        nickname: 'JWT Test',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-id',
        nickname: 'JWT Test',
        deviceIdentifier: 'jwt-device',
        status: 'pairing',
      } as any);

      await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceIdentifier: 'jwt-device',
          organizationId,
          type: 'device',
        }),
        expect.objectContaining({ expiresIn: '90d' }),
      );
    });

    it('should store updated pairing request with token in Redis', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'token-device',
        nickname: 'Token Test',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-id',
        nickname: 'Token Test',
        deviceIdentifier: 'token-device',
        status: 'pairing',
      } as any);

      // Reset call count after requestPairingCode
      const setCallsBefore = mockRedisService.set.mock.calls.length;

      await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
      });

      // completePairing should call set again to update with plaintextToken
      const setCallsAfter = mockRedisService.set.mock.calls.length;
      expect(setCallsAfter).toBeGreaterThan(setCallsBefore);

      // Verify the stored value contains plaintextToken
      const lastSetCall = mockRedisService.set.mock.calls[setCallsAfter - 1];
      const storedData = JSON.parse(lastSetCall[1]);
      expect(storedData.plaintextToken).toBe('mock-jwt-token');
    });

    it('rejects replay after a pairing code has already been completed', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'replay-device',
        nickname: 'Replay Test',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'replay-display',
        nickname: 'Replay Test',
        deviceIdentifier: 'replay-device',
        status: 'pairing',
      } as any);

      await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
      });
      mockDatabaseService.display.create.mockClear();
      mockDatabaseService.display.update.mockClear();

      await expect(
        service.completePairing('org-other', 'user-other', {
          code: pairingResult.code,
        }),
      ).rejects.toThrow('Pairing code has already been completed');
      expect(mockDatabaseService.display.create).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.update).not.toHaveBeenCalled();
    });

    it('rejects a concurrent completion while another dashboard request owns the claim', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'concurrent-device',
        nickname: 'Concurrent Test',
        metadata: {},
      });
      redisStore.set(`pairing-complete-claim:${pairingResult.code}`, {
        value: 'other-claim-token',
        ttl: 300,
        expiresAt: Date.now() + 300_000,
      });

      await expect(
        service.completePairing(organizationId, userId, {
          code: pairingResult.code,
        }),
      ).rejects.toThrow('Pairing code is already being completed');
      expect(mockDatabaseService.display.create).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.update).not.toHaveBeenCalled();
    });

    it('serializes new-display pairing quota checks per organization', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'org-lock-device',
        nickname: 'Org Lock Test',
        metadata: {},
      });
      redisStore.set(`pairing-new-display-claim:${organizationId}`, {
        value: 'other-org-claim-token',
        ttl: 300,
        expiresAt: Date.now() + 300_000,
      });

      await expect(
        service.completePairing(organizationId, userId, {
          code: pairingResult.code,
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.completePairing(organizationId, userId, {
          code: pairingResult.code,
        }),
      ).rejects.toThrow(
        'Another display pairing is already being completed for this organization',
      );
      expect(
        mockDatabaseService.organization.findUnique,
      ).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.create).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.update).not.toHaveBeenCalled();
    });

    it('rejects pairing an existing display that belongs to another organization', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'display-other-org',
          location: 'Lobby',
          organizationId: 'org-other',
        } as any);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'other-org-device',
        nickname: 'Other Org Display',
        metadata: {},
      });

      await expect(
        service.completePairing(organizationId, userId, {
          code: pairingResult.code,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockDatabaseService.display.update).not.toHaveBeenCalled();
    });

    it('enforces screen quota only when pairing creates a new display', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockDatabaseService.organization.findUnique.mockResolvedValueOnce({
        screenQuota: 1,
        _count: { displays: 1 },
      } as any);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'over-quota-device',
        nickname: 'Over Quota Display',
        metadata: {},
      });

      await expect(
        service.completePairing(organizationId, userId, {
          code: pairingResult.code,
        }),
      ).rejects.toThrow('Screen quota exceeded');
      expect(mockDatabaseService.display.create).not.toHaveBeenCalled();
    });

    it('allows same-organization existing-display pairing while at screen quota', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'existing-at-quota-display',
          location: 'Lobby',
          organizationId,
        } as any);
      mockDatabaseService.organization.findUnique.mockResolvedValueOnce({
        screenQuota: 1,
        _count: { displays: 1 },
      } as any);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'existing-at-quota-device',
        nickname: 'Existing At Quota',
        metadata: {},
      });

      mockDatabaseService.display.update.mockResolvedValue({
        id: 'existing-at-quota-display',
        nickname: 'Existing At Quota',
        deviceIdentifier: 'existing-at-quota-device',
        status: 'pairing',
      } as any);

      await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
      });

      expect(
        mockDatabaseService.organization.findUnique,
      ).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.update).toHaveBeenCalled();
    });

    it('should clean up pairing request after device retrieves token', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'cleanup-device',
        nickname: 'Cleanup Test',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-id',
        nickname: 'Cleanup Test',
        deviceIdentifier: 'cleanup-device',
        status: 'pairing',
      } as any);

      await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
      });

      // After completePairing, the request still exists in Redis (has plaintextToken set)
      // checkPairingStatus will return paired and THEN clean up
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'new-id',
        organizationId: 'org-123',
      } as any);

      const status = await service.checkPairingStatus(pairingResult.code);
      expect(status.status).toBe('paired');

      // NOW the code should be cleaned up
      await expect(
        service.checkPairingStatus(pairingResult.code),
      ).rejects.toThrow(NotFoundException);
    });

    // R4-MED11: onboarding subscribes to display.paired with `organizationId`.
    // Guard the payload shape so a publisher-side rename can't silently break
    // the firstScreenPairedAt milestone.
    it('emits display.paired with organizationId key', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'event-device',
        nickname: 'Event Test',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'display-evt',
        nickname: 'Event Test',
        deviceIdentifier: 'event-device',
        status: 'pairing',
      } as any);

      const eventEmitter = (service as any).events;

      await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'display.paired',
        expect.objectContaining({ organizationId, displayId: 'display-evt' }),
      );
    });

    it('should use provided nickname over request nickname', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'nickname-device',
        nickname: 'Original Nickname',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-id',
        nickname: 'Custom Nickname',
        deviceIdentifier: 'nickname-device',
        status: 'pairing',
      } as any);

      await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
        nickname: 'Custom Nickname',
      });

      expect(mockDatabaseService.display.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nickname: 'Custom Nickname',
          }),
        }),
      );
    });
  });

  describe('getActivePairings', () => {
    it('should return empty array when no pairings exist', async () => {
      const result = await service.getActivePairings('org-123');

      expect(result).toEqual([]);
      expect(redisClient.scan).not.toHaveBeenCalled();
    });

    it('should not return brand-new unclaimed pairing requests to org dashboards', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      await service.requestPairingCode({
        deviceIdentifier: 'device-1',
        nickname: 'Display 1',
        metadata: {},
      });

      await service.requestPairingCode({
        deviceIdentifier: 'device-2',
        nickname: 'Display 2',
        metadata: {},
      });

      const result = await service.getActivePairings('org-123');

      expect(result).toEqual([]);
      expect(redisClient.scan).not.toHaveBeenCalled();
      expect(redisClient.mget).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.findMany).not.toHaveBeenCalled();
    });

    it('should not return expired pairings', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue({
        jwtToken: null,
        organizationId: 'org-123',
      } as any);

      await service.requestPairingCode({
        deviceIdentifier: 'device-expired',
        nickname: 'Expired Display',
        metadata: {},
      });

      // Advance time past expiration
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);
      redisClient.scan.mockClear();

      const result = await service.getActivePairings('org-123');

      expect(result).toHaveLength(0);
      expect(redisClient.scan).not.toHaveBeenCalled();
    });

    it('should batch Redis reads and only show unclaimed active pairings for displays owned by the org', async () => {
      const orgId = 'org-123';
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce({
          jwtToken: null,
          organizationId: orgId,
        } as any)
        .mockResolvedValueOnce({
          jwtToken: null,
          organizationId: 'org-other',
        } as any)
        .mockResolvedValueOnce(null);
      mockDatabaseService.display.findMany.mockResolvedValue([
        {
          deviceIdentifier: 'device-owned',
          organizationId: orgId,
        },
      ] as any);

      await service.requestPairingCode({
        deviceIdentifier: 'device-owned',
        nickname: 'Owned Display',
        metadata: {},
      });
      await service.requestPairingCode({
        deviceIdentifier: 'device-other-org',
        nickname: 'Other Org Display',
        metadata: {},
      });
      await service.requestPairingCode({
        deviceIdentifier: 'device-new',
        nickname: 'Brand New Display',
        metadata: {},
      });
      mockDatabaseService.display.findUnique.mockClear();

      const result = await service.getActivePairings(orgId);

      expect(redisClient.scan).not.toHaveBeenCalled();
      expect(redisClient.zrangebyscore).toHaveBeenCalledWith(
        `pairing-active-org:${orgId}`,
        expect.any(Number),
        '+inf',
      );
      expect(redisClient.mget).toHaveBeenCalledTimes(1);
      expect(mockRedisService.get).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.findMany).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.display.findMany).toHaveBeenCalledWith({
        where: {
          deviceIdentifier: {
            in: ['device-owned'],
          },
        },
        select: { deviceIdentifier: true, organizationId: true },
      });
      expect(mockDatabaseService.display.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual([
        expect.objectContaining({
          nickname: 'Owned Display',
          code: expect.any(String),
          createdAt: expect.any(String),
          expiresAt: expect.any(String),
        }),
      ]);
      expect(result).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ nickname: 'Other Org Display' }),
          expect.objectContaining({ nickname: 'Brand New Display' }),
        ]),
      );
    });

    it('uses the organization active-pairing zset instead of Redis SCAN', async () => {
      const orgId = 'org-123';
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce({
          jwtToken: null,
          organizationId: orgId,
        } as any)
        .mockResolvedValueOnce(null);
      mockDatabaseService.display.findMany.mockResolvedValue([
        {
          deviceIdentifier: 'device-owned',
          organizationId: orgId,
        },
      ] as any);

      await service.requestPairingCode({
        deviceIdentifier: 'device-owned',
        nickname: 'Owned Display',
        metadata: {},
      });
      await service.requestPairingCode({
        deviceIdentifier: 'device-new',
        nickname: 'Brand New Display',
        metadata: {},
      });
      redisClient.scan.mockClear();
      redisClient.mget.mockClear();
      redisClient.zrangebyscore.mockClear();
      mockDatabaseService.display.findMany.mockClear();

      const result = await service.getActivePairings(orgId);

      expect(redisClient.scan).not.toHaveBeenCalled();
      expect(redisClient.zrangebyscore).toHaveBeenCalledWith(
        `pairing-active-org:${orgId}`,
        expect.any(Number),
        '+inf',
      );
      expect(redisClient.mget).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.display.findMany).toHaveBeenCalledWith({
        where: {
          deviceIdentifier: {
            in: ['device-owned'],
          },
        },
        select: { deviceIdentifier: true, organizationId: true },
      });
      expect(result).toEqual([
        expect.objectContaining({
          nickname: 'Owned Display',
          code: expect.any(String),
        }),
      ]);
      expect(result).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ nickname: 'Brand New Display' }),
        ]),
      );
    });

    it('removes the organization active-pairing index when pairing completes', async () => {
      const orgId = 'org-123';
      const userId = 'user-123';
      const previousSecret = process.env.DEVICE_JWT_SECRET;
      process.env.DEVICE_JWT_SECRET =
        'test-device-secret-that-is-at-least-32-chars';
      try {
        mockDatabaseService.display.findUnique.mockResolvedValueOnce({
          jwtToken: null,
          organizationId: orgId,
        } as any);

        const pairingResult = await service.requestPairingCode({
          deviceIdentifier: 'device-owned',
          nickname: 'Owned Display',
          metadata: {},
        });

        mockDatabaseService.display.findUnique.mockResolvedValueOnce({
          id: 'display-owned',
          location: null,
          organizationId: orgId,
        } as any);
        mockDatabaseService.display.update.mockResolvedValue({
          id: 'display-owned',
          nickname: 'Owned Display',
          deviceIdentifier: 'device-owned',
          status: 'pairing',
        } as any);
        redisClient.zrem.mockClear();

        await service.completePairing(orgId, userId, {
          code: pairingResult.code,
        });

        expect(redisClient.zrem).toHaveBeenCalledWith(
          `pairing-active-org:${orgId}`,
          pairingResult.code,
        );
      } finally {
        process.env.DEVICE_JWT_SECRET = previousSecret;
      }
    });

    it('should prune stale indexed records without exposing them', async () => {
      const orgId = 'org-123';
      const future = new Date(Date.now() + 300_000).toISOString();
      const past = new Date(Date.now() - 1_000).toISOString();
      const validRequest = {
        code: 'OWNED1',
        deviceIdentifier: 'device-owned',
        nickname: 'Owned Display',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: future,
        activePairingOrganizationId: orgId,
      };
      const requests = [
        validRequest,
        {
          ...validRequest,
          code: 'MISMAT',
          deviceIdentifier: 'device-mismatch',
          nickname: 'Mismatched Display',
          activePairingOrganizationId: 'org-other',
        },
        {
          ...validRequest,
          code: 'EXPIRE',
          deviceIdentifier: 'device-expired',
          nickname: 'Expired Display',
          expiresAt: past,
        },
        {
          ...validRequest,
          code: 'DONE01',
          deviceIdentifier: 'device-completed',
          nickname: 'Completed Display',
          plaintextToken: 'token',
          organizationId: orgId,
        },
      ];
      for (const request of requests) {
        redisStore.set(`pairing:${request.code}`, {
          value: JSON.stringify(request),
          ttl: 300,
          expiresAt: Date.now() + 300_000,
        });
      }
      redisSortedSets.set(`pairing-active-org:${orgId}`, {
        values: new Map([
          ['MISSING', Date.now() + 300_000],
          ...requests.map((request) => [
            request.code,
            Date.now() + 300_000,
          ] as [string, number]),
        ]),
        expiresAt: Date.now() + 300_000,
      });
      mockDatabaseService.display.findMany.mockResolvedValue([
        {
          deviceIdentifier: 'device-owned',
          organizationId: orgId,
        },
      ] as any);

      const result = await service.getActivePairings(orgId);

      expect(redisClient.scan).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.findMany).toHaveBeenCalledWith({
        where: {
          deviceIdentifier: {
            in: ['device-owned'],
          },
        },
        select: { deviceIdentifier: true, organizationId: true },
      });
      expect(redisClient.zrem).toHaveBeenCalledWith(
        `pairing-active-org:${orgId}`,
        'MISSING',
        'MISMAT',
        'EXPIRE',
        'DONE01',
      );
      expect(result).toEqual([
        expect.objectContaining({
          code: 'OWNED1',
          nickname: 'Owned Display',
        }),
      ]);
    });

    it('should not return or query display ownership for completed org pairings', async () => {
      const orgId = 'org-123';
      const userId = 'user-123';
      const previousSecret = process.env.DEVICE_JWT_SECRET;
      process.env.DEVICE_JWT_SECRET =
        'test-device-secret-that-is-at-least-32-chars';
      try {
        mockDatabaseService.display.findUnique.mockResolvedValueOnce({
          jwtToken: null,
          organizationId: orgId,
        } as any);

        const pairingResult = await service.requestPairingCode({
          deviceIdentifier: 'completed-device',
          nickname: 'Completed Display',
          metadata: {},
        });

        mockDatabaseService.display.findUnique.mockResolvedValueOnce({
          id: 'display-owned',
          location: null,
          organizationId: orgId,
        } as any);
        mockDatabaseService.display.update.mockResolvedValue({
          id: 'display-owned',
          nickname: 'Completed Display',
          deviceIdentifier: 'completed-device',
          status: 'pairing',
        } as any);

        await service.completePairing(orgId, userId, {
          code: pairingResult.code,
        });
        await redisClient.zadd(
          `pairing-active-org:${orgId}`,
          Date.now() + 300_000,
          pairingResult.code,
        );
        mockDatabaseService.display.findUnique.mockClear();
        mockDatabaseService.display.findMany.mockClear();
        mockRedisService.get.mockClear();
        redisClient.mget.mockClear();

        const result = await service.getActivePairings(orgId);

        expect(redisClient.mget).toHaveBeenCalledTimes(1);
        expect(mockRedisService.get).not.toHaveBeenCalled();
        expect(mockDatabaseService.display.findMany).not.toHaveBeenCalled();
        expect(mockDatabaseService.display.findUnique).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      } finally {
        process.env.DEVICE_JWT_SECRET = previousSecret;
      }
    });
  });

  describe('cleanup expired requests', () => {
    it('should automatically clean up expired requests via Redis TTL', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'auto-cleanup-device',
        nickname: 'Auto Cleanup Test',
        metadata: {},
      });

      // Advance time past expiration plus cleanup interval
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      // Try to check status - should be cleaned up (Redis TTL expired)
      await expect(
        service.checkPairingStatus(pairingResult.code),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unique code generation', () => {
    it('should generate unique codes for multiple requests', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        const result = await service.requestPairingCode({
          deviceIdentifier: `device-${i}`,
          nickname: `Display ${i}`,
          metadata: {},
        });
        codes.add(result.code);
      }

      expect(codes.size).toBe(50);
    });
  });
});

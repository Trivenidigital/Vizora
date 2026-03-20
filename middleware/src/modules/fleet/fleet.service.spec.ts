import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { NotFoundException } from '@nestjs/common';
import { FleetService, TooManyRequestsException } from './fleet.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';

describe('FleetService', () => {
  let service: FleetService;
  let db: any;
  let redis: any;
  let httpService: any;
  let circuitBreaker: any;
  let mockRedisClient: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-456';
  const mockDeviceId = 'device-789';
  const mockGroupId = 'group-001';

  beforeEach(async () => {
    process.env.INTERNAL_API_SECRET = 'test-secret';

    mockRedisClient = {
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      scard: jest.fn().mockResolvedValue(0),
    };

    const mockDb = {
      display: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      displayGroup: {
        findFirst: jest.fn(),
      },
      displayGroupMember: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(true),
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const mockHttpService = {
      post: jest.fn().mockReturnValue(of({ data: { devicesOnline: 1 } })),
    };

    const mockCircuitBreaker = {
      execute: jest.fn().mockImplementation((_name, fn) => fn()),
      executeWithFallback: jest
        .fn()
        .mockImplementation((_name, fn, _fallback) => fn()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FleetService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: RedisService, useValue: mockRedis },
        { provide: HttpService, useValue: mockHttpService },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
      ],
    }).compile();

    service = module.get<FleetService>(FleetService);
    db = module.get(DatabaseService);
    redis = module.get(RedisService);
    httpService = module.get(HttpService);
    circuitBreaker = module.get(CircuitBreakerService);
  });

  afterEach(() => {
    delete process.env.INTERNAL_API_SECRET;
  });

  describe('resolveTargetDevices', () => {
    it('should resolve a single device target', async () => {
      db.display.findFirst.mockResolvedValue({
        id: mockDeviceId,
        nickname: 'Lobby Screen',
        organizationId: mockOrgId,
      });

      const result = await service.resolveTargetDevices(mockOrgId, {
        type: 'device',
        id: mockDeviceId,
      });

      expect(result.deviceIds).toEqual([mockDeviceId]);
      expect(result.targetName).toBe('Lobby Screen');
    });

    it('should throw NotFoundException for nonexistent device', async () => {
      db.display.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveTargetDevices(mockOrgId, {
          type: 'device',
          id: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve group target to member device IDs', async () => {
      db.displayGroup.findFirst.mockResolvedValue({
        id: mockGroupId,
        name: 'Floor 1',
        organizationId: mockOrgId,
      });
      db.displayGroupMember.findMany.mockResolvedValue([
        { displayId: 'dev-1' },
        { displayId: 'dev-2' },
        { displayId: 'dev-3' },
      ]);

      const result = await service.resolveTargetDevices(mockOrgId, {
        type: 'group',
        id: mockGroupId,
      });

      expect(result.deviceIds).toEqual(['dev-1', 'dev-2', 'dev-3']);
      expect(result.targetName).toBe('Floor 1');
    });

    it('should return empty array for empty group', async () => {
      db.displayGroup.findFirst.mockResolvedValue({
        id: mockGroupId,
        name: 'Empty Group',
        organizationId: mockOrgId,
      });
      db.displayGroupMember.findMany.mockResolvedValue([]);

      const result = await service.resolveTargetDevices(mockOrgId, {
        type: 'group',
        id: mockGroupId,
      });

      expect(result.deviceIds).toEqual([]);
      expect(result.targetName).toBe('Empty Group');
    });

    it('should throw NotFoundException for nonexistent group', async () => {
      db.displayGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveTargetDevices(mockOrgId, {
          type: 'group',
          id: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve organization target to all devices', async () => {
      db.display.findMany.mockResolvedValue([
        { id: 'dev-1' },
        { id: 'dev-2' },
      ]);

      const result = await service.resolveTargetDevices(mockOrgId, {
        type: 'organization',
        id: mockOrgId,
      });

      expect(result.deviceIds).toEqual(['dev-1', 'dev-2']);
      expect(result.targetName).toBe('All Devices');
    });
  });

  describe('sendCommand', () => {
    it('should call gateway and return correct counts', async () => {
      db.display.findFirst.mockResolvedValue({
        id: mockDeviceId,
        nickname: 'Test',
        organizationId: mockOrgId,
      });

      const dto = {
        command: 'reload' as const,
        target: { type: 'device' as const, id: mockDeviceId },
      };

      const result = await service.sendCommand(
        mockOrgId,
        mockUserId,
        'admin',
        dto,
      );

      expect(result.command).toBe('reload');
      expect(result.devicesTargeted).toBe(1);
      expect(result.devicesOnline).toBe(1);
      expect(result.devicesQueued).toBe(0);
      expect(result.commandId).toBeDefined();
      expect(circuitBreaker.executeWithFallback).toHaveBeenCalled();
    });
  });

  describe('createOverride', () => {
    it('should set Redis keys with correct TTL', async () => {
      await service.createOverride(
        mockOrgId,
        'cmd-1',
        'Alert Content',
        'device',
        mockDeviceId,
        'Lobby',
        60,
        mockUserId,
        [mockDeviceId, 'dev-2'],
      );

      // Should add to index set
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        `overrides:index:${mockOrgId}`,
        'cmd-1',
      );

      // Should store override details with TTL (60 minutes * 60 seconds)
      expect(redis.set).toHaveBeenCalledWith(
        `override:${mockOrgId}:cmd-1`,
        expect.any(String),
        3600,
      );

      // Should set per-device override keys
      expect(redis.set).toHaveBeenCalledWith(
        `device:override:${mockDeviceId}`,
        'cmd-1',
        3600,
      );
      expect(redis.set).toHaveBeenCalledWith(
        'device:override:dev-2',
        'cmd-1',
        3600,
      );
    });
  });

  describe('getActiveOverrides', () => {
    it('should return active overrides', async () => {
      const overrideData = {
        commandId: 'cmd-1',
        contentTitle: 'Alert',
        duration: 60,
        deviceIds: [mockDeviceId],
      };

      mockRedisClient.scard.mockResolvedValue(1);
      mockRedisClient.smembers.mockResolvedValue(['cmd-1']);
      redis.get.mockResolvedValue(JSON.stringify(overrideData));

      const result = await service.getActiveOverrides(mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0].commandId).toBe('cmd-1');
    });

    it('should return empty array when no overrides exist', async () => {
      mockRedisClient.scard.mockResolvedValue(0);

      const result = await service.getActiveOverrides(mockOrgId);

      expect(result).toEqual([]);
      // Should NOT call smembers (fast path)
      expect(mockRedisClient.smembers).not.toHaveBeenCalled();
    });

    it('should clean up expired entries', async () => {
      mockRedisClient.scard.mockResolvedValue(2);
      mockRedisClient.smembers.mockResolvedValue(['cmd-1', 'cmd-expired']);
      redis.get
        .mockResolvedValueOnce(
          JSON.stringify({ commandId: 'cmd-1', deviceIds: [] }),
        )
        .mockResolvedValueOnce(null); // expired

      const result = await service.getActiveOverrides(mockOrgId);

      expect(result).toHaveLength(1);
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        `overrides:index:${mockOrgId}`,
        'cmd-expired',
      );
    });
  });

  describe('clearOverride', () => {
    const overrideData = {
      commandId: 'cmd-1',
      deviceIds: [mockDeviceId, 'dev-2'],
    };

    it('should delete keys and broadcast CLEAR_OVERRIDE', async () => {
      redis.get.mockResolvedValue(JSON.stringify(overrideData));

      const result = await service.clearOverride(mockOrgId, 'cmd-1');

      expect(result.commandId).toBe('cmd-1');
      expect(result.devicesNotified).toBe(2);

      // Should delete override data
      expect(redis.del).toHaveBeenCalledWith(
        `override:${mockOrgId}:cmd-1`,
      );

      // Should remove from index
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        `overrides:index:${mockOrgId}`,
        'cmd-1',
      );

      // Should delete per-device keys
      expect(redis.del).toHaveBeenCalledWith(
        `device:override:${mockDeviceId}`,
      );
      expect(redis.del).toHaveBeenCalledWith('device:override:dev-2');
    });

    it('should throw NotFoundException for nonexistent override', async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.clearOverride(mockOrgId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow up to 10 commands', async () => {
      redis.incr.mockResolvedValue(10);

      await expect(service.checkRateLimit(mockOrgId)).resolves.not.toThrow();
    });

    it('should reject the 11th command', async () => {
      redis.incr.mockResolvedValue(11);

      await expect(service.checkRateLimit(mockOrgId)).rejects.toThrow(
        TooManyRequestsException,
      );
    });

    it('should set TTL on first increment', async () => {
      redis.incr.mockResolvedValue(1);

      await service.checkRateLimit(mockOrgId);

      expect(redis.expire).toHaveBeenCalledWith(
        `fleet:ratelimit:${mockOrgId}`,
        60,
      );
    });
  });

  describe('audit logging', () => {
    it('should create audit entry for every command', async () => {
      db.display.findFirst.mockResolvedValue({
        id: mockDeviceId,
        nickname: 'Test',
        organizationId: mockOrgId,
      });

      const dto = {
        command: 'reload' as const,
        target: { type: 'device' as const, id: mockDeviceId },
      };

      await service.sendCommand(mockOrgId, mockUserId, 'admin', dto);

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          userId: mockUserId,
          action: 'fleet_command',
          entityType: 'fleet',
        }),
      });
    });
  });
});

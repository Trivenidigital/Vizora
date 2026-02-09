import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DeviceGateway } from './device.gateway';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';
import { NotificationService } from '../services/notification.service';
import { MetricsService } from '../metrics/metrics.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';

// Mock Sentry
jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

describe('DeviceGateway', () => {
  let gateway: DeviceGateway;
  let jwtService: JwtService;
  let redisService: RedisService;
  let metricsService: MetricsService;
  let databaseService: DatabaseService;
  let notificationService: NotificationService;

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockRedisService = {
    setDeviceStatus: jest.fn().mockResolvedValue(undefined),
    getDeviceCommands: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(false),
    getCachedPlaylist: jest.fn().mockResolvedValue(null),
    cachePlaylist: jest.fn().mockResolvedValue(undefined),
  };

  const mockHeartbeatService = {
    processHeartbeat: jest.fn().mockResolvedValue(undefined),
    logImpression: jest.fn().mockResolvedValue(undefined),
    logError: jest.fn().mockResolvedValue(undefined),
  };

  const mockPlaylistService = {
    getDevicePlaylist: jest.fn().mockResolvedValue(null),
  };

  const mockNotificationService = {
    wasDeviceOfflineLong: jest.fn().mockResolvedValue(false),
    cancelOfflineNotification: jest.fn().mockResolvedValue(undefined),
    scheduleOfflineNotification: jest.fn().mockResolvedValue(undefined),
    createOnlineNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockMetricsService = {
    recordConnection: jest.fn(),
    updateDeviceStatus: jest.fn(),
    recordHeartbeat: jest.fn(),
    recordImpression: jest.fn(),
    recordContentError: jest.fn(),
    updateDeviceMetrics: jest.fn(),
  };

  const mockDatabaseService = {
    display: {
      update: jest.fn().mockResolvedValue({ nickname: 'Test Device', deviceIdentifier: 'test-id' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    playlist: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    content: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  const mockStorageService = {
    isMinioAvailable: jest.fn().mockReturnValue(true),
    generateScreenshotKey: jest.fn().mockReturnValue('screenshots/test.png'),
    uploadScreenshot: jest.fn().mockResolvedValue(undefined),
    getPresignedUrl: jest.fn().mockResolvedValue('https://storage/test.png'),
  };

  const mockServer = {
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
    sockets: {
      sockets: new Map(),
    },
  };

  const createMockSocket = (overrides: Record<string, any> = {}) => ({
    id: 'socket-1',
    handshake: {
      auth: { token: 'valid-token' },
      address: '127.0.0.1',
    },
    data: {
      deviceId: 'device-1',
      organizationId: 'org-1',
      ...overrides.data,
    },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    emit: jest.fn(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Use fake timers to prevent setInterval leaks
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: HeartbeatService, useValue: mockHeartbeatService },
        { provide: PlaylistService, useValue: mockPlaylistService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    gateway = module.get<DeviceGateway>(DeviceGateway);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    metricsService = module.get<MetricsService>(MetricsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    notificationService = module.get<NotificationService>(NotificationService);

    // Assign mock server
    (gateway as any).server = mockServer;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('handleConnection', () => {
    it('should reject connections without a token', async () => {
      const client = createMockSocket({
        handshake: { auth: {}, address: '127.0.0.1' },
      });

      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should reject connections with an invalid token type', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'user', // not 'device'
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should accept valid device connections', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('device:device-1');
      expect(client.join).toHaveBeenCalledWith('org:org-1');
      expect(mockRedisService.setDeviceStatus).toHaveBeenCalled();
    });

    it('should reject connections with a revoked token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
        jti: 'token-123',
      });
      mockRedisService.exists.mockResolvedValueOnce(true); // token is revoked

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should reject expired JWT tokens', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should rate limit excessive connections from same IP', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      // Exhaust the rate limit (11 connections from same IP)
      for (let i = 0; i < 11; i++) {
        const client = createMockSocket({
          id: `socket-${i}`,
          handshake: { auth: { token: 'valid-token' }, address: '10.0.0.1' },
        });
        await gateway.handleConnection(client as any);
      }

      // The 12th should be rate limited
      const client = createMockSocket({
        id: 'socket-12',
        handshake: { auth: { token: 'valid-token' }, address: '10.0.0.1' },
      });
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should update Redis and DB on disconnect', async () => {
      // First register the device socket
      (gateway as any).deviceSockets.set('device-1', 'socket-1');

      const client = createMockSocket();

      await gateway.handleDisconnect(client as any);

      expect(mockRedisService.setDeviceStatus).toHaveBeenCalledWith('device-1', expect.objectContaining({
        status: 'offline',
      }));
      expect(mockDatabaseService.display.update).toHaveBeenCalled();
      expect(mockMetricsService.recordConnection).toHaveBeenCalledWith('org-1', 'disconnected');
    });

    it('should ignore disconnect for stale sockets', async () => {
      // Register a different socket for this device
      (gateway as any).deviceSockets.set('device-1', 'socket-new');

      const client = createMockSocket({ id: 'socket-old' });

      await gateway.handleDisconnect(client as any);

      // Should not update Redis/DB because socket-old is stale
      expect(mockRedisService.setDeviceStatus).not.toHaveBeenCalled();
    });

    it('should handle disconnect for non-device clients gracefully', async () => {
      const client = createMockSocket({
        data: {}, // no deviceId
      });

      await expect(gateway.handleDisconnect(client as any)).resolves.not.toThrow();
    });
  });

  describe('handleHeartbeat', () => {
    it('should process heartbeat and return success', async () => {
      const client = createMockSocket();
      const data = {
        metrics: { cpuUsage: 50, memoryUsage: 60 },
        currentContent: { contentId: 'content-1' },
      };

      const result = await gateway.handleHeartbeat(client as any, data as any);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('nextHeartbeatIn', 15000);
      expect(mockRedisService.setDeviceStatus).toHaveBeenCalled();
      expect(mockHeartbeatService.processHeartbeat).toHaveBeenCalled();
    });

    it('should not write to DB when status has not changed', async () => {
      // Pre-set the status cache to 'online'
      (gateway as any).deviceStatusCache.set('device-1', 'online');

      const client = createMockSocket();
      const data = {};

      await gateway.handleHeartbeat(client as any, data as any);

      // DB update should NOT be called since status hasn't changed
      expect(mockDatabaseService.display.update).not.toHaveBeenCalled();
    });

    it('should write to DB when status transitions from offline to online', async () => {
      // Pre-set the status cache to 'offline'
      (gateway as any).deviceStatusCache.set('device-1', 'offline');

      const client = createMockSocket();
      const data = {};

      await gateway.handleHeartbeat(client as any, data as any);

      // DB update SHOULD be called because status changed
      expect(mockDatabaseService.display.update).toHaveBeenCalled();
    });

    it('should return error response on failure', async () => {
      mockRedisService.setDeviceStatus.mockRejectedValueOnce(new Error('Redis down'));

      const client = createMockSocket();
      const data = {};

      const result = await gateway.handleHeartbeat(client as any, data as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should update metrics when device metrics are present', async () => {
      const client = createMockSocket();
      const data = {
        metrics: { cpuUsage: 75, memoryUsage: 80 },
      };

      await gateway.handleHeartbeat(client as any, data as any);

      expect(mockMetricsService.updateDeviceMetrics).toHaveBeenCalledWith(
        'org-1',
        75,
        80,
      );
    });
  });

  describe('room join/leave', () => {
    it('should allow joining own device room', async () => {
      const client = createMockSocket();
      const result = await gateway.handleJoinRoom(client as any, { room: 'device:device-1' });
      expect(result.success).toBe(true);
    });

    it('should allow joining own org room', async () => {
      const client = createMockSocket();
      const result = await gateway.handleJoinRoom(client as any, { room: 'org:org-1' });
      expect(result.success).toBe(true);
    });

    it('should reject joining different org room', async () => {
      const client = createMockSocket();
      const result = await gateway.handleJoinRoom(client as any, { room: 'org:other-org' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid room patterns', async () => {
      const client = createMockSocket();
      const result = await gateway.handleJoinRoom(client as any, { room: 'invalid:room' });
      expect(result.success).toBe(false);
    });

    it('should handle leave room', async () => {
      const client = createMockSocket();
      const result = await gateway.handleLeaveRoom(client as any, { room: 'org:org-1' });
      expect(result.success).toBe(true);
      expect(client.leave).toHaveBeenCalledWith('org:org-1');
    });
  });
});

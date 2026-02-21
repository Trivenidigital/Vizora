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
    rooms: new Set(['socket-1', 'device:device-1', 'org:org-1']),
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

    it('should reject connections when both JWT verifications fail', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should accept user JWT and join org room without device setup', async () => {
      // Device JWT fails, user JWT succeeds
      mockJwtService.verify
        .mockImplementationOnce(() => { throw new Error('invalid device token'); })
        .mockReturnValueOnce({
          sub: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
          type: 'user',
        });

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      // User connections should NOT be disconnected
      expect(client.disconnect).not.toHaveBeenCalled();
      // User connections should join org room
      expect(client.join).toHaveBeenCalledWith('org:org-1');
      // User connections should NOT trigger device DB lookup
      expect(mockDatabaseService.display.findUnique).not.toHaveBeenCalled();
      // User connections should NOT update Redis device status
      expect(mockRedisService.setDeviceStatus).not.toHaveBeenCalled();
    });

    it('should prevent device tokens from being accepted as user tokens', async () => {
      // Both verifications return a device-type payload
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      // But device is not in DB
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      // Device path runs (type === 'device') but device not found → disconnect
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should accept valid device connections', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue({ id: 'device-1', organizationId: 'org-1' });

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
      mockDatabaseService.display.findUnique.mockResolvedValue({ id: 'device-1', organizationId: 'org-1' });

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

  describe('handleContentImpression', () => {
    it('should log impression and return success', async () => {
      const client = createMockSocket();
      const data = { contentId: 'content-1', playlistId: 'playlist-1', duration: 10 };

      const result = await gateway.handleContentImpression(client as any, data as any);

      expect(result.success).toBe(true);
      expect(mockHeartbeatService.logImpression).toHaveBeenCalledWith('device-1', data);
    });

    it('should call heartbeat service logImpression with device ID', async () => {
      const client = createMockSocket({ data: { deviceId: 'device-99', organizationId: 'org-1' } });
      const data = { contentId: 'content-5' };

      await gateway.handleContentImpression(client as any, data as any);

      expect(mockHeartbeatService.logImpression).toHaveBeenCalledWith('device-99', data);
    });

    it('should record impression metrics', async () => {
      const client = createMockSocket();
      const data = { contentId: 'content-1' };

      await gateway.handleContentImpression(client as any, data as any);

      expect(mockMetricsService.recordImpression).toHaveBeenCalledWith('device-1', 'content-1');
    });

    it('should return error on failure and report to Sentry', async () => {
      const Sentry = require('@sentry/nestjs');
      mockHeartbeatService.logImpression.mockRejectedValueOnce(new Error('DB failure'));

      const client = createMockSocket();
      const data = { contentId: 'content-1' };

      const result = await gateway.handleContentImpression(client as any, data as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('handleContentError', () => {
    it('should log content error and return success', async () => {
      const client = createMockSocket();
      const data = { contentId: 'content-1', errorType: 'load_failed', errorMessage: 'timeout' };

      const result = await gateway.handleContentError(client as any, data as any);

      expect(result.success).toBe(true);
      expect(mockHeartbeatService.logError).toHaveBeenCalledWith('device-1', data);
    });

    it('should report content error to Sentry as a message', async () => {
      const Sentry = require('@sentry/nestjs');
      const client = createMockSocket();
      const data = { contentId: 'content-1', errorType: 'network_error', errorMessage: 'DNS failed' };

      await gateway.handleContentError(client as any, data as any);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Content error on device device-1'),
        expect.objectContaining({
          level: 'warning',
          tags: expect.objectContaining({
            deviceId: 'device-1',
            errorType: 'network_error',
            contentId: 'content-1',
          }),
        }),
      );
    });

    it('should record content error metrics', async () => {
      const client = createMockSocket();
      const data = { contentId: 'content-1', errorType: 'decode_error' };

      await gateway.handleContentError(client as any, data as any);

      expect(mockMetricsService.recordContentError).toHaveBeenCalledWith('device-1', 'decode_error');
    });

    it('should return error on internal failure', async () => {
      const Sentry = require('@sentry/nestjs');
      mockHeartbeatService.logError.mockRejectedValueOnce(new Error('DB down'));

      const client = createMockSocket();
      const data = { contentId: 'content-1', errorType: 'unknown' };

      const result = await gateway.handleContentError(client as any, data as any);

      expect(result.success).toBe(false);
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('handlePlaylistRequest', () => {
    it('should return playlist with forceRefresh', async () => {
      const mockPlaylist = { id: 'p-1', name: 'Test', items: [] };
      mockPlaylistService.getDevicePlaylist.mockResolvedValueOnce(mockPlaylist);

      const client = createMockSocket();
      const data = { forceRefresh: true };

      const result = await gateway.handlePlaylistRequest(client as any, data as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ playlist: mockPlaylist });
      expect(mockPlaylistService.getDevicePlaylist).toHaveBeenCalledWith('device-1', true);
    });

    it('should return null playlist when device has none', async () => {
      mockPlaylistService.getDevicePlaylist.mockResolvedValueOnce(null);

      const client = createMockSocket();
      const data = {};

      const result = await gateway.handlePlaylistRequest(client as any, data as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ playlist: null });
    });

    it('should return error on service failure', async () => {
      mockPlaylistService.getDevicePlaylist.mockRejectedValueOnce(new Error('Service down'));

      const client = createMockSocket();
      const data = {};

      const result = await gateway.handlePlaylistRequest(client as any, data as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendPlaylistUpdate', () => {
    it('should resolve minio:// URLs before sending', async () => {
      const playlist = {
        id: 'p-1',
        name: 'Test',
        items: [
          {
            id: 'item-1',
            contentId: 'c-1',
            content: { id: 'c-1', name: 'Image', url: 'minio://bucket/file.jpg' },
          },
        ],
      };

      await gateway.sendPlaylistUpdate('device-1', playlist as any);

      expect(mockServer.to).toHaveBeenCalledWith('device:device-1');
      const emitCall = mockServer.to('device:device-1').emit;
      expect(emitCall).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          playlist: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                content: expect.objectContaining({
                  url: expect.stringContaining('/api/device-content/c-1/file'),
                }),
              }),
            ]),
          }),
        }),
      );
    });

    it('should emit playlist:update to device room', async () => {
      const playlist = { id: 'p-1', name: 'Test', items: [] };

      await gateway.sendPlaylistUpdate('device-2', playlist as any);

      expect(mockServer.to).toHaveBeenCalledWith('device:device-2');
      const emitFn = mockServer.to('device:device-2').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          playlist: expect.objectContaining({ id: 'p-1' }),
        }),
      );
    });

    it('should include timestamp in the emitted event', async () => {
      const playlist = { id: 'p-1', name: 'Test', items: [] };

      await gateway.sendPlaylistUpdate('device-1', playlist as any);

      const emitFn = mockServer.to('device:device-1').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('sendCommand', () => {
    it('should emit command to device room', async () => {
      const command = { type: 'reload' as any };

      await gateway.sendCommand('device-1', command);

      expect(mockServer.to).toHaveBeenCalledWith('device:device-1');
      const emitFn = mockServer.to('device:device-1').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'command',
        expect.objectContaining({ type: 'reload' }),
      );
    });

    it('should include timestamp in the command', async () => {
      const command = { type: 'clear_cache' as any, payload: {} };

      await gateway.sendCommand('device-1', command);

      const emitFn = mockServer.to('device:device-1').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'command',
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('broadcastToOrganization', () => {
    it('should broadcast event to org room', async () => {
      const data = { message: 'hello' };

      await gateway.broadcastToOrganization('org-1', 'announcement', data);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-1');
      const emitFn = mockServer.to('org:org-1').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'announcement',
        expect.objectContaining({ message: 'hello' }),
      );
    });

    it('should pass through event name and include timestamp', async () => {
      const data = { key: 'value' };

      await gateway.broadcastToOrganization('org-2', 'custom:event', data);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-2');
      const emitFn = mockServer.to('org:org-2').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'custom:event',
        expect.objectContaining({
          key: 'value',
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('handleJoinOrganization', () => {
    it('should allow joining own organization', async () => {
      const client = createMockSocket();
      const data = { organizationId: 'org-1' };

      const result = await gateway.handleJoinOrganization(client as any, data as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ joined: true, organizationId: 'org-1' }));
      expect(client.join).toHaveBeenCalledWith('org:org-1');
    });

    it('should reject joining a different organization', async () => {
      const client = createMockSocket();
      const data = { organizationId: 'org-other' };

      const result = await gateway.handleJoinOrganization(client as any, data as any);

      expect(result.success).toBe(false);
      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: expect.stringContaining('Unauthorized'),
      }));
    });

    it('should return error when organizationId is missing', async () => {
      const client = createMockSocket();
      const data = {};

      const result = await gateway.handleJoinOrganization(client as any, data as any);

      expect(result.success).toBe(false);
    });

    it('should set isDashboard flag on client data', async () => {
      const client = createMockSocket();
      const data = { organizationId: 'org-1' };

      await gateway.handleJoinOrganization(client as any, data as any);

      expect(client.data.isDashboard).toBe(true);
    });
  });

  describe('handleScreenshotResponse', () => {
    // Helper: small valid PNG header in base64
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validPngBase64 = pngHeader.toString('base64');

    // Helper: small valid JPEG header in base64
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const validJpegBase64 = jpegHeader.toString('base64');

    it('should reject oversized screenshot data', async () => {
      const client = createMockSocket();
      const data = {
        requestId: 'req-1',
        imageData: 'A'.repeat(2 * 1024 * 1024 + 1),
        width: 1920,
        height: 1080,
      };

      const result = await gateway.handleScreenshotResponse(client as any, data as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should reject invalid base64 format', async () => {
      const client = createMockSocket();
      const data = {
        requestId: 'req-1',
        imageData: '!!!invalid-base64!!!',
        width: 1920,
        height: 1080,
      };

      const result = await gateway.handleScreenshotResponse(client as any, data as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('base64');
    });

    it('should reject images with invalid magic bytes', async () => {
      // Valid base64, but not PNG or JPEG header
      const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
      const gifBase64 = gifHeader.toString('base64');

      const client = createMockSocket();
      const data = {
        requestId: 'req-1',
        imageData: gifBase64,
        width: 1920,
        height: 1080,
      };

      const result = await gateway.handleScreenshotResponse(client as any, data as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid image format');
    });

    it('should accept valid PNG screenshots and save to storage', async () => {
      const client = createMockSocket();
      const data = {
        requestId: 'req-1',
        imageData: validPngBase64,
        width: 1920,
        height: 1080,
      };

      const result = await gateway.handleScreenshotResponse(client as any, data as any);

      expect(result.success).toBe(true);
      expect(mockStorageService.uploadScreenshot).toHaveBeenCalled();
      expect(mockStorageService.getPresignedUrl).toHaveBeenCalled();
    });

    it('should accept valid JPEG screenshots', async () => {
      const client = createMockSocket();
      const data = {
        requestId: 'req-1',
        imageData: validJpegBase64,
        width: 1920,
        height: 1080,
      };

      const result = await gateway.handleScreenshotResponse(client as any, data as any);

      expect(result.success).toBe(true);
      expect(mockStorageService.uploadScreenshot).toHaveBeenCalled();
    });

    it('should update the display record in database', async () => {
      const client = createMockSocket();
      const data = {
        requestId: 'req-1',
        imageData: validPngBase64,
        width: 1920,
        height: 1080,
      };

      await gateway.handleScreenshotResponse(client as any, data as any);

      expect(mockDatabaseService.display.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'device-1', organizationId: 'org-1' },
          data: expect.objectContaining({
            lastScreenshotAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should broadcast screenshot:ready to org room', async () => {
      const client = createMockSocket();
      const data = {
        requestId: 'req-1',
        imageData: validPngBase64,
        width: 1920,
        height: 1080,
      };

      await gateway.handleScreenshotResponse(client as any, data as any);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-1');
      const emitFn = mockServer.to('org:org-1').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'screenshot:ready',
        expect.objectContaining({
          deviceId: 'device-1',
          requestId: 'req-1',
          width: 1920,
          height: 1080,
        }),
      );
    });
  });

  describe('sendQrOverlayUpdate', () => {
    it('should emit qr-overlay:update to device room', async () => {
      const qrOverlay = { enabled: true, url: 'https://example.com', position: 'bottom-right' };

      await gateway.sendQrOverlayUpdate('device-1', qrOverlay);

      expect(mockServer.to).toHaveBeenCalledWith('device:device-1');
      const emitFn = mockServer.to('device:device-1').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'qr-overlay:update',
        expect.objectContaining({ qrOverlay }),
      );
    });

    it('should pass through data and include timestamp', async () => {
      const qrOverlay = { enabled: false };

      await gateway.sendQrOverlayUpdate('device-5', qrOverlay);

      expect(mockServer.to).toHaveBeenCalledWith('device:device-5');
      const emitFn = mockServer.to('device:device-5').emit;
      expect(emitFn).toHaveBeenCalledWith(
        'qr-overlay:update',
        expect.objectContaining({
          qrOverlay: { enabled: false },
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('resolveContentUrl', () => {
    it('should resolve minio:// URLs to API content endpoint', () => {
      const item = { content: { id: 'c-1', url: 'minio://bucket/file.jpg' } };

      const result = (gateway as any).resolveContentUrl(item);

      expect(result).toContain('/api/device-content/c-1/file');
    });

    it('should return original URL for non-minio URLs', () => {
      const item = { content: { id: 'c-1', url: 'https://cdn.example.com/file.jpg' } };

      const result = (gateway as any).resolveContentUrl(item);

      expect(result).toBe('https://cdn.example.com/file.jpg');
    });

    it('should return empty string when content or url is null', () => {
      const itemNoContent = { content: null };
      expect((gateway as any).resolveContentUrl(itemNoContent)).toBe('');

      const itemNoUrl = { content: { id: 'c-1', url: null } };
      expect((gateway as any).resolveContentUrl(itemNoUrl)).toBe('');
    });
  });

  describe('cleanupRateLimitEntries', () => {
    it('should remove expired rate limit entries', () => {
      const now = Date.now();
      const attempts = (gateway as any).connectionAttempts as Map<string, { count: number; resetAt: number }>;

      // Add an expired entry and a fresh entry
      attempts.set('10.0.0.1', { count: 5, resetAt: now - 1000 }); // expired
      attempts.set('10.0.0.2', { count: 3, resetAt: now + 60000 }); // still valid

      (gateway as any).cleanupRateLimitEntries();

      expect(attempts.has('10.0.0.1')).toBe(false);
      expect(attempts.has('10.0.0.2')).toBe(true);
    });

    it('should retain entries that have not expired', () => {
      const now = Date.now();
      const attempts = (gateway as any).connectionAttempts as Map<string, { count: number; resetAt: number }>;

      attempts.set('192.168.1.1', { count: 2, resetAt: now + 30000 });
      attempts.set('192.168.1.2', { count: 1, resetAt: now + 60000 });

      (gateway as any).cleanupRateLimitEntries();

      expect(attempts.size).toBe(2);
    });
  });

  describe('concurrent disconnect', () => {
    it('should handle dual socket disconnect correctly', async () => {
      // Register socket-new as active
      (gateway as any).deviceSockets.set('device-1', 'socket-new');

      const oldClient = createMockSocket({ id: 'socket-old' });
      const newClient = createMockSocket({ id: 'socket-new' });

      // Disconnect old (stale) socket first - should be ignored
      await gateway.handleDisconnect(oldClient as any);
      expect(mockRedisService.setDeviceStatus).not.toHaveBeenCalled();

      // Disconnect new (active) socket - should process
      await gateway.handleDisconnect(newClient as any);
      expect(mockRedisService.setDeviceStatus).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ status: 'offline' }),
      );
    });

    it('should ignore stale socket disconnect even with same device ID', async () => {
      // Socket-2 is the active socket
      (gateway as any).deviceSockets.set('device-1', 'socket-2');

      const staleClient = createMockSocket({ id: 'socket-1' });

      await gateway.handleDisconnect(staleClient as any);

      // None of the disconnect side effects should have happened
      expect(mockRedisService.setDeviceStatus).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.update).not.toHaveBeenCalled();
      expect(mockMetricsService.recordConnection).not.toHaveBeenCalled();
    });
  });

  describe('rate limiting boundary', () => {
    it('should allow exactly 10 connections within rate limit window', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue({ id: 'device-1', organizationId: 'org-1' });

      // 10 connections should be fine
      for (let i = 0; i < 10; i++) {
        const client = createMockSocket({
          id: `socket-${i}`,
          handshake: { auth: { token: 'valid-token' }, address: '10.0.0.50' },
        });
        await gateway.handleConnection(client as any);
      }

      // The 10th should NOT have been disconnected via rate-limit
      const tenthClient = createMockSocket({
        id: 'socket-10th-check',
        handshake: { auth: { token: 'valid-token' }, address: '10.0.0.50' },
      });
      // This is the 11th - should still pass (threshold is >10, so 11 is allowed, 12 is rejected)
      await gateway.handleConnection(tenthClient as any);
      // The 11th does increment count to 11 which is >10, so it gets rate limited
      // Actually per the code: rateEntry.count++ then if > 10.
      // After 10 connections, count is 10. 11th: count becomes 11, 11 > 10 = rate limited
      expect(tenthClient.disconnect).toHaveBeenCalled();
    });

    it('should reset rate limit after window expires', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue({ id: 'device-1', organizationId: 'org-1' });

      // Use a unique IP
      const testIp = '10.0.0.99';

      // Make 10 connections to get near the limit
      for (let i = 0; i < 10; i++) {
        const client = createMockSocket({
          id: `socket-reset-${i}`,
          handshake: { auth: { token: 'valid-token' }, address: testIp },
        });
        await gateway.handleConnection(client as any);
      }

      // Advance time past the 60s window
      jest.advanceTimersByTime(61000);

      // After window reset, should be allowed
      const client = createMockSocket({
        id: 'socket-after-reset',
        handshake: { auth: { token: 'valid-token' }, address: testIp },
      });
      await gateway.handleConnection(client as any);

      // Should NOT be rate limited since window reset
      // The client should not have been disconnected for rate limiting
      // (it may get disconnected for other reasons like device_not_found, but not rate_limited)
      const emitCalls = client.emit.mock.calls;
      const rateLimitEmit = emitCalls.find(
        (call: any[]) => call[0] === 'error' && call[1]?.message === 'rate_limited',
      );
      expect(rateLimitEmit).toBeUndefined();
    });
  });
});

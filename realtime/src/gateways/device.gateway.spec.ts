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
import { createHash } from 'node:crypto';

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
    sign: jest.fn(),
  };

  const hashToken = (token: string) =>
    createHash('sha256').update(token).digest('hex');

  const mockRedisService = {
    setDeviceStatus: jest.fn().mockResolvedValue(undefined),
    getDeviceCommands: jest.fn().mockResolvedValue([]),
    addDeviceCommand: jest.fn().mockResolvedValue(undefined),
    setPendingPlaylist: jest.fn().mockResolvedValue(undefined),
    deletePendingPlaylist: jest.fn().mockResolvedValue(undefined),
    getPendingPlaylist: jest.fn().mockResolvedValue(null),
    exists: jest.fn().mockResolvedValue(false),
    get: jest.fn().mockResolvedValue(null),
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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        nickname: 'Test Device',
        deviceIdentifier: 'test-id',
        jwtToken: hashToken('valid-token'),
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    playlist: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    content: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const mockStorageService = {
    isMinioAvailable: jest.fn().mockReturnValue(true),
    generateScreenshotKey: jest.fn().mockReturnValue('screenshots/test.png'),
    uploadScreenshot: jest.fn().mockResolvedValue(undefined),
    getPresignedUrl: jest.fn().mockResolvedValue('https://storage/test.png'),
  };

  // Mock socket that auto-invokes ack callbacks on emit
  const mockRemoteSocket = {
    id: 'remote-socket-1',
    data: { deliveryAckCapable: true, deviceId: 'device-1' },
    emit: jest.fn((_event: string, _data: any, ackCb?: () => void) => {
      if (ackCb) ackCb();
    }),
  };

  const mockServer = {
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
    in: jest.fn().mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([mockRemoteSocket]),
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
    (gateway as any).deviceSockets.set('device-1', 'remote-socket-1');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('layout content resolution', () => {
    it('emits display-compatible resolvedPlaylist and resolvedContent zone fields', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValueOnce({
        id: 'playlist-1',
        name: 'Menu Loop',
        items: [
          {
            id: 'item-1',
            contentId: 'content-1',
            duration: 10,
            order: 0,
            content: {
              id: 'content-1',
              name: 'Menu Image',
              type: 'image',
              url: 'minio://org/content-1.png',
              thumbnail: '/thumb.png',
              mimeType: 'image/png',
              duration: 10,
            },
          },
        ],
      });
      mockDatabaseService.content.findFirst.mockResolvedValueOnce({
        id: 'content-2',
        name: 'Weather',
        type: 'url',
        url: 'https://example.com/weather',
        thumbnail: null,
        mimeType: null,
        duration: null,
      });

      const result = await (gateway as any).resolveLayoutContent({
        id: 'layout-1',
        type: 'layout',
        metadata: {
          zones: [
            { id: 'zone-playlist', gridArea: 'main', playlistId: 'playlist-1' },
            { id: 'zone-content', gridArea: 'side', contentId: 'content-2' },
          ],
        },
      }, 'org-1');

      expect(result.metadata.zones[0].resolvedPlaylist).toEqual(
        expect.objectContaining({
          id: 'playlist-1',
          items: expect.arrayContaining([
            expect.objectContaining({
              content: expect.objectContaining({
                id: 'content-1',
                name: 'Menu Image',
                url: 'http://localhost:3000/api/v1/device-content/content-1/file',
              }),
            }),
          ]),
        }),
      );
      expect(result.metadata.zones[0].playlist).toBeUndefined();
      expect(result.metadata.zones[1].resolvedContent).toEqual(
        expect.objectContaining({
          id: 'content-2',
          name: 'Weather',
          url: 'https://example.com/weather',
        }),
      );
      expect(result.metadata.zones[1].content).toBeUndefined();
      expect(mockDatabaseService.playlist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'playlist-1', organizationId: 'org-1' },
        }),
      );
      expect(mockDatabaseService.content.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'content-2', organizationId: 'org-1' },
        }),
      );
    });

    it('does not resolve cross-organization layout zone references', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValueOnce(null);
      mockDatabaseService.content.findFirst.mockResolvedValueOnce(null);

      const result = await (gateway as any).resolveLayoutContent({
        id: 'layout-1',
        type: 'layout',
        metadata: {
          zones: [
            { id: 'zone-playlist', gridArea: 'main', playlistId: 'other-org-playlist' },
            { id: 'zone-content', gridArea: 'side', contentId: 'other-org-content' },
          ],
        },
      }, 'org-1');

      expect(result.metadata.zones[0].resolvedPlaylist).toBeUndefined();
      expect(result.metadata.zones[1].resolvedContent).toBeUndefined();
      expect(mockDatabaseService.playlist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'other-org-playlist', organizationId: 'org-1' },
        }),
      );
      expect(mockDatabaseService.content.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'other-org-content', organizationId: 'org-1' },
        }),
      );
    });
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
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        jwtToken: hashToken('valid-token'),
      });

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('device:device-1');
      expect(client.join).toHaveBeenCalledWith('org:org-1');
      expect(mockRedisService.setDeviceStatus).toHaveBeenCalled();
    });

    it('should reject disabled device connections', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: true,
        jwtToken: hashToken('valid-token'),
      });

      const client = createMockSocket();

      await gateway.handleConnection(client as any);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'device_disabled' });
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalledWith('device:device-1');
    });

    it('should reject a signed device token that is not the current stored token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        jwtToken: hashToken('current-device-token'),
      });

      const client = createMockSocket({
        handshake: { auth: { token: 'stale-device-token' }, address: '127.0.0.1' },
      });

      await gateway.handleConnection(client as any);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'device_token_stale' });
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalledWith('device:device-1');
      expect(mockRedisService.setDeviceStatus).not.toHaveBeenCalled();
    });

    it('should reject a signed device token when the display has no stored token hash', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        jwtToken: null,
      });

      const client = createMockSocket();

      await gateway.handleConnection(client as any);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'device_token_stale' });
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalledWith('device:device-1');
    });

    it('should persist a rotated device token hash before emitting token refresh', async () => {
      const oldToken = 'valid-token';
      const newToken = 'rotated-device-token';
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
        exp: Math.floor(Date.now() / 1000) + 3 * 86400,
      });
      mockJwtService.sign.mockReturnValue(newToken);
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        jwtToken: hashToken(oldToken),
      });
      mockDatabaseService.display.updateMany.mockResolvedValue({ count: 1 });

      const client = createMockSocket({
        handshake: { auth: { token: oldToken }, address: '127.0.0.1' },
      });

      await gateway.handleConnection(client as any);

      expect(mockDatabaseService.display.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'device-1',
          organizationId: 'org-1',
          isDisabled: false,
          jwtToken: hashToken(oldToken),
        },
        data: { jwtToken: hashToken(newToken) },
      });
      expect(client.emit).toHaveBeenCalledWith('token:refresh', { token: newToken });
    });

    it('should not emit a rotated token when persisting the new hash races or fails', async () => {
      const oldToken = 'valid-token';
      const newToken = 'rotated-device-token';
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
        exp: Math.floor(Date.now() / 1000) + 3 * 86400,
      });
      mockJwtService.sign.mockReturnValue(newToken);
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        jwtToken: hashToken(oldToken),
      });
      mockDatabaseService.display.updateMany.mockResolvedValue({ count: 0 });

      const client = createMockSocket({
        handshake: { auth: { token: oldToken }, address: '127.0.0.1' },
      });

      await gateway.handleConnection(client as any);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalledWith('token:refresh', { token: newToken });
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

    // Dashboard-user session invalidation — mirrors the REST JwtStrategy
    // checks (PR #111) on the realtime handshake, reading the shared Redis
    // keys middleware writes: user_revoked:${sub} and pwd_changed:${sub}.
    it('should reject a dashboard user whose account was revoked (user_revoked:)', async () => {
      mockJwtService.verify
        .mockImplementationOnce(() => { throw new Error('invalid device token'); })
        .mockReturnValueOnce({
          sub: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
          type: 'user',
          jti: 'jti-1',
        });
      mockRedisService.exists.mockImplementation((key: string) =>
        Promise.resolve(key === 'user_revoked:user-1'),
      );

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalledWith('org:org-1');
    });

    it('should reject a dashboard user token minted before the last password change (pwd_changed:)', async () => {
      mockJwtService.verify
        .mockImplementationOnce(() => { throw new Error('invalid device token'); })
        .mockReturnValueOnce({
          sub: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
          type: 'user',
          jti: 'jti-1',
          iat: 1_999_999,
        });
      mockRedisService.exists.mockResolvedValue(false); // not revoked
      mockRedisService.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'pwd_changed:user-1' ? '2000000' : null),
      );

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalledWith('org:org-1');
    });

    it('should accept a dashboard user token minted after the last password change', async () => {
      mockJwtService.verify
        .mockImplementationOnce(() => { throw new Error('invalid device token'); })
        .mockReturnValueOnce({
          sub: 'user-1',
          email: 'test@example.com',
          organizationId: 'org-1',
          type: 'user',
          jti: 'jti-1',
          iat: 2_000_001,
        });
      mockRedisService.exists.mockResolvedValue(false);
      mockRedisService.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'pwd_changed:user-1' ? '2000000' : null),
      );

      const client = createMockSocket();

      await gateway.handleConnection(client as any);
      // Assert the pwd_changed key was actually queried — without this, the
      // test would stay green even if the whole check were deleted (a fresh
      // login always connects). This makes it a real positive sentinel.
      expect(mockRedisService.get).toHaveBeenCalledWith('pwd_changed:user-1');
      expect(client.join).toHaveBeenCalledWith('org:org-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should rate limit excessive connections from same IP', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'device-1',
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: 'test-id',
      });
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        jwtToken: hashToken('valid-token'),
      });

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

    it('should not rate limit different tokens sharing one proxy IP', async () => {
      mockJwtService.verify.mockImplementation((token: string) => ({
        sub: token,
        type: 'device',
        organizationId: 'org-1',
        deviceIdentifier: token,
      }));
      mockDatabaseService.display.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve({
          id: where.id,
          organizationId: 'org-1',
          isDisabled: false,
          jwtToken: hashToken(where.id),
        }),
      );

      const clients = [];
      for (let i = 0; i < 12; i++) {
        const client = createMockSocket({
          id: `socket-token-${i}`,
          handshake: { auth: { token: `device-token-${i}` }, address: '10.0.0.1' },
        });
        clients.push(client);
        await gateway.handleConnection(client as any);
      }

      expect(clients.every((client) => client.disconnect.mock.calls.length === 0)).toBe(true);
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
      expect(mockDatabaseService.display.updateMany).toHaveBeenCalled();
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

    it('does not schedule an offline notification for intentional disable disconnects', async () => {
      (gateway as any).deviceSockets.set('device-1', 'socket-1');

      const client = createMockSocket({
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          suppressOfflineNotification: true,
        },
      });

      await gateway.handleDisconnect(client as any);

      expect(mockNotificationService.scheduleOfflineNotification).not.toHaveBeenCalled();
      expect(mockMetricsService.recordConnection).toHaveBeenCalledWith('org-1', 'disconnected');
    });

    it('should handle disconnect for non-device clients gracefully', async () => {
      const client = createMockSocket({
        data: {}, // no deviceId
      });

      await expect(gateway.handleDisconnect(client as any)).resolves.not.toThrow();
    });
  });

  describe('disconnectDevice', () => {
    it('emits a reason and disconnects the active device socket', () => {
      const socket = {
        id: 'remote-socket-1',
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      mockServer.sockets.sockets.set('remote-socket-1', socket);
      (gateway as any).deviceSockets.set('device-1', 'remote-socket-1');

      const result = gateway.disconnectDevice('device-1', 'device_disabled');

      expect(result).toBe(true);
      expect(socket.data).toEqual(expect.objectContaining({ suppressOfflineNotification: true }));
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'device_disabled' });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
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

    it('should replay pending deliveries after heartbeat without returning command drains', async () => {
      const emit = jest.fn((_event: string, _payload: any, ackCb?: (ack?: { ok: boolean }) => void) => {
        ackCb?.({ ok: true });
      });
      const client = createMockSocket({
        connected: true,
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deliveryAckCapable: true,
        },
        emit,
      });
      const pendingPlaylist = { id: 'playlist-pending', items: [] };
      const pendingCommand = { type: 'reload', timestamp: '2026-05-31T00:00:00.000Z' };
      mockRedisService.getPendingPlaylist.mockResolvedValueOnce(pendingPlaylist);
      mockRedisService.getDeviceCommands.mockResolvedValueOnce([pendingCommand]);
      (gateway as any).deviceSockets.set('device-1', 'socket-1');

      const result = await gateway.handleHeartbeat(client as any, {} as any);
      for (let i = 0; i < 8; i += 1) {
        await Promise.resolve();
      }

      expect(result.success).toBe(true);
      expect(result.data.commands).toEqual([]);
      expect(mockRedisService.getPendingPlaylist).toHaveBeenCalledWith('device-1');
      expect(mockRedisService.getDeviceCommands).toHaveBeenCalledWith('device-1');
      expect(emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          playlist: pendingPlaylist,
          timestamp: expect.any(String),
        }),
        expect.any(Function),
      );
      expect(emit).toHaveBeenCalledWith('command', pendingCommand, expect.any(Function));
      expect(mockRedisService.setPendingPlaylist).not.toHaveBeenCalledWith('device-1', pendingPlaylist);
      expect(mockRedisService.addDeviceCommand).not.toHaveBeenCalledWith('device-1', pendingCommand);
    });

    it('should not drain pending deliveries from stale socket heartbeats', async () => {
      const client = createMockSocket({
        id: 'socket-old',
        connected: true,
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deliveryAckCapable: true,
        },
      });
      (gateway as any).deviceSockets.set('device-1', 'socket-new');

      const result = await gateway.handleHeartbeat(client as any, {} as any);
      for (let i = 0; i < 4; i += 1) {
        await Promise.resolve();
      }

      expect(result.success).toBe(true);
      expect(result.data.commands).toEqual([]);
      expect(mockRedisService.getPendingPlaylist).not.toHaveBeenCalled();
      expect(mockRedisService.getDeviceCommands).not.toHaveBeenCalled();
    });

    it('should requeue remaining pending commands if the active socket changes during replay', async () => {
      const pendingCommands = [
        { type: 'reload', timestamp: '2026-05-31T00:00:00.000Z' },
        { type: 'clear_cache', timestamp: '2026-05-31T00:00:01.000Z' },
      ];
      const emit = jest.fn((_event: string, _payload: any, ackCb?: (ack?: { ok: boolean }) => void) => {
        ackCb?.({ ok: true });
        (gateway as any).deviceSockets.set('device-1', 'socket-new');
      });
      const client = createMockSocket({
        connected: true,
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deliveryAckCapable: true,
        },
        emit,
      });
      (gateway as any).deviceSockets.set('device-1', 'socket-1');
      mockRedisService.getDeviceCommands.mockResolvedValueOnce(pendingCommands);

      const result = await (gateway as any).deliverPendingCommands(client, 'device-1');

      expect(result).toEqual({ delivered: 0, requeued: 2, skipped: false, shouldBackoff: false });
      expect(emit).toHaveBeenCalledTimes(1);
      expect(mockRedisService.addDeviceCommand).toHaveBeenCalledWith('device-1', pendingCommands[0]);
      expect(mockRedisService.addDeviceCommand).toHaveBeenCalledWith('device-1', pendingCommands[1]);
    });

    it('should back off heartbeat replay after failed pending delivery', async () => {
      const emit = jest.fn((_event: string, _payload: any, ackCb?: (ack?: { ok: boolean; error?: string }) => void) => {
        ackCb?.({ ok: false, error: 'renderer failed' });
      });
      const client = createMockSocket({
        connected: true,
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deliveryAckCapable: true,
        },
        emit,
      });
      (gateway as any).deviceSockets.set('device-1', 'socket-1');
      mockRedisService.getPendingPlaylist.mockResolvedValueOnce({ id: 'playlist-pending', items: [] });

      await gateway.handleHeartbeat(client as any, {} as any);
      for (let i = 0; i < 8; i += 1) {
        await Promise.resolve();
      }
      expect(mockRedisService.setPendingPlaylist).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ id: 'playlist-pending' }),
      );

      mockRedisService.getPendingPlaylist.mockClear();
      await gateway.handleHeartbeat(client as any, {} as any);
      for (let i = 0; i < 4; i += 1) {
        await Promise.resolve();
      }

      expect(mockRedisService.getPendingPlaylist).not.toHaveBeenCalled();
    });

    it('should not write to DB when status has not changed', async () => {
      // Pre-set the status cache to 'online'
      (gateway as any).deviceStatusCache.set('device-1', 'online');

      const client = createMockSocket();
      const data = {};

      await gateway.handleHeartbeat(client as any, data as any);

      // DB update should NOT be called since status hasn't changed
      expect(mockDatabaseService.display.updateMany).not.toHaveBeenCalled();
    });

    it('should write to DB when status transitions from offline to online', async () => {
      // Pre-set the status cache to 'offline'
      (gateway as any).deviceStatusCache.set('device-1', 'offline');

      const client = createMockSocket();
      const data = {};

      await gateway.handleHeartbeat(client as any, data as any);

      // DB update SHOULD be called because status changed
      expect(mockDatabaseService.display.updateMany).toHaveBeenCalled();
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

    it('should redact device tokens before storing or reporting content errors', async () => {
      const Sentry = require('@sentry/nestjs');
      const client = createMockSocket();
      const data = {
        contentId: 'content-1',
        errorType: 'network_error',
        errorMessage: 'failed http://localhost:3000/api/v1/device-content/content-1/file?token=device-jwt',
        context: {
          url: 'http://localhost:3000/api/v1/device-content/content-1/file?variant=original&token=device-jwt',
        },
      };

      await gateway.handleContentError(client as any, data as any);

      expect(mockHeartbeatService.logError).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          errorMessage: 'failed http://localhost:3000/api/v1/device-content/content-1/file?token=[redacted]',
          context: {
            url: 'http://localhost:3000/api/v1/device-content/content-1/file?variant=original&token=[redacted]',
          },
        }),
      );
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          extra: expect.objectContaining({
            errorMessage: 'failed http://localhost:3000/api/v1/device-content/content-1/file?token=[redacted]',
            context: {
              url: 'http://localhost:3000/api/v1/device-content/content-1/file?variant=original&token=[redacted]',
            },
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
    beforeEach(() => {
      mockRemoteSocket.emit.mockClear();
      mockServer.in.mockClear();
    });

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

      const result = await gateway.sendPlaylistUpdate('device-1', playlist as any);

      expect(result).toEqual({ delivered: true });
      expect(mockServer.in).toHaveBeenCalledWith('device:device-1');
      expect(mockRemoteSocket.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          playlist: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                content: expect.objectContaining({
                  url: expect.stringContaining('/api/v1/device-content/c-1/file'),
                }),
              }),
            ]),
          }),
        }),
        expect.any(Function),
      );
    });

    it('should emit playlist:update to device room', async () => {
      const playlist = { id: 'p-1', name: 'Test', items: [] };

      const result = await gateway.sendPlaylistUpdate('device-1', playlist as any);

      expect(result).toEqual({ delivered: true });
      expect(mockServer.in).toHaveBeenCalledWith('device:device-1');
      expect(mockRemoteSocket.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          playlist: expect.objectContaining({ id: 'p-1' }),
        }),
        expect.any(Function),
      );
    });

    it('should include timestamp in the emitted event', async () => {
      const playlist = { id: 'p-1', name: 'Test', items: [] };

      const result = await gateway.sendPlaylistUpdate('device-1', playlist as any);

      expect(result).toEqual({ delivered: true });
      expect(mockRemoteSocket.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
        expect.any(Function),
      );
    });

    it('should clear stale pending playlist after a newer playlist is acknowledged', async () => {
      const playlist = { id: 'p-new', name: 'New Playlist', items: [] };

      const result = await gateway.sendPlaylistUpdate('device-1', playlist as any);

      expect(result).toEqual({ delivered: true });
      expect(mockRedisService.deletePendingPlaylist).toHaveBeenCalledWith('device-1');
    });

    it('should not replay an already-consumed pending playlist after a newer playlist is acknowledged', async () => {
      const oldPlaylist = { id: 'p-old', name: 'Old Playlist', items: [] };
      const newPlaylist = { id: 'p-new', name: 'New Playlist', items: [] };
      const pendingClientEmit = jest.fn((_event: string, _payload: any, ackCb?: (ack?: { ok: boolean }) => void) => {
        ackCb?.({ ok: true });
      });
      const pendingClient = createMockSocket({
        connected: true,
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deliveryAckCapable: true,
        },
        emit: pendingClientEmit,
      });
      let resolveDisplay!: (value: any) => void;
      const displayLookup = new Promise(resolve => {
        resolveDisplay = resolve;
      });
      mockRedisService.getPendingPlaylist.mockResolvedValueOnce(oldPlaylist);
      mockDatabaseService.display.findUnique.mockReturnValueOnce(displayLookup);
      (gateway as any).deviceSockets.set('device-1', 'socket-1');

      const replay = (gateway as any).deliverPendingPlaylist(pendingClient, 'device-1');
      await Promise.resolve();
      await Promise.resolve();

      mockServer.in.mockReturnValueOnce({
        fetchSockets: jest.fn().mockResolvedValue([pendingClient]),
      });
      const pushResult = await gateway.sendPlaylistUpdate('device-1', newPlaylist as any);
      resolveDisplay({ metadata: {} });
      const replayResult = await replay;

      expect(pushResult).toEqual({ delivered: true });
      expect(replayResult).toBe('skipped');
      expect(pendingClientEmit).not.toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({ playlist: oldPlaylist }),
        expect.any(Function),
      );
      expect(mockRedisService.setPendingPlaylist).not.toHaveBeenCalledWith('device-1', oldPlaylist);
      expect(mockRedisService.deletePendingPlaylist).toHaveBeenCalledWith('device-1');
    });

    it('should return no_sockets when no devices connected', async () => {
      mockServer.in.mockReturnValueOnce({
        fetchSockets: jest.fn().mockResolvedValue([]),
      });
      const playlist = { id: 'p-1', name: 'Test', items: [] };
      (gateway as any).heartbeatReplayState.set('device-99', { failures: 5, lastAttemptAt: Date.now() });

      const result = await gateway.sendPlaylistUpdate('device-99', playlist as any);

      expect(result).toEqual({ delivered: false, reason: 'no_sockets' });
      expect((gateway as any).heartbeatReplayState.has('device-99')).toBe(false);
    });

    it('should queue playlist when only a dashboard socket is in the device room', async () => {
      const dashboardSocket = {
        id: 'dashboard-socket',
        data: { isDashboard: true, organizationId: 'org-1' },
        emit: jest.fn(),
      };
      mockServer.in.mockReturnValueOnce({
        fetchSockets: jest.fn().mockResolvedValue([dashboardSocket]),
      });

      const result = await gateway.sendPlaylistUpdate('device-1', { id: 'p-1', name: 'Test', items: [] } as any);

      expect(result).toEqual({ delivered: false, reason: 'no_sockets' });
      expect(dashboardSocket.emit).not.toHaveBeenCalled();
      expect(mockRedisService.setPendingPlaylist).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ id: 'p-1' }),
      );
    });

    it('should requeue playlist when the device sends a negative ack', async () => {
      mockRemoteSocket.emit.mockImplementationOnce(
        (_event: string, _data: any, ackCb?: (ack?: { ok: boolean; error?: string }) => void) => {
          ackCb?.({ ok: false, error: 'renderer failed' });
        },
      );
      const playlist = { id: 'p-1', name: 'Test', items: [] };

      const result = await gateway.sendPlaylistUpdate('device-1', playlist as any);

      expect(result).toEqual({ delivered: false, reason: 'negative_ack' });
      expect(mockRedisService.setPendingPlaylist).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ id: 'p-1' }),
      );
    });

    it('should treat no-ack legacy sockets as best-effort delivered', async () => {
      const legacySocket = {
        id: 'legacy-socket',
        data: { deliveryAckCapable: false, deviceId: 'device-1' },
        emit: jest.fn(),
      };
      (gateway as any).deviceSockets.set('device-1', 'legacy-socket');
      mockServer.in.mockReturnValueOnce({
        fetchSockets: jest.fn().mockResolvedValue([legacySocket]),
      });
      const playlist = { id: 'p-legacy', name: 'Legacy', items: [] };

      const result = await gateway.sendPlaylistUpdate('device-1', playlist as any);

      expect(result).toEqual({ delivered: true });
      expect(legacySocket.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          playlist: expect.objectContaining({ id: 'p-legacy' }),
        }),
      );
      expect(mockRedisService.setPendingPlaylist).not.toHaveBeenCalled();
    });
  });

  describe('sendCommand', () => {
    it('should emit command with ack to connected device', async () => {
      const command = { type: 'reload' as any };

      const result = await gateway.sendCommand('device-1', command);

      expect(result).toEqual({ delivered: true });
      expect(mockServer.in).toHaveBeenCalledWith('device:device-1');
      expect(mockRemoteSocket.emit).toHaveBeenCalledWith(
        'command',
        expect.objectContaining({ type: 'reload', timestamp: expect.any(String) }),
        expect.any(Function),
      );
    });

    it('should queue command when no sockets connected', async () => {
      mockServer.in.mockReturnValueOnce({
        fetchSockets: jest.fn().mockResolvedValue([]),
      });
      const command = { type: 'clear_cache' as any, payload: {} };
      (gateway as any).heartbeatReplayState.set('device-99', { failures: 5, lastAttemptAt: Date.now() });

      const result = await gateway.sendCommand('device-99', command);

      expect(result).toEqual({ delivered: false, reason: 'no_sockets' });
      expect(mockRedisService.addDeviceCommand).toHaveBeenCalledWith(
        'device-99',
        expect.objectContaining({ type: 'clear_cache', timestamp: expect.any(String) }),
      );
      expect((gateway as any).heartbeatReplayState.has('device-99')).toBe(false);
    });

    it('should queue command when only a dashboard socket is in the device room', async () => {
      const dashboardSocket = {
        id: 'dashboard-socket',
        data: { isDashboard: true, organizationId: 'org-1' },
        emit: jest.fn(),
      };
      mockServer.in.mockReturnValueOnce({
        fetchSockets: jest.fn().mockResolvedValue([dashboardSocket]),
      });
      const command = { type: 'reload' as any };

      const result = await gateway.sendCommand('device-1', command);

      expect(result).toEqual({ delivered: false, reason: 'no_sockets' });
      expect(dashboardSocket.emit).not.toHaveBeenCalled();
      expect(mockRedisService.addDeviceCommand).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ type: 'reload', timestamp: expect.any(String) }),
      );
    });

    it('should queue command when the device sends a negative ack', async () => {
      mockRemoteSocket.emit.mockImplementationOnce(
        (_event: string, _data: any, ackCb?: (ack?: { ok: boolean; error?: string }) => void) => {
          ackCb?.({ ok: false, error: 'command failed' });
        },
      );
      const command = { type: 'reload' as any };

      const result = await gateway.sendCommand('device-1', command);

      expect(result).toEqual({ delivered: false, reason: 'negative_ack' });
      expect(mockRedisService.addDeviceCommand).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({ type: 'reload', timestamp: expect.any(String) }),
      );
    });

    it('should treat no-ack legacy sockets as best-effort delivered for commands', async () => {
      const legacySocket = {
        id: 'legacy-socket',
        data: { deliveryAckCapable: false, deviceId: 'device-1' },
        emit: jest.fn(),
      };
      (gateway as any).deviceSockets.set('device-1', 'legacy-socket');
      mockServer.in.mockReturnValueOnce({
        fetchSockets: jest.fn().mockResolvedValue([legacySocket]),
      });
      const command = { type: 'reload' as any };

      const result = await gateway.sendCommand('device-1', command);

      expect(result).toEqual({ delivered: true });
      expect(legacySocket.emit).toHaveBeenCalledWith(
        'command',
        expect.objectContaining({ type: 'reload', timestamp: expect.any(String) }),
      );
      expect(mockRedisService.addDeviceCommand).not.toHaveBeenCalled();
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

  describe('sendDeviceStatusCatchUp (catch-up cap)', () => {
    it('should cap a large fleet at 500 devices and warn about truncation', async () => {
      const client = createMockSocket();
      // Simulate 501 devices for one org — the cap is 500, so the
      // query should request take=501 (cap + 1 peek) and the function
      // should emit only the first 500 + a warning.
      const fleet = Array.from({ length: 501 }, (_, i) => ({
        id: `dev-${i}`,
        status: 'offline',
        lastHeartbeat: new Date(Date.now() - i * 1000),
      }));
      databaseService.display.findMany.mockResolvedValue(fleet as any);

      const warnSpy = jest.spyOn((gateway as any).logger, 'warn');

      await (gateway as any).sendDeviceStatusCatchUp(client, 'org-big');

      expect(databaseService.display.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-big' },
          take: 501,
        }),
      );
      expect(client.emit).toHaveBeenCalledTimes(500);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('truncated at 500'));
    });

    it('should send all devices when fleet is under the cap', async () => {
      const client = createMockSocket();
      const fleet = Array.from({ length: 7 }, (_, i) => ({
        id: `dev-${i}`,
        status: 'offline',
        lastHeartbeat: new Date(),
      }));
      databaseService.display.findMany.mockResolvedValue(fleet as any);

      await (gateway as any).sendDeviceStatusCatchUp(client, 'org-small');

      expect(client.emit).toHaveBeenCalledTimes(7);
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

      expect(result).toContain('/api/v1/device-content/c-1/file');
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
      expect(mockDatabaseService.display.updateMany).not.toHaveBeenCalled();
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

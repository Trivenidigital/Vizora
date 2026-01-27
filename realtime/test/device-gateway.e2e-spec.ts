import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app/app.module';
import { RedisService } from '../src/services/redis.service';
import { DeviceGateway } from '../src/gateways/device.gateway';

describe('DeviceGateway (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let redisService: RedisService;
  let deviceGateway: DeviceGateway;
  let serverUrl: string;
  let deviceToken: string;
  let deviceId: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0); // Random available port

    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? address : address.port;
    serverUrl = `http://localhost:${port}`;

    jwtService = moduleFixture.get<JwtService>(JwtService);
    redisService = moduleFixture.get<RedisService>(RedisService);
    deviceGateway = moduleFixture.get<DeviceGateway>(DeviceGateway);

    // Generate test device token
    deviceId = 'test-device-001';
    organizationId = 'test-org-001';
    deviceToken = jwtService.sign(
      {
        sub: deviceId,
        deviceIdentifier: 'TEST-DEVICE-001',
        organizationId,
        type: 'device',
      },
      {
        secret: process.env.DEVICE_JWT_SECRET,
        expiresIn: '1h',
      }
    );
  });

  afterAll(async () => {
    try {
      // Cleanup Redis
      await redisService.deletePattern(`device:${deviceId}:*`);
      await redisService.deletePattern(`heartbeat:${deviceId}:*`);
      await redisService.deletePattern(`errors:device:${deviceId}`);
      await redisService.deletePattern(`stats:device:${deviceId}:*`);
    } catch (error) {
      // Ignore Redis errors during cleanup
    }

    await app.close();
    
    // Give time for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  describe('Connection Establishment', () => {
    let client: Socket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should successfully connect with valid device token', (done) => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        done();
      });

      client.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should receive initial config after connection', (done) => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
      });

      client.on('config', (config) => {
        expect(config).toHaveProperty('heartbeatInterval');
        expect(config).toHaveProperty('cacheSize');
        expect(config).toHaveProperty('autoUpdate');
        expect(config.heartbeatInterval).toBe(15000);
        done();
      });
    });

    it('should reject connection without token', (done) => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {},
      });

      client.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      client.once('disconnect', () => {
        expect(client.connected).toBe(false);
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: 'invalid-token',
        },
      });

      client.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      client.once('disconnect', () => {
        expect(client.connected).toBe(false);
        done();
      });
    });

    it('should reject connection with non-device token type', (done) => {
      const userToken = jwtService.sign(
        {
          sub: 'user-123',
          type: 'user',
        },
        {
          secret: process.env.DEVICE_JWT_SECRET,
          expiresIn: '1h',
        }
      );

      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: userToken,
        },
      });

      client.on('connect', () => {
        done(new Error('Should not connect with user token'));
      });

      client.once('disconnect', () => {
        expect(client.connected).toBe(false);
        done();
      });
    });

    it('should update device status in Redis on connection', async () => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
      });

      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
      });

      // Wait a bit for Redis update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await redisService.getDeviceStatus(deviceId);
      expect(status).toBeDefined();
      expect(status.status).toBe('online');
      expect(status.socketId).toBeDefined();
      expect(status.organizationId).toBe(organizationId);
    });
  });

  describe('Heartbeat Mechanism', () => {
    let client: Socket;

    beforeEach((done) => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
      });

      client.on('connect', () => done());
    });

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should handle heartbeat with metrics', (done) => {
      const heartbeatData = {
        metrics: {
          cpuUsage: 45.2,
          memoryUsage: 62.8,
          storageUsed: 1024000,
          networkLatency: 23,
        },
        currentContent: {
          contentId: 'content-123',
          playlistId: 'playlist-456',
          position: 150,
        },
        status: 'playing',
      };

      client.emit('heartbeat', heartbeatData, (response) => {
        expect(response.success).toBe(true);
        expect(response.nextHeartbeatIn).toBe(15000);
        expect(response.timestamp).toBeDefined();
        expect(response.commands).toBeDefined();
        done();
      });
    });

    it('should update Redis with heartbeat data', async () => {
      const heartbeatData = {
        metrics: {
          cpuUsage: 50.0,
        },
        status: 'active',
      };

      await new Promise<void>((resolve) => {
        client.emit('heartbeat', heartbeatData, (response) => {
          expect(response.success).toBe(true);
          resolve();
        });
      });

      // Wait for Redis update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = await redisService.getDeviceStatus(deviceId);
      expect(status).toBeDefined();
      expect(status.status).toBe('online');
      expect(status.metrics).toBeDefined();
    });

    it('should handle multiple sequential heartbeats', async () => {
      const heartbeatCount = 5;
      const results = [];

      for (let i = 0; i < heartbeatCount; i++) {
        const result = await new Promise((resolve) => {
          client.emit(
            'heartbeat',
            {
              metrics: { cpuUsage: 40 + i },
              status: 'active',
            },
            (response) => resolve(response)
          );
        });
        results.push(result);
      }

      expect(results).toHaveLength(heartbeatCount);
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
      });
    });

    it('should return pending commands with heartbeat response', async () => {
      // Add a command to Redis
      await redisService.addDeviceCommand(deviceId, {
        type: 'restart',
        timestamp: Date.now(),
      });

      const response = await new Promise((resolve) => {
        client.emit('heartbeat', { status: 'active' }, (resp) => resolve(resp));
      });

      expect((response as any).success).toBe(true);
      expect((response as any).commands).toBeDefined();
      expect(Array.isArray((response as any).commands)).toBe(true);
    });
  });

  describe('Content Push Delivery', () => {
    let client: Socket;

    beforeEach((done) => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
      });

      client.on('connect', () => done());
    });

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should receive playlist update push', (done) => {
      const testPlaylist = {
        id: 'playlist-789',
        name: 'Test Playlist',
        items: [
          {
            contentId: 'content-001',
            duration: 30000,
          },
        ],
      };

      client.on('playlist:update', (data) => {
        expect(data.playlist).toBeDefined();
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Simulate push from server
      setTimeout(async () => {
        await deviceGateway.sendPlaylistUpdate(deviceId, testPlaylist);
      }, 100);
    });

    it('should receive command push', (done) => {
      const testCommand = {
        type: 'reload',
        force: true,
      };

      client.on('command', (data) => {
        expect(data.type).toBe('reload');
        expect(data.force).toBe(true);
        expect(data.timestamp).toBeDefined();
        done();
      });

      setTimeout(async () => {
        await deviceGateway.sendCommand(deviceId, testCommand);
      }, 100);
    });

    it('should handle content impression logging', (done) => {
      const impressionData = {
        contentId: 'content-123',
        playlistId: 'playlist-456',
        duration: 30000,
        completed: true,
        timestamp: Date.now(),
      };

      client.emit('content:impression', impressionData, (response) => {
        expect(response.success).toBe(true);
        expect(response.timestamp).toBeDefined();
        done();
      });
    });

    it('should handle content error logging', (done) => {
      const errorData = {
        contentId: 'content-123',
        errorType: 'PlaybackError',
        errorMessage: 'Failed to load video',
        timestamp: Date.now(),
      };

      client.emit('content:error', errorData, (response) => {
        expect(response.success).toBe(true);
        done();
      });
    });

    it('should handle playlist request', (done) => {
      client.emit('playlist:request', {}, (response) => {
        expect(response.success).toBe(true);
        expect(response.playlist).toBeDefined();
        expect(response.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe('Reconnection Handling', () => {
    let client: Socket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should handle disconnect and reconnect', (done) => {
      let disconnected = false;

      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
        reconnection: true,
        reconnectionDelay: 100,
      });

      client.on('connect', () => {
        if (disconnected) {
          expect(client.connected).toBe(true);
          done();
        } else {
          // Force disconnect
          client.disconnect();
        }
      });

      client.on('disconnect', () => {
        disconnected = true;
        // Trigger reconnect
        client.connect();
      });
    });

    it('should update Redis status on disconnect', async () => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
      });

      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
      });

      client.disconnect();

      // Wait for disconnect processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      const status = await redisService.getDeviceStatus(deviceId);
      expect(status).toBeDefined();
      expect(status.status).toBe('offline');
      expect(status.socketId).toBeNull();
    });

    it('should maintain state after reconnection', async () => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
        reconnection: true,
        reconnectionDelay: 100,
      });

      // First connection
      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
      });

      // Send heartbeat
      await new Promise<void>((resolve) => {
        client.emit('heartbeat', { status: 'before-disconnect' }, () => resolve());
      });

      // Disconnect
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Reconnect
      client.connect();
      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
      });

      // Send another heartbeat
      const response = await new Promise((resolve) => {
        client.emit('heartbeat', { status: 'after-reconnect' }, (resp) => resolve(resp));
      });

      expect((response as any).success).toBe(true);
    });
  });

  describe('Multiple Concurrent Connections', () => {
    const clients: Socket[] = [];

    afterEach(() => {
      clients.forEach((client) => {
        if (client && client.connected) {
          client.disconnect();
        }
      });
      clients.length = 0;
    });

    it('should handle multiple devices connecting simultaneously', async () => {
      const deviceCount = 5;
      const tokens = [];

      // Generate tokens for multiple devices
      for (let i = 0; i < deviceCount; i++) {
        const token = jwtService.sign(
          {
            sub: `test-device-${i}`,
            deviceIdentifier: `TEST-DEVICE-${i}`,
            organizationId,
            type: 'device',
          },
          {
            secret: process.env.DEVICE_JWT_SECRET,
            expiresIn: '1h',
          }
        );
        tokens.push(token);
      }

      // Connect all devices
      const connectPromises = tokens.map((token) => {
        return new Promise<Socket>((resolve, reject) => {
          const client = io(serverUrl, {
            transports: ['websocket'],
            auth: { token },
          });

          client.on('connect', () => {
            clients.push(client);
            resolve(client);
          });

          client.on('connect_error', reject);

          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
      });

      const connectedClients = await Promise.all(connectPromises);
      expect(connectedClients).toHaveLength(deviceCount);

      connectedClients.forEach((client) => {
        expect(client.connected).toBe(true);
      });
    });

    it('should handle concurrent heartbeats from multiple devices', async () => {
      const deviceCount = 3;
      const tokens = [];

      for (let i = 0; i < deviceCount; i++) {
        const token = jwtService.sign(
          {
            sub: `test-device-concurrent-${i}`,
            deviceIdentifier: `TEST-DEVICE-CONCURRENT-${i}`,
            organizationId,
            type: 'device',
          },
          {
            secret: process.env.DEVICE_JWT_SECRET,
            expiresIn: '1h',
          }
        );
        tokens.push(token);
      }

      // Connect all devices
      for (const token of tokens) {
        const client = await new Promise<Socket>((resolve) => {
          const c = io(serverUrl, {
            transports: ['websocket'],
            auth: { token },
          });
          c.on('connect', () => resolve(c));
        });
        clients.push(client);
      }

      // Send heartbeats concurrently
      const heartbeatPromises = clients.map((client, index) => {
        return new Promise((resolve) => {
          client.emit(
            'heartbeat',
            {
              metrics: { cpuUsage: 50 + index },
              status: 'active',
            },
            (response) => resolve(response)
          );
        });
      });

      const responses = await Promise.all(heartbeatPromises);

      responses.forEach((response: any) => {
        expect(response.success).toBe(true);
      });
    });

    it('should broadcast to organization correctly', (done) => {
      let receivedCount = 0;
      const expectedCount = 2;

      const token1 = jwtService.sign(
        {
          sub: 'broadcast-device-1',
          deviceIdentifier: 'BROADCAST-DEVICE-1',
          organizationId: 'broadcast-org',
          type: 'device',
        },
        {
          secret: process.env.DEVICE_JWT_SECRET,
          expiresIn: '1h',
        }
      );

      const token2 = jwtService.sign(
        {
          sub: 'broadcast-device-2',
          deviceIdentifier: 'BROADCAST-DEVICE-2',
          organizationId: 'broadcast-org',
          type: 'device',
        },
        {
          secret: process.env.DEVICE_JWT_SECRET,
          expiresIn: '1h',
        }
      );

      const client1 = io(serverUrl, {
        transports: ['websocket'],
        auth: { token: token1 },
      });

      const client2 = io(serverUrl, {
        transports: ['websocket'],
        auth: { token: token2 },
      });

      clients.push(client1, client2);

      const checkDone = () => {
        receivedCount++;
        if (receivedCount === expectedCount) {
          done();
        }
      };

      client1.on('test:broadcast', (data) => {
        expect(data.message).toBe('Hello organization');
        checkDone();
      });

      client2.on('test:broadcast', (data) => {
        expect(data.message).toBe('Hello organization');
        checkDone();
      });

      Promise.all([
        new Promise<void>((resolve) => client1.on('connect', () => resolve())),
        new Promise<void>((resolve) => client2.on('connect', () => resolve())),
      ]).then(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await deviceGateway.broadcastToOrganization('broadcast-org', 'test:broadcast', {
          message: 'Hello organization',
        });
      });
    });
  });

  describe('Error Scenarios', () => {
    let client: Socket;

    afterEach(() => {
      if (client && client.connected) {
        client.disconnect();
      }
    });

    it('should handle malformed heartbeat data gracefully', (done) => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
      });

      client.on('connect', () => {
        client.emit('heartbeat', null, (response) => {
          // Should still respond, even with null data
          expect(response).toBeDefined();
          done();
        });
      });
    });

    it('should handle network interruption', (done) => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
        reconnection: false,
      });

      client.on('connect', () => {
        // Simulate network interruption
        (client as any).io.engine.close();
      });

      client.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });
    });

    it('should handle expired token gracefully', (done) => {
      const expiredToken = jwtService.sign(
        {
          sub: deviceId,
          deviceIdentifier: 'TEST-DEVICE-001',
          organizationId,
          type: 'device',
        },
        {
          secret: process.env.DEVICE_JWT_SECRET,
          expiresIn: '-1h', // Expired 1 hour ago
        }
      );

      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: expiredToken,
        },
      });

      client.on('connect', () => {
        done(new Error('Should not connect with expired token'));
      });

      client.once('disconnect', () => {
        expect(client.connected).toBe(false);
        done();
      });
    });

    it('should limit error storage in Redis', async () => {
      client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: deviceToken,
        },
      });

      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
      });

      // Send 15 errors (more than the 10 limit)
      for (let i = 0; i < 15; i++) {
        await new Promise<void>((resolve) => {
          client.emit(
            'content:error',
            {
              errorType: 'TestError',
              errorMessage: `Error ${i}`,
              timestamp: Date.now(),
            },
            () => resolve()
          );
        });
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check Redis - should only have 10 errors
      const errorsJson = await redisService.get(`errors:device:${deviceId}`);
      const errors = JSON.parse(errorsJson);

      expect(errors.length).toBeLessThanOrEqual(10);
    });
  });
});

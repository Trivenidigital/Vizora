import { AppController } from './app.controller';
import { DeviceGateway } from '../gateways/device.gateway';
import { RedisService } from '../services/redis.service';
import { DatabaseService } from '../database/database.service';

describe('AppController', () => {
  let controller: AppController;
  let mockDeviceGateway: Partial<DeviceGateway>;
  let mockRedisService: Partial<RedisService>;
  let mockDatabaseService: Partial<DatabaseService>;

  // Socket.IO mock helpers
  let mockRooms: Map<string, Set<string>>;
  let mockEmit: jest.Mock;
  let mockTo: jest.Mock;

  beforeEach(() => {
    mockRooms = new Map();
    mockEmit = jest.fn();
    mockTo = jest.fn().mockReturnValue({ emit: mockEmit });

    mockDeviceGateway = {
      server: {
        sockets: {
          adapter: {
            rooms: mockRooms,
          },
        },
        to: mockTo,
      } as any,
      sendPlaylistUpdate: jest.fn(),
      sendCommand: jest.fn(),
    };

    mockRedisService = {
      addDeviceCommand: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
    };

    mockDatabaseService = {
      isHealthy: jest.fn().mockResolvedValue(true),
    };

    controller = new AppController(
      mockDeviceGateway as DeviceGateway,
      mockRedisService as RedisService,
      mockDatabaseService as DatabaseService,
    );
  });

  describe('broadcastCommand', () => {
    const baseCommand = { type: 'clear_override', payload: { reason: 'test' }, commandId: 'cmd-1' };

    it('should emit to each device room and return correct devicesOnline count', async () => {
      // Device A is online (has a room with 1 socket)
      mockRooms.set('device:dev-a', new Set(['socket-1']));
      // Device B is also online
      mockRooms.set('device:dev-b', new Set(['socket-2']));

      const result = await controller.broadcastCommand({
        deviceIds: ['dev-a', 'dev-b'],
        command: baseCommand,
      });

      expect(result.devicesOnline).toBe(2);
      expect(mockTo).toHaveBeenCalledWith('device:dev-a');
      expect(mockTo).toHaveBeenCalledWith('device:dev-b');
      expect(mockEmit).toHaveBeenCalledTimes(2);
      expect(mockEmit).toHaveBeenCalledWith('command', expect.objectContaining({
        type: 'clear_override',
        payload: { reason: 'test' },
        commandId: 'cmd-1',
        timestamp: expect.any(String),
      }));
    });

    it('should queue commands for offline devices via addDeviceCommand', async () => {
      // Device A is online
      mockRooms.set('device:dev-a', new Set(['socket-1']));
      // Device B is offline (no room entry)

      const result = await controller.broadcastCommand({
        deviceIds: ['dev-a', 'dev-b'],
        command: baseCommand,
      });

      expect(result.devicesOnline).toBe(1);
      // Should NOT queue for online device
      expect(mockRedisService.addDeviceCommand).not.toHaveBeenCalledWith(
        'dev-a',
        expect.anything(),
      );
      // Should queue for offline device
      expect(mockRedisService.addDeviceCommand).toHaveBeenCalledWith(
        'dev-b',
        expect.objectContaining({
          type: 'clear_override',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should queue all commands when all devices are offline', async () => {
      const result = await controller.broadcastCommand({
        deviceIds: ['dev-x', 'dev-y'],
        command: { type: 'reload' },
      });

      expect(result.devicesOnline).toBe(0);
      expect(mockRedisService.addDeviceCommand).toHaveBeenCalledTimes(2);
    });

    it('should add a timestamp to the command', async () => {
      await controller.broadcastCommand({
        deviceIds: ['dev-a'],
        command: { type: 'reload' },
      });

      expect(mockEmit).toHaveBeenCalledWith(
        'command',
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });

    it('should handle empty deviceIds array', async () => {
      const result = await controller.broadcastCommand({
        deviceIds: [],
        command: baseCommand,
      });

      expect(result.devicesOnline).toBe(0);
      expect(mockTo).not.toHaveBeenCalled();
      expect(mockRedisService.addDeviceCommand).not.toHaveBeenCalled();
    });
  });

  describe('broadcastCommand guard', () => {
    it('should have InternalApiGuard applied', () => {
      // Verify the guard is configured via decorator metadata
      const guards = Reflect.getMetadata('__guards__', AppController.prototype.broadcastCommand);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });
  });
});

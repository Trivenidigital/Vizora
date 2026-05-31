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

    it('should send each broadcast command through DeviceGateway and return delivery counts', async () => {
      (mockDeviceGateway.sendCommand as jest.Mock).mockResolvedValue({ delivered: true });
      mockRooms.set('device:dev-a', new Set(['socket-1']));
      mockRooms.set('device:dev-b', new Set(['socket-2']));

      const result = await controller.broadcastCommand({
        deviceIds: ['dev-a', 'dev-b'],
        command: baseCommand,
      });

      expect(result).toEqual({
        devicesOnline: 2,
        delivered: 2,
        queued: 0,
        failed: 0,
      });
      expect(mockDeviceGateway.sendCommand).toHaveBeenCalledWith('dev-a', baseCommand);
      expect(mockDeviceGateway.sendCommand).toHaveBeenCalledWith('dev-b', baseCommand);
      expect(mockTo).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should count gateway-queued commands without writing a parallel queue path', async () => {
      (mockDeviceGateway.sendCommand as jest.Mock)
        .mockResolvedValueOnce({ delivered: true })
        .mockResolvedValueOnce({ delivered: false, reason: 'no_sockets' });
      mockRooms.set('device:dev-a', new Set(['socket-1']));

      const result = await controller.broadcastCommand({
        deviceIds: ['dev-a', 'dev-b'],
        command: baseCommand,
      });

      expect(result).toEqual({
        devicesOnline: 1,
        delivered: 1,
        queued: 1,
        failed: 0,
      });
      expect(mockRedisService.addDeviceCommand).not.toHaveBeenCalled();
    });

    it('should count all offline commands as queued by the gateway', async () => {
      (mockDeviceGateway.sendCommand as jest.Mock).mockResolvedValue({ delivered: false, reason: 'no_sockets' });

      const result = await controller.broadcastCommand({
        deviceIds: ['dev-x', 'dev-y'],
        command: { type: 'reload' },
      });

      expect(result).toEqual({
        devicesOnline: 0,
        delivered: 0,
        queued: 2,
        failed: 0,
      });
      expect(mockRedisService.addDeviceCommand).not.toHaveBeenCalled();
    });

    it('should leave timestamping to DeviceGateway', async () => {
      (mockDeviceGateway.sendCommand as jest.Mock).mockResolvedValue({ delivered: true });
      const command = { type: 'reload' };
      mockRooms.set('device:dev-a', new Set(['socket-1']));

      await controller.broadcastCommand({
        deviceIds: ['dev-a'],
        command,
      });

      expect(mockDeviceGateway.sendCommand).toHaveBeenCalledWith('dev-a', command);
    });

    it('should handle empty deviceIds array', async () => {
      const result = await controller.broadcastCommand({
        deviceIds: [],
        command: baseCommand,
      });

      expect(result).toEqual({
        devicesOnline: 0,
        delivered: 0,
        queued: 0,
        failed: 0,
      });
      expect(mockTo).not.toHaveBeenCalled();
      expect(mockRedisService.addDeviceCommand).not.toHaveBeenCalled();
    });

    it('should count unexpected gateway errors as failed deliveries', async () => {
      (mockDeviceGateway.sendCommand as jest.Mock)
        .mockResolvedValueOnce({ delivered: true })
        .mockRejectedValueOnce(new Error('gateway unavailable'));
      mockRooms.set('device:dev-a', new Set(['socket-1']));
      mockRooms.set('device:dev-b', new Set(['socket-2']));

      const result = await controller.broadcastCommand({
        deviceIds: ['dev-a', 'dev-b'],
        command: baseCommand,
      });

      expect(result).toEqual({
        devicesOnline: 2,
        delivered: 1,
        queued: 0,
        failed: 1,
      });
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

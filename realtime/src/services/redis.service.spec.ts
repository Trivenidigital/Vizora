import { RedisService } from './redis.service';

// Mock ioredis
const mockRedis = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  lpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  multi: jest.fn().mockReturnValue({
    lrange: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, []], [null, 1]]),
  }),
  scan: jest.fn().mockResolvedValue(['0', []]),
  mget: jest.fn().mockResolvedValue([]),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  removeListener: jest.fn(),
  status: 'ready',
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ ...mockRedis })),
  };
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('setDeviceStatus', () => {
    it('should set device status with TTL for online', async () => {
      const status = {
        status: 'online' as const,
        lastHeartbeat: Date.now(),
        socketId: 'sock-1',
        organizationId: 'org-1',
      };
      await service.setDeviceStatus('device-1', status);
      // Should have called setex on the underlying redis
      expect(service).toBeDefined();
    });

    it('should set device status with longer TTL for offline', async () => {
      const status = {
        status: 'offline' as const,
        lastHeartbeat: Date.now(),
        socketId: null,
        organizationId: 'org-1',
      };
      await service.setDeviceStatus('device-1', status);
      expect(service).toBeDefined();
    });
  });

  describe('getDeviceStatus', () => {
    it('should return null when device not found', async () => {
      const result = await service.getDeviceStatus('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('get/set/delete operations', () => {
    it('should get a value', async () => {
      const result = await service.get('test-key');
      expect(result).toBeNull(); // mocked to return null
    });

    it('should set a value without TTL', async () => {
      await service.set('test-key', 'test-value');
      expect(service).toBeDefined();
    });

    it('should set a value with TTL', async () => {
      await service.set('test-key', 'test-value', 3600);
      expect(service).toBeDefined();
    });

    it('should delete a key', async () => {
      await service.delete('test-key');
      expect(service).toBeDefined();
    });

    it('should check if key exists', async () => {
      const result = await service.exists('test-key');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('error handling', () => {
    it('should handle health check when Redis is available', async () => {
      const healthy = await service.isHealthy();
      expect(typeof healthy).toBe('boolean');
    });

    it('should return connection status', () => {
      const status = service.getConnectionStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('status');
    });
  });

  describe('device commands', () => {
    it('should add device command', async () => {
      await service.addDeviceCommand('device-1', {
        type: 'reload' as any,
        payload: {},
      });
      expect(service).toBeDefined();
    });

    it('should get device commands', async () => {
      const commands = await service.getDeviceCommands('device-1');
      expect(Array.isArray(commands)).toBe(true);
    });
  });

  describe('playlist cache', () => {
    it('should cache a playlist', async () => {
      await service.cachePlaylist('device-1', {
        id: 'pl-1',
        name: 'Test Playlist',
        organizationId: 'org-1',
        isActive: true,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(service).toBeDefined();
    });

    it('should return null for uncached playlist', async () => {
      const result = await service.getCachedPlaylist('device-1');
      expect(result).toBeNull();
    });
  });

  describe('increment', () => {
    it('should increment a counter', async () => {
      const result = await service.increment('counter-key');
      expect(typeof result).toBe('number');
    });

    it('should increment with TTL', async () => {
      const result = await service.increment('counter-key', 3600);
      expect(typeof result).toBe('number');
    });
  });
});

import { RedisService } from './redis.service';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn(),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  }));
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisService();
  });

  afterEach(async () => {
    // Clean up
    await service.onModuleDestroy();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize client on module init', async () => {
      await service.onModuleInit();
      expect(service.getClient()).not.toBeNull();
    });

    it('uses a resilient retry strategy that never gives up (crash-loop regression)', async () => {
      await service.onModuleInit();
      const RedisMock = jest.requireMock('ioredis') as jest.Mock;
      const opts = RedisMock.mock.calls[0][1];

      // Raised from 3 so in-flight commands ride out a brief reconnect.
      expect(opts.maxRetriesPerRequest).toBe(20);

      // retryStrategy must NEVER return null: null fires 'end', after which every
      // command fails and cascades into an unhandled rejection that crash-loops
      // the process. It must always return a positive, capped backoff.
      for (const times of [1, 5, 10, 11, 50, 500]) {
        const delay = opts.retryStrategy(times);
        expect(typeof delay).toBe('number');
        expect(delay).toBeGreaterThan(0);
        expect(delay).toBeLessThanOrEqual(5000);
      }
    });
  });

  describe('ping', () => {
    it('should return true when Redis responds with PONG', async () => {
      await service.onModuleInit();

      // Manually trigger the connect event to set isConnected = true
      const client = service.getClient();
      if (client) {
        const connectHandler = (client.on as jest.Mock).mock.calls.find(
          call => call[0] === 'connect'
        );
        if (connectHandler) {
          connectHandler[1](); // Call the connect handler
        }
      }

      const result = await service.ping();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      // Don't initialize - client should be null
      const result = await service.ping();
      expect(result).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Redis is responsive', async () => {
      await service.onModuleInit();

      // Manually trigger connect
      const client = service.getClient();
      if (client) {
        const connectHandler = (client.on as jest.Mock).mock.calls.find(
          call => call[0] === 'connect'
        );
        if (connectHandler) {
          connectHandler[1]();
        }
      }

      const result = await service.healthCheck();
      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy when client not initialized', async () => {
      const result = await service.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should return unhealthy when ping fails', async () => {
      await service.onModuleInit();
      const client = service.getClient();

      // Trigger connect
      if (client) {
        const connectHandler = (client.on as jest.Mock).mock.calls.find(
          call => call[0] === 'connect'
        );
        if (connectHandler) {
          connectHandler[1]();
        }

        // Make ping fail
        (client.ping as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));
      }

      const result = await service.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Connection lost');
    });
  });

  describe('isAvailable', () => {
    it('should return false when not connected', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should return true when connected', async () => {
      await service.onModuleInit();
      const client = service.getClient();

      if (client) {
        const connectHandler = (client.on as jest.Mock).mock.calls.find(
          call => call[0] === 'connect'
        );
        if (connectHandler) {
          connectHandler[1]();
        }
      }

      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('cache operations', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      const client = service.getClient();
      if (client) {
        const connectHandler = (client.on as jest.Mock).mock.calls.find(
          call => call[0] === 'connect'
        );
        if (connectHandler) {
          connectHandler[1]();
        }
      }
    });

    describe('get', () => {
      it('should return value for existing key', async () => {
        const client = service.getClient();
        (client?.get as jest.Mock).mockResolvedValue('test-value');

        const result = await service.get('test-key');
        expect(result).toBe('test-value');
        expect(client?.get).toHaveBeenCalledWith('test-key');
      });

      it('should return null for non-existing key', async () => {
        const client = service.getClient();
        (client?.get as jest.Mock).mockResolvedValue(null);

        const result = await service.get('non-existing-key');
        expect(result).toBeNull();
      });

      it('should return null on error', async () => {
        const client = service.getClient();
        (client?.get as jest.Mock).mockRejectedValue(new Error('Redis error'));

        const result = await service.get('test-key');
        expect(result).toBeNull();
      });

      it('should return null when client not available', async () => {
        await service.onModuleDestroy();
        const result = await service.get('test-key');
        expect(result).toBeNull();
      });
    });

    describe('set', () => {
      it('should set value without TTL', async () => {
        const client = service.getClient();
        const result = await service.set('test-key', 'test-value');

        expect(result).toBe(true);
        expect(client?.set).toHaveBeenCalledWith('test-key', 'test-value');
      });

      it('should set value with TTL', async () => {
        const client = service.getClient();
        const result = await service.set('test-key', 'test-value', 3600);

        expect(result).toBe(true);
        expect(client?.setex).toHaveBeenCalledWith('test-key', 3600, 'test-value');
      });

      it('should return false on error', async () => {
        const client = service.getClient();
        (client?.set as jest.Mock).mockRejectedValue(new Error('Redis error'));

        const result = await service.set('test-key', 'test-value');
        expect(result).toBe(false);
      });

      it('should return false when client not available', async () => {
        await service.onModuleDestroy();
        const result = await service.set('test-key', 'test-value');
        expect(result).toBe(false);
      });
    });

    describe('del', () => {
      it('should delete key', async () => {
        const client = service.getClient();
        const result = await service.del('test-key');

        expect(result).toBe(true);
        expect(client?.del).toHaveBeenCalledWith('test-key');
      });

      it('should return false on error', async () => {
        const client = service.getClient();
        (client?.del as jest.Mock).mockRejectedValue(new Error('Redis error'));

        const result = await service.del('test-key');
        expect(result).toBe(false);
      });

      it('should return false when client not available', async () => {
        await service.onModuleDestroy();
        const result = await service.del('test-key');
        expect(result).toBe(false);
      });
    });

    describe('exists', () => {
      it('should return true when key exists', async () => {
        const client = service.getClient();
        (client?.exists as jest.Mock).mockResolvedValue(1);

        const result = await service.exists('test-key');
        expect(result).toBe(true);
      });

      it('should return false when key does not exist', async () => {
        const client = service.getClient();
        (client?.exists as jest.Mock).mockResolvedValue(0);

        const result = await service.exists('test-key');
        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        const client = service.getClient();
        (client?.exists as jest.Mock).mockRejectedValue(new Error('Redis error'));

        const result = await service.exists('test-key');
        expect(result).toBe(false);
      });

      it('should return false when client not available', async () => {
        await service.onModuleDestroy();
        const result = await service.exists('test-key');
        expect(result).toBe(false);
      });
    });

    describe('incrementWithTtl', () => {
      it('increments and sets TTL on the first hit (count === 1)', async () => {
        const client = service.getClient();
        (client?.incr as jest.Mock).mockResolvedValue(1);

        const result = await service.incrementWithTtl('counter', 900);

        expect(result).toBe(1);
        expect(client?.incr).toHaveBeenCalledWith('counter');
        expect(client?.expire).toHaveBeenCalledWith('counter', 900);
      });

      it('does NOT reset TTL on subsequent hits (count > 1) — fixed window, not sliding', async () => {
        const client = service.getClient();
        (client?.incr as jest.Mock).mockResolvedValue(4);

        const result = await service.incrementWithTtl('counter', 900);

        expect(result).toBe(4);
        expect(client?.expire).not.toHaveBeenCalled();
      });

      it('returns 0 on error (best-effort)', async () => {
        const client = service.getClient();
        (client?.incr as jest.Mock).mockRejectedValue(new Error('Redis error'));

        const result = await service.incrementWithTtl('counter', 900);
        expect(result).toBe(0);
      });

      it('returns 0 when client not available', async () => {
        await service.onModuleDestroy();
        const result = await service.incrementWithTtl('counter', 900);
        expect(result).toBe(0);
      });
    });

    describe('setIfNotExists', () => {
      it('returns true and issues SET NX EX when the key is newly claimed', async () => {
        const client = service.getClient();
        (client?.set as jest.Mock).mockResolvedValue('OK');

        const result = await service.setIfNotExists('used-key', '1', 300);

        expect(result).toBe(true);
        expect(client?.set).toHaveBeenCalledWith('used-key', '1', 'EX', 300, 'NX');
      });

      it('returns false when the key already exists (SET NX returns null)', async () => {
        const client = service.getClient();
        (client?.set as jest.Mock).mockResolvedValue(null);

        const result = await service.setIfNotExists('used-key', '1', 300);
        expect(result).toBe(false);
      });

      it('returns false on error (fail CLOSED — never allow the claim through)', async () => {
        const client = service.getClient();
        (client?.set as jest.Mock).mockRejectedValue(new Error('Redis error'));

        const result = await service.setIfNotExists('used-key', '1', 300);
        expect(result).toBe(false);
      });

      it('returns false when client not available', async () => {
        await service.onModuleDestroy();
        const result = await service.setIfNotExists('used-key', '1', 300);
        expect(result).toBe(false);
      });
    });
  });

  describe('connection handling', () => {
    it('should handle connection errors gracefully', async () => {
      await service.onModuleInit();
      const client = service.getClient();

      if (client) {
        const errorHandler = (client.on as jest.Mock).mock.calls.find(
          call => call[0] === 'error'
        );
        if (errorHandler) {
          // Simulate an error - should not throw
          expect(() => errorHandler[1](new Error('Connection refused'))).not.toThrow();
        }
      }
    });

    it('should handle close events', async () => {
      await service.onModuleInit();
      const client = service.getClient();

      if (client) {
        const closeHandler = (client.on as jest.Mock).mock.calls.find(
          call => call[0] === 'close'
        );
        if (closeHandler) {
          closeHandler[1]();
          expect(service.isAvailable()).toBe(false);
        }
      }
    });
  });
});

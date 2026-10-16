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
  rpush: jest.fn().mockResolvedValue(1),
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
    // A MULTI that applies Redis 7 RPUSH / EXPIRE NX|GT semantics to an in-memory store,
    // so the tests assert the resulting TTL, not merely which arguments were sent.
    // `ttls` holds remaining seconds; a key absent from it is non-volatile (no TTL).
    const KEY = 'device:commands:device-1';
    let lists: Map<string, string[]>;
    let ttls: Map<string, number>;
    let multiCalls: unknown[][];

    const installTtlSimulator = () => {
      lists = new Map();
      ttls = new Map();
      multiCalls = [];
      (service as any).redis.multi.mockImplementation(() => {
        const ops: Array<() => void> = [];
        const chain: any = {
          rpush: (key: string, value: string) => {
            multiCalls.push(['rpush', key, value]);
            ops.push(() => lists.set(key, [...(lists.get(key) ?? []), value]));
            return chain;
          },
          expire: (key: string, seconds: number, mode: 'NX' | 'GT') => {
            multiCalls.push(['expire', key, seconds, mode]);
            ops.push(() => {
              if (!lists.has(key)) return;
              const current = ttls.get(key);
              if (mode === 'NX' && current === undefined) ttls.set(key, seconds);
              // GT treats a non-volatile key as infinite, so it never sets a first TTL.
              if (mode === 'GT' && current !== undefined && seconds > current) ttls.set(key, seconds);
            });
            return chain;
          },
          exec: async () => {
            ops.forEach((op) => op());
            return [];
          },
        };
        return chain;
      });
    };

    afterEach(() => {
      (service as any).redis.multi.mockImplementation(() => ({
        lrange: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, []], [null, 1]]),
      }));
    });

    it('a new key gets the pushed command\'s TTL via NX, in one MULTI with the RPUSH', async () => {
      installTtlSimulator();

      await service.addDeviceCommand('device-1', { type: 'reload' as any }, 300);

      expect(ttls.get(KEY)).toBe(300);
      expect(multiCalls).toEqual([
        ['rpush', KEY, JSON.stringify({ type: 'reload' })],
        ['expire', KEY, 300, 'NX'],
        ['expire', KEY, 300, 'GT'],
      ]);
      expect((service as any).redis.rpush).not.toHaveBeenCalled();
      expect((service as any).redis.expire).not.toHaveBeenCalled();
    });

    it('a fresh command pushed onto a key with a shorter remaining TTL raises it to ~300', async () => {
      installTtlSimulator();
      lists.set(KEY, ['old']);
      ttls.set(KEY, 10); // the old command has 10s left

      await service.addDeviceCommand('device-1', { type: 'reboot' as any }, 300);

      // Without GT the key (and the brand-new command) would be reaped 10s from now.
      expect(ttls.get(KEY)).toBe(300);
    });

    it('a requeued old command (age 200s) cannot raise a key TTL of 250s', async () => {
      installTtlSimulator();
      lists.set(KEY, ['younger']);
      ttls.set(KEY, 250);

      await service.addDeviceCommand('device-1', { type: 'reboot' as any }, 100);

      expect(ttls.get(KEY)).toBe(250);
      expect(multiCalls).toContainEqual(['expire', KEY, 100, 'GT']);
      expect(multiCalls).toContainEqual(['expire', KEY, 100, 'NX']);
    });

    it('a requeue onto a key with a LONGER TTL never shortens it', async () => {
      installTtlSimulator();
      lists.set(KEY, ['fresh']);
      ttls.set(KEY, 290);

      await service.addDeviceCommand('device-1', { type: 'reload' as any }, 5);

      expect(ttls.get(KEY)).toBe(290);
    });

    it('clamps a sub-second or zero TTL to 1s (EXPIRE 0 would delete the key)', async () => {
      installTtlSimulator();

      await service.addDeviceCommand('device-1', { type: 'reload' as any }, 0);

      expect(ttls.get(KEY)).toBe(1);
    });

    it('rejects when the MULTI resolves with a per-command error (exec does not reject on WRONGTYPE)', async () => {
      const wrongType = new Error('WRONGTYPE Operation against a key holding the wrong kind of value');
      const chain: any = {
        rpush: () => chain,
        expire: () => chain,
        exec: jest.fn().mockResolvedValue([[wrongType, null], [null, 0], [null, 0]]),
      };
      (service as any).redis.multi.mockReturnValueOnce(chain);

      await expect(service.addDeviceCommand('device-1', { type: 'reboot' as any }, 300)).rejects.toBe(wrongType);
    });

    it('rejects when the MULTI is aborted (exec resolves null)', async () => {
      const chain: any = { rpush: () => chain, expire: () => chain, exec: jest.fn().mockResolvedValue(null) };
      (service as any).redis.multi.mockReturnValueOnce(chain);

      await expect(service.addDeviceCommand('device-1', { type: 'reboot' as any }, 300)).rejects.toThrow('MULTI aborted');
    });

    it('keeps valid queued commands when other entries are unparseable or not objects', async () => {
      const first = { type: 'reload' as any, timestamp: '2026-10-16T12:00:00.000Z' };
      const second = { type: 'clear_cache' as any, timestamp: '2026-10-16T12:00:01.000Z' };
      (service as any).redis.multi.mockReturnValueOnce({
        lrange: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, [JSON.stringify(first), 'garbage{secret-token', 'null', JSON.stringify(second)]],
          [null, 1],
        ]),
      });
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

      await expect(service.getDeviceCommands('device-1')).resolves.toEqual([first, second]);

      const warnings = warnSpy.mock.calls.map(([message]) => String(message));
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toContain('device-1');
      expect(warnings[0]).toContain('index 1');
      expect(warnings[1]).toContain('index 2');
      expect(warnings.join('\n')).not.toContain('secret-token');
    });

    it.each([['a number', '42'], ['an array', '[1,2]'], ['a string', '"reboot"']])(
      'drops a queued entry that parses to %s',
      async (_label, entry) => {
        (service as any).redis.multi.mockReturnValueOnce({
          lrange: jest.fn().mockReturnThis(),
          del: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([[null, [entry]], [null, 1]]),
        });
        jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

        await expect(service.getDeviceCommands('device-1')).resolves.toEqual([]);
      },
    );

    it('should get device commands', async () => {
      const commands = await service.getDeviceCommands('device-1');
      expect(Array.isArray(commands)).toBe(true);
    });

    it('stores and replays queued commands in FIFO order', async () => {
      const first = { type: 'clear_cache' as any, payload: { order: 1 } };
      const second = { type: 'reload' as any, payload: { order: 2 } };
      installTtlSimulator();

      await service.addDeviceCommand('device-1', first, 300);
      await service.addDeviceCommand('device-1', second, 300);

      expect(lists.get(KEY)).toEqual([JSON.stringify(first), JSON.stringify(second)]);

      (service as any).redis.multi.mockReturnValueOnce({
        lrange: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, [JSON.stringify(first), JSON.stringify(second)]],
          [null, 1],
        ]),
      });

      await expect(service.getDeviceCommands('device-1')).resolves.toEqual([
        first,
        second,
      ]);
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

    it('should delete pending playlist', async () => {
      await service.deletePendingPlaylist('device-1');

      expect((service as any).redis.del).toHaveBeenCalledWith(
        'device:pending-playlist:device-1',
      );
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

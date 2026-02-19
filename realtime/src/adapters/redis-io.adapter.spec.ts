import { RedisIoAdapter } from './redis-io.adapter';
import { INestApplication, Logger } from '@nestjs/common';

// Mock ioredis
const mockOn = jest.fn();
const mockDuplicate = jest.fn();

const mockPubClient = {
  on: mockOn,
  duplicate: mockDuplicate,
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      ...mockPubClient,
      duplicate: jest.fn().mockReturnValue({
        on: jest.fn(),
      }),
    })),
  };
});

// Mock @socket.io/redis-adapter
const mockCreateAdapter = jest.fn().mockReturnValue('mock-adapter-constructor');
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: (...args: any[]) => mockCreateAdapter(...args),
}));

// Mock the IoAdapter parent class
const mockSuperCreateIOServer = jest.fn().mockReturnValue({
  adapter: jest.fn(),
});

jest.mock('@nestjs/platform-socket.io', () => ({
  IoAdapter: class MockIoAdapter {
    constructor(protected app: any) {}
    createIOServer(port: number, options?: any) {
      return mockSuperCreateIOServer(port, options);
    }
  },
}));

describe('RedisIoAdapter', () => {
  let adapter: RedisIoAdapter;
  let mockApp: INestApplication;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApp = {} as INestApplication;
    adapter = new RedisIoAdapter(mockApp);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(RedisIoAdapter);
    });
  });

  describe('connectToRedis', () => {
    it('should create pub and sub Redis clients', async () => {
      const Redis = require('ioredis').default;

      await adapter.connectToRedis();

      // Redis constructor should have been called for the pub client
      expect(Redis).toHaveBeenCalled();
    });

    it('should call createAdapter with pub and sub clients', async () => {
      await adapter.connectToRedis();

      expect(mockCreateAdapter).toHaveBeenCalledTimes(1);
      // createAdapter receives two arguments: pubClient and subClient
      expect(mockCreateAdapter).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should register error handlers on both clients', async () => {
      const Redis = require('ioredis').default;

      await adapter.connectToRedis();

      // The pub client should have 'error' handler registered
      const pubInstance = Redis.mock.results[0].value;
      expect(pubInstance.on).toHaveBeenCalledWith('error', expect.any(Function));

      // The sub client (from duplicate) should also have 'error' handler
      const subInstance = pubInstance.duplicate.mock.results[0].value;
      expect(subInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should use REDIS_URL environment variable when set', async () => {
      const originalEnv = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://custom-host:6380';

      const Redis = require('ioredis').default;
      Redis.mockClear();

      await adapter.connectToRedis();

      expect(Redis).toHaveBeenCalledWith('redis://custom-host:6380');

      process.env.REDIS_URL = originalEnv;
    });

    it('should use default redis URL when REDIS_URL is not set', async () => {
      const originalEnv = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      const Redis = require('ioredis').default;
      Redis.mockClear();

      await adapter.connectToRedis();

      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379');

      process.env.REDIS_URL = originalEnv;
    });

    it('should handle error event on pub client without crashing', async () => {
      const Redis = require('ioredis').default;

      await adapter.connectToRedis();

      const pubInstance = Redis.mock.results[0].value;
      const errorHandler = pubInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'error',
      )?.[1];

      expect(errorHandler).toBeDefined();
      // Invoking the error handler should not throw
      expect(() => errorHandler(new Error('connection refused'))).not.toThrow();
    });

    it('should handle error event on sub client without crashing', async () => {
      const Redis = require('ioredis').default;

      await adapter.connectToRedis();

      const pubInstance = Redis.mock.results[0].value;
      const subInstance = pubInstance.duplicate.mock.results[0].value;
      const errorHandler = subInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'error',
      )?.[1];

      expect(errorHandler).toBeDefined();
      expect(() => errorHandler(new Error('connection refused'))).not.toThrow();
    });
  });

  describe('createIOServer', () => {
    it('should create a server using parent class', () => {
      const server = adapter.createIOServer(3002, { cors: { origin: '*' } });

      expect(mockSuperCreateIOServer).toHaveBeenCalledWith(3002, { cors: { origin: '*' } });
      expect(server).toBeDefined();
    });

    it('should not attach adapter if connectToRedis was not called', () => {
      const server = adapter.createIOServer(3002);

      expect(server.adapter).not.toHaveBeenCalled();
    });

    it('should attach Redis adapter after connectToRedis is called', async () => {
      await adapter.connectToRedis();

      const server = adapter.createIOServer(3002);

      expect(server.adapter).toHaveBeenCalledWith('mock-adapter-constructor');
    });

    it('should pass port and options to parent createIOServer', () => {
      const options = { cors: { origin: 'http://localhost:3001' }, pingTimeout: 5000 };

      adapter.createIOServer(3002, options);

      expect(mockSuperCreateIOServer).toHaveBeenCalledWith(3002, options);
    });
  });
});

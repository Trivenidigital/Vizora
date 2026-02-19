// Mock modules before imports
jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

jest.mock('os', () => ({
  hostname: jest.fn().mockReturnValue('test-host'),
  platform: jest.fn().mockReturnValue('linux'),
  arch: jest.fn().mockReturnValue('x64'),
  cpus: jest.fn().mockReturnValue([
    {
      model: 'Test CPU',
      speed: 2400,
      times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 },
    },
    {
      model: 'Test CPU',
      speed: 2400,
      times: { user: 120, nice: 0, sys: 40, idle: 840, irq: 0 },
    },
  ]),
  totalmem: jest.fn().mockReturnValue(8 * 1024 * 1024 * 1024), // 8GB
  freemem: jest.fn().mockReturnValue(4 * 1024 * 1024 * 1024), // 4GB
  type: jest.fn().mockReturnValue('Linux'),
  release: jest.fn().mockReturnValue('5.15.0'),
  networkInterfaces: jest.fn().mockReturnValue({
    eth0: [{ mac: 'aa:bb:cc:dd:ee:ff', address: '192.168.1.100', family: 'IPv4' }],
  }),
}));

jest.mock('http', () => {
  const actualHttp = jest.requireActual('http');
  return {
    ...actualHttp,
    request: jest.fn(),
  };
});

jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: jest.fn().mockReturnValue([]),
  },
  session: {
    defaultSession: {
      clearCache: jest.fn().mockResolvedValue(undefined),
    },
  },
}), { virtual: true });

import { DeviceClient } from './device-client';
import { io } from 'socket.io-client';
import * as http from 'http';
import * as os from 'os';

describe('DeviceClient', () => {
  let client: DeviceClient;
  let mockConfig: any;
  let mockStore: any;

  let mockSocket: any;

  const createMockSocket = () => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockConfig = {
      onPairingRequired: jest.fn(),
      onPaired: jest.fn(),
      onPlaylistUpdate: jest.fn(),
      onCommand: jest.fn(),
      onError: jest.fn(),
    };

    mockStore = {
      get: jest.fn().mockReturnValue(undefined),
      set: jest.fn(),
      delete: jest.fn(),
    };

    mockSocket = createMockSocket();
    (io as jest.Mock).mockReturnValue(mockSocket);

    client = new DeviceClient(
      'http://localhost:3000',
      'http://localhost:3002',
      mockConfig,
      mockStore,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('requestPairingCode', () => {
    it('should send POST request to pairing endpoint', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn(),
      };

      let dataCallback: Function;
      let endCallback: Function;
      mockResponse.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'data') dataCallback = cb;
        if (event === 'end') endCallback = cb;
        return mockResponse;
      });

      const mockReq = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (http.request as jest.Mock).mockImplementation((_url: any, _opts: any, cb: Function) => {
        cb(mockResponse);
        // Simulate async data
        Promise.resolve().then(() => {
          dataCallback(JSON.stringify({ code: 'ABC123', qrCode: 'data:image/png;base64,...' }));
          endCallback();
        });
        return mockReq;
      });

      const result = await client.requestPairingCode();

      expect(result).toEqual({ code: 'ABC123', qrCode: 'data:image/png;base64,...' });
      expect(mockReq.write).toHaveBeenCalled();
      expect(mockReq.end).toHaveBeenCalled();
    });

    it('should reject on HTTP error status', async () => {
      const mockResponse = {
        statusCode: 500,
        on: jest.fn(),
      };

      let dataCallback: Function;
      let endCallback: Function;
      mockResponse.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'data') dataCallback = cb;
        if (event === 'end') endCallback = cb;
        return mockResponse;
      });

      const mockReq = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (http.request as jest.Mock).mockImplementation((_url: any, _opts: any, cb: Function) => {
        cb(mockResponse);
        Promise.resolve().then(() => {
          dataCallback('Internal Server Error');
          endCallback();
        });
        return mockReq;
      });

      await expect(client.requestPairingCode()).rejects.toThrow('HTTP 500');
    });

    it('should reject on network error', async () => {
      const mockReq = {
        on: jest.fn(),
        setTimeout: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      let errorCallback: Function;
      mockReq.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'error') errorCallback = cb;
        return mockReq;
      });

      (http.request as jest.Mock).mockImplementation(() => {
        Promise.resolve().then(() => {
          errorCallback(new Error('ECONNREFUSED'));
        });
        return mockReq;
      });

      await expect(client.requestPairingCode()).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('checkPairingStatus', () => {
    it('should resolve with paired status and connect on success', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn(),
      };

      let dataCallback: Function;
      let endCallback: Function;
      mockResponse.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'data') dataCallback = cb;
        if (event === 'end') endCallback = cb;
        return mockResponse;
      });

      const mockReq = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (http.request as jest.Mock).mockImplementation((_url: any, _opts: any, cb: Function) => {
        cb(mockResponse);
        Promise.resolve().then(() => {
          dataCallback(JSON.stringify({ status: 'paired', deviceToken: 'jwt-token-123' }));
          endCallback();
        });
        return mockReq;
      });

      const result = await client.checkPairingStatus('ABC123');

      expect(result.status).toBe('paired');
      expect(result.deviceToken).toBe('jwt-token-123');
      expect(mockConfig.onPaired).toHaveBeenCalledWith('jwt-token-123');
      expect(io).toHaveBeenCalled();
    });

    it('should resolve with pending when 404', async () => {
      const mockResponse = {
        statusCode: 404,
        on: jest.fn(),
      };

      let endCallback: Function;
      mockResponse.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'data') { /* no data */ }
        if (event === 'end') endCallback = cb;
        return mockResponse;
      });

      const mockReq = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      (http.request as jest.Mock).mockImplementation((_url: any, _opts: any, cb: Function) => {
        cb(mockResponse);
        Promise.resolve().then(() => {
          endCallback();
        });
        return mockReq;
      });

      const result = await client.checkPairingStatus('PENDING');

      expect(result.status).toBe('pending');
    });
  });

  describe('connect', () => {
    it('should create socket.io connection with correct config', () => {
      client.connect('test-jwt-token');

      expect(io).toHaveBeenCalledWith(
        expect.stringContaining('127.0.0.1'),
        expect.objectContaining({
          auth: { token: 'test-jwt-token' },
          transports: ['websocket', 'polling'],
          reconnection: true,
        }),
      );
    });

    it('should register event handlers', () => {
      client.connect('test-token');

      const registeredEvents = mockSocket.on.mock.calls.map((call: any[]) => call[0]);
      expect(registeredEvents).toContain('connect');
      expect(registeredEvents).toContain('disconnect');
      expect(registeredEvents).toContain('connect_error');
      expect(registeredEvents).toContain('playlist:update');
      expect(registeredEvents).toContain('command');
      expect(registeredEvents).toContain('error');
    });

    it('should start heartbeat on connect event', () => {
      client.connect('test-token');

      // Find the connect callback
      const connectCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'connect');
      expect(connectCall).toBeDefined();

      // Trigger connect
      connectCall![1]();

      // Heartbeat should have been emitted immediately
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'heartbeat',
        expect.objectContaining({
          metrics: expect.objectContaining({
            cpuUsage: expect.any(Number),
            memoryUsage: expect.any(Number),
          }),
        }),
        expect.any(Function),
      );
    });

    it('should clear token and re-enter pairing on unauthorized error', () => {
      client.connect('bad-token');

      const errorCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'connect_error');
      expect(errorCall).toBeDefined();

      // Trigger unauthorized error
      errorCall![1]({ message: 'unauthorized' });

      expect(mockStore.delete).toHaveBeenCalledWith('deviceToken');
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(mockConfig.onPairingRequired).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket and clear reference', () => {
      client.connect('test-token');
      client.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should stop heartbeat interval', () => {
      client.connect('test-token');

      // Trigger connect to start heartbeat
      const connectCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'connect');
      connectCall![1]();

      client.disconnect();

      // After disconnect, advancing timers should NOT trigger more heartbeats
      const callCountBefore = mockSocket.emit.mock.calls.filter(
        (call: any[]) => call[0] === 'heartbeat',
      ).length;

      jest.advanceTimersByTime(30000);

      const callCountAfter = mockSocket.emit.mock.calls.filter(
        (call: any[]) => call[0] === 'heartbeat',
      ).length;

      expect(callCountAfter).toBe(callCountBefore);
    });

    it('should be safe to call when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('sendHeartbeat', () => {
    it('should emit heartbeat with metrics', () => {
      client.connect('token');
      client.sendHeartbeat({});

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'heartbeat',
        expect.objectContaining({
          timestamp: expect.any(Number),
          metrics: expect.objectContaining({
            cpuUsage: expect.any(Number),
            memoryUsage: expect.any(Number),
          }),
          status: 'online',
        }),
        expect.any(Function),
      );
    });

    it('should not emit when socket is disconnected', () => {
      client.connect('token');
      mockSocket.connected = false;

      client.sendHeartbeat({});

      // No heartbeat should be emitted (connected = false)
      expect(mockSocket.emit).not.toHaveBeenCalledWith('heartbeat', expect.anything(), expect.anything());
    });

    it('should not throw when socket is null', () => {
      // Don't call connect, so socket is null
      expect(() => client.sendHeartbeat({})).not.toThrow();
    });

    it('should include current content when provided', () => {
      client.connect('token');
      client.sendHeartbeat({ currentContent: { contentId: 'c-1' } });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'heartbeat',
        expect.objectContaining({
          currentContent: { contentId: 'c-1' },
        }),
        expect.any(Function),
      );
    });
  });

  describe('logImpression', () => {
    it('should emit content:impression event', () => {
      client.connect('token');
      client.logImpression({ contentId: 'c-1', duration: 10 });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'content:impression',
        expect.objectContaining({
          contentId: 'c-1',
          duration: 10,
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should not emit when not connected', () => {
      client.logImpression({ contentId: 'c-1' });
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should emit content:error event', () => {
      client.connect('token');
      client.logError({ contentId: 'c-1', errorType: 'load_failed', errorMessage: 'timeout' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'content:error',
        expect.objectContaining({
          contentId: 'c-1',
          errorType: 'load_failed',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should not emit when not connected', () => {
      client.logError({ contentId: 'c-1', errorType: 'unknown' });
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleCommand', () => {
    it('should invoke onCommand callback with the command data', () => {
      client.connect('token');

      const commandCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'command');
      expect(commandCall).toBeDefined();

      // Trigger a command
      commandCall![1]({ type: 'reload' });
      expect(mockConfig.onCommand).toHaveBeenCalledWith({ type: 'reload' });
    });

    it('should handle unknown command types without crashing', () => {
      client.connect('token');

      const commandCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'command');

      // Unknown command should not throw (it just logs a warning)
      commandCall![1]({ type: 'unknown_command' });
      expect(mockConfig.onCommand).toHaveBeenCalledWith({ type: 'unknown_command' });
    });
  });

  describe('getCpuUsage', () => {
    it('should return a number between 0 and 100', () => {
      const cpuUsage = (client as any).getCpuUsage();

      expect(typeof cpuUsage).toBe('number');
      expect(cpuUsage).toBeGreaterThanOrEqual(0);
      expect(cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should use instantaneous calculation on first call', () => {
      // previousCpuTimes is null on first call
      expect((client as any).previousCpuTimes).toBeNull();

      const cpuUsage = (client as any).getCpuUsage();

      // After first call, previousCpuTimes should be populated
      expect((client as any).previousCpuTimes).not.toBeNull();
      expect((client as any).previousCpuTimes).toHaveProperty('idle');
      expect((client as any).previousCpuTimes).toHaveProperty('total');
      expect(typeof cpuUsage).toBe('number');
    });

    it('should use delta calculation on subsequent calls', () => {
      // First call sets the baseline
      (client as any).getCpuUsage();

      // Update os.cpus mock to return different values for second reading
      const osMock = require('os');
      osMock.cpus.mockReturnValueOnce([
        {
          model: 'Test CPU',
          speed: 2400,
          times: { user: 200, nice: 0, sys: 100, idle: 900, irq: 0 },
        },
        {
          model: 'Test CPU',
          speed: 2400,
          times: { user: 220, nice: 0, sys: 80, idle: 900, irq: 0 },
        },
      ]);

      // Second call should use delta between snapshots
      const cpuUsage = (client as any).getCpuUsage();

      expect(typeof cpuUsage).toBe('number');
      expect(cpuUsage).toBeGreaterThanOrEqual(0);
      expect(cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should return 0 when delta time is zero', () => {
      // First call to establish baseline
      (client as any).getCpuUsage();

      // Return identical CPU times (zero delta)
      const osMock = require('os');
      osMock.cpus.mockReturnValueOnce([
        {
          model: 'Test CPU',
          speed: 2400,
          times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 },
        },
        {
          model: 'Test CPU',
          speed: 2400,
          times: { user: 120, nice: 0, sys: 40, idle: 840, irq: 0 },
        },
      ]);

      const cpuUsage = (client as any).getCpuUsage();

      // totalDelta === 0 should return 0
      expect(cpuUsage).toBe(0);
    });

    it('should clamp result to 0 minimum', () => {
      // First call to establish baseline
      (client as any).getCpuUsage();

      // Return values where idle increased more than total (edge case)
      // This forces a negative raw usage value
      const osMock = require('os');

      // Set previous to high-activity state
      (client as any).previousCpuTimes = { idle: 0, total: 1000 };

      // Current reading shows all idle time
      osMock.cpus.mockReturnValueOnce([
        {
          model: 'Test CPU',
          speed: 2400,
          times: { user: 0, nice: 0, sys: 0, idle: 1100, irq: 0 },
        },
      ]);

      const cpuUsage = (client as any).getCpuUsage();

      expect(cpuUsage).toBeGreaterThanOrEqual(0);
    });

    it('should clamp result to 100 maximum', () => {
      // First call to establish baseline
      (client as any).getCpuUsage();

      const osMock = require('os');

      // Set previous snapshot
      (client as any).previousCpuTimes = { idle: 1000, total: 1000 };

      // Current reading: all CPU time, no idle
      osMock.cpus.mockReturnValueOnce([
        {
          model: 'Test CPU',
          speed: 2400,
          times: { user: 1500, nice: 0, sys: 500, idle: 1000, irq: 0 },
        },
      ]);

      const cpuUsage = (client as any).getCpuUsage();

      expect(cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should update previousCpuTimes after each call', () => {
      (client as any).getCpuUsage();
      const firstSnapshot = { ...(client as any).previousCpuTimes };

      const osMock = require('os');
      osMock.cpus.mockReturnValueOnce([
        {
          model: 'Test CPU',
          speed: 2400,
          times: { user: 300, nice: 0, sys: 100, idle: 600, irq: 0 },
        },
      ]);

      (client as any).getCpuUsage();
      const secondSnapshot = (client as any).previousCpuTimes;

      // Snapshots should differ since CPU times changed
      expect(secondSnapshot.total).not.toBe(firstSnapshot.total);
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage percentage', () => {
      const memUsage = (client as any).getMemoryUsage();

      // With 8GB total and 4GB free, usage should be ~50%
      expect(memUsage).toBeCloseTo(50, 0);
    });
  });

  describe('getDeviceIdentifier', () => {
    it('should return a consistent identifier on repeated calls', () => {
      const id1 = (client as any).getDeviceIdentifier();
      const id2 = (client as any).getDeviceIdentifier();

      expect(id1).toBe(id2);
    });

    it('should load persisted identifier from store', () => {
      mockStore.get.mockReturnValue('stored-device-id');
      // Create new client with store that has an ID
      const clientWithStore = new DeviceClient(
        'http://localhost:3000',
        'http://localhost:3002',
        mockConfig,
        mockStore,
      );

      const id = (clientWithStore as any).getDeviceIdentifier();

      expect(id).toBe('stored-device-id');
    });

    it('should persist newly generated identifier to store', () => {
      mockStore.get.mockReturnValue(undefined);
      const freshClient = new DeviceClient(
        'http://localhost:3000',
        'http://localhost:3002',
        mockConfig,
        mockStore,
      );

      const id = (freshClient as any).getDeviceIdentifier();

      expect(mockStore.set).toHaveBeenCalledWith('deviceIdentifier', id);
      expect(id).toContain('aa:bb:cc:dd:ee:ff');
    });
  });
});

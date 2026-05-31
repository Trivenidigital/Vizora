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
  app: {
    relaunch: jest.fn(),
    exit: jest.fn(),
    getPath: jest.fn().mockReturnValue('/tmp/vizora-test'),
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
    connect: jest.fn(),
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

      let requestedUrl = '';
      (http.request as jest.Mock).mockImplementation((url: any, _opts: any, cb: Function) => {
        requestedUrl = url.toString();
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
      expect(requestedUrl).toContain('/api/v1/devices/pairing/request');
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

      let requestedUrl = '';
      (http.request as jest.Mock).mockImplementation((url: any, _opts: any, cb: Function) => {
        requestedUrl = url.toString();
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

      let requestedUrl = '';
      (http.request as jest.Mock).mockImplementation((url: any, _opts: any, cb: Function) => {
        requestedUrl = url.toString();
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
      expect(requestedUrl).toContain('/api/v1/devices/pairing/status/ABC123');
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
          auth: {
            token: 'test-jwt-token',
            capabilities: { deliveryAck: true },
          },
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
      expect(registeredEvents).toContain('token:refresh');
      expect(registeredEvents).toContain('playlist:update');
      expect(registeredEvents).toContain('command');
      expect(registeredEvents).toContain('error');
    });

    it('should acknowledge playlist updates after applying them', async () => {
      client.connect('test-token');

      const playlistCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'playlist:update',
      );
      const ack = jest.fn();
      const playlist = { id: 'playlist-1', name: 'Menu Loop' };

      await playlistCall![1]({ playlist }, ack);

      expect(mockConfig.onPlaylistUpdate).toHaveBeenCalledWith(playlist);
      expect(ack).toHaveBeenCalledWith({ ok: true });
    });

    it('should append the device token to protected playlist media URLs before rendering', async () => {
      client.connect('device-token-123');

      const playlistCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'playlist:update',
      );
      const ack = jest.fn();
      const playlist = {
        id: 'playlist-1',
        items: [
          {
            id: 'item-1',
            content: {
              id: 'content-1',
              url: 'http://localhost:3000/api/v1/device-content/content-1/file?variant=original',
            },
          },
        ],
      };

      await playlistCall![1]({ playlist }, ack);

      expect(mockConfig.onPlaylistUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              content: expect.objectContaining({
                url: 'http://localhost:3000/api/v1/device-content/content-1/file?variant=original&token=device-token-123',
              }),
            }),
          ],
        }),
      );
      expect(playlist.items[0].content.url).toBe(
        'http://localhost:3000/api/v1/device-content/content-1/file?variant=original',
      );
      expect(ack).toHaveBeenCalledWith({ ok: true });
    });

    it('should not append the device token to attacker-origin device-content lookalike URLs', async () => {
      client.connect('device-token-123');

      const playlistCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'playlist:update',
      );
      const ack = jest.fn();
      const playlist = {
        id: 'playlist-1',
        items: [
          {
            id: 'item-1',
            content: {
              id: 'content-1',
              url: 'https://evil.example/api/v1/device-content/content-1/file',
            },
          },
        ],
      };

      await playlistCall![1]({ playlist }, ack);

      expect(mockConfig.onPlaylistUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              content: expect.objectContaining({
                url: 'https://evil.example/api/v1/device-content/content-1/file',
              }),
            }),
          ],
        }),
      );
      expect(ack).toHaveBeenCalledWith({ ok: true });
    });

    it('should normalize protected relative URLs to absolute API URLs before tokenizing', async () => {
      client.connect('device-token-123');

      const playlistCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'playlist:update',
      );
      const ack = jest.fn();

      await playlistCall![1]({
        playlist: {
          id: 'playlist-1',
          items: [
            {
              id: 'item-1',
              content: {
                id: 'content-1',
                url: '/api/v1/device-content/content-1/file',
              },
            },
          ],
        },
      }, ack);

      expect(mockConfig.onPlaylistUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              content: expect.objectContaining({
                url: 'http://localhost:3000/api/v1/device-content/content-1/file?token=device-token-123',
              }),
            }),
          ],
        }),
      );
      expect(ack).toHaveBeenCalledWith({ ok: true });
    });

    it('should consume refreshed device tokens for subsequent protected media URLs', async () => {
      client.connect('old-token');

      const refreshCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'token:refresh',
      );
      refreshCall![1]({ token: 'new-token' });

      const playlistCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'playlist:update',
      );
      await playlistCall![1]({
        playlist: {
          id: 'playlist-1',
          items: [
            {
              id: 'item-1',
              content: {
                id: 'content-1',
                url: 'http://localhost:3000/api/v1/device-content/content-1/file',
              },
            },
          ],
        },
      }, jest.fn());

      expect(mockStore.set).toHaveBeenCalledWith('deviceToken', 'new-token');
      expect(mockConfig.onPlaylistUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              content: expect.objectContaining({
                url: 'http://localhost:3000/api/v1/device-content/content-1/file?token=new-token',
              }),
            }),
          ],
        }),
      );
    });

    it('should update socket auth when a device token is refreshed', () => {
      client.connect('old-token');
      mockSocket.auth = {
        token: 'old-token',
        capabilities: { deliveryAck: true },
      };

      const refreshCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'token:refresh',
      );
      refreshCall![1]({ token: 'new-token' });

      expect(mockSocket.auth).toEqual({
        token: 'new-token',
        capabilities: { deliveryAck: true },
      });
      expect(mockStore.set).toHaveBeenCalledWith('deviceToken', 'new-token');
    });

    it('should negative-ack playlist updates when applying fails', async () => {
      client.connect('test-token');
      mockConfig.onPlaylistUpdate.mockImplementation(() => {
        throw new Error('renderer failed');
      });

      const playlistCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'playlist:update',
      );
      const ack = jest.fn();

      await playlistCall![1]({ playlist: { id: 'playlist-1' } }, ack);

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: 'renderer failed',
      });
    });

    it('should negative-ack playlist updates when renderer acknowledgement rejects', async () => {
      client.connect('test-token');
      mockConfig.onPlaylistUpdate.mockRejectedValue(new Error('renderer timeout'));

      const playlistCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'playlist:update',
      );
      const ack = jest.fn();

      await playlistCall![1]({ playlist: { id: 'playlist-1' } }, ack);

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: 'renderer timeout',
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
      jest.advanceTimersByTime(250);
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should acknowledge renderer-owned commands after applying them', async () => {
      client.connect('test-token');

      const commandCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'command',
      );
      const ack = jest.fn();
      const command = { type: 'unknown_command' };

      await commandCall![1](command, ack);

      expect(mockConfig.onCommand).toHaveBeenCalledWith(command);
      expect(ack).toHaveBeenCalledWith({ ok: true });
    });

    it('should acknowledge restart before exiting so realtime does not requeue it', async () => {
      const electron = require('electron');
      client.connect('test-token');

      const commandCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'command',
      );
      const ack = jest.fn();

      const commandPromise = commandCall![1]({ type: 'restart' }, ack);
      await Promise.resolve();

      expect(ack).toHaveBeenCalledWith({ ok: true });
      expect(electron.app.relaunch).not.toHaveBeenCalled();
      expect(electron.app.exit).not.toHaveBeenCalled();

      jest.advanceTimersByTime(499);
      await Promise.resolve();
      expect(electron.app.exit).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      await commandPromise;

      expect(electron.app.relaunch).toHaveBeenCalled();
      expect(electron.app.exit).toHaveBeenCalledWith(0);
      expect(ack.mock.invocationCallOrder[0]).toBeLessThan(
        electron.app.exit.mock.invocationCallOrder[0],
      );
    });

    it('should restart even when the renderer command path is unavailable', async () => {
      const electron = require('electron');
      mockConfig.onCommand.mockRejectedValue(new Error('renderer hung'));
      client.connect('test-token');

      const commandCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'command',
      );
      const ack = jest.fn();

      const commandPromise = commandCall![1]({ type: 'restart' }, ack);
      await Promise.resolve();

      expect(mockConfig.onCommand).not.toHaveBeenCalled();
      expect(ack).toHaveBeenCalledWith({ ok: true });
      expect(electron.app.exit).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      await commandPromise;

      expect(electron.app.relaunch).toHaveBeenCalled();
      expect(electron.app.exit).toHaveBeenCalledWith(0);
    });

    it('should negative-ack push_content when the command cannot be applied', async () => {
      client.connect('test-token');

      const commandCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'command',
      );
      const ack = jest.fn();

      await commandCall![1]({ type: 'push_content', payload: {} }, ack);

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: 'push_content missing content URL',
      });
    });

    it('should append the device token before loading protected push_content URLs', async () => {
      const electron = require('electron');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      try {
        const mockWindow = {
          webContents: {
            getURL: jest.fn().mockReturnValue('file:///display/index.html'),
          },
          loadURL: jest.fn().mockResolvedValue(undefined),
        };
        electron.BrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
        client.connect('device-token-123');

        const commandCall = mockSocket.on.mock.calls.find(
          (call: any[]) => call[0] === 'command',
        );
        const ack = jest.fn();

        await commandCall![1]({
          type: 'push_content',
          payload: {
            content: {
              id: 'content-1',
              url: 'http://localhost:3000/api/v1/device-content/content-1/file',
            },
            duration: 1,
          },
        }, ack);

        expect(mockWindow.loadURL).toHaveBeenCalledWith(
          'http://localhost:3000/api/v1/device-content/content-1/file?token=device-token-123',
        );
        expect(logSpy.mock.calls.flat().join(' ')).not.toContain('device-token-123');
        expect(ack).toHaveBeenCalledWith({ ok: true });
      } finally {
        logSpy.mockRestore();
      }
    });

    it('should clear overrides in the main process even when the renderer command path is unavailable', async () => {
      const electron = require('electron');
      const mockWindow = {
        webContents: {
          getURL: jest.fn().mockReturnValue('file:///display/index.html'),
        },
        loadURL: jest.fn().mockResolvedValue(undefined),
      };
      electron.BrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
      mockConfig.onCommand.mockRejectedValue(new Error('renderer unavailable'));
      client.connect('device-token-123');

      const commandCall = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'command',
      );

      await commandCall![1]({
        type: 'push_content',
        payload: {
          content: {
            id: 'content-1',
            url: 'http://localhost:3000/api/v1/device-content/content-1/file',
          },
          duration: 1,
        },
      }, jest.fn());
      mockWindow.loadURL.mockClear();

      const ack = jest.fn();
      await commandCall![1]({ type: 'clear_override' }, ack);

      expect(mockConfig.onCommand).not.toHaveBeenCalled();
      expect(mockWindow.loadURL).toHaveBeenCalledWith('file:///display/index.html');
      expect(ack).toHaveBeenCalledWith({ ok: true });
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
    it('should invoke onCommand callback with the command data', async () => {
      client.connect('token');

      const commandCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'command');
      expect(commandCall).toBeDefined();

      // Trigger a command
      await commandCall![1]({ type: 'unknown_command' });
      expect(mockConfig.onCommand).toHaveBeenCalledWith({ type: 'unknown_command' });
    });

    it('should handle unknown command types without crashing', async () => {
      client.connect('token');

      const commandCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'command');

      // Unknown command should not throw (it just logs a warning)
      await commandCall![1]({ type: 'unknown_command' });
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

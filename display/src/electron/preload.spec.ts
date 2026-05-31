// Mock electron before imports
const mockInvoke = jest.fn().mockResolvedValue({});
const mockOn = jest.fn().mockReturnValue(undefined);
const mockSend = jest.fn();
const mockRemoveListener = jest.fn();
let exposedApi: Record<string, Function> = {};

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn().mockImplementation((apiKey: string, api: any) => {
      exposedApi = api;
    }),
  },
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
    send: mockSend,
    removeListener: mockRemoveListener,
  },
}), { virtual: true });

import { contextBridge, ipcRenderer } from 'electron';

describe('preload.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exposedApi = {};

    // Re-require preload to trigger exposeInMainWorld
    jest.isolateModules(() => {
      require('./preload');
    });
  });

  describe('contextBridge.exposeInMainWorld', () => {
    it('should expose electronAPI to the main world', () => {
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'electronAPI',
        expect.any(Object),
      );
    });

    it('should expose the correct API surface', () => {
      const expectedMethods = [
        'getPairingCode',
        'checkPairingStatus',
        'sendHeartbeat',
        'logImpression',
        'logError',
        'getDeviceInfo',
        'quitApp',
        'toggleFullscreen',
        'cacheDownload',
        'cacheGet',
        'cacheStats',
        'cacheClear',
        'onPairingRequired',
        'onPaired',
        'onPlaylistUpdate',
        'onCommand',
        'onError',
        'removeListener',
      ];

      for (const method of expectedMethods) {
        expect(exposedApi[method]).toBeDefined();
        expect(typeof exposedApi[method]).toBe('function');
      }
    });
  });

  describe('Pairing methods', () => {
    it('getPairingCode should invoke get-pairing-code', () => {
      exposedApi.getPairingCode();
      expect(mockInvoke).toHaveBeenCalledWith('get-pairing-code');
    });

    it('checkPairingStatus should invoke check-pairing-status with code', () => {
      exposedApi.checkPairingStatus('ABC123');
      expect(mockInvoke).toHaveBeenCalledWith('check-pairing-status', 'ABC123');
    });
  });

  describe('Device communication methods', () => {
    it('sendHeartbeat should invoke send-heartbeat with data', () => {
      const data = { currentContent: { contentId: 'c-1' } };
      exposedApi.sendHeartbeat(data);
      expect(mockInvoke).toHaveBeenCalledWith('send-heartbeat', data);
    });

    it('logImpression should invoke log-impression with data', () => {
      const data = { contentId: 'c-1', duration: 10 };
      exposedApi.logImpression(data);
      expect(mockInvoke).toHaveBeenCalledWith('log-impression', data);
    });

    it('logError should invoke log-error with data', () => {
      const data = { contentId: 'c-1', errorType: 'load_failed' };
      exposedApi.logError(data);
      expect(mockInvoke).toHaveBeenCalledWith('log-error', data);
    });
  });

  describe('Device info method', () => {
    it('getDeviceInfo should invoke get-device-info', () => {
      exposedApi.getDeviceInfo();
      expect(mockInvoke).toHaveBeenCalledWith('get-device-info');
    });
  });

  describe('App control methods', () => {
    it('quitApp should invoke quit-app', () => {
      exposedApi.quitApp();
      expect(mockInvoke).toHaveBeenCalledWith('quit-app');
    });

    it('toggleFullscreen should invoke toggle-fullscreen', () => {
      exposedApi.toggleFullscreen();
      expect(mockInvoke).toHaveBeenCalledWith('toggle-fullscreen');
    });
  });

  describe('Cache management methods', () => {
    it('cacheDownload should invoke cache:download with id, url, mimeType', () => {
      exposedApi.cacheDownload('c-1', 'http://example.com/img.jpg', 'image/jpeg');
      expect(mockInvoke).toHaveBeenCalledWith('cache:download', 'c-1', 'http://example.com/img.jpg', 'image/jpeg');
    });

    it('cacheGet should invoke cache:get with id', () => {
      exposedApi.cacheGet('c-1');
      expect(mockInvoke).toHaveBeenCalledWith('cache:get', 'c-1');
    });

    it('cacheStats should invoke cache:stats', () => {
      exposedApi.cacheStats();
      expect(mockInvoke).toHaveBeenCalledWith('cache:stats');
    });

    it('cacheClear should invoke cache:clear', () => {
      exposedApi.cacheClear();
      expect(mockInvoke).toHaveBeenCalledWith('cache:clear');
    });
  });

  describe('Event listener methods', () => {
    it('onPairingRequired should register listener on pairing-required channel', () => {
      const callback = jest.fn();
      exposedApi.onPairingRequired(callback);
      expect(mockOn).toHaveBeenCalledWith('pairing-required', callback);
    });

    it('onPaired should register listener on paired channel', () => {
      const callback = jest.fn();
      exposedApi.onPaired(callback);
      expect(mockOn).toHaveBeenCalledWith('paired', callback);
    });

    it('onPlaylistUpdate should register listener on playlist-update channel', () => {
      const callback = jest.fn();
      exposedApi.onPlaylistUpdate(callback);
      expect(mockOn).toHaveBeenCalledWith('playlist-update', expect.any(Function));
    });

    it('onPlaylistUpdate should unwrap playlist payload and acknowledge application', () => {
      const callback = jest.fn((_event, _playlist, ack) => ack({ ok: true }));
      exposedApi.onPlaylistUpdate(callback);

      const listener = mockOn.mock.calls.find((call) => call[0] === 'playlist-update')?.[1];
      listener({}, {
        requestId: 'request-1',
        playlist: { id: 'playlist-1' },
      });

      expect(callback).toHaveBeenCalledWith(
        {},
        { id: 'playlist-1' },
        expect.any(Function),
      );
      expect(mockSend).toHaveBeenCalledWith('playlist-update-applied', {
        requestId: 'request-1',
        ok: true,
      });
    });

    it('onCommand should register listener on command channel', () => {
      const callback = jest.fn();
      exposedApi.onCommand(callback);
      expect(mockOn).toHaveBeenCalledWith('command', expect.any(Function));
    });

    it('onCommand should unwrap command payload and acknowledge application', () => {
      const callback = jest.fn((_event, _command, ack) => ack({ ok: false, error: 'failed' }));
      exposedApi.onCommand(callback);

      const listener = mockOn.mock.calls.find((call) => call[0] === 'command')?.[1];
      listener({}, {
        requestId: 'command-1',
        command: { type: 'reload' },
      });

      expect(callback).toHaveBeenCalledWith(
        {},
        { type: 'reload' },
        expect.any(Function),
      );
      expect(mockSend).toHaveBeenCalledWith('command-applied', {
        requestId: 'command-1',
        ok: false,
        error: 'failed',
      });
    });

    it('onError should register listener on error channel', () => {
      const callback = jest.fn();
      exposedApi.onError(callback);
      expect(mockOn).toHaveBeenCalledWith('error', callback);
    });
  });

  describe('removeListener method', () => {
    it('should remove listener from specified channel', () => {
      const callback = jest.fn();
      exposedApi.removeListener('paired', callback);
      expect(mockRemoveListener).toHaveBeenCalledWith('paired', callback);
    });
  });
});

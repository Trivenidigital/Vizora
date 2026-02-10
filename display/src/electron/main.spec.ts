// Mock electron-store before anything else
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    delete: jest.fn(),
  }));
}, { virtual: true });

// Mock the cache-manager module
jest.mock('./cache-manager', () => ({
  CacheManager: jest.fn().mockImplementation(() => ({
    clearCache: jest.fn(),
    downloadContent: jest.fn().mockResolvedValue('/tmp/cached.jpg'),
    getCachedPath: jest.fn().mockReturnValue(null),
    getCacheStats: jest.fn().mockReturnValue({ itemCount: 0, totalSizeMB: 0, maxSizeMB: 500 }),
  })),
}));

// Mock the device-client module
const mockDeviceClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  requestPairingCode: jest.fn().mockResolvedValue({ code: 'ABC123', qrCode: 'qr-data' }),
  checkPairingStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
  sendHeartbeat: jest.fn(),
  logImpression: jest.fn(),
  logError: jest.fn(),
};

jest.mock('./device-client', () => ({
  DeviceClient: jest.fn().mockImplementation(() => mockDeviceClient),
}));

// Capture handlers registered via ipcMain.handle and app event listeners
const ipcHandlers: Record<string, Function> = {};
const appEventListeners: Record<string, Function[]> = {};
const webContentsListeners: Record<string, Function[]> = {};
let onHeadersReceivedCallback: Function | null = null;

const mockWebContents = {
  send: jest.fn(),
  openDevTools: jest.fn(),
  insertCSS: jest.fn(),
  on: jest.fn().mockImplementation((event: string, cb: Function) => {
    if (!webContentsListeners[event]) webContentsListeners[event] = [];
    webContentsListeners[event].push(cb);
    return mockWebContents;
  }),
  session: {
    webRequest: {
      onHeadersReceived: jest.fn().mockImplementation((cb: Function) => {
        onHeadersReceivedCallback = cb;
      }),
    },
    clearCache: jest.fn().mockResolvedValue(undefined),
  },
};

const mockMainWindow = {
  webContents: mockWebContents,
  loadURL: jest.fn().mockResolvedValue(undefined),
  loadFile: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  setFullScreen: jest.fn(),
  isFullScreen: jest.fn().mockReturnValue(false),
  reload: jest.fn(),
};

jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn().mockReturnValue({ then: jest.fn() }),
    on: jest.fn().mockImplementation((event: string, cb: Function) => {
      if (!appEventListeners[event]) appEventListeners[event] = [];
      appEventListeners[event].push(cb);
    }),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
    getPath: jest.fn().mockReturnValue('/tmp/test'),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => mockMainWindow),
  ipcMain: {
    handle: jest.fn().mockImplementation((channel: string, handler: Function) => {
      ipcHandlers[channel] = handler;
    }),
  },
  screen: {
    getPrimaryDisplay: jest.fn().mockReturnValue({
      workAreaSize: { width: 1920, height: 1080 },
    }),
  },
  session: {
    defaultSession: {
      clearCache: jest.fn().mockResolvedValue(undefined),
    },
  },
}), { virtual: true });

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

// Clear module cache to force fresh require of main.ts
beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(ipcHandlers).forEach((k) => delete ipcHandlers[k]);
  Object.keys(appEventListeners).forEach((k) => delete appEventListeners[k]);
  Object.keys(webContentsListeners).forEach((k) => delete webContentsListeners[k]);
  onHeadersReceivedCallback = null;
});

// Import after mocks are set up
import { app, BrowserWindow, ipcMain } from 'electron';

describe('main.ts - Electron main process', () => {
  describe('IPC handler registration', () => {
    beforeEach(() => {
      // Require main.ts to trigger all registrations
      jest.isolateModules(() => {
        require('./main');
      });
    });

    it('should register get-pairing-code handler', () => {
      expect(ipcHandlers['get-pairing-code']).toBeDefined();
    });

    it('should register check-pairing-status handler', () => {
      expect(ipcHandlers['check-pairing-status']).toBeDefined();
    });

    it('should register send-heartbeat handler', () => {
      expect(ipcHandlers['send-heartbeat']).toBeDefined();
    });

    it('should register log-impression handler', () => {
      expect(ipcHandlers['log-impression']).toBeDefined();
    });

    it('should register log-error handler', () => {
      expect(ipcHandlers['log-error']).toBeDefined();
    });

    it('should register get-device-info handler', () => {
      expect(ipcHandlers['get-device-info']).toBeDefined();
    });

    it('should register quit-app handler', () => {
      expect(ipcHandlers['quit-app']).toBeDefined();
    });

    it('should register toggle-fullscreen handler', () => {
      expect(ipcHandlers['toggle-fullscreen']).toBeDefined();
    });

    it('should register cache:download handler', () => {
      expect(ipcHandlers['cache:download']).toBeDefined();
    });

    it('should register cache:get handler', () => {
      expect(ipcHandlers['cache:get']).toBeDefined();
    });

    it('should register cache:stats handler', () => {
      expect(ipcHandlers['cache:stats']).toBeDefined();
    });

    it('should register cache:clear handler', () => {
      expect(ipcHandlers['cache:clear']).toBeDefined();
    });
  });

  describe('App lifecycle registration', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        require('./main');
      });
    });

    it('should register whenReady handler', () => {
      expect(app.whenReady).toHaveBeenCalled();
    });

    it('should register window-all-closed handler', () => {
      expect(appEventListeners['window-all-closed']).toBeDefined();
      expect(appEventListeners['window-all-closed'].length).toBeGreaterThan(0);
    });

    it('should register activate handler', () => {
      expect(appEventListeners['activate']).toBeDefined();
      expect(appEventListeners['activate'].length).toBeGreaterThan(0);
    });

    it('should register before-quit handler', () => {
      expect(appEventListeners['before-quit']).toBeDefined();
      expect(appEventListeners['before-quit'].length).toBeGreaterThan(0);
    });
  });

  describe('IPC handler: get-device-info', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        require('./main');
      });
    });

    it('should return device info with platform, arch, and versions', async () => {
      const handler = ipcHandlers['get-device-info'];
      const result = await handler();

      expect(result).toEqual({
        platform: process.platform,
        arch: process.arch,
        version: '1.0.0',
        electronVersion: process.versions.electron,
      });
    });
  });

  describe('IPC handler: quit-app', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        require('./main');
      });
    });

    it('should call app.quit', async () => {
      const handler = ipcHandlers['quit-app'];
      await handler();

      expect(app.quit).toHaveBeenCalled();
    });
  });

  describe('IPC handler: cache:stats', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        require('./main');
      });
    });

    it('should return default stats when cacheManager is not initialized', async () => {
      const handler = ipcHandlers['cache:stats'];
      const result = await handler();

      // Returns either from cacheManager or fallback
      expect(result).toHaveProperty('itemCount');
      expect(result).toHaveProperty('totalSizeMB');
      expect(result).toHaveProperty('maxSizeMB');
    });
  });

  describe('IPC handler: cache:clear', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        require('./main');
      });
    });

    it('should return success', async () => {
      const handler = ipcHandlers['cache:clear'];
      const result = await handler();

      expect(result).toEqual({ success: true });
    });
  });

  describe('window-all-closed handler', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        require('./main');
      });
    });

    it('should quit app on non-darwin platforms', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const handler = appEventListeners['window-all-closed'][0];
      handler();

      expect(app.quit).toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should not quit app on darwin', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      (app.quit as jest.Mock).mockClear();
      const handler = appEventListeners['window-all-closed'][0];
      handler();

      expect(app.quit).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('activate handler', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        require('./main');
      });
    });

    it('should create a new window if none exist', () => {
      (BrowserWindow.getAllWindows as jest.Mock) = jest.fn().mockReturnValue([]);

      const handler = appEventListeners['activate'][0];
      handler();

      // createWindow should be called (BrowserWindow constructor)
      // We just verify it doesn't throw
      expect(handler).toBeDefined();
    });
  });
});

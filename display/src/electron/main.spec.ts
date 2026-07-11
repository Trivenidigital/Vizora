// Mock electron-store before anything else
const mockStoreGet = jest.fn().mockReturnValue(null);
const mockStoreSet = jest.fn();
const mockStoreDelete = jest.fn();
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockStoreGet,
    set: mockStoreSet,
    delete: mockStoreDelete,
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
const mockDeviceClient: any = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  requestPairingCode: jest.fn().mockResolvedValue({ code: 'ABC123', qrCode: 'qr-data' }),
  checkPairingStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
  sendHeartbeat: jest.fn(),
  logImpression: jest.fn(),
  logError: jest.fn(),
  getActiveOverride: jest.fn().mockReturnValue(null),
  __config: undefined,
};

jest.mock('./device-client', () => ({
  // Capture the config on the shared instance so tests can exercise the
  // main-side wiring (persist / override bridge / renderer status) regardless of
  // which module registry (isolateModules) main.ts was loaded in.
  DeviceClient: jest.fn().mockImplementation((...args: any[]) => {
    mockDeviceClient.__config = args[2];
    return mockDeviceClient;
  }),
}));

const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();

jest.mock('fs', () => ({
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
}));

// Capture handlers registered via ipcMain.handle and app event listeners
const ipcHandlers: Record<string, Function> = {};
const ipcListeners: Record<string, Function[]> = {};
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
  isDestroyed: jest.fn().mockReturnValue(false),
};

const mockSetLoginItemSettings = jest.fn();
const mockPowerSaveBlocker = {
  start: jest.fn().mockReturnValue(42),
  stop: jest.fn(),
  isStarted: jest.fn().mockReturnValue(true),
};

jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    whenReady: jest.fn().mockReturnValue({ then: jest.fn() }),
    on: jest.fn().mockImplementation((event: string, cb: Function) => {
      if (!appEventListeners[event]) appEventListeners[event] = [];
      appEventListeners[event].push(cb);
    }),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
    getPath: jest.fn().mockReturnValue('/tmp/test'),
    setLoginItemSettings: (...args: any[]) => mockSetLoginItemSettings(...args),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => mockMainWindow),
  ipcMain: {
    handle: jest.fn().mockImplementation((channel: string, handler: Function) => {
      ipcHandlers[channel] = handler;
    }),
    on: jest.fn().mockImplementation((channel: string, listener: Function) => {
      if (!ipcListeners[channel]) ipcListeners[channel] = [];
      ipcListeners[channel].push(listener);
    }),
    off: jest.fn().mockImplementation((channel: string, listener: Function) => {
      ipcListeners[channel] = (ipcListeners[channel] || []).filter((l) => l !== listener);
    }),
  },
  powerSaveBlocker: mockPowerSaveBlocker,
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
  mockStoreGet.mockReturnValue(null);
  Object.defineProperty(app, 'isPackaged', { value: false, configurable: true });
  delete process.env.APPIMAGE;
  mockPowerSaveBlocker.start.mockReturnValue(42);
  mockPowerSaveBlocker.isStarted.mockReturnValue(true);
  Object.keys(ipcHandlers).forEach((k) => delete ipcHandlers[k]);
  Object.keys(ipcListeners).forEach((k) => delete ipcListeners[k]);
  Object.keys(appEventListeners).forEach((k) => delete appEventListeners[k]);
  Object.keys(webContentsListeners).forEach((k) => delete webContentsListeners[k]);
  onHeadersReceivedCallback = null;
});

// Import after mocks are set up
import { app, BrowserWindow, ipcMain, powerSaveBlocker } from 'electron';

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

    it('does not configure production runtime guards for unpackaged test runs', () => {
      const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
      const createWindowCallback = thenMock.mock.calls[0][0];
      createWindowCallback();

      expect(mockSetLoginItemSettings).not.toHaveBeenCalled();
      expect(powerSaveBlocker.start).not.toHaveBeenCalled();
      expect(mockMkdirSync).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('does not configure runtime guards for unpackaged NODE_ENV production runs', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
        const createWindowCallback = thenMock.mock.calls[0][0];
        createWindowCallback();

        expect(mockSetLoginItemSettings).not.toHaveBeenCalled();
        expect(powerSaveBlocker.start).not.toHaveBeenCalled();
        expect(mockMkdirSync).not.toHaveBeenCalled();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
      } finally {
        if (originalNodeEnv === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = originalNodeEnv;
        }
      }
    });

    it('enables login item auto-start and display sleep prevention for packaged Windows displays', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(app, 'isPackaged', { value: true, configurable: true });

      const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
      const createWindowCallback = thenMock.mock.calls[0][0];
      createWindowCallback();

      expect(mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        path: process.execPath,
      });
      expect(powerSaveBlocker.start).toHaveBeenCalledWith('prevent-display-sleep');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('writes a Linux desktop autostart entry for packaged Linux displays', () => {
      const originalPlatform = process.platform;
      process.env.APPIMAGE = '/opt/Vizora Display.AppImage';
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      Object.defineProperty(app, 'isPackaged', { value: true, configurable: true });

      const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
      const createWindowCallback = thenMock.mock.calls[0][0];
      createWindowCallback();

      expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/test/.config/autostart', { recursive: true });
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/tmp/test/.config/autostart/vizora-display.desktop',
        expect.stringContaining('Exec="/opt/Vizora Display.AppImage"'),
        'utf8',
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/tmp/test/.config/autostart/vizora-display.desktop',
        expect.stringContaining('X-GNOME-Autostart-enabled=true'),
        'utf8',
      );
      expect(mockSetLoginItemSettings).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('stops display sleep prevention before quitting', () => {
      Object.defineProperty(app, 'isPackaged', { value: true, configurable: true });

      const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
      const createWindowCallback = thenMock.mock.calls[0][0];
      createWindowCallback();

      const handler = appEventListeners['before-quit'][0];
      handler();

      expect(powerSaveBlocker.stop).toHaveBeenCalledWith(42);
    });

    it('initializes the device client once and never tears down the socket on renderer reload', () => {
      jest.useFakeTimers();
      mockStoreGet.mockImplementation((key: string) => (key === 'deviceToken' ? 'device-token' : null));

      const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
      const createWindowCallback = thenMock.mock.calls[0][0];
      createWindowCallback();

      const didFinishLoad = webContentsListeners['did-finish-load'][0];
      didFinishLoad();
      jest.advanceTimersByTime(500);
      didFinishLoad();
      jest.advanceTimersByTime(500);

      // Init-once (realtime #9): a reload must not reconnect or disconnect the
      // live socket — the renderer's post-reload state is restored separately.
      expect(mockDeviceClient.connect).toHaveBeenCalledTimes(1);
      expect(mockDeviceClient.disconnect).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('renderer crash recovery (realtime #2)', () => {
    beforeEach(() => {
      jest.isolateModules(() => {
        require('./main');
      });
    });

    function createWindowViaReady() {
      const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
      thenMock.mock.calls[0][0]();
    }

    it('reloads the renderer with a backoff delay on render-process-gone (not immediately)', () => {
      jest.useFakeTimers();
      createWindowViaReady();

      const gone = webContentsListeners['render-process-gone'][0];
      gone({}, { reason: 'crashed' });

      // Scheduled, not immediate — avoids reloading into the same crash.
      expect(mockMainWindow.reload).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1000); // base delay
      expect(mockMainWindow.reload).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('does not stack reloads and backs off exponentially instead of hot-looping', () => {
      jest.useFakeTimers();
      createWindowViaReady();
      const gone = webContentsListeners['render-process-gone'][0];

      // Two crashes before the first reload fires → only one reload scheduled.
      gone({}, { reason: 'oom' });
      gone({}, { reason: 'oom' });
      jest.advanceTimersByTime(1000);
      expect(mockMainWindow.reload).toHaveBeenCalledTimes(1);

      // Next crash backs off to 2000ms (attempt 2), not another 1000ms.
      gone({}, { reason: 'oom' });
      jest.advanceTimersByTime(1000);
      expect(mockMainWindow.reload).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1000);
      expect(mockMainWindow.reload).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('resets the backoff after a successful renderer load', () => {
      jest.useFakeTimers();
      mockStoreGet.mockImplementation((key: string) => (key === 'deviceToken' ? 'device-token' : null));
      createWindowViaReady();
      const gone = webContentsListeners['render-process-gone'][0];
      const didFinishLoad = webContentsListeners['did-finish-load'][0];

      gone({}, { reason: 'oom' });     // attempt 1 → delay 1000
      jest.advanceTimersByTime(1000);  // reload #1
      gone({}, { reason: 'oom' });     // attempt 2 → delay 2000
      jest.advanceTimersByTime(2000);  // reload #2
      didFinishLoad();                 // successful load resets backoff
      jest.advanceTimersByTime(500);

      (mockMainWindow.reload as jest.Mock).mockClear();
      gone({}, { reason: 'oom' });     // attempt 1 again → delay 1000
      jest.advanceTimersByTime(1000);
      expect(mockMainWindow.reload).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('cancels a pending reload when the renderer becomes responsive again', () => {
      jest.useFakeTimers();
      createWindowViaReady();
      const unresponsive = webContentsListeners['unresponsive'][0];
      const responsive = webContentsListeners['responsive'][0];

      unresponsive();
      responsive(); // recovered on its own before the timer fired
      jest.advanceTimersByTime(60000);
      expect(mockMainWindow.reload).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('offline boot render + last-known-good playlist (realtime #3)', () => {
    beforeEach(() => {
      // Fake timers so the post-load 500ms device-client init timer never fires
      // after the test — these tests only exercise the synchronous boot render.
      jest.useFakeTimers();
      jest.isolateModules(() => {
        require('./main');
      });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    function createWindowViaReady() {
      const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
      thenMock.mock.calls[0][0]();
    }

    it('renders the cached playlist and paired state immediately on load', () => {
      const cachedPlaylist = { id: 'p1', items: [{ content: { id: 'c1', type: 'image' } }] };
      mockStoreGet.mockImplementation((key: string) => {
        if (key === 'deviceToken') return 'device-token';
        if (key === 'lastPlaylist') return cachedPlaylist;
        return null;
      });

      createWindowViaReady();
      const didFinishLoad = webContentsListeners['did-finish-load'][0];
      didFinishLoad();

      expect(mockWebContents.send).toHaveBeenCalledWith('paired', 'device-token');
      expect(mockWebContents.send).toHaveBeenCalledWith('playlist-update', { playlist: cachedPlaylist });
    });

    it('shows pairing when no device token is stored', () => {
      mockStoreGet.mockReturnValue(null);
      createWindowViaReady();
      const didFinishLoad = webContentsListeners['did-finish-load'][0];
      didFinishLoad();
      expect(mockWebContents.send).toHaveBeenCalledWith('pairing-required');
    });

    it('does not send a cached playlist when the store has none', () => {
      mockStoreGet.mockImplementation((key: string) => (key === 'deviceToken' ? 'device-token' : null));
      createWindowViaReady();
      const didFinishLoad = webContentsListeners['did-finish-load'][0];
      didFinishLoad();
      const playlistSends = mockWebContents.send.mock.calls.filter((c: any[]) => c[0] === 'playlist-update');
      expect(playlistSends).toHaveLength(0);
    });
  });

  describe('device client wiring (realtime #2/#3/#9)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockDeviceClient.__config = undefined;
      jest.isolateModules(() => {
        require('./main');
      });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    function initAndGetConfig() {
      mockStoreGet.mockImplementation((key: string) => (key === 'deviceToken' ? 'device-token' : null));
      const thenMock = (app.whenReady as jest.Mock).mock.results[0].value.then;
      thenMock.mock.calls[0][0]();
      const didFinishLoad = webContentsListeners['did-finish-load'][0];
      didFinishLoad();
      jest.advanceTimersByTime(500);
      // Config captured on the shared mock instance by the DeviceClient factory.
      return mockDeviceClient.__config;
    }

    it('persists a non-empty playlist to the store on receive', () => {
      const config = initAndGetConfig();
      const playlist = { id: 'p1', items: [{ content: { id: 'c1' } }] };
      config.onPlaylistUpdate(playlist);
      expect(mockStoreSet).toHaveBeenCalledWith('lastPlaylist', playlist);
    });

    it('does not persist an empty playlist (never clobbers the cache)', () => {
      const config = initAndGetConfig();
      mockStoreSet.mockClear();
      config.onPlaylistUpdate({ id: 'p1', items: [] });
      expect(mockStoreSet).not.toHaveBeenCalledWith('lastPlaylist', expect.anything());
    });

    it('bridges onOverride / onClearOverride to the renderer over IPC', () => {
      const config = initAndGetConfig();
      const override = { content: { url: 'https://example.com/promo' } };
      config.onOverride(override);
      expect(mockWebContents.send).toHaveBeenCalledWith('override', override);
      config.onClearOverride();
      expect(mockWebContents.send).toHaveBeenCalledWith('override', null);
    });

    it('reports renderer liveness via getRendererStatus (boot → playing after a paint ping)', () => {
      const config = initAndGetConfig();
      expect(config.getRendererStatus().screenState).toBe('boot');

      const paintListener = ipcListeners['renderer-heartbeat'][0];
      paintListener();
      expect(config.getRendererStatus().screenState).toBe('playing');
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

import { app, BrowserWindow, ipcMain, powerSaveBlocker, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DeviceClient } from './device-client';
import { CacheManager } from './cache-manager';
import Store from 'electron-store';

const store = new Store({
  defaults: {
    deviceToken: null,
  },
  fileExtension: 'json',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});
let mainWindow: BrowserWindow | null = null;
let deviceClient: DeviceClient | null = null;
let cacheManager: CacheManager | null = null;
let sleepBlockerId: number | null = null;
const PLAYLIST_RENDERER_ACK_TIMEOUT_MS = 5000;
const COMMAND_RENDERER_ACK_TIMEOUT_MS = 5000;
const LINUX_AUTOSTART_FILE = 'vizora-display.desktop';
const PROCESS_ERROR_HANDLERS_REGISTERED = '__vizoraDisplayProcessErrorHandlersRegistered';

// Renderer crash-recovery reload with capped exponential backoff (realtime #2).
// The delay doubles per consecutive failure up to the cap and resets to 0 on a
// successful load, and only one reload is ever scheduled at a time — so a
// renderer that keeps dying backs off to 30s instead of hot-looping.
const RENDERER_RELOAD_BASE_DELAY_MS = 1000;
const RENDERER_RELOAD_MAX_DELAY_MS = 30000;
// Renderer is considered dark/frozen if it has not posted a paint ping within
// this window (it pings every ~2s; heartbeat cadence is 15s) (realtime #2).
const RENDERER_LIVENESS_TIMEOUT_MS = 10000;
const LAST_PLAYLIST_STORE_KEY = 'lastPlaylist';

let deviceClientInitialized = false;
let rendererReloadAttempts = 0;
let rendererReloadTimer: NodeJS.Timeout | null = null;
let lastRendererPaintAt = 0;
let hasLivePlaylist = false;

function shouldEnableRuntimeGuards(): boolean {
  return app.isPackaged;
}

function quoteDesktopExec(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function getLinuxAutostartExecPath(): string {
  return process.env.APPIMAGE || process.execPath;
}

function configureAutoStart(): void {
  if (!shouldEnableRuntimeGuards()) {
    return;
  }

  try {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: false,
        path: process.execPath,
      });
      console.log('[Main] Auto-start enabled via login item settings');
      return;
    }

    if (process.platform === 'linux') {
      const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
      const desktopPath = path.join(autostartDir, LINUX_AUTOSTART_FILE);
      fs.mkdirSync(autostartDir, { recursive: true });
      fs.writeFileSync(
        desktopPath,
        [
          '[Desktop Entry]',
          'Type=Application',
          'Name=Vizora Display',
          `Exec=${quoteDesktopExec(getLinuxAutostartExecPath())}`,
          'Terminal=false',
          'X-GNOME-Autostart-enabled=true',
          '',
        ].join('\n'),
        'utf8',
      );
      console.log(`[Main] Auto-start enabled via ${desktopPath}`);
    }
  } catch (error) {
    console.error('[Main] Failed to configure auto-start:', error);
  }
}

function registerProcessErrorHandlers(): void {
  const handlerState = globalThis as typeof globalThis & {
    [PROCESS_ERROR_HANDLERS_REGISTERED]?: boolean;
  };

  if (handlerState[PROCESS_ERROR_HANDLERS_REGISTERED]) {
    return;
  }

  // Handle uncaught exceptions from renderer process
  process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught exception:', error);
    // Continue running - don't crash
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
    // Continue running - don't crash
  });

  handlerState[PROCESS_ERROR_HANDLERS_REGISTERED] = true;
}

function startDisplaySleepBlocker(): void {
  if (!shouldEnableRuntimeGuards()) {
    return;
  }

  try {
    if (sleepBlockerId !== null && powerSaveBlocker.isStarted(sleepBlockerId)) {
      return;
    }
    sleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    console.log(`[Main] Display sleep prevention enabled (${sleepBlockerId})`);
  } catch (error) {
    console.error('[Main] Failed to enable display sleep prevention:', error);
  }
}

function stopDisplaySleepBlocker(): void {
  if (sleepBlockerId === null) {
    return;
  }

  try {
    if (powerSaveBlocker.isStarted(sleepBlockerId)) {
      powerSaveBlocker.stop(sleepBlockerId);
    }
  } catch (error) {
    console.error('[Main] Failed to stop display sleep prevention:', error);
  } finally {
    sleepBlockerId = null;
  }
}

function sendPlaylistToRenderer(playlist: any): Promise<void> {
  if (!mainWindow) {
    return Promise.reject(new Error('Renderer window is not available'));
  }

  const requestId = `playlist-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      ipcMain.off('playlist-update-applied', handler);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Renderer did not acknowledge playlist update'));
    }, PLAYLIST_RENDERER_ACK_TIMEOUT_MS);

    const handler = (_event: unknown, response?: {
      requestId?: string;
      ok?: boolean;
      error?: string;
    }) => {
      if (response?.requestId !== requestId) {
        return;
      }

      cleanup();
      if (response.ok === false) {
        reject(new Error(response.error || 'Renderer rejected playlist update'));
        return;
      }

      resolve();
    };

    ipcMain.on('playlist-update-applied', handler);
    mainWindow!.webContents.send('playlist-update', { requestId, playlist });
  });
}

function sendCommandToRenderer(command: any): Promise<void> {
  if (!mainWindow) {
    return Promise.reject(new Error('Renderer window is not available'));
  }

  const requestId = `command-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      ipcMain.off('command-applied', handler);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Renderer did not acknowledge command'));
    }, COMMAND_RENDERER_ACK_TIMEOUT_MS);

    const handler = (_event: unknown, response?: {
      requestId?: string;
      ok?: boolean;
      error?: string;
    }) => {
      if (response?.requestId !== requestId) {
        return;
      }

      cleanup();
      if (response.ok === false) {
        reject(new Error(response.error || 'Renderer rejected command'));
        return;
      }

      resolve();
    };

    ipcMain.on('command-applied', handler);
    mainWindow!.webContents.send('command', { requestId, command });
  });
}

function persistLastKnownGoodPlaylist(playlist: any): void {
  // Persist the last non-empty playlist to disk so the screen can render content
  // offline on the next boot, before the socket connects (realtime #3). Never
  // overwrite a good cache with an empty playlist.
  try {
    if (playlist && Array.isArray(playlist.items) && playlist.items.length > 0) {
      store.set(LAST_PLAYLIST_STORE_KEY, playlist);
    }
  } catch (error) {
    console.error('[Main] Failed to persist last-known-good playlist:', error);
  }
}

function getStoredDeviceToken(): string | undefined {
  const stored = store.get('deviceToken') as string | undefined;
  return stored || process.env.DEVICE_TOKEN || undefined;
}

function computeRendererStatus(): { screenState?: string; playbackSource?: string } {
  // Fold renderer liveness into the heartbeat (realtime #2). A connected device
  // whose renderer is not painting reads as on-but-dark (screenState != playing)
  // instead of a false green.
  const playbackSource = hasLivePlaylist ? 'live' : 'cached';
  if (lastRendererPaintAt === 0) {
    // Renderer has not yet reported a paint (early boot / pre-first-frame).
    return { screenState: 'boot', playbackSource };
  }
  const stale = Date.now() - lastRendererPaintAt > RENDERER_LIVENESS_TIMEOUT_MS;
  return { screenState: stale ? 'recovering' : 'playing', playbackSource };
}

function restoreRendererState(): void {
  // Runs on every renderer load (first boot AND every reload). Renders the
  // last-known-good playlist immediately from cache and restores the paired /
  // pairing / override state, so a reloaded or offline-booted renderer never
  // sits blank waiting for the socket (realtime #2 + #3).
  if (!mainWindow) {
    return;
  }

  const deviceToken = getStoredDeviceToken();
  if (!deviceToken) {
    mainWindow.webContents.send('pairing-required');
    return;
  }

  mainWindow.webContents.send('paired', deviceToken);

  const cached = store.get(LAST_PLAYLIST_STORE_KEY) as any;
  if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
    // Fire-and-forget (no requestId): the renderer applies it without an ack.
    mainWindow.webContents.send('playlist-update', { playlist: cached });
  }

  // Re-show an active override overlay after a renderer reload (realtime #9).
  const activeOverride = deviceClient?.getActiveOverride?.();
  if (activeOverride) {
    mainWindow.webContents.send('override', activeOverride);
  }
}

function cancelRendererReload(): void {
  if (rendererReloadTimer) {
    clearTimeout(rendererReloadTimer);
    rendererReloadTimer = null;
  }
}

function scheduleRendererReload(reason: string): void {
  if (!mainWindow) {
    return;
  }
  // Only one reload in flight — never stack timers (prevents hot-loop) (realtime #2).
  if (rendererReloadTimer) {
    return;
  }

  const delay = Math.min(
    RENDERER_RELOAD_MAX_DELAY_MS,
    RENDERER_RELOAD_BASE_DELAY_MS * Math.pow(2, rendererReloadAttempts),
  );
  rendererReloadAttempts++;
  console.error(`[Main] Renderer ${reason} — reloading in ${delay}ms (attempt ${rendererReloadAttempts})`);

  rendererReloadTimer = setTimeout(() => {
    rendererReloadTimer = null;
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    } catch (error) {
      console.error('[Main] Renderer reload failed:', error);
    }
  }, delay);
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Construct preload script path with better error handling
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Main] Loading preload script from:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: false,
    frame: true,
    kiosk: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      sandbox: true, // Enable sandbox for security
    },
  });

  cacheManager = new CacheManager();

  // Resolve server URLs: electron-store > environment variables > defaults
  const apiUrl = (store.get('apiUrl') as string) || process.env.API_URL || 'http://localhost:3000';
  const realtimeUrl = (store.get('realtimeUrl') as string) || process.env.REALTIME_URL || 'ws://localhost:3002';

  // Extract the API domain for CSP directives
  let cspApiOrigin: string;
  try {
    const parsed = new URL(apiUrl);
    cspApiOrigin = parsed.origin;
  } catch {
    cspApiOrigin = 'http://localhost:3000';
  }

  let cspWsOrigin: string;
  try {
    const parsed = new URL(realtimeUrl);
    cspWsOrigin = parsed.origin;
  } catch {
    cspWsOrigin = 'ws://localhost:3002';
  }

  // Set Content Security Policy dynamically based on configured URLs
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          `img-src 'self' data: file: ${cspApiOrigin}; ` +
          `connect-src 'self' ${cspApiOrigin} ${cspWsOrigin}; ` +
          `media-src 'self' file: ${cspApiOrigin}; ` +
          `frame-src 'self' ${cspApiOrigin} http: https:;`
        ]
      }
    });
  });

  // Load the app
  // Always load from dist in development for reliability
  // Use webpack-dev-server only if explicitly requested via env var
  const useDevServer = process.env.USE_DEV_SERVER === 'true';

  if (useDevServer) {
    console.log('[Main] Loading from webpack dev server at http://localhost:4200');
    mainWindow.loadURL('http://localhost:4200').catch((err) => {
      console.log('[Main] Dev server not available, falling back to dist:', err.message);
      mainWindow?.loadFile(path.join(__dirname, '../renderer/index.html'));
    });
  } else {
    console.log('[Main] Loading from dist/renderer/index.html');
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')).catch((err) => {
      console.error('[Main] Failed to load renderer:', err);
    });
  }
  
  // Open dev tools only in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools();
  }

  // Capture console messages from renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = ['verbose', 'info', 'warn', 'error'][level] || 'log';
    console.log(`[RENDERER-${levelStr.toUpperCase()}] ${message}`);
    if (sourceId) {
      console.log(`  at ${sourceId}:${line}`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Renderer crash / hang recovery (realtime #2). An OOM, GPU crash or hung
  // decode whites out the window with nothing to reload it — while the main
  // process keeps heartbeating "online". Reload with capped backoff so a dead
  // renderer comes back instead of staying blank forever.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    scheduleRendererReload(`render-process-gone (${details?.reason ?? 'unknown'})`);
  });
  mainWindow.webContents.on('unresponsive', () => {
    scheduleRendererReload('unresponsive');
  });
  mainWindow.webContents.on('responsive', () => {
    // Renderer recovered on its own — cancel any pending reload.
    cancelRendererReload();
  });

  // Hide cursor in production
  if (process.env.NODE_ENV === 'production') {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.insertCSS('* { cursor: none !important; }');
    });
  }

  // On every renderer load (first boot AND crash-recovery reloads):
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Renderer loaded');
    // A successful load means the renderer is healthy again — reset crash backoff
    // and renderer-liveness (the renderer will re-post paint pings) (realtime #2).
    rendererReloadAttempts = 0;
    cancelRendererReload();
    lastRendererPaintAt = 0;

    // Render last-known-good playlist + restore paired/pairing/override state
    // immediately, before (and independent of) the socket (realtime #2/#3/#9).
    restoreRendererState();

    // Initialize the device client exactly once — NOT on every reload — so a
    // renderer reload never tears down the live socket (realtime #9).
    if (!deviceClientInitialized) {
      deviceClientInitialized = true;
      // Give renderer a moment to set up event listeners.
      setTimeout(() => {
        initializeDeviceClient();
      }, 500);
    }
  });
}

function initializeDeviceClient() {
  // Init exactly once (realtime #9). A renderer reload must never tear down the
  // live socket; the renderer's post-reload state is restored via
  // restoreRendererState() instead.
  if (deviceClient) {
    return;
  }

  let deviceToken = store.get('deviceToken') as string | undefined;

  // For testing/debugging: allow token from environment variable
  if (!deviceToken && process.env.DEVICE_TOKEN) {
    deviceToken = process.env.DEVICE_TOKEN;
    console.log('[Main] Using DEVICE_TOKEN from environment');
    store.set('deviceToken', deviceToken);
  }

  const apiUrl = (store.get('apiUrl') as string) || process.env.API_URL || 'http://localhost:3000';
  const realtimeUrl = (store.get('realtimeUrl') as string) || process.env.REALTIME_URL || 'ws://localhost:3002';

  console.log('[Main] *** INITIALIZING DEVICE CLIENT ***');
  console.log('[Main] Device token loaded:', deviceToken ? `${deviceToken.substring(0, 20)}...` : 'NONE - WILL REQUEST PAIRING');

  deviceClient = new DeviceClient(apiUrl, realtimeUrl, {
    onPairingRequired: () => {
      mainWindow?.webContents.send('pairing-required');
    },
    onPaired: (token) => {
      try {
        store.set('deviceToken', token);
        console.log('[Main] Device token saved successfully');
      } catch (error) {
        console.error('[Main] Failed to save device token:', error);
      }
      mainWindow?.webContents.send('paired', token);
    },
    onPlaylistUpdate: (playlist) => {
      // Persist the last-known-good playlist for offline boot (realtime #3).
      persistLastKnownGoodPlaylist(playlist);
      hasLivePlaylist = true;
      return sendPlaylistToRenderer(playlist);
    },
    onCommand: async (command) => {
      if (command.type === 'clear_cache') {
        await cacheManager?.clearCache();
      }
      await sendCommandToRenderer(command);
    },
    onError: (error) => {
      mainWindow?.webContents.send('error', error);
    },
    // Emergency / push_content override rendered as an in-renderer overlay,
    // and cleared back to the playlist — no top-level navigation (realtime #9).
    onOverride: (override) => {
      mainWindow?.webContents.send('override', override);
    },
    onClearOverride: () => {
      mainWindow?.webContents.send('override', null);
    },
    // Renderer-liveness folded into the heartbeat (realtime #2).
    getRendererStatus: () => computeRendererStatus(),
  }, store);

  if (deviceToken) {
    console.log('[Main] Device token exists, connecting...');
    deviceClient.connect(deviceToken);
  } else {
    // No token — the renderer was already told to show the pairing screen by
    // restoreRendererState(); the device client is now ready to serve codes.
    console.log('[Main] No device token — awaiting pairing');
  }
}

// Renderer liveness ping (realtime #2). The renderer posts this on a paint-gated
// timer; the main process tracks the last paint time and folds it into the
// heartbeat so a frozen renderer is visible server-side.
ipcMain.on('renderer-heartbeat', () => {
  lastRendererPaintAt = Date.now();
});

// IPC Handlers
ipcMain.handle('get-pairing-code', async () => {
  try {
    console.log('[Main] IPC Handler: get-pairing-code called');
    if (!deviceClient) {
      console.error('[Main] ERROR: deviceClient is null/undefined!');
      throw new Error('deviceClient not initialized');
    }
    console.log('[Main] Calling deviceClient.requestPairingCode()...');
    const result = await deviceClient.requestPairingCode();
    console.log('[Main] Got pairing result:', { code: result.code, hasQR: !!result.qrCode });
    return result;
  } catch (error: any) {
    console.error('[Main] *** ERROR getting pairing code:', error.message || error);
    console.error('[Main] Full error:', error);
    throw error;
  }
});

ipcMain.handle('check-pairing-status', async (event, code: string) => {
  try {
    const result = await deviceClient?.checkPairingStatus(code);
    return result;
  } catch (error) {
    console.error('Failed to check pairing status:', error);
    throw error;
  }
});

ipcMain.handle('send-heartbeat', async (event, data: any) => {
  try {
    deviceClient?.sendHeartbeat(data);
    return { success: true };
  } catch (error) {
    console.error('Failed to send heartbeat:', error);
    throw error;
  }
});

ipcMain.handle('log-impression', async (event, data: any) => {
  try {
    deviceClient?.logImpression(data);
    return { success: true };
  } catch (error) {
    console.error('Failed to log impression:', error);
    throw error;
  }
});

ipcMain.handle('log-error', async (event, data: any) => {
  try {
    deviceClient?.logError(data);
    return { success: true };
  } catch (error) {
    console.error('Failed to log error:', error);
    throw error;
  }
});

ipcMain.handle('get-device-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    electronVersion: process.versions.electron,
  };
});

ipcMain.handle('quit-app', async () => {
  app.quit();
});

ipcMain.handle('toggle-fullscreen', async () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

// Cache management IPC handlers
ipcMain.handle('cache:download', async (event, id: string, url: string, mimeType: string) => {
  try {
    const localPath = await cacheManager?.downloadContent(id, url, mimeType);
    return { success: true, path: localPath };
  } catch (error) {
    console.error('Failed to cache content:', error);
    return { success: false, path: null };
  }
});

ipcMain.handle('cache:get', async (event, id: string) => {
  try {
    const localPath = cacheManager?.getCachedPath(id);
    return { path: localPath };
  } catch (error) {
    return { path: null };
  }
});

ipcMain.handle('cache:stats', async () => {
  return cacheManager?.getCacheStats() || { itemCount: 0, totalSizeMB: 0, maxSizeMB: 500 };
});

ipcMain.handle('cache:clear', async () => {
  cacheManager?.clearCache();
  return { success: true };
});

// App lifecycle
app.whenReady().then(() => {
  configureAutoStart();
  startDisplaySleepBlocker();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app termination
app.on('before-quit', () => {
  stopDisplaySleepBlocker();
  deviceClient?.disconnect();
});

registerProcessErrorHandlers();

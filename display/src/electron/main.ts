import { app, BrowserWindow, ipcMain, screen } from 'electron';
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

  // Hide cursor in production
  if (process.env.NODE_ENV === 'production') {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.insertCSS('* { cursor: none !important; }');
    });
  }

  // Wait for renderer to be ready before initializing device client
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Renderer loaded, initializing device client...');
    // Give renderer a moment to set up event listeners
    setTimeout(() => {
      initializeDeviceClient();
    }, 500);
  });
}

function initializeDeviceClient() {
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
      mainWindow?.webContents.send('playlist-update', playlist);
    },
    onCommand: (command) => {
      if (command.type === 'clear_cache') {
        cacheManager?.clearCache();
      }
      mainWindow?.webContents.send('command', command);
    },
    onError: (error) => {
      mainWindow?.webContents.send('error', error);
    },
  }, store);

  if (deviceToken) {
    console.log('[Main] Device token exists, connecting...');
    deviceClient.connect(deviceToken);
    // Send paired event to renderer so it shows content screen instead of pairing
    console.log('[Main] Sending paired event to renderer (existing token)');
    mainWindow?.webContents.send('paired', deviceToken);
  } else {
    // Request pairing
    console.log('[Main] *** SENDING PAIRING-REQUIRED EVENT TO RENDERER ***');
    mainWindow?.webContents.send('pairing-required');
    console.log('[Main] pairing-required event sent');
  }
}

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
app.whenReady().then(createWindow);

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
  deviceClient?.disconnect();
});

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

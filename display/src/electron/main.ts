import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { DeviceClient } from './device-client';
import Store from 'electron-store';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let deviceClient: DeviceClient | null = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const preloadPath = path.join(__dirname, 'preload.js');

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
    },
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:4200').catch(() => {
      // If dev server is not running, load from dist
      mainWindow?.loadFile(path.join(__dirname, '../renderer/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  
  // Always open dev tools for debugging
  mainWindow.webContents.openDevTools();

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
  const deviceToken = store.get('deviceToken') as string | undefined;
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const realtimeUrl = process.env.REALTIME_URL || 'ws://localhost:3002';

  deviceClient = new DeviceClient(apiUrl, realtimeUrl, {
    onPairingRequired: () => {
      mainWindow?.webContents.send('pairing-required');
    },
    onPaired: (token) => {
      store.set('deviceToken', token);
      mainWindow?.webContents.send('paired', token);
    },
    onPlaylistUpdate: (playlist) => {
      mainWindow?.webContents.send('playlist-update', playlist);
    },
    onCommand: (command) => {
      mainWindow?.webContents.send('command', command);
    },
    onError: (error) => {
      mainWindow?.webContents.send('error', error);
    },
  });

  if (deviceToken) {
    deviceClient.connect(deviceToken);
  } else {
    // Request pairing
    mainWindow?.webContents.send('pairing-required');
  }
}

// IPC Handlers
ipcMain.handle('get-pairing-code', async () => {
  try {
    const result = await deviceClient?.requestPairingCode();
    return result;
  } catch (error) {
    console.error('Failed to get pairing code:', error);
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

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

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: true,
    frame: false,
    kiosk: process.env.NODE_ENV === 'production',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Hide cursor in production
  if (process.env.NODE_ENV === 'production') {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.insertCSS('* { cursor: none !important; }');
    });
  }

  // Initialize device client
  initializeDeviceClient();
}

function initializeDeviceClient() {
  const deviceToken = store.get('deviceToken') as string | undefined;
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const realtimeUrl = process.env.REALTIME_URL || 'ws://localhost:3001';

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

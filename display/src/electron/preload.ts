import { contextBridge, ipcRenderer } from 'electron';

// Preload script - exposes safe IPC methods to renderer
console.log('[Preload] Initializing electronAPI...');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electronAPI', {
  // Pairing
  getPairingCode: () => ipcRenderer.invoke('get-pairing-code'),
  checkPairingStatus: (code: string) =>
    ipcRenderer.invoke('check-pairing-status', code),

  // Device communication
  sendHeartbeat: (data: any) => ipcRenderer.invoke('send-heartbeat', data),
  logImpression: (data: any) => ipcRenderer.invoke('log-impression', data),
  logError: (data: any) => ipcRenderer.invoke('log-error', data),

  // Device info
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),

  // App control
  quitApp: () => ipcRenderer.invoke('quit-app'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  // Event listeners
  onPairingRequired: (callback: () => void) =>
    ipcRenderer.on('pairing-required', callback),
  onPaired: (callback: (event: any, token: string) => void) =>
    ipcRenderer.on('paired', callback),
  onPlaylistUpdate: (callback: (event: any, playlist: any) => void) =>
    ipcRenderer.on('playlist-update', callback),
  onCommand: (callback: (event: any, command: any) => void) =>
    ipcRenderer.on('command', callback),
  onError: (callback: (event: any, error: any) => void) =>
    ipcRenderer.on('error', callback),

  // Remove listeners
  removeListener: (channel: string, callback: any) =>
    ipcRenderer.removeListener(channel, callback),
  });
  console.log('[Preload] ✅ electronAPI exposed successfully');
} catch (error) {
  console.error('[Preload] ❌ Failed to expose electronAPI:', error);
}

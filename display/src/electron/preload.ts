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

  // Renderer liveness ping — proves the renderer is still painting so the main
  // process can surface a dead / frozen renderer in the heartbeat (realtime #2).
  notifyRendererAlive: () => ipcRenderer.send('renderer-heartbeat'),

  // Device info
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),

  // App control
  quitApp: () => ipcRenderer.invoke('quit-app'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  // Cache management
  cacheDownload: (id: string, url: string, mimeType: string) =>
    ipcRenderer.invoke('cache:download', id, url, mimeType),
  cacheGet: (id: string) => ipcRenderer.invoke('cache:get', id),
  cacheStats: () => ipcRenderer.invoke('cache:stats'),
  cacheClear: () => ipcRenderer.invoke('cache:clear'),

  // Event listeners
  onPairingRequired: (callback: () => void) =>
    ipcRenderer.on('pairing-required', callback),
  onPaired: (callback: (event: any, token: string) => void) =>
    ipcRenderer.on('paired', callback),
  onPlaylistUpdate: (callback: (
    event: any,
    playlist: any,
    ack?: (response?: { ok: boolean; error?: string }) => void,
  ) => void) =>
    ipcRenderer.on('playlist-update', (event, payload) => {
      const requestId = payload?.requestId;
      const playlist = payload?.playlist ?? payload;
      const ack = (response: { ok: boolean; error?: string } = { ok: true }) => {
        if (requestId) {
          ipcRenderer.send('playlist-update-applied', {
            requestId,
            ...response,
          });
        }
      };
      callback(event, playlist, ack);
    }),
  onCommand: (callback: (
    event: any,
    command: any,
    ack?: (response?: { ok: boolean; error?: string }) => void,
  ) => void) =>
    ipcRenderer.on('command', (event, payload) => {
      const requestId = payload?.requestId;
      const command = payload?.command ?? payload;
      const ack = (response: { ok: boolean; error?: string } = { ok: true }) => {
        if (requestId) {
          ipcRenderer.send('command-applied', {
            requestId,
            ...response,
          });
        }
      };
      callback(event, command, ack);
    }),
  onError: (callback: (event: any, error: any) => void) =>
    ipcRenderer.on('error', callback),

  // Emergency / push_content override, rendered as an in-renderer overlay
  // instead of a top-level navigation so the socket + app survive (realtime #9).
  // A `null` payload clears the overlay and reverts to the normal playlist.
  onOverride: (callback: (
    event: any,
    override: { content: any; commandId?: string } | null,
  ) => void) =>
    ipcRenderer.on('override', (event, payload) => {
      callback(event, payload ?? null);
    }),

  // Remove listeners
  removeListener: (channel: string, callback: any) =>
    ipcRenderer.removeListener(channel, callback),
  });
  console.log('[Preload] ✅ electronAPI exposed successfully');
} catch (error) {
  console.error('[Preload] ❌ Failed to expose electronAPI:', error);
}

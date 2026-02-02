/**
 * Vizora Web Display Client
 *
 * This is a web-based display client that runs in any browser.
 * It can be deployed on:
 * - Smart TVs with built-in browsers (Samsung, LG, etc.)
 * - Android TV via Chrome/WebView
 * - Fire TV via Silk Browser
 * - Raspberry Pi with Chromium in kiosk mode
 * - Any device with a modern web browser
 */

import { io, Socket } from 'socket.io-client';

// Configuration - can be overridden via URL params or localStorage
const CONFIG = {
  apiUrl: getConfig('API_URL', 'http://localhost:3000'),
  realtimeUrl: getConfig('REALTIME_URL', 'http://localhost:3002'),
  dashboardUrl: getConfig('DASHBOARD_URL', 'http://localhost:3001'),
};

function getConfig(key: string, defaultValue: string): string {
  // Check URL params first
  const urlParams = new URLSearchParams(window.location.search);
  const urlValue = urlParams.get(key.toLowerCase());
  if (urlValue) return urlValue;

  // Check localStorage
  const storedValue = localStorage.getItem(`vizora_${key}`);
  if (storedValue) return storedValue;

  return defaultValue;
}

interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  loopPlaylist?: boolean;
}

interface PlaylistItem {
  id: string;
  contentId: string;
  duration: number;
  order: number;
  content: {
    id: string;
    name: string;
    type: string;
    url: string;
    thumbnail?: string;
    mimeType?: string;
    duration?: number;
  } | null;
}

class VizoraDisplay {
  private socket: Socket | null = null;
  private deviceId: string | null = null;
  private deviceToken: string | null = null;
  private pairingCode: string | null = null;
  private pairingCheckInterval: NodeJS.Timeout | null = null;

  private currentPlaylist: Playlist | null = null;
  private currentIndex = 0;
  private playbackTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    console.log('[Vizora] Initializing web display client...');

    // Check for existing device token
    this.deviceToken = localStorage.getItem('vizora_device_token');
    this.deviceId = localStorage.getItem('vizora_device_id');

    if (this.deviceToken && this.deviceId) {
      console.log('[Vizora] Found existing device credentials, connecting...');
      this.connectToRealtime();
    } else {
      console.log('[Vizora] No credentials found, starting pairing flow...');
      this.startPairing();
    }
  }

  // ==================== PAIRING ====================

  private async startPairing() {
    this.showScreen('pairing');
    this.updateStatus('connecting', 'Requesting pairing code...');

    try {
      // Request pairing code from API
      const response = await fetch(`${CONFIG.apiUrl}/api/pairing/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceInfo: this.getDeviceInfo(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request pairing code');
      }

      const data = await response.json();
      this.pairingCode = data.code;
      this.deviceId = data.deviceId;

      // Display the code
      this.displayPairingCode(data.code);

      // Generate QR code
      if (data.qrCode) {
        this.displayQRCode(data.qrCode);
      } else {
        this.generateQRCode(data.code);
      }

      // Start polling for pairing completion
      this.startPairingCheck();

      this.updateStatus('connecting', 'Waiting for pairing...');
    } catch (error) {
      console.error('[Vizora] Pairing request failed:', error);
      this.showError('Failed to request pairing code. Retrying...');
      setTimeout(() => this.startPairing(), 5000);
    }
  }

  private displayPairingCode(code: string) {
    const codeElement = document.getElementById('pairing-code');
    if (codeElement) {
      codeElement.textContent = code;
    }
  }

  private displayQRCode(qrDataUrl: string) {
    const container = document.getElementById('qr-code');
    if (container) {
      const img = document.createElement('img');
      img.src = qrDataUrl;
      img.alt = 'QR Code';
      container.innerHTML = '';
      container.appendChild(img);
    }
  }

  private async generateQRCode(code: string) {
    const container = document.getElementById('qr-code');
    if (!container) return;

    // QR code contains a URL for easy mobile pairing
    const pairUrl = `${CONFIG.dashboardUrl}/pair?code=${code}`;

    try {
      // Dynamic import of QRCode library
      const QRCode = await import('qrcode');
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, pairUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      container.innerHTML = '';
      container.appendChild(canvas);
    } catch (error) {
      console.error('[Vizora] Failed to generate QR code:', error);
      // Show text URL as fallback
      container.innerHTML = `<div style="color: #888; font-size: 0.8rem;">Scan QR code unavailable<br>${pairUrl}</div>`;
    }
  }

  private startPairingCheck() {
    if (this.pairingCheckInterval) {
      clearInterval(this.pairingCheckInterval);
    }

    this.pairingCheckInterval = setInterval(async () => {
      if (!this.pairingCode) return;

      try {
        const response = await fetch(
          `${CONFIG.apiUrl}/api/pairing/status/${this.pairingCode}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Pairing code expired, get a new one
            console.log('[Vizora] Pairing code expired, requesting new one...');
            this.startPairing();
            return;
          }
          throw new Error('Failed to check pairing status');
        }

        const data = await response.json();

        if (data.status === 'paired' && data.deviceToken) {
          console.log('[Vizora] Device paired successfully!');
          this.stopPairingCheck();

          // Store credentials
          this.deviceToken = data.deviceToken;
          localStorage.setItem('vizora_device_token', data.deviceToken);
          localStorage.setItem('vizora_device_id', this.deviceId || '');

          // Connect to realtime service
          this.connectToRealtime();
        }
      } catch (error) {
        console.error('[Vizora] Pairing check error:', error);
      }
    }, 2000);
  }

  private stopPairingCheck() {
    if (this.pairingCheckInterval) {
      clearInterval(this.pairingCheckInterval);
      this.pairingCheckInterval = null;
    }
  }

  // ==================== REALTIME CONNECTION ====================

  private connectToRealtime() {
    if (!this.deviceToken) {
      console.error('[Vizora] No device token available');
      this.startPairing();
      return;
    }

    this.updateStatus('connecting', 'Connecting to server...');

    // Use IPv4 explicitly to avoid connection issues
    const realtimeUrl = CONFIG.realtimeUrl.replace('localhost', '127.0.0.1');

    this.socket = io(realtimeUrl, {
      auth: {
        token: this.deviceToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[Vizora] Connected to realtime gateway');
      this.updateStatus('online', 'Connected');
      this.showScreen('content');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Vizora] Disconnected:', reason);
      this.updateStatus('offline', 'Disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Vizora] Connection error:', error);
      this.updateStatus('offline', 'Connection failed');

      // If token is invalid, clear and re-pair
      if (error.message.includes('unauthorized') || error.message.includes('invalid token')) {
        console.log('[Vizora] Token invalid, clearing credentials...');
        localStorage.removeItem('vizora_device_token');
        localStorage.removeItem('vizora_device_id');
        this.deviceToken = null;
        this.deviceId = null;
        setTimeout(() => this.startPairing(), 2000);
      }
    });

    this.socket.on('config', (config) => {
      console.log('[Vizora] Received config:', config);
    });

    this.socket.on('playlist:update', (data) => {
      console.log('[Vizora] Received playlist update:', data);
      this.updatePlaylist(data.playlist);
    });

    this.socket.on('command', (command) => {
      console.log('[Vizora] Received command:', command);
      this.handleCommand(command);
    });
  }

  // ==================== PLAYBACK ====================

  private updatePlaylist(playlist: Playlist) {
    this.currentPlaylist = playlist;
    this.currentIndex = 0;

    // Stop current playback
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    // Clear content container
    const container = document.getElementById('content-container');
    if (container) {
      container.innerHTML = '';
    }

    // Start playing
    if (playlist.items && playlist.items.length > 0) {
      this.showScreen('content');
      this.playContent();
    } else {
      console.log('[Vizora] Playlist is empty');
    }
  }

  private playContent() {
    if (!this.currentPlaylist || !this.currentPlaylist.items) {
      return;
    }

    const items = this.currentPlaylist.items;
    if (items.length === 0) return;

    const currentItem = items[this.currentIndex];
    const container = document.getElementById('content-container');

    if (!container || !currentItem || !currentItem.content) {
      this.nextContent();
      return;
    }

    console.log(`[Vizora] Playing content ${this.currentIndex + 1}/${items.length}: ${currentItem.content.name}`);

    // Clear previous content
    container.innerHTML = '';

    // Create content element
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content-item';

    const contentUrl = currentItem.content.url;
    const contentType = currentItem.content.type;

    switch (contentType) {
      case 'image':
        const img = document.createElement('img');
        img.src = contentUrl;
        img.alt = currentItem.content.name;
        img.onerror = () => {
          console.error('[Vizora] Image load failed:', contentUrl);
          this.nextContent();
        };
        contentDiv.appendChild(img);
        break;

      case 'video':
        const video = document.createElement('video');
        video.src = contentUrl;
        video.autoplay = true;
        video.muted = false; // Can be changed based on settings
        video.playsInline = true;
        video.onerror = () => {
          console.error('[Vizora] Video load failed:', contentUrl);
          this.nextContent();
        };
        video.onended = () => this.nextContent();
        contentDiv.appendChild(video);
        break;

      case 'webpage':
      case 'url':
        const iframe = document.createElement('iframe');
        iframe.src = contentUrl;
        iframe.allow = 'autoplay; fullscreen';
        iframe.onerror = () => {
          console.error('[Vizora] Webpage load failed:', contentUrl);
          this.nextContent();
        };
        contentDiv.appendChild(iframe);
        break;

      default:
        console.warn('[Vizora] Unknown content type:', contentType);
        this.nextContent();
        return;
    }

    container.appendChild(contentDiv);

    // Schedule next content (if not video - videos advance on end)
    if (contentType !== 'video') {
      const duration = (currentItem.duration || 10) * 1000;
      this.playbackTimer = setTimeout(() => this.nextContent(), duration);
    }
  }

  private nextContent() {
    if (!this.currentPlaylist || !this.currentPlaylist.items) {
      return;
    }

    this.currentIndex++;

    // Loop back to beginning if at end
    if (this.currentIndex >= this.currentPlaylist.items.length) {
      if (this.currentPlaylist.loopPlaylist !== false) {
        this.currentIndex = 0;
      } else {
        console.log('[Vizora] Playlist ended');
        return;
      }
    }

    this.playContent();
  }

  // ==================== COMMANDS ====================

  private handleCommand(command: { type: string; [key: string]: any }) {
    switch (command.type) {
      case 'reload':
        window.location.reload();
        break;
      case 'clear_cache':
        localStorage.clear();
        window.location.reload();
        break;
      case 'unpair':
        localStorage.removeItem('vizora_device_token');
        localStorage.removeItem('vizora_device_id');
        window.location.reload();
        break;
      case 'screenshot':
        // Not supported in web, ignore
        console.log('[Vizora] Screenshot command not supported in web client');
        break;
      default:
        console.warn('[Vizora] Unknown command:', command.type);
    }
  }

  // ==================== UI HELPERS ====================

  private showScreen(screen: 'loading' | 'pairing' | 'content' | 'error') {
    const screens = ['loading-screen', 'pairing-screen', 'content-screen', 'error-screen'];
    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle('hidden', id !== `${screen}-screen`);
      }
    });
  }

  private showError(message: string) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
      errorMessage.textContent = message;
    }
    this.showScreen('error');
  }

  private updateStatus(status: 'online' | 'offline' | 'connecting', text: string) {
    const dot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (dot) {
      dot.className = 'status-dot ' + status;
    }
    if (statusText) {
      statusText.textContent = text;
    }
  }

  private getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      timestamp: new Date().toISOString(),
    };
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new VizoraDisplay());
} else {
  new VizoraDisplay();
}

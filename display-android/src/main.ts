/**
 * Vizora Android TV Display Client
 *
 * Built with Capacitor for native Android TV support.
 * Features:
 * - Native Android performance
 * - D-pad navigation support
 * - Hardware acceleration for video
 * - Background service capability
 * - Auto-start on boot
 * - Persistent storage via Capacitor Preferences
 */

import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { io, Socket } from 'socket.io-client';

// Configuration - can be overridden via URL params or stored preferences
const DEFAULT_CONFIG = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  realtimeUrl: import.meta.env.VITE_REALTIME_URL || 'http://localhost:3002',
  dashboardUrl: import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:3001',
};

interface Config {
  apiUrl: string;
  realtimeUrl: string;
  dashboardUrl: string;
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

class VizoraAndroidTV {
  private socket: Socket | null = null;
  private deviceId: string | null = null;
  private deviceToken: string | null = null;
  private pairingCode: string | null = null;
  private pairingCheckInterval: ReturnType<typeof setInterval> | null = null;
  private config: Config = DEFAULT_CONFIG;

  private currentPlaylist: Playlist | null = null;
  private currentIndex = 0;
  private playbackTimer: ReturnType<typeof setTimeout> | null = null;
  private isOnline = true;

  constructor() {
    this.init();
  }

  private async init() {
    console.log('[Vizora] Initializing Android TV display client...');

    // Load configuration
    await this.loadConfig();

    // Setup Capacitor plugins
    await this.setupCapacitor();

    // Check for existing device token
    const storedToken = await Preferences.get({ key: 'device_token' });
    const storedDeviceId = await Preferences.get({ key: 'device_id' });

    this.deviceToken = storedToken.value;
    this.deviceId = storedDeviceId.value;

    if (this.deviceToken && this.deviceId) {
      console.log('[Vizora] Found existing device credentials, connecting...');
      this.connectToRealtime();
    } else {
      console.log('[Vizora] No credentials found, starting pairing flow...');
      this.startPairing();
    }

    // Hide splash screen
    await SplashScreen.hide();
  }

  private async loadConfig() {
    // Try to load config from URL params first
    const urlParams = new URLSearchParams(window.location.search);

    const apiUrl = urlParams.get('api_url');
    const realtimeUrl = urlParams.get('realtime_url');
    const dashboardUrl = urlParams.get('dashboard_url');

    if (apiUrl) this.config.apiUrl = apiUrl;
    if (realtimeUrl) this.config.realtimeUrl = realtimeUrl;
    if (dashboardUrl) this.config.dashboardUrl = dashboardUrl;

    // Try to load from stored preferences
    const storedApiUrl = await Preferences.get({ key: 'config_api_url' });
    const storedRealtimeUrl = await Preferences.get({ key: 'config_realtime_url' });
    const storedDashboardUrl = await Preferences.get({ key: 'config_dashboard_url' });

    if (storedApiUrl.value && !apiUrl) this.config.apiUrl = storedApiUrl.value;
    if (storedRealtimeUrl.value && !realtimeUrl) this.config.realtimeUrl = storedRealtimeUrl.value;
    if (storedDashboardUrl.value && !dashboardUrl) this.config.dashboardUrl = storedDashboardUrl.value;

    console.log('[Vizora] Config loaded:', this.config);
  }

  private async setupCapacitor() {
    // Setup network status monitoring
    Network.addListener('networkStatusChange', (status) => {
      console.log('[Vizora] Network status changed:', status);
      this.isOnline = status.connected;

      if (status.connected && this.deviceToken && !this.socket?.connected) {
        console.log('[Vizora] Network restored, reconnecting...');
        this.connectToRealtime();
      }
    });

    // Check initial network status
    const status = await Network.getStatus();
    this.isOnline = status.connected;
    console.log('[Vizora] Initial network status:', status);

    // Handle app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('[Vizora] App state changed, active:', isActive);
      if (isActive && this.deviceToken && !this.socket?.connected) {
        this.connectToRealtime();
      }
    });

    // Handle back button (Android TV)
    App.addListener('backButton', () => {
      // Don't exit the app on back button
      console.log('[Vizora] Back button pressed, ignoring...');
    });

    // Setup D-pad navigation
    this.setupDpadNavigation();
  }

  private setupDpadNavigation() {
    // Android TV D-pad key codes
    const KEY_UP = 'ArrowUp';
    const KEY_DOWN = 'ArrowDown';
    const KEY_LEFT = 'ArrowLeft';
    const KEY_RIGHT = 'ArrowRight';
    const KEY_ENTER = 'Enter';
    const KEY_BACK = 'Escape';

    document.addEventListener('keydown', (event) => {
      const focusableElements = document.querySelectorAll('.focusable');
      const currentFocus = document.activeElement;

      switch (event.key) {
        case KEY_UP:
        case KEY_DOWN:
        case KEY_LEFT:
        case KEY_RIGHT:
          // Navigate between focusable elements
          this.handleDpadNavigation(event.key, focusableElements, currentFocus);
          event.preventDefault();
          break;

        case KEY_ENTER:
          // Activate current element
          if (currentFocus && currentFocus instanceof HTMLElement) {
            currentFocus.click();
          }
          event.preventDefault();
          break;

        case KEY_BACK:
          // Don't exit app
          event.preventDefault();
          break;
      }
    });
  }

  private handleDpadNavigation(
    direction: string,
    elements: NodeListOf<Element>,
    currentFocus: Element | null
  ) {
    if (elements.length === 0) return;

    const elementsArray = Array.from(elements);
    let currentIndex = currentFocus ? elementsArray.indexOf(currentFocus) : -1;

    switch (direction) {
      case 'ArrowUp':
      case 'ArrowLeft':
        currentIndex = currentIndex <= 0 ? elementsArray.length - 1 : currentIndex - 1;
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        currentIndex = currentIndex >= elementsArray.length - 1 ? 0 : currentIndex + 1;
        break;
    }

    const nextElement = elementsArray[currentIndex];
    if (nextElement instanceof HTMLElement) {
      nextElement.focus();
    }
  }

  // ==================== PAIRING ====================

  private async startPairing() {
    this.showScreen('pairing');
    this.updateStatus('connecting', 'Requesting pairing code...');

    if (!this.isOnline) {
      this.showError('No network connection. Please check your network settings.');
      setTimeout(() => this.startPairing(), 5000);
      return;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/api/pairing/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceInfo: await this.getDeviceInfo(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to request pairing code: ${response.status}`);
      }

      const data = await response.json();
      this.pairingCode = data.code;
      this.deviceId = data.deviceId;

      // Display the code
      this.displayPairingCode(data.code);

      // Generate/display QR code
      if (data.qrCode) {
        this.displayQRCode(data.qrCode);
      } else {
        await this.generateQRCode(data.code);
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

    const pairUrl = `${this.config.dashboardUrl}/pair?code=${code}`;

    try {
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
      container.innerHTML = `<div style="color: #888; font-size: 0.8rem; padding: 2rem;">QR unavailable<br>${pairUrl}</div>`;
    }
  }

  private startPairingCheck() {
    if (this.pairingCheckInterval) {
      clearInterval(this.pairingCheckInterval);
    }

    this.pairingCheckInterval = setInterval(async () => {
      if (!this.pairingCode || !this.isOnline) return;

      try {
        const response = await fetch(
          `${this.config.apiUrl}/api/pairing/status/${this.pairingCode}`
        );

        if (!response.ok) {
          if (response.status === 404) {
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

          this.deviceToken = data.deviceToken;

          // Store credentials using Capacitor Preferences
          await Preferences.set({ key: 'device_token', value: data.deviceToken });
          await Preferences.set({ key: 'device_id', value: this.deviceId || '' });

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

    if (!this.isOnline) {
      console.log('[Vizora] Offline, will retry when network is available');
      this.updateStatus('offline', 'No network connection');
      return;
    }

    this.updateStatus('connecting', 'Connecting to server...');

    // Close existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.config.realtimeUrl, {
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

    this.socket.on('connect_error', async (error) => {
      console.error('[Vizora] Connection error:', error);
      this.updateStatus('offline', 'Connection failed');

      if (error.message.includes('unauthorized') || error.message.includes('invalid token')) {
        console.log('[Vizora] Token invalid, clearing credentials...');
        await Preferences.remove({ key: 'device_token' });
        await Preferences.remove({ key: 'device_id' });
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

    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    const container = document.getElementById('content-container');
    if (container) {
      container.innerHTML = '';
    }

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

    container.innerHTML = '';

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
        video.muted = false;
        video.playsInline = true;
        // Android TV specific attributes
        video.setAttribute('x5-video-player-type', 'h5');
        video.setAttribute('x5-video-player-fullscreen', 'true');
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

  private async handleCommand(command: { type: string; [key: string]: unknown }) {
    switch (command.type) {
      case 'reload':
        window.location.reload();
        break;

      case 'clear_cache':
        await Preferences.clear();
        window.location.reload();
        break;

      case 'unpair':
        await Preferences.remove({ key: 'device_token' });
        await Preferences.remove({ key: 'device_id' });
        window.location.reload();
        break;

      case 'update_config':
        if (command.apiUrl) {
          await Preferences.set({ key: 'config_api_url', value: command.apiUrl as string });
        }
        if (command.realtimeUrl) {
          await Preferences.set({ key: 'config_realtime_url', value: command.realtimeUrl as string });
        }
        if (command.dashboardUrl) {
          await Preferences.set({ key: 'config_dashboard_url', value: command.dashboardUrl as string });
        }
        window.location.reload();
        break;

      default:
        console.warn('[Vizora] Unknown command:', command.type);
    }
  }

  // ==================== UI HELPERS ====================

  private showScreen(screen: 'loading' | 'pairing' | 'content' | 'error') {
    const screens = ['loading-screen', 'pairing-screen', 'content-screen', 'error-screen'];
    screens.forEach((id) => {
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

  private async getDeviceInfo() {
    // Get network info
    const networkStatus = await Network.getStatus();

    return {
      platform: 'android_tv',
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      networkType: networkStatus.connectionType,
      timestamp: new Date().toISOString(),
    };
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new VizoraAndroidTV());
} else {
  new VizoraAndroidTV();
}

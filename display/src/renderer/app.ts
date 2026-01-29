// Renderer process code
declare global {
  interface Window {
    electronAPI: {
      getPairingCode: () => Promise<any>;
      checkPairingStatus: (code: string) => Promise<any>;
      sendHeartbeat: (data: any) => Promise<any>;
      logImpression: (data: any) => Promise<any>;
      logError: (data: any) => Promise<any>;
      getDeviceInfo: () => Promise<any>;
      quitApp: () => Promise<void>;
      toggleFullscreen: () => Promise<void>;
      onPairingRequired: (callback: () => void) => void;
      onPaired: (callback: (event: any, token: string) => void) => void;
      onPlaylistUpdate: (callback: (event: any, playlist: any) => void) => void;
      onCommand: (callback: (event: any, command: any) => void) => void;
      onError: (callback: (event: any, error: any) => void) => void;
      removeListener: (channel: string, callback: any) => void;
    };
  }
}

class DisplayApp {
  private currentPlaylist: any = null;
  private currentIndex = 0;
  private playbackTimer: NodeJS.Timeout | null = null;
  private pairingCheckInterval: NodeJS.Timeout | null = null;
  private currentCode: string | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.error('[App] CRITICAL: window.electronAPI is undefined!');
      console.error('[App] Preload script did not load or execute properly.');
      this.showPreloadError();
      return;
    }

    console.log('[App] electronAPI initialized successfully');

    // Listen for events from main process
    window.electronAPI.onPairingRequired(() => {
      this.showPairingScreen();
    });

    window.electronAPI.onPaired((_, token) => {
      console.log('Device paired successfully');
      this.hidePairingScreen();
      this.showContentScreen();
    });

    window.electronAPI.onPlaylistUpdate((_, playlist) => {
      console.log('Received playlist update:', playlist);
      this.updatePlaylist(playlist);
    });

    window.electronAPI.onCommand((_, command) => {
      console.log('Received command:', command);
      this.handleCommand(command);
    });

    window.electronAPI.onError((_, error) => {
      console.error('Error:', error);
      this.showErrorScreen(error.message || 'Unknown error');
    });
  }

  private async showPairingScreen() {
    this.hideAllScreens();
    document.getElementById('pairing-screen')?.classList.remove('hidden');

    try {
      const result = await window.electronAPI.getPairingCode();

      if (result.code) {
        this.currentCode = result.code;
        this.displayPairingCode(result.code);

        if (result.qrCode) {
          this.displayQRCode(result.qrCode);
        }

        // Start checking pairing status
        this.startPairingCheck(result.code);
      }
    } catch (error) {
      console.error('Failed to get pairing code:', error);
      this.showErrorScreen('Failed to request pairing code');
    }
  }

  private displayPairingCode(code: string) {
    const codeElement = document.getElementById('pairing-code');
    if (codeElement) {
      codeElement.textContent = code;
    }
  }

  private displayQRCode(qrCodeDataUrl: string) {
    const qrContainer = document.getElementById('qr-code');
    if (qrContainer) {
      qrContainer.innerHTML = `<img src="${qrCodeDataUrl}" alt="QR Code" width="300" height="300" />`;
      qrContainer.classList.remove('hidden');
    }
  }

  private startPairingCheck(code: string) {
    if (this.pairingCheckInterval) {
      clearInterval(this.pairingCheckInterval);
    }

    let consecutiveErrors = 0;
    const maxErrors = 3; // Stop after 3 consecutive errors (likely paired and deleted)

    this.pairingCheckInterval = setInterval(async () => {
      try {
        const result = await window.electronAPI.checkPairingStatus(code);

        // Reset error counter on successful check
        consecutiveErrors = 0;

        if (result.status === 'paired') {
          this.stopPairingCheck();
          // The onPaired event will be triggered from main process
        }
      } catch (error: any) {
        consecutiveErrors++;
        
        // If we get multiple consecutive errors (404), pairing likely completed
        // and the request was deleted from backend. Stop polling.
        if (consecutiveErrors >= maxErrors) {
          console.log('[App] Stopping pairing check - likely already paired');
          this.stopPairingCheck();
        } else {
          // Only log the error if we haven't exceeded threshold
          console.error(`[RENDERER-ERROR] Failed to check pairing status: ${error.message || error}`);
        }
      }
    }, 2000); // Check every 2 seconds
  }

  private stopPairingCheck() {
    if (this.pairingCheckInterval) {
      clearInterval(this.pairingCheckInterval);
      this.pairingCheckInterval = null;
    }
  }

  private hidePairingScreen() {
    document.getElementById('pairing-screen')?.classList.add('hidden');
    this.stopPairingCheck();
  }

  private showContentScreen() {
    this.hideAllScreens();
    document.getElementById('content-screen')?.classList.remove('hidden');

    // Request current playlist
    // The playlist will be sent via onPlaylistUpdate event
  }

  private showErrorScreen(message: string) {
    this.hideAllScreens();
    const errorScreen = document.getElementById('error-screen');
    const errorMessage = document.getElementById('error-message');

    if (errorScreen && errorMessage) {
      errorMessage.textContent = message;
      errorScreen.classList.remove('hidden');
    }
  }

  private hideAllScreens() {
    document.getElementById('pairing-screen')?.classList.add('hidden');
    document.getElementById('content-screen')?.classList.add('hidden');
    document.getElementById('error-screen')?.classList.add('hidden');
  }

  private updatePlaylist(playlist: any) {
    this.currentPlaylist = playlist;
    this.currentIndex = 0;

    // Stop current playback
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
    }

    // Clear content container
    const container = document.getElementById('content-container');
    if (container) {
      container.innerHTML = '';
    }

    // Start playing new playlist
    if (playlist.items && playlist.items.length > 0) {
      this.playContent();
    }
  }

  private playContent() {
    if (!this.currentPlaylist || !this.currentPlaylist.items) {
      return;
    }

    const items = this.currentPlaylist.items;

    if (items.length === 0) {
      return;
    }

    const currentItem = items[this.currentIndex];
    const container = document.getElementById('content-container');

    if (!container || !currentItem) {
      return;
    }

    // Create content element
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content-item active';

    const startTime = Date.now();

    switch (currentItem.content?.type) {
      case 'image':
        const img = document.createElement('img');
        img.src = currentItem.content.source;
        img.onerror = () => this.handleContentError(currentItem, 'Image load failed');
        contentDiv.appendChild(img);
        break;

      case 'video':
        const video = document.createElement('video');
        video.src = currentItem.content.source;
        video.autoplay = true;
        video.muted = false;
        video.onerror = () => this.handleContentError(currentItem, 'Video load failed');
        video.onended = () => this.nextContent();
        contentDiv.appendChild(video);
        break;

      case 'webpage':
        const iframe = document.createElement('iframe');
        iframe.src = currentItem.content.source;
        iframe.allow = 'autoplay';
        contentDiv.appendChild(iframe);
        break;

      default:
        console.warn('Unknown content type:', currentItem.content?.type);
    }

    // Clear previous content and add new
    container.innerHTML = '';
    container.appendChild(contentDiv);

    // Log impression
    window.electronAPI.logImpression({
      contentId: currentItem.content?._id,
      playlistId: this.currentPlaylist._id,
      timestamp: startTime,
    });

    // Schedule next content (if not video)
    if (currentItem.content?.type !== 'video') {
      const duration = (currentItem.duration || 10) * 1000; // Convert to ms

      this.playbackTimer = setTimeout(() => {
        // Log completion
        window.electronAPI.logImpression({
          contentId: currentItem.content?._id,
          playlistId: this.currentPlaylist._id,
          duration: Date.now() - startTime,
          completed: true,
          timestamp: Date.now(),
        });

        this.nextContent();
      }, duration);
    }
  }

  private nextContent() {
    if (!this.currentPlaylist || !this.currentPlaylist.items) {
      return;
    }

    this.currentIndex++;

    // Loop back to beginning if at end
    if (this.currentIndex >= this.currentPlaylist.items.length) {
      if (this.currentPlaylist.loopPlaylist) {
        this.currentIndex = 0;
      } else {
        // Stop playback
        return;
      }
    }

    this.playContent();
  }

  private handleContentError(item: any, errorMessage: string) {
    console.error('Content error:', errorMessage, item);

    window.electronAPI.logError({
      contentId: item.content?._id,
      errorType: 'playback_error',
      errorMessage,
      timestamp: Date.now(),
    });

    // Skip to next content
    this.nextContent();
  }

  private handleCommand(command: any) {
    switch (command.type) {
      case 'reload':
        window.location.reload();
        break;
      case 'fullscreen':
        window.electronAPI.toggleFullscreen();
        break;
      case 'quit':
        window.electronAPI.quitApp();
        break;
      default:
        console.warn('Unknown command:', command);
    }
  }

  private showPreloadError() {
    this.hideAllScreens();
    const errorScreen = document.getElementById('error-screen');
    const errorMessage = document.getElementById('error-message');

    if (errorScreen && errorMessage) {
      errorMessage.innerHTML = `
        <strong>Preload Script Error</strong><br><br>
        window.electronAPI is undefined<br>
        The preload script did not load properly.<br><br>
        <small>Check the console for more details.</small>
      `;
      errorScreen.classList.remove('hidden');
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new DisplayApp();
  });
} else {
  new DisplayApp();
}

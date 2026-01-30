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
  private isPairingScreenShown = false;

  constructor() {
    console.log('[App] Constructor: Creating DisplayApp instance');
    this.init();
  }

  private init() {
    console.log('[App] init(): Initializing DisplayApp');
    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.error('[App] CRITICAL: window.electronAPI is undefined!');
      console.error('[App] Preload script did not load or execute properly.');
      this.showPreloadError();
      return;
    }

    console.log('[App] electronAPI initialized successfully');

    // Listen for events from main process
    console.log('[App] Setting up onPairingRequired listener...');
    window.electronAPI.onPairingRequired(() => {
      console.log('[App] *** PAIRING REQUIRED EVENT FIRED ***');
      this.showPairingScreen();
    });
    console.log('[App] onPairingRequired listener registered');

    window.electronAPI.onPaired((event, token) => {
      console.log('[App] ✅ ✅ ✅ PAIRED EVENT RECEIVED!');
      console.log('[App] Token length:', token ? token.length : 'NO TOKEN');
      console.log('[App] Device paired successfully');
      try {
        this.hidePairingScreen();
        console.log('[App] Pairing screen hidden');
        this.showContentScreen();
        console.log('[App] Content screen shown');
      } catch (error) {
        console.error('[App] ERROR during navigation:', error);
      }
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
    // Prevent duplicate pairing screens if event is fired multiple times
    if (this.isPairingScreenShown) {
      console.log('[App] ⚠️  Pairing screen already shown, ignoring duplicate request');
      return;
    }
    this.isPairingScreenShown = true;

    console.log('[App] showPairingScreen(): Displaying pairing screen');
    this.hideAllScreens();
    const pairingScreen = document.getElementById('pairing-screen');
    console.log('[App] Pairing screen element:', pairingScreen);
    pairingScreen?.classList.remove('hidden');
    console.log('[App] Hidden class removed from pairing-screen');

    try {
      console.log('[App] Requesting pairing code from device client...');
      const result = await window.electronAPI.getPairingCode();
      console.log('[App] *** PAIRING CODE RECEIVED ***');
      console.log('[App] Result keys:', Object.keys(result));
      console.log('[App] Code:', result.code);
      console.log('[App] Has QR:', result.qrCode ? 'YES' : 'NO');
      if (result.qrCode) {
        console.log('[App] QR length:', result.qrCode.length);
      }

      if (result.code) {
        this.currentCode = result.code;
        // Store the pairing code in case we need it again
        localStorage.setItem('lastPairingCode', result.code);
        this.displayPairingCode(result.code);

        if (result.qrCode) {
          console.log('[App] Calling displayQRCode...');
          this.displayQRCode(result.qrCode);
        } else {
          console.warn('[App] ⚠️  NO QR CODE IN RESPONSE');
        }

        // Start checking pairing status
        this.startPairingCheck(result.code);
      } else {
        console.error('[App] ❌ NO CODE IN RESPONSE:', result);
      }
    } catch (error: any) {
      console.error('[App] *** ERROR getting pairing code:', error.message || error);
      console.error('[App] Full error:', error);

      // Check if error is "device already paired"
      if (error?.message?.includes('already paired')) {
        console.log('[App] Device already paired, checking status with stored code...');
        const storedCode = localStorage.getItem('lastPairingCode');
        if (storedCode) {
          // Try to get the token using the stored pairing code
          this.startPairingCheck(storedCode);
          return;
        }
      }

      this.showErrorScreen('Failed to request pairing code');
      this.isPairingScreenShown = false; // Reset so pairing can be retried
    }
  }

  private displayPairingCode(code: string) {
    console.log('[App] displayPairingCode() called with code:', code);
    const codeElement = document.getElementById('pairing-code');
    console.log('[App] Found pairing-code element:', codeElement ? 'YES' : 'NO');
    if (codeElement) {
      console.log('[App] Setting pairing code text to:', code);
      codeElement.textContent = code;
      console.log('[App] Pairing code displayed');
    } else {
      console.error('[App] ❌ pairing-code element not found!');
    }
  }

  private displayQRCode(qrCodeDataUrl: string) {
    const qrContainer = document.getElementById('qr-code');
    if (qrContainer) {
      if (!qrCodeDataUrl) {
        console.warn('[App] displayQRCode(): Received empty QR code data URL');
        return;
      }
      console.log('[App] displayQRCode(): Rendering QR code, URL length:', qrCodeDataUrl.length);
      const img = document.createElement('img');
      img.src = qrCodeDataUrl;
      img.alt = 'QR Code';
      img.width = 300;
      img.height = 300;
      img.onerror = () => {
        console.error('[App] QR code image failed to load');
      };
      img.onload = () => {
        console.log('[App] QR code image loaded successfully');
      };
      qrContainer.innerHTML = '';
      qrContainer.appendChild(img);
      qrContainer.classList.remove('hidden');
      console.log('[App] QR code container shown');
    } else {
      console.error('[App] QR code container element not found');
    }
  }

  private startPairingCheck(code: string) {
    console.log('[App] startPairingCheck(): Starting pairing status check with code:', code);
    if (this.pairingCheckInterval) {
      clearInterval(this.pairingCheckInterval);
    }

    let consecutiveErrors = 0;
    const maxErrors = 5; // Increased from 3 to allow more retries before stopping
    let codeExpiryTime = Date.now() + (5 * 60 * 1000); // 5 minutes from now
    const codeRefreshThreshold = 30 * 1000; // Refresh code 30 seconds before expiry
    let currentCode = code; // Use local variable for current code

    const pollInterval = setInterval(async () => {
      try {
        // Check if code is about to expire and refresh it
        const timeUntilExpiry = codeExpiryTime - Date.now();
        if (timeUntilExpiry < codeRefreshThreshold) {
          console.log('[App] ⏰ Pairing code about to expire, requesting new code...');
          try {
            const newResult = await window.electronAPI.getPairingCode();
            console.log('[App] ✅ New pairing code received:', newResult.code);
            this.currentCode = newResult.code;
            currentCode = newResult.code; // ← FIX: Update the local currentCode
            localStorage.setItem('lastPairingCode', newResult.code);
            this.displayPairingCode(newResult.code);
            if (newResult.qrCode) {
              this.displayQRCode(newResult.qrCode);
            }
            codeExpiryTime = Date.now() + (5 * 60 * 1000); // Reset expiry timer
            consecutiveErrors = 0; // Reset error counter when code refreshed
            // ← REMOVED: return statement that was skipping status check
            // Continue to next iteration to check status with new code
          } catch (refreshError: any) {
            console.error('[App] ❌ Failed to refresh pairing code:', refreshError.message);
            this.showErrorScreen('Failed to refresh pairing code');
            clearInterval(pollInterval);
            this.pairingCheckInterval = null;
            this.isPairingScreenShown = false;
            return;
          }
        }

        // Check pairing status with the current code
        console.log('[App] Checking pairing status for code:', currentCode);
        try {
          const result = await window.electronAPI.checkPairingStatus(currentCode);
          console.log('[App] Pairing status result:', result);

          // Reset error counter on successful check
          consecutiveErrors = 0;

          if (result.status === 'paired') {
            console.log('[App] ✅ Device is paired! Token received from status check');
            clearInterval(pollInterval);
            this.pairingCheckInterval = null;
            // onPaired callback will be triggered from device-client
            return;
          }
        } catch (statusError: any) {
          consecutiveErrors++;
          console.log(`[App] ⚠️ Pairing check error (${consecutiveErrors}/${maxErrors}):`, statusError.message);

          // After pairing, backend deletes the pairing request
          // This causes 404 errors, but we should try a few more times
          if (consecutiveErrors >= maxErrors) {
            console.log('[App] Stopping pairing check after multiple errors');
            clearInterval(pollInterval);
            this.pairingCheckInterval = null;
          }
        }
      } catch (error: any) {
        console.error('[App] Unexpected error in pairing check:', error.message);
        consecutiveErrors++;
        if (consecutiveErrors >= maxErrors) {
          clearInterval(pollInterval);
          this.pairingCheckInterval = null;
        }
      }
    }, 2000); // Check every 2 seconds

    this.pairingCheckInterval = pollInterval;
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
    this.isPairingScreenShown = false;
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

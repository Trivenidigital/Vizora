// Renderer process code
import { getEntityId } from './ids';
import {
  shouldDownloadOnCacheMiss,
  shouldReadCachedContent,
  shouldPreloadContentType,
} from './preload-policy';
import { computeVideoSafetyTimeoutMs } from './video-safety';

// Renderer liveness ping cadence (realtime #2). The renderer proves it is still
// painting; the main process folds staleness into the heartbeat.
const RENDERER_ALIVE_PING_INTERVAL_MS = 2000;
// Advance watchdog (realtime #6): if rotation has not advanced within this window
// while a multi-item / looping playlist is active, force a restart. Kept well
// above the per-video safety ceiling so the two never fight.
const ADVANCE_WATCHDOG_INTERVAL_MS = 30000;
const ADVANCE_WATCHDOG_MAX_STALL_MS = 20 * 60 * 1000;

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
      cacheDownload: (id: string, url: string, mimeType: string) => Promise<{ success: boolean; path: string | null }>;
      cacheGet: (id: string) => Promise<{ path: string | null }>;
      cacheStats: () => Promise<{ itemCount: number; totalSizeMB: number; maxSizeMB: number }>;
      cacheClear: () => Promise<{ success: boolean }>;
      onPairingRequired: (callback: () => void) => void;
      onPaired: (callback: (event: any, token: string) => void) => void;
      onPlaylistUpdate: (callback: (
        event: any,
        playlist: any,
        ack?: (response?: { ok: boolean; error?: string }) => void,
      ) => void) => void;
      onCommand: (callback: (
        event: any,
        command: any,
        ack?: (response?: { ok: boolean; error?: string }) => void,
      ) => void) => void;
      onError: (callback: (event: any, error: any) => void) => void;
      onOverride?: (callback: (
        event: any,
        override: { content: any; commandId?: string } | null,
      ) => void) => void;
      notifyRendererAlive?: () => void;
      removeListener: (channel: string, callback: any) => void;
    };
  }
}

class DisplayApp {
  private currentPlaylist: any = null;
  private currentIndex = 0;
  private playbackTimer: NodeJS.Timeout | null = null;
  private pairingCheckInterval: NodeJS.Timeout | null = null;
  private isPairingScreenShown = false;
  private contentStartTime: number = 0;
  private zoneTimers: Map<string, NodeJS.Timeout> = new Map();
  private zoneIndices: Map<string, number> = new Map();
  // Reliability (realtime #6): per-video safety timer + a monotonic advance token
  // that invalidates late timers/events from a superseded item (no double-advance).
  private videoSafetyTimer: NodeJS.Timeout | null = null;
  private advanceToken = 0;
  private lastAdvanceAt = 0;
  private advanceWatchdog: NodeJS.Timeout | null = null;
  private playlistEnded = false;
  private lastFrameAt = 0;

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

    window.electronAPI.onPlaylistUpdate((_, playlist, ack) => {
      console.log('[App] Received playlist update:', playlist);
      try {
        // If we receive a playlist update, we're connected - hide pairing if shown, show content
        if (this.isPairingScreenShown) {
          console.log('[App] Hiding pairing screen due to playlist update');
          this.hidePairingScreen();
        }
        this.showContentScreen();
        this.updatePlaylist(playlist);
        ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply playlist';
        console.error('[App] Failed to apply playlist update:', message);
        ack?.({ ok: false, error: message });
      }
    });

    window.electronAPI.onCommand((_, command, ack) => {
      console.log('Received command:', command);
      try {
        this.handleCommand(command);
        ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply command';
        console.error('[App] Failed to apply command:', message);
        ack?.({ ok: false, error: message });
      }
    });

    window.electronAPI.onError((_, error) => {
      console.error('Error:', error);
      this.showErrorScreen(error.message || 'Unknown error');
    });

    // Emergency / push_content override rendered as an in-renderer overlay
    // (realtime #9). A `null` payload clears the overlay and reveals the playlist.
    window.electronAPI.onOverride?.((_, override) => {
      try {
        this.renderOverride(override);
      } catch (error) {
        console.error('[App] Failed to render override overlay:', error);
      }
    });

    // Renderer liveness (realtime #2) + advance watchdog (realtime #6).
    this.startRendererLivenessPing();
    this.startAdvanceWatchdog();

    // Don't proactively show pairing screen - wait for main process to tell us
    // The main process will send 'pairing-required' if no token exists
    console.log('[App] Renderer ready, waiting for main process events...');
  }

  private startRendererLivenessPing() {
    // Paint-gated liveness ping (realtime #2). requestAnimationFrame only fires
    // while the compositor is actually painting, so if the renderer freezes the
    // pings stop and the main process surfaces the device as on-but-dark. A hung
    // renderer therefore reports staleness instead of a false "online".
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number;

    const frame = () => {
      this.lastFrameAt = Date.now();
      raf(frame);
    };
    frame();

    setInterval(() => {
      // Only ping if a frame painted recently — a frozen compositor stops raf,
      // so we stop pinging and the device correctly reads as dark.
      if (Date.now() - this.lastFrameAt < RENDERER_ALIVE_PING_INTERVAL_MS * 2) {
        window.electronAPI.notifyRendererAlive?.();
      }
    }, RENDERER_ALIVE_PING_INTERVAL_MS);
  }

  private startAdvanceWatchdog() {
    if (this.advanceWatchdog) {
      clearInterval(this.advanceWatchdog);
    }
    this.advanceWatchdog = setInterval(
      () => this.checkAdvanceWatchdog(),
      ADVANCE_WATCHDOG_INTERVAL_MS,
    );
  }

  private checkAdvanceWatchdog() {
    // Backstop for a wedged rotation (realtime #6): if content has not advanced
    // for far longer than any legitimate item duration while a rotating playlist
    // is active, restart rotation. Skips a legitimately-ended non-looping playlist
    // and single static holds so it never thrashes intended behavior.
    if (this.playlistEnded) return;
    const items = this.currentPlaylist?.items;
    if (!Array.isArray(items) || items.length === 0) return;
    if (items.length < 2 && !this.currentPlaylist.loopPlaylist) return;
    if (this.lastAdvanceAt === 0) return;

    if (Date.now() - this.lastAdvanceAt > ADVANCE_WATCHDOG_MAX_STALL_MS) {
      console.warn('[App] Advance watchdog: rotation stalled — restarting');
      this.clearVideoSafetyTimer();
      if (this.playbackTimer) {
        clearTimeout(this.playbackTimer);
        this.playbackTimer = null;
      }
      this.nextContent();
    }
  }

  private clearVideoSafetyTimer() {
    if (this.videoSafetyTimer) {
      clearTimeout(this.videoSafetyTimer);
      this.videoSafetyTimer = null;
    }
  }

  private armVideoSafetyTimer(item: any, token: number, probedDurationSec?: number) {
    // Force-advance a stalled/hung video that fires neither `ended` nor `error`
    // (realtime #6). Re-armed with the probed duration once metadata loads.
    if (token !== this.advanceToken) return;
    this.clearVideoSafetyTimer();
    const timeoutMs = computeVideoSafetyTimeoutMs(
      item?.duration ?? item?.content?.duration,
      probedDurationSec,
    );
    this.videoSafetyTimer = setTimeout(() => {
      console.warn('[App] Video safety timer fired — force-advancing (no ended/error)');
      this.advance(token);
    }, timeoutMs);
  }

  private advance(token: number) {
    // Single guarded advance path (realtime #6). A late `ended`/`error`/safety
    // timer from a superseded item carries a stale token and is ignored, so the
    // playlist can never double-advance.
    if (token !== this.advanceToken) return;
    this.clearVideoSafetyTimer();
    this.nextContent();
  }

  private renderOverride(override: { content?: any } | null) {
    // In-renderer overlay for push_content / emergency overrides (realtime #9).
    // Rendered above the playlist so the socket + app survive; a null payload
    // removes it and reveals the still-running playlist underneath.
    const existing = document.getElementById('override-overlay');

    if (!override || !override.content) {
      if (existing) {
        existing.innerHTML = '';
        existing.remove();
      }
      return;
    }

    const overlay = existing ?? document.createElement('div');
    overlay.id = 'override-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '2000';
    overlay.style.background = '#000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = '';
    if (!existing) {
      document.body.appendChild(overlay);
    }

    const content = override.content;
    const source = content.url || content.source;

    switch (content.type) {
      case 'image': {
        const img = document.createElement('img');
        img.src = source;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        overlay.appendChild(img);
        break;
      }
      case 'video': {
        const video = document.createElement('video');
        video.src = source;
        video.autoplay = true;
        video.loop = true;
        video.muted = false;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        overlay.appendChild(video);
        break;
      }
      case 'html':
      case 'template': {
        const htmlIframe = document.createElement('iframe');
        htmlIframe.sandbox.add('allow-scripts');
        htmlIframe.srcdoc = source;
        htmlIframe.style.width = '100%';
        htmlIframe.style.height = '100%';
        htmlIframe.style.border = 'none';
        overlay.appendChild(htmlIframe);
        break;
      }
      default: {
        // url / webpage / unspecified — load in an iframe.
        const iframe = document.createElement('iframe');
        iframe.src = source;
        iframe.allow = 'autoplay';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        overlay.appendChild(iframe);
      }
    }
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
    const maxErrors = 10; // Allow more retries - device-client needs time to connect
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
            currentCode = newResult.code;
            localStorage.setItem('lastPairingCode', newResult.code);
            this.displayPairingCode(newResult.code);
            if (newResult.qrCode) {
              this.displayQRCode(newResult.qrCode);
            }
            codeExpiryTime = Date.now() + (5 * 60 * 1000); // Reset expiry timer
            consecutiveErrors = 0; // Reset error counter when code refreshed
          } catch (refreshError: any) {
            console.error('[App] ❌ Failed to refresh pairing code:', refreshError.message);
            // Don't show error screen yet - try to continue with current code
            // Only show error if we can't recover
            if (timeUntilExpiry <= 0) {
              this.showErrorScreen('Pairing code expired. Please restart the app.');
              clearInterval(pollInterval);
              this.pairingCheckInterval = null;
              this.isPairingScreenShown = false;
              return;
            }
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

            // IMPORTANT: Directly transition to content screen here
            // Don't rely solely on the IPC event which may have timing issues
            console.log('[App] Transitioning to content screen from poll result...');
            this.hidePairingScreen();
            this.showContentScreen();
            return;
          }
        } catch (statusError: any) {
          consecutiveErrors++;
          console.log(`[App] ⚠️ Pairing check error (${consecutiveErrors}/${maxErrors}):`, statusError.message);

          // After pairing completes, backend deletes the pairing request
          // This causes 404 errors, which may mean pairing succeeded
          // Keep trying - the onPaired IPC event should arrive
          if (consecutiveErrors >= maxErrors) {
            console.log('[App] Max errors reached - refreshing pairing code...');
            // Instead of stopping, try to get a new code
            try {
              const newResult = await window.electronAPI.getPairingCode();
              console.log('[App] ✅ New pairing code received after errors:', newResult.code);
              currentCode = newResult.code;
              localStorage.setItem('lastPairingCode', newResult.code);
              this.displayPairingCode(newResult.code);
              if (newResult.qrCode) {
                this.displayQRCode(newResult.qrCode);
              }
              codeExpiryTime = Date.now() + (5 * 60 * 1000);
              consecutiveErrors = 0;
            } catch (refreshError: any) {
              console.error('[App] ❌ Failed to recover with new code:', refreshError.message);
              // Check if device is already paired (error message contains 'already paired')
              if (refreshError.message && refreshError.message.includes('already paired')) {
                console.log('[App] Device already paired - transitioning to content screen');
                clearInterval(pollInterval);
                this.pairingCheckInterval = null;
                this.hidePairingScreen();
                this.showContentScreen();
                return;
              }
              this.showErrorScreen('Connection lost. Please restart the app.');
              clearInterval(pollInterval);
              this.pairingCheckInterval = null;
              this.isPairingScreenShown = false;
            }
          }
        }
      } catch (error: any) {
        console.error('[App] Unexpected error in pairing check:', error.message);
        consecutiveErrors++;
        if (consecutiveErrors >= maxErrors) {
          // Try to recover instead of giving up
          console.log('[App] Attempting recovery after unexpected errors...');
        }
      }
    }, 8000); // Stay under the pairing status endpoint's 10/min throttle

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
    this.playlistEnded = false;

    // Stop current playback (both the non-video rotation timer and the video
    // safety timer) and invalidate any in-flight advance from the old item.
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.clearVideoSafetyTimer();
    this.advanceToken++;

    // Clear content container
    const container = document.getElementById('content-container');
    if (container) {
      container.innerHTML = '';
    }

    // Start playing new playlist
    if (playlist.items && playlist.items.length > 0) {
      this.playContent();
      // Preload next items in background
      this.preloadContent(playlist.items.slice(0, Math.min(5, playlist.items.length)));
    }
  }

  private async playContent() {
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

    // New item on the glass — invalidate any pending advance from the prior item
    // and record the advance time for the watchdog (realtime #6).
    const token = ++this.advanceToken;
    this.clearVideoSafetyTimer();
    this.lastAdvanceAt = Date.now();

    // Create content element
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content-item active';


    // Support both 'source' and 'url' field names for compatibility
    let contentSource = currentItem.content?.source || currentItem.content?.url;

    // Read cached image/video content, but only images are downloaded on a miss.
    // Videos should rely on native range streaming unless already cached.
    if (shouldReadCachedContent(currentItem.content?.type)) {
      try {
        const contentId = getEntityId(currentItem.content);
        if (contentId && contentSource) {
          const cached = await window.electronAPI.cacheGet(contentId);
          if (cached.path) {
            contentSource = cached.path;
            console.log('[App] Using cached content:', cached.path);
          } else if (shouldDownloadOnCacheMiss(currentItem.content?.type)) {
            // Background download for future use
            const mimeType = currentItem.content.mimeType || 'image/jpeg';
            window.electronAPI.cacheDownload(contentId, contentSource, mimeType)
              .catch(err => console.warn('[App] Background cache failed:', err));
          }
        } else {
          console.warn('[App] Skipping cache for content without id or source');
        }
      } catch (err) {
        console.warn('[App] Cache check failed:', err);
      }
    }

    switch (currentItem.content?.type) {
      case 'image':
        const img = document.createElement('img');
        img.src = contentSource;
        img.onerror = () => this.handleContentError(currentItem, 'Image load failed');
        contentDiv.appendChild(img);
        break;

      case 'video': {
        const video = document.createElement('video');
        video.src = contentSource;
        video.autoplay = true;
        video.muted = false;
        // Guarded, single-advance handlers (realtime #6).
        video.onerror = () => {
          if (token !== this.advanceToken) return;
          this.clearVideoSafetyTimer();
          this.handleContentError(currentItem, 'Video load failed');
        };
        video.onended = () => this.advance(token);
        // `stalled` / `waiting` are recoverable buffering signals — log only and
        // let the safety timer escalate to a force-advance if playback never
        // resumes. This avoids skipping content on a transient network hiccup.
        video.onstalled = () => console.warn('[App] Video stalled (buffering)');
        video.onwaiting = () => console.warn('[App] Video waiting (buffering)');
        // Re-arm the safety timer with the true clip length once known.
        video.onloadedmetadata = () =>
          this.armVideoSafetyTimer(currentItem, token, video.duration);
        contentDiv.appendChild(video);
        // Arm an initial safety timer immediately in case metadata never loads
        // (a hung load fires neither loadedmetadata nor error).
        this.armVideoSafetyTimer(currentItem, token, undefined);
        break;
      }

      case 'webpage':
      case 'url':
        const iframe = document.createElement('iframe');
        iframe.src = contentSource;
        iframe.allow = 'autoplay';
        contentDiv.appendChild(iframe);
        break;

      case 'html':
      case 'template':
        // Use sandboxed iframe to safely render HTML content
        const htmlIframe = document.createElement('iframe');
        htmlIframe.sandbox.add('allow-scripts');
        htmlIframe.srcdoc = contentSource;
        htmlIframe.style.width = '100%';
        htmlIframe.style.height = '100%';
        htmlIframe.style.border = 'none';
        contentDiv.appendChild(htmlIframe);
        break;

      case 'layout':
        this.renderLayout(currentItem);
        break;

      default:
        console.warn('Unknown content type:', currentItem.content?.type);
    }

    // Clear previous content and add new
    container.innerHTML = '';
    container.appendChild(contentDiv);

    // Record start time for duration tracking
    this.contentStartTime = Date.now();
    const expectedDuration = (currentItem.duration || 10) * 1000;

    // Log initial impression
    window.electronAPI.logImpression({
      contentId: getEntityId(currentItem.content),
      playlistId: getEntityId(this.currentPlaylist),
      timestamp: this.contentStartTime,
    });

    // Schedule next content (if not video)
    if (currentItem.content?.type !== 'video') {
      this.playbackTimer = setTimeout(() => {
        const actualDurationMs = Date.now() - this.contentStartTime;
        const completionPercentage = Math.min(100, Math.round((actualDurationMs / expectedDuration) * 100));

        // Log completion with duration and completion data
        window.electronAPI.logImpression({
          contentId: getEntityId(currentItem.content),
          playlistId: getEntityId(this.currentPlaylist),
          duration: Math.round(actualDurationMs / 1000),
          completionPercentage,
          timestamp: Date.now(),
        });

        this.advance(token);
      }, expectedDuration);
    }
  }

  private nextContent() {
    if (!this.currentPlaylist || !this.currentPlaylist.items) {
      return;
    }

    // Log completion for video content (timer-based content already logs in the timeout)
    const currentItem = this.currentPlaylist.items[this.currentIndex];
    if (currentItem?.content?.type === 'video' && this.contentStartTime > 0) {
      const actualDurationMs = Date.now() - this.contentStartTime;
      const expectedDuration = (currentItem.duration || currentItem.content?.duration || 30) * 1000;
      const completionPercentage = Math.min(100, Math.round((actualDurationMs / expectedDuration) * 100));

      window.electronAPI.logImpression({
        contentId: getEntityId(currentItem.content),
        playlistId: getEntityId(this.currentPlaylist),
        duration: Math.round(actualDurationMs / 1000),
        completionPercentage,
        timestamp: Date.now(),
      });
    }

    this.currentIndex++;

    // Loop back to beginning if at end
    if (this.currentIndex >= this.currentPlaylist.items.length) {
      if (this.currentPlaylist.loopPlaylist) {
        this.currentIndex = 0;
      } else {
        // Non-looping playlist finished — intentionally hold the last frame.
        // Mark ended so the advance watchdog does not thrash it, and clear any
        // pending timers so nothing fires against a stopped playlist (realtime #6).
        this.playlistEnded = true;
        this.clearVideoSafetyTimer();
        if (this.playbackTimer) {
          clearTimeout(this.playbackTimer);
          this.playbackTimer = null;
        }
        return;
      }
    }

    this.playContent();
  }

  private handleContentError(item: any, errorMessage: string) {
    console.error('Content error:', errorMessage, item);

    window.electronAPI.logError({
      contentId: getEntityId(item.content),
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
      case 'qr-overlay-update':
        this.renderQrOverlay(command.config || command.payload?.config);
        break;
      default:
        console.warn('Unknown command:', command);
    }
  }

  private renderQrOverlay(config: any) {
    const overlay = document.getElementById('qr-overlay');
    if (!overlay) return;

    if (!config || !config.enabled) {
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
      return;
    }

    overlay.innerHTML = '';
    overlay.className = config.position || 'bottom-right';
    overlay.style.backgroundColor = config.backgroundColor || '#ffffff';
    overlay.style.opacity = String(config.opacity ?? 1);

    // Set custom margin if provided
    const margin = config.margin || 16;
    if (config.position === 'top-left') { overlay.style.top = margin + 'px'; overlay.style.left = margin + 'px'; }
    else if (config.position === 'top-right') { overlay.style.top = margin + 'px'; overlay.style.right = margin + 'px'; }
    else if (config.position === 'bottom-left') { overlay.style.bottom = margin + 'px'; overlay.style.left = margin + 'px'; }
    else { overlay.style.bottom = margin + 'px'; overlay.style.right = margin + 'px'; }

    // Generate QR code
    const size = config.size || 120;
    try {
      const QRCode = require('qrcode');
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, config.url, {
        width: size,
        margin: 1,
        color: { dark: '#000000', light: config.backgroundColor || '#ffffff' },
      }, (err: any) => {
        if (err) {
          console.error('[App] QR overlay generation failed:', err);
          return;
        }
        overlay.appendChild(canvas);

        // Add label if provided
        if (config.label) {
          const label = document.createElement('div');
          label.className = 'qr-label';
          label.textContent = config.label;
          label.style.maxWidth = size + 'px';
          overlay.appendChild(label);
        }

        overlay.classList.remove('hidden');
      });
    } catch (err) {
      console.error('[App] QR code library not available:', err);
    }
  }

  private renderLayout(content: any) {
    const container = document.getElementById('content-container');
    if (!container) return;

    const metadata = content.metadata || content.content?.metadata;
    if (!metadata || !metadata.zones) {
      console.warn('[App] Layout has no zone data');
      return;
    }

    // Cleanup any previous layout
    this.cleanupLayout();

    // Create CSS Grid container
    const grid = document.createElement('div');
    grid.className = 'layout-grid';
    if (metadata.gridTemplate) {
      grid.style.gridTemplateColumns = metadata.gridTemplate.columns || '1fr';
      grid.style.gridTemplateRows = metadata.gridTemplate.rows || '1fr';
    }
    if (metadata.gap) {
      grid.style.gap = metadata.gap + 'px';
    }
    if (metadata.backgroundColor) {
      grid.style.backgroundColor = metadata.backgroundColor;
    }

    // Create zones
    for (const zone of metadata.zones) {
      const zoneDiv = document.createElement('div');
      zoneDiv.className = 'layout-zone';
      zoneDiv.id = `zone-${zone.id}`;
      zoneDiv.style.gridArea = zone.gridArea;

      // If zone has resolved content/playlist, start playing
      if (zone.resolvedPlaylist && zone.resolvedPlaylist.items?.length > 0) {
        this.createZonePlayer(zone.id, zone.resolvedPlaylist, zoneDiv);
      } else if (zone.resolvedContent) {
        this.renderZoneContent(zone.resolvedContent, zoneDiv);
      }

      grid.appendChild(zoneDiv);
    }

    container.innerHTML = '';
    container.appendChild(grid);
  }

  private createZonePlayer(zoneId: string, playlist: any, container: HTMLElement) {
    this.zoneIndices.set(zoneId, 0);

    const playZoneItem = () => {
      const index = this.zoneIndices.get(zoneId) || 0;
      const items = playlist.items;
      if (!items || items.length === 0) return;

      const item = items[index % items.length];
      if (!item || !item.content) return;

      this.renderZoneContent(item.content, container);

      const duration = (item.duration || item.content.duration || 10) * 1000;
      const timer = setTimeout(() => {
        this.zoneIndices.set(zoneId, (index + 1) % items.length);
        playZoneItem();
      }, duration);
      this.zoneTimers.set(zoneId, timer);
    };

    playZoneItem();
  }

  private renderZoneContent(content: any, container: HTMLElement) {
    container.innerHTML = '';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content-item active';

    const contentSource = content.source || content.url;

    switch (content.type) {
      case 'image':
        const img = document.createElement('img');
        img.src = contentSource;
        contentDiv.appendChild(img);
        break;
      case 'video':
        const video = document.createElement('video');
        video.src = contentSource;
        video.autoplay = true;
        video.muted = true; // Mute zone videos to avoid audio conflicts
        video.loop = true;
        contentDiv.appendChild(video);
        break;
      case 'html':
      case 'template':
        const iframe = document.createElement('iframe');
        iframe.sandbox.add('allow-scripts');
        iframe.srcdoc = contentSource;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        contentDiv.appendChild(iframe);
        break;
      case 'url':
      case 'webpage':
        const urlIframe = document.createElement('iframe');
        urlIframe.src = contentSource;
        urlIframe.style.width = '100%';
        urlIframe.style.height = '100%';
        urlIframe.style.border = 'none';
        contentDiv.appendChild(urlIframe);
        break;
    }

    container.appendChild(contentDiv);
  }

  private cleanupLayout() {
    // Stop all zone timers
    for (const timer of this.zoneTimers.values()) {
      clearTimeout(timer);
    }
    this.zoneTimers.clear();
    this.zoneIndices.clear();
  }

  private async preloadContent(items: any[]) {
    for (const item of items) {
      if (!item.content) continue;
      const type = item.content.type;
      if (!shouldPreloadContentType(type)) continue;

      const contentUrl = item.content.source || item.content.url;
      const contentId = getEntityId(item.content);
      const mimeType = item.content.mimeType || 'image/jpeg';

      try {
        if (!contentId || !contentUrl) {
          console.warn('[App] Skipping preload for content without id or source');
          continue;
        }

        const cached = await window.electronAPI.cacheGet(contentId);
        if (!cached.path) {
          console.log('[App] Preloading content:', contentId);
          await window.electronAPI.cacheDownload(contentId, contentUrl, mimeType);
        }
      } catch (err) {
        console.warn('[App] Preload failed for', contentId, err);
      }
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

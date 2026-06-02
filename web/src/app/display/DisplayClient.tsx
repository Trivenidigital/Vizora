'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DisplayState, Playlist, DeviceCommand, DeviceConfig, PushContent } from './lib/types';
import { usePairing, clearCredentials } from './hooks/usePairing';
import { useDeviceConnection } from './hooks/useDeviceConnection';
import { usePlaylistPlayer } from './hooks/usePlaylistPlayer';
import { useFullscreen } from './hooks/useFullscreen';
import { useBrowserCache } from './hooks/useBrowserCache';
import { PairingScreen } from './components/PairingScreen';
import { ContentScreen } from './components/ContentScreen';
import { StatusBar } from './components/StatusBar';
import { FullscreenButton } from './components/FullscreenButton';
import { redactSensitiveUrl } from './lib/redact-sensitive-url';

function authenticateDisplayContentUrl(url: string, token?: string): string {
  if (!token || !url) return url;
  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(url, baseOrigin);
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
      : baseOrigin;
    const isDeviceContentPath =
      /^\/(?:api\/v1\/)?device-content\/[^/]+\/file$/.test(parsed.pathname);

    if (!new Set([baseOrigin, apiOrigin]).has(parsed.origin) || !isDeviceContentPath) {
      return url;
    }

    parsed.searchParams.set('token', token);
    if (/^[a-z][a-z\d+\-.]*:/i.test(url)) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function DisplayClient() {
  const [state, setState] = useState<DisplayState>('LOADING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impressionRef = useRef<((...args: any[]) => void) | null>(null);

  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const { getCachedUrl, preloadItems, clearCache } = useBrowserCache();

  const {
    pairingCode,
    qrCode,
    credentials,
    isPairing,
    error: pairingError,
    requestPairingCode,
    resetPairing,
    updateDeviceToken,
  } = usePairing();

  // Stable callback that delegates to the connection's emitImpression once available
  const onImpression = useCallback((data: {
    contentId: string;
    playlistId?: string;
    duration?: number;
    completionPercentage?: number;
    timestamp: number;
  }) => {
    impressionRef.current?.(data);
  }, []);

  const player = usePlaylistPlayer({ onImpression });

  const handlePlaylistUpdate = useCallback((playlist: Playlist) => {
    player.updatePlaylist(playlist);
    setState('PLAYING');

    // Preload image items only. Videos should rely on native range streaming;
    // Cache API preloads would fetch the full file before playback.
    const urls = playlist.items
      .slice(0, 5)
      .filter((item) => item.content?.type === 'image')
      .map((item) => authenticateDisplayContentUrl(item.content!.url, credentials?.deviceToken))
      .filter(Boolean);
    if (urls.length > 0) preloadItems(urls);
  }, [credentials?.deviceToken, player, preloadItems]);

  const handleCommand = useCallback((command: DeviceCommand) => {
    switch (command.type) {
      case 'reload':
        window.location.reload();
        break;
      case 'clear_cache':
        void clearCache().finally(() => window.location.reload());
        break;
      case 'unpair':
        clearCredentials();
        window.location.reload();
        break;
      default:
        console.warn('[Vizora Display] Unknown command:', command.type);
    }
  }, [clearCache]);

  const handleConfig = useCallback((_config: DeviceConfig) => {
    // Config received (heartbeat interval, cache settings, etc.)
  }, []);

  const handleContentPush = useCallback((content: PushContent, duration: number) => {
    player.pushContent(content, duration);
    setState('PLAYING');
  }, [player]);

  const handleUnauthorized = useCallback(() => {
    resetPairing();
    setState('PAIRING');
  }, [resetPairing]);

  const connection = useDeviceConnection({
    credentials: credentials!,
    onPlaylistUpdate: handlePlaylistUpdate,
    onCommand: handleCommand,
    onConfig: handleConfig,
    onContentPush: handleContentPush,
    onUnauthorized: handleUnauthorized,
    onTokenRefresh: updateDeviceToken,
    currentContentId: player.currentContentId,
  });

  // Wire up impression emitter once connection is available
  impressionRef.current = connection.emitImpression;

  // State machine transitions
  useEffect(() => {
    if (credentials) {
      if (connection.status === 'connected') {
        setState('PLAYING');
      } else if (connection.status === 'connecting') {
        setState('CONNECTING');
      } else if (connection.status === 'error') {
        setState('ERROR');
        setErrorMessage('Connection failed. Retrying...');
      }
    } else {
      setState('PAIRING');
    }
  }, [credentials, connection.status]);

  // Screen Wake Lock
  useEffect(() => {
    const acquireWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          // Wake lock denied
        }
      }
    };

    acquireWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLockRef.current?.release();
    };
  }, []);

  const handleContentError = useCallback((contentId: string, errorType: string, errMsg: string) => {
    connection.emitContentError({
      contentId,
      errorType,
      errorMessage: redactSensitiveUrl(errMsg),
      timestamp: Date.now(),
    });
  }, [connection]);

  // Render based on state
  if (state === 'LOADING') {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (state === 'PAIRING' || !credentials) {
    return (
      <PairingScreen
        code={pairingCode}
        qrCode={qrCode}
        error={pairingError}
        isPairing={isPairing}
        onRequestCode={requestPairingCode}
      />
    );
  }

  if (state === 'ERROR') {
    return (
      <div style={styles.errorScreen}>
        <div style={styles.errorContent}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={styles.errorText}>{errorMessage || 'An error occurred'}</p>
          <p style={styles.errorSubtext}>Attempting to reconnect...</p>
        </div>
      </div>
    );
  }

  // CONNECTING or PLAYING
  return (
    <>
      <ContentScreen
        currentItem={player.currentItem}
        temporaryContent={player.temporaryContent}
        onVideoEnded={player.handleVideoEnded}
        onContentError={handleContentError}
        deviceToken={credentials.deviceToken}
        getCachedUrl={getCachedUrl}
      />
      <StatusBar status={connection.status} />
      <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    background: '#061A21',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid rgba(0,229,160,0.2)',
    borderTopColor: '#00E5A0',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    background: '#061A21',
  },
  errorContent: {
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: '1.2rem',
    fontWeight: 500,
    margin: 0,
  },
  errorSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.9rem',
  },
};

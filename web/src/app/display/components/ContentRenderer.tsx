'use client';

import { useEffect, useRef, useState } from 'react';
import type { ContentType } from '../lib/types';
import { LayoutRenderer } from './LayoutRenderer';
import type { LayoutMetadata } from '../lib/types';
import { redactSensitiveUrl } from '../lib/redact-sensitive-url';

interface ContentRendererProps {
  type: ContentType;
  url: string;
  name?: string;
  metadata?: LayoutMetadata;
  authenticateUrl?: (url: string) => string;
  getCachedUrl?: (url: string) => Promise<string | null>;
  onEnded?: () => void;
  onError?: (errorType: string, errorMessage: string) => void;
}

/**
 * Resolve protected media to an object URL. The browser display cache is
 * checked first; protected images keep the old network blob fallback.
 */
function useMediaObjectUrl(
  url: string,
  enabled: boolean,
  fetchOnCacheMiss: boolean,
  getCachedUrl?: (url: string) => Promise<string | null>,
) {
  const [state, setState] = useState<{
    url: string;
    objectUrl: string | null;
    error: string | null;
    cacheDone: boolean;
    fetchPending: boolean;
  }>({
    url: '',
    objectUrl: null,
    error: null,
    cacheDone: false,
    fetchPending: false,
  });

  useEffect(() => {
    if (!enabled || !url) {
      setState({
        url,
        objectUrl: null,
        error: null,
        cacheDone: true,
        fetchPending: false,
      });
      return;
    }

    let revoked = false;
    let currentObjectUrl: string | null = null;
    const controller = new AbortController();

    setState({
      url,
      objectUrl: null,
      error: null,
      cacheDone: !getCachedUrl,
      fetchPending: !getCachedUrl && fetchOnCacheMiss,
    });

    const loadObjectUrl = async () => {
      const cachedUrl = getCachedUrl
        ? await Promise.resolve(getCachedUrl(url)).catch(() => null)
        : null;
      if (revoked) {
        if (cachedUrl && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(cachedUrl);
        }
        return;
      }
      if (cachedUrl) {
        currentObjectUrl = cachedUrl;
        setState({
          url,
          objectUrl: cachedUrl,
          error: null,
          cacheDone: true,
          fetchPending: false,
        });
        return;
      }
      if (!fetchOnCacheMiss) {
        setState({
          url,
          objectUrl: null,
          error: null,
          cacheDone: true,
          fetchPending: false,
        });
        return;
      }

      setState({
        url,
        objectUrl: null,
        error: null,
        cacheDone: true,
        fetchPending: true,
      });

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (revoked) return;
        const objectUrl = URL.createObjectURL(blob);
        currentObjectUrl = objectUrl;
        setState({
          url,
          objectUrl,
          error: null,
          cacheDone: true,
          fetchPending: false,
        });
      } catch (err) {
        if (revoked) return;
        const error = err instanceof Error ? err.message : 'fetch failed';
        setState({
          url,
          objectUrl: null,
          error,
          cacheDone: true,
          fetchPending: false,
        });
      }
    };

    void loadObjectUrl();

    return () => {
      revoked = true;
      controller.abort();
      if (currentObjectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [url, enabled, fetchOnCacheMiss, getCachedUrl]);

  const stateMatchesUrl = state.url === url;
  const cachePending = enabled && Boolean(getCachedUrl) && (!stateMatchesUrl || !state.cacheDone);
  const fetchPending = enabled && fetchOnCacheMiss && (!stateMatchesUrl || state.fetchPending);

  return {
    objectUrl: stateMatchesUrl ? state.objectUrl : null,
    error: stateMatchesUrl ? state.error : null,
    pending: cachePending || fetchPending,
  };
}

function shouldUseDeviceContentObjectUrl(url: string): boolean {
  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(url, baseOrigin);
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
      : baseOrigin;
    const isDeviceContentPath =
      /^\/(?:api\/v1\/)?device-content\/[^/]+\/file$/.test(parsed.pathname);

    return new Set([baseOrigin, apiOrigin]).has(parsed.origin) && isDeviceContentPath;
  } catch {
    return false;
  }
}

export function ContentRenderer({
  type,
  url,
  name,
  metadata,
  authenticateUrl,
  getCachedUrl,
  onEnded,
  onError,
}: ContentRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const renderedUrl = authenticateUrl ? authenticateUrl(url) : url;
  const safeRenderedUrl = redactSensitiveUrl(renderedUrl);
  const isImage = type === 'image';
  const isVideo = type === 'video';
  const shouldUseObjectUrl = (isImage || isVideo) && shouldUseDeviceContentObjectUrl(renderedUrl);
  const {
    objectUrl: mediaObjectUrl,
    error: fetchError,
    pending: mediaPending,
  } = useMediaObjectUrl(renderedUrl, shouldUseObjectUrl, isImage, getCachedUrl);

  // Attempt autoplay when video mounts
  useEffect(() => {
    if (type === 'video' && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked, try muted
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }, [type, renderedUrl, mediaObjectUrl]);

  // Report fetch errors for images
  useEffect(() => {
    if (isImage && fetchError) {
      onError?.('load_error', `Image fetch failed: ${fetchError} (url: ${safeRenderedUrl})`);
    }
  }, [isImage, fetchError, safeRenderedUrl, onError]);

  switch (type) {
    case 'image':
      if (!shouldUseObjectUrl) {
        return (
          <img
            src={renderedUrl}
            alt={name || 'Display content'}
            style={styles.image}
            onError={() => {
              onError?.('load_error', `Image failed to load: ${safeRenderedUrl}`);
              onEnded?.();
            }}
          />
        );
      }
      if (fetchError) {
        return (
          <div style={{ ...styles.image, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', fontSize: '14px', padding: '20px', textAlign: 'center' as const }}>
            Image load error: {fetchError}<br />URL: {safeRenderedUrl?.substring(0, 80)}...
          </div>
        );
      }
      if (!mediaObjectUrl || mediaPending) {
        return (
          <div style={{ ...styles.image, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,229,160,0.2)', borderTopColor: '#00E5A0', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        );
      }
      return (
        <img
          src={mediaObjectUrl}
          alt={name || 'Display content'}
          style={styles.image}
          onError={() => {
            onError?.('load_error', `Image blob failed to render`);
            onEnded?.();
          }}
        />
      );

    case 'video':
      if (shouldUseObjectUrl && getCachedUrl && mediaPending && !mediaObjectUrl) {
        return (
          <div style={{ ...styles.video, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,229,160,0.2)', borderTopColor: '#00E5A0', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        );
      }
      return (
        <video
          ref={videoRef}
          src={mediaObjectUrl || renderedUrl}
          autoPlay
          muted
          playsInline
          style={styles.video}
          onEnded={onEnded}
          onError={() => {
            onError?.('load_error', `Video failed to load: ${safeRenderedUrl}`);
            onEnded?.();
          }}
        />
      );

    case 'url':
    case 'webpage':
      return (
        <iframe
          src={renderedUrl}
          style={styles.iframe}
          allow="autoplay; fullscreen"
          title={name || 'Web content'}
          onError={() => {
            onError?.('load_error', `Webpage failed to load: ${safeRenderedUrl}`);
            onEnded?.();
          }}
        />
      );

    case 'html':
    case 'template':
      return (
        <iframe
          srcDoc={renderedUrl}
          sandbox="allow-scripts"
          style={styles.iframe}
          title={name || 'HTML content'}
        />
      );

    case 'layout':
      if (metadata) {
        return (
          <LayoutRenderer
            metadata={metadata}
            authenticateUrl={authenticateUrl}
            getCachedUrl={getCachedUrl}
            onError={onError}
          />
        );
      }
      return null;

    default:
      onEnded?.();
      return null;
  }
}

const styles: Record<string, React.CSSProperties> = {
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#000',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
  },
};

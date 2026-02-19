'use client';

import { useEffect, useRef, useState } from 'react';
import type { ContentType } from '../lib/types';
import { LayoutRenderer } from './LayoutRenderer';
import type { LayoutMetadata } from '../lib/types';

interface ContentRendererProps {
  type: ContentType;
  url: string;
  name?: string;
  metadata?: LayoutMetadata;
  onEnded?: () => void;
  onError?: (errorType: string, errorMessage: string) => void;
}

/**
 * Fetch an image URL via JavaScript and return a blob URL.
 * This bypasses browser caching/header issues with <img src>.
 */
function useBlobUrl(url: string, enabled: boolean) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !url) return;

    let revoked = false;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setError(null);
      })
      .catch((err) => {
        if (revoked) return;
        setError(err.message || 'fetch failed');
      });

    return () => {
      revoked = true;
      controller.abort();
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [url, enabled]);

  return { blobUrl, error };
}

export function ContentRenderer({ type, url, name, metadata, onEnded, onError }: ContentRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isImage = type === 'image';
  const { blobUrl, error: fetchError } = useBlobUrl(url, isImage);

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
  }, [type, url]);

  // Report fetch errors for images
  useEffect(() => {
    if (isImage && fetchError) {
      onError?.('load_error', `Image fetch failed: ${fetchError} (url: ${url})`);
    }
  }, [isImage, fetchError, url, onError]);

  switch (type) {
    case 'image':
      if (fetchError) {
        return (
          <div style={{ ...styles.image, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', fontSize: '14px', padding: '20px', textAlign: 'center' as const }}>
            Image load error: {fetchError}<br />URL: {url?.substring(0, 80)}...
          </div>
        );
      }
      if (!blobUrl) {
        return (
          <div style={{ ...styles.image, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,229,160,0.2)', borderTopColor: '#00E5A0', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        );
      }
      return (
        <img
          src={blobUrl}
          alt={name || 'Display content'}
          style={styles.image}
          onError={() => {
            onError?.('load_error', `Image blob failed to render`);
            onEnded?.();
          }}
        />
      );

    case 'video':
      return (
        <video
          ref={videoRef}
          src={url}
          autoPlay
          muted
          playsInline
          style={styles.video}
          onEnded={onEnded}
          onError={() => {
            onError?.('load_error', `Video failed to load: ${url}`);
            onEnded?.();
          }}
        />
      );

    case 'url':
    case 'webpage':
      return (
        <iframe
          src={url}
          style={styles.iframe}
          allow="autoplay; fullscreen"
          title={name || 'Web content'}
          onError={() => {
            onError?.('load_error', `Webpage failed to load: ${url}`);
            onEnded?.();
          }}
        />
      );

    case 'html':
    case 'template':
      return (
        <iframe
          srcDoc={url}
          sandbox="allow-scripts"
          style={styles.iframe}
          title={name || 'HTML content'}
        />
      );

    case 'layout':
      if (metadata) {
        return <LayoutRenderer metadata={metadata} onError={onError} />;
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

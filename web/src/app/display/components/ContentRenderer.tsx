'use client';

import { useEffect, useRef } from 'react';
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

export function ContentRenderer({ type, url, name, metadata, onEnded, onError }: ContentRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

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

  switch (type) {
    case 'image':
      return (
        <img
          src={url}
          alt={name || 'Display content'}
          style={styles.image}
          onError={() => {
            onError?.('load_error', `Image failed to load: ${url}`);
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

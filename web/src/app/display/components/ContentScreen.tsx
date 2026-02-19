'use client';

import type { PlaylistItem, PushContent } from '../lib/types';
import { ContentRenderer } from './ContentRenderer';

interface ContentScreenProps {
  currentItem: PlaylistItem | null;
  temporaryContent: PushContent | null;
  onVideoEnded: () => void;
  onContentError?: (contentId: string, errorType: string, errorMessage: string) => void;
  deviceToken?: string;
}

/**
 * Append device JWT token to device-content API URLs for authentication.
 * img/video src attributes can't send Authorization headers, so we use query params.
 */
function authenticateUrl(url: string, token?: string): string {
  if (!token || !url) return url;
  if (url.includes('/device-content/') && url.includes('/file')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }
  return url;
}

export function ContentScreen({
  currentItem,
  temporaryContent,
  onVideoEnded,
  onContentError,
  deviceToken,
}: ContentScreenProps) {
  // Debug: log what we're rendering (temporary)
  if (temporaryContent) {
    console.log('[Vizora Debug] temporaryContent:', JSON.stringify(temporaryContent));
    console.log('[Vizora Debug] authenticated URL:', authenticateUrl(temporaryContent.url, deviceToken));
  }
  if (currentItem?.content) {
    console.log('[Vizora Debug] currentItem.content:', JSON.stringify(currentItem.content));
    console.log('[Vizora Debug] authenticated URL:', authenticateUrl(currentItem.content.url, deviceToken));
  }

  // Temporary pushed content takes priority
  if (temporaryContent) {
    const resolvedUrl = authenticateUrl(temporaryContent.url, deviceToken);
    return (
      <div style={styles.container}>
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', color: '#0f0', fontSize: '12px', padding: '8px', maxWidth: '100vw', wordBreak: 'break-all' as const }}>
          DEBUG: type={temporaryContent.type} | url={resolvedUrl}
        </div>
        <ContentRenderer
          type={temporaryContent.type}
          url={resolvedUrl}
          name={temporaryContent.name}
          onEnded={onVideoEnded}
          onError={(errType, errMsg) => onContentError?.(temporaryContent.id, errType, errMsg)}
        />
      </div>
    );
  }

  // Regular playlist content
  if (currentItem?.content) {
    return (
      <div style={styles.container}>
        <ContentRenderer
          type={currentItem.content.type}
          url={authenticateUrl(currentItem.content.url, deviceToken)}
          name={currentItem.content.name}
          metadata={currentItem.content.metadata}
          onEnded={onVideoEnded}
          onError={(errType, errMsg) => onContentError?.(currentItem.content!.id, errType, errMsg)}
        />
      </div>
    );
  }

  // Waiting for content
  return (
    <div style={styles.waiting}>
      <div style={styles.waitingContent}>
        <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="rgba(0,229,160,0.15)" />
          <path d="M14 24L22 32L34 16" stroke="#00E5A0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 style={styles.waitingTitle}>Display Connected</h2>
        <p style={styles.waitingText}>
          Waiting for content. Assign a playlist to this display from the dashboard.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  waiting: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    background: 'linear-gradient(135deg, #061A21 0%, #0a2a35 50%, #061A21 100%)',
  },
  waitingContent: {
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
  },
  waitingTitle: {
    color: '#fff',
    fontSize: '1.5rem',
    fontWeight: 600,
    margin: 0,
  },
  waitingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '1rem',
    maxWidth: '400px',
    lineHeight: 1.5,
  },
};

'use client';

import type { PlaylistItem, PushContent } from '../lib/types';
import { ContentRenderer } from './ContentRenderer';

interface ContentScreenProps {
  currentItem: PlaylistItem | null;
  temporaryContent: PushContent | null;
  onVideoEnded: () => void;
  onContentError?: (contentId: string, errorType: string, errorMessage: string) => void;
  deviceToken?: string;
  getCachedUrl?: (url: string) => Promise<string | null>;
}

/**
 * Append device JWT token to device-content API URLs for authentication.
 * img/video src attributes can't send Authorization headers, so we use query params.
 */
function authenticateUrl(url: string, token?: string): string {
  if (!token || !url) return url;
  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(url, baseOrigin);
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
      : baseOrigin;
    const trustedOrigins = new Set([baseOrigin, apiOrigin]);
    const isDeviceContentPath =
      /^\/(?:api\/v1\/)?device-content\/[^/]+\/file$/.test(parsed.pathname);

    if (!trustedOrigins.has(parsed.origin) || !isDeviceContentPath) {
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

export function ContentScreen({
  currentItem,
  temporaryContent,
  onVideoEnded,
  onContentError,
  deviceToken,
  getCachedUrl,
}: ContentScreenProps) {
  // Temporary pushed content takes priority
  if (temporaryContent) {
    return (
      <div style={styles.container}>
        <ContentRenderer
          type={temporaryContent.type}
          url={authenticateUrl(temporaryContent.url, deviceToken)}
          name={temporaryContent.name}
          authenticateUrl={(url) => authenticateUrl(url, deviceToken)}
          getCachedUrl={getCachedUrl}
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
          authenticateUrl={(url) => authenticateUrl(url, deviceToken)}
          getCachedUrl={getCachedUrl}
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

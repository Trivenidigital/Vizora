'use client';

import type { PlaylistItem, PushContent } from '../lib/types';
import { ContentRenderer } from './ContentRenderer';

interface ContentScreenProps {
  currentItem: PlaylistItem | null;
  temporaryContent: PushContent | null;
  onVideoEnded: () => void;
  onContentError?: (contentId: string, errorType: string, errorMessage: string) => void;
}

export function ContentScreen({
  currentItem,
  temporaryContent,
  onVideoEnded,
  onContentError,
}: ContentScreenProps) {
  // Temporary pushed content takes priority
  if (temporaryContent) {
    return (
      <div style={styles.container}>
        <ContentRenderer
          type={temporaryContent.type}
          url={temporaryContent.url}
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
          url={currentItem.content.url}
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

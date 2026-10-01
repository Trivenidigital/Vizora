'use client';

interface FullscreenButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
}

export function FullscreenButton({ isFullscreen, onToggle }: FullscreenButtonProps) {
  return (
    <button
      onClick={onToggle}
      style={styles.button}
      title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      {isFullscreen ? (
        // Minimize icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 14 10 14 10 20" />
          <polyline points="20 10 14 10 14 4" />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      ) : (
        // Maximize icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      )}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    position: 'fixed',
    bottom: '12px',
    right: '12px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    /*
     * Same call as `StatusBar`: opaque `--viewport-surface` rather than a black
     * scrim, because this control floats over customer media and a translucent
     * fill leaves its glyph with no computable ground. The icon is
     * `currentColor`, so the two SVGs inherit the 13.33:1 ink below.
     * `backdropFilter` is gone for the same reason it went there — inert behind
     * an opaque fill.
     */
    background: 'var(--viewport-surface)',
    color: 'var(--viewport-ink)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    zIndex: 1000,
    transition: 'background 0.2s',
  },
};

'use client';

import { useState, useEffect } from 'react';

interface StatusBarProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export function StatusBar({ status }: StatusBarProps) {
  const [visible, setVisible] = useState(true);

  // Auto-hide after 3 seconds when connected
  useEffect(() => {
    setVisible(true);
    if (status === 'connected') {
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  if (!visible) return null;

  /*
   * SEMANTIC, and on the `-light` step of each family rather than the `-ink`.
   *
   * The inks are light-SUBSTRATE values: on the pill fill they measure
   * `--success-ink` 2.15:1, `--warning-ink` 2.16:1, `--error-ink` 2.37:1 — all
   * invisible. The `-light` step is the same hue family one stop brighter, so
   * nothing is invented. Computed on `--viewport-surface`, the pill's own fill:
   *
   *   connected     --success-light      6.73:1
   *   connecting    --warning-light      9.19:1
   *   error         --error-light        4.08:1
   *   disconnected  --viewport-ink-muted 6.58:1
   *
   * These are 8px dots, so the bar is the 3:1 WCAG 1.4.11 asks of a meaningful
   * graphic, not 4.5:1 — and `--error-light` clears that while still reading as
   * RED at 8px, which `--error-lighter` (10.61:1, but a pale pink) does not.
   * Hue is not carrying the meaning in any case: the label beside the dot says
   * the state in words, so the readout survives a greyscale screenshot.
   */
  const colors: Record<string, string> = {
    connected: 'var(--success-light)',
    connecting: 'var(--warning-light)',
    disconnected: 'var(--viewport-ink-muted)',
    error: 'var(--error-light)',
  };

  const labels: Record<string, string> = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  };

  return (
    <div style={styles.bar}>
      <div style={{ ...styles.dot, backgroundColor: colors[status] }} />
      <span style={styles.label}>{labels[status]}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    top: '12px',
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    /*
     * OPAQUE `--viewport-surface`, where this was a 70% black scrim.
     *
     * The pill floats over CUSTOMER MEDIA, so under a scrim its ground is
     * whatever the screen happens to be playing — and no ratio can be computed
     * against an unknown ground. Worst case was real, not theoretical: 70% black
     * over white media composites to a flat 30% grey, where the error dot would
     * have been 2.25:1, below the 3:1 a status graphic needs. A status readout that
     * is only legible over some content is not a status readout.
     *
     * The cost is ~90x24px of occluded media in one corner, and only while
     * NOT connected: the bar auto-hides three seconds after it goes green,
     * which is exactly when there is nothing to report. `backdropFilter` went
     * with the translucency — a blur behind an opaque fill renders nothing and
     * still costs a compositing layer.
     */
    background: 'var(--viewport-surface)',
    borderRadius: '20px',
    zIndex: 1000,
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  label: {
    /* 13.33:1 on the pill fill. */
    color: 'var(--viewport-ink)',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
};

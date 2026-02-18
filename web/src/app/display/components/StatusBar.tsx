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
  }, [status]);

  if (!visible) return null;

  const colors: Record<string, string> = {
    connected: '#00E5A0',
    connecting: '#FFB800',
    disconnected: '#888',
    error: '#ff6b6b',
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
    background: 'rgba(0,0,0,0.7)',
    borderRadius: '20px',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  label: {
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
};

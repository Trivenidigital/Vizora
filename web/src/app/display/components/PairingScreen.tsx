'use client';

import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PairingScreenProps {
  code: string | null;
  qrCode: string | null;
  error: string | null;
  isPairing: boolean;
  onRequestCode: () => void;
}

export function PairingScreen({ code, qrCode, error, isPairing, onRequestCode }: PairingScreenProps) {
  // Request code on mount
  useEffect(() => {
    if (!code && !isPairing && !error) {
      onRequestCode();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dashboardUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/devices/pair`
    : '';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#00E5A0" />
            <path d="M14 24L22 32L34 16" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 style={styles.title}>Vizora Display</h1>
        </div>

        {error && (
          <div style={styles.error}>
            <p>{error}</p>
            <button onClick={onRequestCode} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        )}

        {!code && !error && (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Requesting pairing code...</p>
          </div>
        )}

        {code && (
          <>
            <p style={styles.instruction}>
              Enter this code in the Vizora dashboard to pair this display
            </p>

            <div style={styles.codeContainer}>
              {code.split('').map((char, i) => (
                <span key={i} style={styles.codeChar}>{char}</span>
              ))}
            </div>

            <div style={styles.qrSection}>
              {qrCode ? (
                <img src={qrCode} alt="QR Code" style={styles.qrImg} />
              ) : dashboardUrl ? (
                <QRCodeSVG
                  value={`${dashboardUrl}?code=${code}`}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              ) : null}
              <p style={styles.qrHint}>
                Or scan QR code to pair from your phone
              </p>
            </div>

            <p style={styles.footer}>
              Go to <strong>Dashboard → Devices → Pair</strong> and enter the code above
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #061A21 0%, #0a2a35 50%, #061A21 100%)',
    padding: '2rem',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '24px',
    padding: '3rem',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center' as const,
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  logo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  },
  title: {
    color: '#ffffff',
    fontSize: '1.5rem',
    fontWeight: 600,
    margin: 0,
  },
  instruction: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '1rem',
    lineHeight: 1.5,
    marginBottom: '2rem',
  },
  codeContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '2rem',
  },
  codeChar: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '68px',
    background: 'rgba(0,229,160,0.15)',
    border: '2px solid #00E5A0',
    borderRadius: '12px',
    color: '#00E5A0',
    fontSize: '2rem',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '2rem',
    padding: '1.5rem',
    background: '#ffffff',
    borderRadius: '16px',
    width: 'fit-content',
    margin: '0 auto 2rem auto',
  },
  qrImg: {
    width: '180px',
    height: '180px',
  },
  qrHint: {
    color: '#666',
    fontSize: '0.8rem',
    margin: 0,
  },
  footer: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.85rem',
    lineHeight: 1.5,
  },
  error: {
    color: '#ff6b6b',
    marginBottom: '1rem',
  },
  retryBtn: {
    marginTop: '0.5rem',
    padding: '0.5rem 1.5rem',
    background: '#00E5A0',
    color: '#061A21',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    padding: '2rem 0',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(0,229,160,0.2)',
    borderTopColor: '#00E5A0',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.95rem',
  },
};

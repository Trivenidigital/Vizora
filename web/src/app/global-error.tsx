'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#061A21', color: '#E8F0F2' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '28rem', width: '100%', padding: '2rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#x26A0;</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
              Something went wrong!
            </h2>
            <p style={{ color: '#94A3B8', marginBottom: '1.5rem' }}>
              We apologize for the inconvenience. An unexpected error occurred.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: '#00E5A0',
                color: '#061A21',
                padding: '0.5rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

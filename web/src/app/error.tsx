'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/theme/icons';

/**
 * Root-level error boundary. Same stale-bundle detection as
 * DashboardSectionError but uses a full-screen layout since nothing
 * above it rendered successfully.
 */
function isStaleBundleError(error: Error): boolean {
  const msg = error?.message || '';
  return (
    msg.includes('Failed to find Server Action') ||
    msg.includes('older or newer deployment') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isReloading, setIsReloading] = useState(false);
  const stale = isStaleBundleError(error);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Application error:', error);
    }
    // Auto-reload on stale bundle errors after a brief delay so the user
    // sees the "updating" message
    if (stale && typeof window !== 'undefined') {
      const timer = setTimeout(() => window.location.reload(), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, stale]);

  const handleHardReload = () => {
    setIsReloading(true);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (stale) {
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="max-w-md w-full bg-[var(--surface)] rounded-lg shadow-lg border border-[var(--border)] p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="animate-spin w-10 h-10 border-4 border-[var(--border)] border-t-[#00E5A0] rounded-full" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">
            Loading the latest version…
          </h2>
          <p className="text-[var(--foreground-secondary)] mb-6">
            A new version of Vizora is available. Refreshing your browser to load it.
          </p>
          <button
            onClick={handleHardReload}
            disabled={isReloading}
            className="eh-btn-neon px-6 py-2 rounded-lg disabled:opacity-50"
          >
            {isReloading ? 'Refreshing…' : 'Refresh Now'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-lg shadow-lg border border-[var(--border)] p-8 text-center">
        <Icon name="error" size="6xl" className="mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">
          Something went wrong!
        </h2>
        <p className="text-[var(--foreground-secondary)] mb-6">
          We apologize for the inconvenience. An unexpected error occurred.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
            <p className="text-sm text-red-500 font-mono break-words">
              {error.message}
            </p>
          </div>
        )}
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="eh-btn-neon px-6 py-2 rounded-lg"
          >
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="bg-[var(--surface-hover)] text-[var(--foreground-secondary)] px-6 py-2 rounded-lg hover:bg-[var(--border)] transition font-semibold"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

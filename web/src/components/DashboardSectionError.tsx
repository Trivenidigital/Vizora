'use client';

import { useEffect, useState } from 'react';

/**
 * Shared error boundary UI for dashboard sections.
 *
 * Detects common transient errors (stale Next.js bundle, server action
 * mismatch, network glitches) and presents a user-friendly recovery path.
 *
 * For stale-bundle errors specifically, a hard reload clears the cache
 * instead of just retrying (which would hit the same broken action ID).
 */
export interface DashboardSectionErrorProps {
  /** What failed — e.g. "Analytics", "Content Library" */
  section: string;
  /** The actual error from Next.js error boundary */
  error: Error & { digest?: string };
  /** Next.js-provided reset function (re-renders the boundary) */
  reset: () => void;
}

/**
 * Heuristic: is this error a stale browser bundle trying to call a
 * Server Action that no longer exists in the current deployment?
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

/**
 * Heuristic: is this a transient network error?
 */
function isNetworkError(error: Error): boolean {
  const msg = error?.message || '';
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('ERR_NETWORK') ||
    msg.includes('ERR_INTERNET_DISCONNECTED')
  );
}

export default function DashboardSectionError({
  section,
  error,
  reset,
}: DashboardSectionErrorProps) {
  const [isReloading, setIsReloading] = useState(false);
  const stale = isStaleBundleError(error);
  const network = isNetworkError(error);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(`${section} section error:`, error);
    }
    // Auto-recover from stale bundle errors — hard reload clears cached chunks
    if (stale) {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, section, stale]);

  const handleHardReload = () => {
    setIsReloading(true);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Stale bundle — show a soft "updating" message while we auto-reload
  if (stale) {
    return (
      <div role="alert" className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full bg-[var(--surface)] rounded-lg border border-[var(--border)] p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[#00E5A0] rounded-full" />
          </div>
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
            Loading the latest version…
          </h2>
          <p className="text-[var(--foreground-secondary)] mb-6 text-sm">
            A new version of Vizora is available. Refreshing your browser to load it.
          </p>
          <button
            onClick={handleHardReload}
            disabled={isReloading}
            className="bg-[#00E5A0] text-[#061A21] px-6 py-2 rounded-lg hover:bg-[#00CC8E] transition font-semibold text-sm disabled:opacity-50"
          >
            {isReloading ? 'Refreshing…' : 'Refresh Now'}
          </button>
        </div>
      </div>
    );
  }

  // Network error — ask to check connection and retry
  if (network) {
    return (
      <div role="alert" className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full bg-[var(--surface)] rounded-lg border border-[var(--border)] p-8 text-center">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
            Connection Issue
          </h2>
          <p className="text-[var(--foreground-secondary)] mb-6 text-sm">
            We couldn't reach the Vizora servers. Check your internet connection and try again.
          </p>
          <button
            onClick={reset}
            className="bg-[#00E5A0] text-[#061A21] px-6 py-2 rounded-lg hover:bg-[#00CC8E] transition font-semibold text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Generic error — show section-specific message
  return (
    <div role="alert" className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-lg border border-[var(--border)] p-8 text-center">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
          {section} Error
        </h2>
        <p className="text-[var(--foreground-secondary)] mb-6 text-sm">
          Something went wrong loading this section. Please try again.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-left">
            <p className="text-xs text-red-500 font-mono break-words">{error.message}</p>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-[#00E5A0] text-[#061A21] px-6 py-2 rounded-lg hover:bg-[#00CC8E] transition font-semibold text-sm"
          >
            Try Again
          </button>
          <button
            onClick={handleHardReload}
            className="bg-[var(--background-tertiary)] text-[var(--foreground)] px-6 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition font-semibold text-sm"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}

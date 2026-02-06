'use client';

import { useEffect } from 'react';
import { Icon } from '@/theme/icons';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (in production, send to error tracking service)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-lg shadow-lg border border-[var(--border)] p-8 text-center">
        <Icon name="error" size="6xl" className="mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">
          Something went wrong!
        </h2>
        <p className="text-[var(--foreground-secondary)] mb-6">
          We apologize for the inconvenience. An unexpected error occurred.
        </p>
        {error.message && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
            <p className="text-sm text-red-500 font-mono break-words">
              {error.message}
            </p>
          </div>
        )}
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-[#00E5A0] text-[#061A21] px-6 py-2 rounded-lg hover:bg-[#00CC8E] transition font-semibold"
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

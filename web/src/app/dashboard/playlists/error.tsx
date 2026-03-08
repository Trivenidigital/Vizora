'use client';

import { useEffect } from 'react';

export default function PlaylistsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Playlists section error:', error);
    }
  }, [error]);

  return (
    <div role="alert" className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-lg border border-[var(--border)] p-8 text-center">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
          Playlists Error
        </h2>
        <p className="text-[var(--foreground-secondary)] mb-6 text-sm">
          Failed to load playlists. Please try again.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-left">
            <p className="text-xs text-red-500 font-mono break-words">{error.message}</p>
          </div>
        )}
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

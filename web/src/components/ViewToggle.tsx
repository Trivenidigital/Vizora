'use client';

import { useEffect } from 'react';
import { Icon } from '@/theme/icons';

interface ViewToggleProps {
  view: 'grid' | 'list';
  onChange: (view: 'grid' | 'list') => void;
  storageKey?: string;
}

export function ViewToggle({ view, onChange, storageKey = 'vizora-content-view' }: ViewToggleProps) {
  // Sync to localStorage when view changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(storageKey, view);
    } catch (error) {
      // Ignore localStorage errors
      console.warn('Failed to save view preference:', error);
    }
  }, [view, storageKey]);

  return (
    <div className="flex bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => onChange('grid')}
        className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 ${
          view === 'grid'
            ? 'bg-[#00E5A0] text-[#061A21]'
            : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
        }`}
        aria-label="Grid view"
        aria-pressed={view === 'grid'}
      >
        <Icon name="grid" size="md" />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`px-4 py-2 text-sm font-medium transition flex items-center gap-2 ${
          view === 'list'
            ? 'bg-[#00E5A0] text-[#061A21]'
            : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
        }`}
        aria-label="List view"
        aria-pressed={view === 'list'}
      >
        <Icon name="list" size="md" />
      </button>
    </div>
  );
}

/**
 * Helper function to get initial view from localStorage
 * Safe for SSR - returns default value if localStorage is unavailable
 */
export function getInitialView(storageKey = 'vizora-content-view'): 'grid' | 'list' {
  if (typeof window === 'undefined') return 'grid';
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'grid' || stored === 'list') {
      return stored;
    }
  } catch (error) {
    // Ignore localStorage errors
  }
  return 'grid';
}

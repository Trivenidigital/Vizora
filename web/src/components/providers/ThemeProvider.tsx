'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Light-only. Dark mode was REMOVED, per decision D1 in
 * `docs/plans/2026-09-17-full-web-little-worlds-redesign.md` §3.
 *
 * The provider and the `useTheme` hook survive the removal on purpose. Five
 * chart wrappers read `isDark` from here (via the one-line re-export at
 * `lib/hooks/useTheme.ts`), and deleting the hook would mean editing all of
 * them for no behavioural gain — they simply always take the light branch now.
 * When the last `isDark` consumer goes, this whole file can go with it.
 *
 * `ThemeMode` keeps 'dark' and 'system' in the union so a persisted value from
 * before the removal still type-checks while it is being migrated away. Nothing
 * can SET them any more.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'theme-mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    /*
     * Migrate anyone who had chosen dark, or left it on the old dark default.
     *
     * Leaving a saved 'dark' in place would park the user on a theme that no
     * longer exists: the class is never applied and the `.dark` token block is
     * gone, so they would silently get light anyway while their stored
     * preference said otherwise — and any future reader of that value would be
     * misled about what they had asked for. Rewriting it keeps the stored state
     * and the rendered state telling the same story.
     */
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null && saved !== 'light') localStorage.setItem(STORAGE_KEY, 'light');
    } catch {
      /* private mode — nothing to migrate, and light is the only outcome anyway */
    }

    /*
     * Defensive: strip `.dark` if anything put it on the element. Nothing in
     * this codebase does any more, but a stale cached bundle or an extension
     * could, and with the `.dark` token block deleted the result would be
     * unstyled rather than merely dark.
     */
    document.documentElement.classList.remove('dark');
  }, []);

  /** Accepts the old signature so callers still compile; light is the only outcome. */
  const setMode = (_next: ThemeMode) => {
    setModeState('light');
    try {
      localStorage.setItem(STORAGE_KEY, 'light');
    } catch {
      /* ignore */
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark: false, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

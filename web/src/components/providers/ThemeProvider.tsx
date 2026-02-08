'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [isDark, setIsDark] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize theme from localStorage and system preference
  useEffect(() => {
    setIsMounted(true);

    // Get saved preference
    const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null;
    const initialMode: ThemeMode = savedMode || 'dark';
    setModeState(initialMode);

    // Determine if dark mode should be active
    const shouldBeDark = determineDarkMode(initialMode);
    setIsDark(shouldBeDark);
    applyTheme(shouldBeDark);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (!isMounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (mode === 'system') {
        const newIsDark = e.matches;
        setIsDark(newIsDark);
        applyTheme(newIsDark);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode, isMounted]);

  const determineDarkMode = (themeMode: ThemeMode): boolean => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    // System preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const applyTheme = (dark: boolean) => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme-mode', newMode);

    const newIsDark = determineDarkMode(newMode);
    setIsDark(newIsDark);
    applyTheme(newIsDark);
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode }}>
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

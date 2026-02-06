'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/theme/icons';

type Theme = 'light' | 'dark' | 'system';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      setTheme('system');
      applyTheme('system', systemPreference);
    }
  }, []);

  const applyTheme = (newTheme: Theme, systemPreference?: 'light' | 'dark') => {
    const htmlElement = document.documentElement;

    if (newTheme === 'system') {
      const preference = systemPreference ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      htmlElement.classList.toggle('dark', preference === 'dark');
    } else {
      htmlElement.classList.toggle('dark', newTheme === 'dark');
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  if (!mounted) return null;

  const themes: Array<{ value: Theme; label: string; icon: string }> = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'system', label: 'System', icon: 'settings' },
  ];

  return (
    <div className="flex items-center gap-1 bg-[var(--background-secondary)] rounded-lg p-1">
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => handleThemeChange(t.value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 ${
            theme === t.value
              ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
          }`}
          title={t.label}
          aria-label={`Switch to ${t.label} theme`}
        >
          <Icon name={t.icon as any} size="sm" />
          <span className="text-sm font-medium hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

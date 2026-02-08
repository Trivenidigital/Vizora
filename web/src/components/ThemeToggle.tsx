'use client';

import { useState, useEffect } from 'react';
import { useTheme, ThemeMode } from '@/components/providers/ThemeProvider';
import { Icon } from '@/theme/icons';

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const themes: Array<{ value: ThemeMode; label: string; icon: string }> = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ];

  return (
    <div className="flex items-center gap-1 bg-[var(--background-secondary)] rounded-lg p-1">
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setMode(t.value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 ${
            mode === t.value
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CommandPalette, { getDefaultCommands, Command } from './CommandPalette';

export default function CommandPaletteWrapper() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [commands] = useState<Command[]>(() => getDefaultCommands(router));

  // Handle Cmd+K / Ctrl+K keyboard shortcut.
  //
  // Compared case-insensitively: with CapsLock on, the browser reports
  // `key: 'K'` and an exact 'k' test silently drops the shortcut, which for a
  // keyboard-only affordance means it simply stops existing. `!e.shiftKey`
  // keeps Ctrl+Shift+K (the browser's own console shortcut) from opening it.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return (
    <CommandPalette
      commands={commands}
      open={isOpen}
      onOpenChange={handleOpenChange}
    />
  );
}

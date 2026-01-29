'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CommandPalette, { getDefaultCommands, Command } from './CommandPalette';

export default function CommandPaletteWrapper() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [commands] = useState<Command[]>(() => getDefaultCommands(router));

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
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

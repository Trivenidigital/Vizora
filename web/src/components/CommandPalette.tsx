'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/theme/icons';
import { SCHEDULES_ENABLED } from '@/lib/feature-flags';

export interface Command {
  id: string;
  title: string;
  description?: string;
  category: 'navigation' | 'action' | 'quick-access';
  icon?: string;
  onExecute: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  commands: Command[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CommandPalette({ commands, open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Use controlled or uncontrolled mode
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : isOpen;

  useEffect(() => {
    if (controlledOpen !== undefined) {
      setIsOpen(controlledOpen);
    }
  }, [controlledOpen]);

  /**
   * The single way this component may change its own visibility.
   *
   * Every dismissal path used to call `setIsOpen(false)` directly. Under a
   * controlled parent — which is how the app mounts it
   * (CommandPaletteWrapper passes `open`) — `open` resolves to the prop, so
   * those writes landed on state nothing reads. Escape did nothing, the
   * backdrop did nothing, and running a command navigated but left the palette
   * covering the page it navigated to. Only ⌘K closed it, because the WRAPPER
   * owns that shortcut.
   *
   * So: notify the parent when controlled, and keep local state authoritative
   * only when it actually is.
   */
  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setIsOpen(next);
    },
    [isControlled, onOpenChange],
  );

  // Handle keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      /**
       * Only own ⌘K when nobody else does.
       *
       * CommandPaletteWrapper registers its own window-level ⌘K handler. If
       * this one also toggled while controlled, BOTH would fire for a single
       * keypress — this one setting the parent to `!open`, the wrapper's
       * functional `prev => !prev` then flipping that result straight back —
       * and the palette would never open at all. Naively routing this through
       * setOpen() is exactly how fixing the dismiss bug breaks the open path.
       */
      if (!isControlled && (e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
        setSearch('');
        setSelectedIndex(0);
      }

      // Only handle navigation keys when palette is open
      if (!open) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].onExecute();
            setOpen(false);
            setSearch('');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, search, selectedIndex, setOpen, isControlled]);

  // Filter commands by search
  const filteredCommands = commands.filter(cmd => {
    const searchLower = search.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(searchLower))
    );
  });

  // Group by category
  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      const category = cmd.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(cmd);
      return acc;
    },
    {} as Record<string, Command[]>
  );

  const categoryOrder = ['navigation', 'action', 'quick-access'];
  const sortedGroups = categoryOrder.filter(cat => groupedCommands[cat]);

  return (
    <>
      {/* Keyboard Shortcut Hint (optional, can be hidden) */}
      {!open && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-secondary)] text-xs font-medium pointer-events-none z-40">
          ⌘K
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => {
            setOpen(false);
            setSearch('');
          }}
        />
      )}

      {/* Command Palette Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div className="w-full max-w-xl mx-4 bg-[var(--surface)] rounded-lg shadow-2xl border border-[var(--border)] overflow-hidden">
            {/* Search Input */}
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Icon name="search" size="sm" className="text-[var(--foreground-tertiary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Search commands..."
                  className="flex-1 bg-transparent text-[var(--foreground)] focus:outline-none text-sm"
                  autoFocus
                />
                <div className="text-xs text-[var(--foreground-tertiary)] font-medium">ESC</div>
              </div>
            </div>

            {/* Commands List */}
            <div className="max-h-96 overflow-y-auto">
              {filteredCommands.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-[var(--foreground-secondary)]">No commands found</p>
                </div>
              ) : (
                sortedGroups.map(category => (
                  <div key={category}>
                    {/* Category Header */}
                    <div className="px-4 py-2 text-xs font-semibold text-[var(--foreground-tertiary)] uppercase tracking-wider bg-[var(--background)]">
                      {category.replace('-', ' ')}
                    </div>

                    {/* Commands in Category */}
                    {groupedCommands[category].map((cmd, idx) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.onExecute();
                            setOpen(false);
                            setSearch('');
                          }}
                          className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                            isSelected
                              ? 'bg-[#00E5A0] text-[#061A21]'
                              : 'text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          {cmd.icon && (
                            <Icon name={cmd.icon as any} size="sm" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{cmd.title}</div>
                            {cmd.description && (
                              <div className="text-xs opacity-75">{cmd.description}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer Help */}
            {filteredCommands.length > 0 && (
              <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground-tertiary)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span>↑↓ Navigate</span>
                  <span>↵ Select</span>
                </div>
                <span>Esc to close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Default commands factory
export function getDefaultCommands(router: any): Command[] {
  return [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      description: 'View dashboard overview',
      category: 'navigation',
      icon: 'overview',
      onExecute: () => router.push('/dashboard'),
      keywords: ['home', 'overview', 'dashboard'],
    },
    {
      id: 'nav-devices',
      title: 'Go to Devices',
      description: 'Manage your devices',
      category: 'navigation',
      icon: 'devices',
      onExecute: () => router.push('/dashboard/devices'),
      keywords: ['devices', 'displays', 'screens'],
    },
    {
      id: 'nav-content',
      title: 'Go to Content',
      description: 'Manage your content library',
      category: 'navigation',
      icon: 'content',
      onExecute: () => router.push('/dashboard/content'),
      keywords: ['content', 'media', 'upload'],
    },
    {
      id: 'nav-playlists',
      title: 'Go to Playlists',
      description: 'Manage your playlists',
      category: 'navigation',
      icon: 'playlists',
      onExecute: () => router.push('/dashboard/playlists'),
      keywords: ['playlists', 'schedule', 'content'],
    },
    // Schedules hidden while SCHEDULES_ENABLED is off (interim C-7 mitigation).
    ...(SCHEDULES_ENABLED
      ? ([{
          id: 'nav-schedules',
          title: 'Go to Schedules',
          description: 'Manage your schedules',
          category: 'navigation',
          icon: 'schedules',
          onExecute: () => router.push('/dashboard/schedules'),
          keywords: ['schedules', 'automation', 'timing'],
        }] as Command[])
      : []),
    {
      id: 'nav-analytics',
      title: 'Go to Analytics',
      description: 'View analytics and reports',
      category: 'navigation',
      icon: 'analytics',
      onExecute: () => router.push('/dashboard/analytics'),
      keywords: ['analytics', 'reports', 'metrics', 'insights'],
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      description: 'Manage your account settings',
      category: 'navigation',
      icon: 'settings',
      onExecute: () => router.push('/dashboard/settings'),
      keywords: ['settings', 'preferences', 'account'],
    },
  ];
}

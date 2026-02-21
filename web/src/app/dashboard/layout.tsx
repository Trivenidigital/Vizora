'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Breadcrumbs from '@/components/Breadcrumbs';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { DeviceStatusProvider } from '@/lib/context/DeviceStatusContext';
import QueryProvider from '@/lib/providers/QueryProvider';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';
import TrialBanner from '@/components/TrialBanner';

const navigation: Array<{ name: string; href: string; icon: IconName; exactMatch?: boolean }> = [
  { name: 'Overview', href: '/dashboard', icon: 'overview', exactMatch: true },
  { name: 'Devices', href: '/dashboard/devices', icon: 'devices' },
  { name: 'Content', href: '/dashboard/content', icon: 'content' },
  { name: 'Templates', href: '/dashboard/templates', icon: 'grid' },
  { name: 'Widgets', href: '/dashboard/widgets', icon: 'content' },
  { name: 'Layouts', href: '/dashboard/layouts', icon: 'content' },
  { name: 'Playlists', href: '/dashboard/playlists', icon: 'playlists' },
  { name: 'Schedules', href: '/dashboard/schedules', icon: 'schedules' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: 'analytics' },
  { name: 'Settings', href: '/dashboard/settings', icon: 'settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, logout: handleLogoutAuth } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (item: typeof navigation[0]) => {
    if (item.exactMatch) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const handleLogout = () => {
    handleLogoutAuth();
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return 'U';
    const parts = user.email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-[var(--surface)]/90 backdrop-blur-xl border-b border-[var(--border)] fixed top-0 left-0 right-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition lg:hidden"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] rounded-lg flex items-center justify-center">
                  <span className="text-[#061A21] font-bold text-lg">V</span>
                </div>
                <h1 className="text-2xl font-bold eh-gradient eh-heading">
                  Vizora
                </h1>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
              {!authLoading && user && (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="hidden sm:flex items-center gap-2 px-3 py-2 bg-[var(--surface-hover)] rounded-lg hover:bg-[var(--border)] transition"
                  >
                    <div
                      className="w-8 h-8 bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] rounded-full flex items-center justify-center"
                      aria-label={`${user.email} avatar`}
                    >
                      <span className="text-[#061A21] text-sm font-semibold">{getUserInitials()}</span>
                    </div>
                    <div className="hidden md:block text-left">
                      <div className="text-sm font-medium text-[var(--foreground)]">{user.email.split('@')[0]}</div>
                      <div className="text-xs text-[var(--foreground-tertiary)]">{user.email}</div>
                    </div>
                    <svg className="w-4 h-4 text-[var(--foreground-tertiary)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] rounded-lg shadow-lg border border-[var(--border)] z-20">
                        <div className="p-4 border-b border-[var(--border)]">
                          <div className="text-sm font-medium text-[var(--foreground)]">{user.email.split('@')[0]}</div>
                          <div className="text-xs text-[var(--foreground-tertiary)]">{user.email}</div>
                        </div>
                        <div className="py-2">
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              router.push('/dashboard/settings');
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] transition flex items-center gap-2"
                          >
                            <Icon name="settings" size="md" className="text-[var(--foreground-tertiary)]" />
                            <span>Settings</span>
                          </button>
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              handleLogout();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition flex items-center gap-2"
                          >
                            <Icon name="logout" size="md" className="text-red-500" />
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Trial/Subscription Banner */}
      <div className="fixed top-16 left-0 right-0 z-20">
        <TrialBanner />
      </div>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:relative lg:translate-x-0 w-56 bg-[var(--surface)] min-h-[calc(100vh-4rem)] border-r border-[var(--border)] transition-transform duration-300 ease-in-out z-20`}
        >
          <nav className="p-3 space-y-1">
            {navigation.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-l-2 border-[#00E5A0]'
                      : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Icon name={item.icon} size="md" className={active ? 'text-[#00E5A0]' : 'text-[var(--foreground-tertiary)]'} />
                  <span className="flex-1">{item.name}</span>
                  {active && (
                    <span className="w-2 h-2 bg-[#00E5A0] rounded-full shadow-neon-sm"></span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-[var(--border)] bg-[var(--surface-secondary)]">
            <div className="text-xs text-[var(--foreground-tertiary)] space-y-1">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-semibold">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Platform</span>
                <span className="font-semibold">Vizora</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        {authLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <QueryProvider>
            <DeviceStatusProvider user={user}>
              <main id="main-content" className="flex-1 p-6 sm:p-8 lg:p-10 min-h-[calc(100vh-4rem)] overflow-x-hidden">
                <div className="max-w-7xl mx-auto">
                  <Breadcrumbs />
                  <div className="animate-[fadeIn_0.2s_ease-out]">
                    {children}
                  </div>
                </div>
              </main>
            </DeviceStatusProvider>
          </QueryProvider>
        )}
      </div>
    </div>
  );
}

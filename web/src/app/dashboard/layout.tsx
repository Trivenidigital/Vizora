'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
import { SupportChatProvider } from '@/components/support/SupportChatProvider';
import { SupportChat } from '@/components/support/SupportChat';
import { useCustomization } from '@/components/providers/CustomizationProvider';

const navigation: Array<{ name: string; href: string; icon: IconName; exactMatch?: boolean }> = [
  { name: 'Overview', href: '/dashboard', icon: 'overview', exactMatch: true },
  { name: 'Devices', href: '/dashboard/devices', icon: 'devices' },
  { name: 'Content', href: '/dashboard/content', icon: 'content' },
  { name: 'Templates', href: '/dashboard/templates', icon: 'grid' },
  { name: 'Widgets', href: '/dashboard/widgets', icon: 'widget' },
  { name: 'Layouts', href: '/dashboard/layouts', icon: 'layout' },
  { name: 'Playlists', href: '/dashboard/playlists', icon: 'playlists' },
  { name: 'Schedules', href: '/dashboard/schedules', icon: 'schedules' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: 'analytics' },
  { name: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  { name: 'Help', href: '/dashboard/help', icon: 'help' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, logout: handleLogoutAuth } = useAuth();
  const { brandConfig } = useCustomization();
  const brandName = brandConfig?.name || 'Vizora';
  const brandLogo = brandConfig?.logo;
  const brandInitial = brandName.charAt(0).toUpperCase();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth >= 1024;
    return true;
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Sync sidebar with viewport — close below lg, open above lg (debounced)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setSidebarOpen(window.innerWidth >= 1024);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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
    if (user?.firstName && user?.lastName) {
      return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    if (!user?.email) return 'U';
    const parts = user.email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const getUserDisplayName = () => {
    if (user?.firstName) {
      return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
    }
    return user?.email?.split('@')[0] || '';
  };

  // Editor route gets full viewport — no header/sidebar
  const isEditorRoute = pathname?.match(/\/dashboard\/templates\/[^/]+\/edit$/);
  if (isEditorRoute) {
    return (
      <SupportChatProvider>
        <QueryProvider>
          <DeviceStatusProvider user={user}>
            {authLoading ? (
              <div className="flex h-screen items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              children
            )}
          </DeviceStatusProvider>
        </QueryProvider>
      </SupportChatProvider>
    );
  }

  return (
    <SupportChatProvider>
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-[var(--surface)]/80 backdrop-blur-xl border-b border-[var(--border)] fixed top-0 left-0 right-0 z-30 transition-colors duration-200">
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
                {brandLogo ? (
                  <img src={brandLogo} alt={brandName} className="w-8 h-8 rounded-lg object-contain" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] rounded-lg flex items-center justify-center">
                    <span className="text-[#061A21] font-bold text-lg">{brandInitial}</span>
                  </div>
                )}
                <h1 className="text-2xl font-bold eh-gradient eh-heading">
                  {brandName}
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
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={`${user.email} avatar`}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] rounded-full flex items-center justify-center"
                        aria-label={`${user.email} avatar`}
                      >
                        <span className="text-[#061A21] text-sm font-semibold">{getUserInitials()}</span>
                      </div>
                    )}
                    <div className="hidden md:block text-left">
                      <div className="text-sm font-medium text-[var(--foreground)]">{getUserDisplayName()}</div>
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
                      <div className="absolute right-0 mt-2 w-56 eh-dash-card shadow-xl z-20 animate-[fadeIn_0.15s_ease-out]">
                        <div className="p-4 border-b border-[var(--border)]">
                          <div className="text-sm font-medium text-[var(--foreground)]">{getUserDisplayName()}</div>
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
      <div className="fixed top-16 left-0 right-0 z-20 lg:left-56">
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
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-l-2 border-[var(--primary)]'
                      : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Icon name={item.icon} size="md" className={active ? 'text-[var(--primary)]' : 'text-[var(--foreground-tertiary)]'} />
                  <span className="flex-1">{item.name}</span>
                  {active && (
                    <span className="w-2 h-2 bg-[var(--primary)] rounded-full shadow-neon-sm"></span>
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
                <span className="font-semibold">{brandName}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-16 bg-black/50 backdrop-blur-sm z-10 lg:hidden"
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
                  <div className="animate-[fadeIn_0.2s_ease-out] space-y-0">
                    {children}
                  </div>
                </div>
              </main>
            </DeviceStatusProvider>
          </QueryProvider>
        )}
      </div>

      {/* Support Chat Widget */}
      <SupportChat />
    </div>
    </SupportChatProvider>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

const navigation: Array<{ name: string; href: string; icon: IconName; exactMatch?: boolean }> = [
  { name: 'Overview', href: '/dashboard', icon: 'overview', exactMatch: true },
  { name: 'Devices', href: '/dashboard/devices', icon: 'devices' },
  { name: 'Content', href: '/dashboard/content', icon: 'content' },
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition lg:hidden"
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
              {/* @ts-expect-error React 19 Link compatibility */}
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">V</span>
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Vizora
                </h1>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {!authLoading && user && (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  >
                    <div 
                      className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center"
                      aria-label={`${user.email} avatar`}
                    >
                      <span className="text-white text-sm font-semibold">{getUserInitials()}</span>
                    </div>
                    <div className="hidden md:block text-left">
                      <div className="text-sm font-medium text-gray-900">{user.email.split('@')[0]}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
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
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                        <div className="p-4 border-b border-gray-200">
                          <div className="text-sm font-medium text-gray-900">{user.email.split('@')[0]}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                        <div className="py-2">
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              router.push('/dashboard/settings');
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition flex items-center gap-2"
                          >
                            <Icon name="settings" size="md" className="text-gray-500" />
                            <span>Settings</span>
                          </button>
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              handleLogout();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
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

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:relative lg:translate-x-0 w-64 bg-white min-h-[calc(100vh-4rem)] border-r border-gray-200 transition-transform duration-300 ease-in-out z-20`}
        >
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const active = isActive(item);
              return (
                // @ts-expect-error React 19 Link compatibility
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon name={item.icon} size="lg" className="text-gray-600" />
                  <span className="flex-1">{item.name}</span>
                  {active && (
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-semibold">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="font-semibold text-green-600">Online</span>
                </span>
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

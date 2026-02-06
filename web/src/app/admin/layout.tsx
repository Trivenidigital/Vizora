'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminSidebar } from './components/AdminSidebar';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check if user is super admin
  useEffect(() => {
    if (!authLoading && user) {
      // Check for super admin - the user object should have isSuperAdmin flag
      // For now we check if user has admin role or specific flag
      const isSuperAdmin = (user as any).isSuperAdmin === true;
      if (!isSuperAdmin) {
        router.replace('/dashboard');
      }
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Don't render admin content if user is not super admin
  const isSuperAdmin = user && (user as any).isSuperAdmin === true;
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">You do not have permission to access this area.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main
        className={`${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        } transition-all duration-300 min-h-screen`}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

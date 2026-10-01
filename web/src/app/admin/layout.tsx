'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminSidebar } from './components/AdminSidebar';
import LoadingSpinner from '@/components/LoadingSpinner';
import CommandPaletteWrapper from '@/components/CommandPaletteWrapper';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /*
   * Collapse the rail to its icon width below `lg`.
   *
   * The rail is `fixed` at 256px and `<main>` clears it with a matching
   * margin, so at 390px the content box was 134px wide and every admin page
   * overflowed the viewport horizontally (measured by the design harness:
   * /admin 459px, /admin/organizations 485px, /admin/health 507px against a
   * 390px viewport). Collapsing to the 64px rail returns 326px of content
   * width — the same trade the dashboard shell already makes, and the chevron
   * stays reachable inside the rail, so this is a default rather than a lock.
   *
   * Debounced and mirrored from the dashboard layout deliberately: two shells
   * that disagree about where "small" starts is a worse bug than the copy.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const apply = () => setSidebarCollapsed(window.innerWidth < 1024);
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 150);
    };
    apply();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Don't render admin content if user is not super admin
  const isSuperAdmin = user && (user as any).isSuperAdmin === true;
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Access Denied</h1>
          <p className="text-[var(--foreground-secondary)]">You do not have permission to access this area.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
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

      {/* Command palette + its Cmd-K hint. Mounted on the authenticated shells
          rather than the root layout; see the note in app/layout.tsx. It is
          deliberately NOT on the loading or access-denied returns above — those
          are transient states, and the denied one is a refusal, which is a poor
          place to offer navigation shortcuts. */}
      <CommandPaletteWrapper />
    </div>
  );
}

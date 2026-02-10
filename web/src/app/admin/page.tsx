import { serverFetch } from '@/lib/server-api';
import type { PlatformStats } from '@/lib/types';
import AdminDashboardClient from './page-client';

export default async function AdminDashboardPage() {
  let stats: PlatformStats | null = null;

  try {
    stats = await serverFetch<PlatformStats>('/admin/stats');
  } catch {
    // Will render with null stats, client handles gracefully
  }

  return <AdminDashboardClient initialStats={stats} />;
}

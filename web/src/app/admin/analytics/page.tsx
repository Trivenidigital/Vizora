import { serverFetch } from '@/lib/server-api';
import type { PlatformStats } from '@/lib/types';
import AdminAnalyticsClient from './page-client';

export default async function AdminAnalyticsPage() {
  let stats: PlatformStats | null = null;

  try {
    stats = await serverFetch<PlatformStats>('/admin/stats');
  } catch {
    // Client handles null stats gracefully
  }

  return <AdminAnalyticsClient initialStats={stats} />;
}

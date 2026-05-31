import type { Metadata } from 'next';
import { serverFetch } from '@/lib/server-api';
import { unwrapPaginatedData } from '@/lib/api/pagination';
import DashboardClient from './page-client';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
 let content: any[] = [];
 let playlists: any[] = [];

 try {
 const results = await Promise.allSettled([
 serverFetch<any>('/content?limit=100'),
 serverFetch<any>('/playlists?limit=100'),
 ]);

 if (results[0].status === 'fulfilled') {
 content = unwrapPaginatedData(results[0].value);
 }
 if (results[1].status === 'fulfilled') {
 playlists = unwrapPaginatedData(results[1].value);
 }
 } catch {
 // Client handles empty state gracefully
 }

 return <DashboardClient initialContent={content} initialPlaylists={playlists} />;
}

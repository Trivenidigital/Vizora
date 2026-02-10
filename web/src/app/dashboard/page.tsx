import { serverFetch } from '@/lib/server-api';
import DashboardClient from './page-client';

export default async function DashboardPage() {
 let content: any[] = [];
 let playlists: any[] = [];

 try {
 const results = await Promise.allSettled([
 serverFetch<any>('/content'),
 serverFetch<any>('/playlists'),
 ]);

 if (results[0].status === 'fulfilled') {
 const val = results[0].value;
 content = Array.isArray(val?.data) ? val.data : Array.isArray(val) ? val : [];
 }
 if (results[1].status === 'fulfilled') {
 const val = results[1].value;
 playlists = Array.isArray(val?.data) ? val.data : Array.isArray(val) ? val : [];
 }
 } catch {
 // Client handles empty state gracefully
 }

 return <DashboardClient initialContent={content} initialPlaylists={playlists} />;
}

import { serverFetch } from '@/lib/server-api';
import type { Display, Playlist } from '@/lib/types';
import DevicesClient from './page-client';

export default async function DevicesPage() {
 let devices: Display[] = [];
 let playlists: Playlist[] = [];

 try {
 const results = await Promise.allSettled([
 serverFetch<any>('/displays'),
 serverFetch<any>('/playlists'),
 ]);

 if (results[0].status === 'fulfilled') {
 const val = results[0].value;
 devices = val?.data || val || [];
 }
 if (results[1].status === 'fulfilled') {
 const val = results[1].value;
 playlists = val?.data || val || [];
 }
 } catch {
 // Client handles empty state gracefully
 }

 return <DevicesClient initialDevices={devices} initialPlaylists={playlists} />;
}

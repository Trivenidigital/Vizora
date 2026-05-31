import type { Metadata } from 'next';
import { serverFetch } from '@/lib/server-api';
import { unwrapPaginatedData } from '@/lib/api/pagination';
import type { Display, Playlist } from '@/lib/types';
import DevicesClient from './page-client';

export const metadata: Metadata = {
  title: 'Devices',
};

export default async function DevicesPage() {
 let devices: Display[] = [];
 let playlists: Playlist[] = [];

 try {
 const results = await Promise.allSettled([
 serverFetch<any>('/displays?limit=100'),
 serverFetch<any>('/playlists?limit=100'),
 ]);

 if (results[0].status === 'fulfilled') {
 devices = unwrapPaginatedData<Display>(results[0].value);
 }
 if (results[1].status === 'fulfilled') {
 playlists = unwrapPaginatedData<Playlist>(results[1].value);
 }
 } catch {
 // Client handles empty state gracefully
 }

 return <DevicesClient initialDevices={devices} initialPlaylists={playlists} />;
}

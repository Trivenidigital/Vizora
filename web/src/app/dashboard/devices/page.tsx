import type { Metadata } from 'next';
import { serverFetch } from '@/lib/server-api';
import { unwrapPaginatedData } from '@/lib/api/pagination';
import type { Display, PaginatedResponse, Playlist } from '@/lib/types';
import DevicesClient from './page-client';

export const metadata: Metadata = {
  title: 'Devices',
};

export default async function DevicesPage() {
 let devices: Display[] = [];
 let playlists: Playlist[] = [];
 let devicesComplete = false;
 let playlistsComplete = false;

 try {
 const results = await Promise.allSettled([
 serverFetch<PaginatedResponse<Display>>('/displays?limit=100'),
 serverFetch<PaginatedResponse<Playlist>>('/playlists?limit=100'),
 ]);

 if (results[0].status === 'fulfilled') {
 devices = unwrapPaginatedData<Display>(results[0].value);
 devicesComplete = (results[0].value.meta?.totalPages ?? 1) <= 1;
 }
 if (results[1].status === 'fulfilled') {
 playlists = unwrapPaginatedData<Playlist>(results[1].value);
 playlistsComplete = (results[1].value.meta?.totalPages ?? 1) <= 1;
 }
 } catch {
 // Client handles empty state gracefully
 }

 return (
 <DevicesClient
 initialDevices={devices}
 initialPlaylists={playlists}
 initialDevicesComplete={devicesComplete}
 initialPlaylistsComplete={playlistsComplete}
 />
 );
}

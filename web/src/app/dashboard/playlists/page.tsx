import type { Metadata } from 'next';
import PlaylistsClient from './page-client';

export const metadata: Metadata = {
  title: 'Playlists',
};

export default async function PlaylistsPage() {
 // Playlists page loads data client-side due to real-time DnD and complex state
 return <PlaylistsClient />;
}

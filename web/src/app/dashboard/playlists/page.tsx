import PlaylistsClient from './page-client';

export default async function PlaylistsPage() {
 // Playlists page loads data client-side due to real-time DnD and complex state
 return <PlaylistsClient />;
}

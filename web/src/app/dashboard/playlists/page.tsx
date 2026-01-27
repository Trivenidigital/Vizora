'use client';

const mockPlaylists = [
  { id: '1', name: 'Morning Promotions', items: 5, duration: '2m 30s' },
  { id: '2', name: 'Lunch Specials', items: 8, duration: '4m 15s' },
  { id: '3', name: 'Evening Content', items: 6, duration: '3m 45s' },
];

export default function PlaylistsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Playlists</h2>
          <p className="mt-2 text-gray-600">
            Create and manage content playlists
          </p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-semibold">
          + Create Playlist
        </button>
      </div>

      {/* Playlists List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-200">
          {mockPlaylists.map((playlist) => (
            <div
              key={playlist.id}
              className="p-6 hover:bg-gray-50 transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-3xl">📋</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {playlist.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {playlist.items} items • {playlist.duration}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition">
                    Edit
                  </button>
                  <button className="px-4 py-2 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition">
                    Publish
                  </button>
                  <button className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

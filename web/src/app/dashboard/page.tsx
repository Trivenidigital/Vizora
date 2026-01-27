export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="mt-2 text-gray-600">
          Welcome to your Vizora dashboard. Here's what's happening.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">Total Devices</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">8</p>
          <p className="mt-1 text-sm text-green-600">5 online</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">Content Items</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">42</p>
          <p className="mt-1 text-sm text-gray-500">3 processing</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">Playlists</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">12</p>
          <p className="mt-1 text-sm text-gray-500">5 active</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">Impressions Today</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">1.2k</p>
          <p className="mt-1 text-sm text-green-600">+15% vs yesterday</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Device "Store Front" came online
                </p>
                <p className="text-xs text-gray-500">2 minutes ago</p>
              </div>
              <span className="text-green-600 text-sm">Online</span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Content "Summer Sale Banner" uploaded
                </p>
                <p className="text-xs text-gray-500">15 minutes ago</p>
              </div>
              <span className="text-blue-600 text-sm">Ready</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Playlist "Morning Promotions" updated
                </p>
                <p className="text-xs text-gray-500">1 hour ago</p>
              </div>
              <span className="text-gray-600 text-sm">Updated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

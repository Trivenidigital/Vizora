export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Analytics</h2>
        <p className="mt-2 text-gray-600">
          Track performance and engagement metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">Total Impressions</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">45.2k</p>
          <p className="mt-1 text-sm text-green-600">+12% this week</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">Avg. Display Time</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">8.5s</p>
          <p className="mt-1 text-sm text-gray-500">Per content item</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm font-medium text-gray-600">Completion Rate</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">94%</p>
          <p className="mt-1 text-sm text-green-600">+3% vs last week</p>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-white rounded-lg shadow p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Impressions Over Time
        </h3>
        <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
          <p className="text-gray-500">Chart visualization would go here</p>
        </div>
      </div>
    </div>
  );
}

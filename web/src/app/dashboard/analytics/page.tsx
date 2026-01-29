'use client';

import { Icon } from '@/theme/icons';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Analytics</h2>
        <p className="mt-2 text-gray-600">
          View performance metrics and insights
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Impressions</p>
          <p className="text-3xl font-bold text-gray-900">12,543</p>
          <p className="text-sm text-green-600 mt-2">↑ 15% from last week</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm font-medium text-gray-600 mb-2">Avg. Play Time</p>
          <p className="text-3xl font-bold text-gray-900">4.2m</p>
          <p className="text-sm text-blue-600 mt-2">Per device per day</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm font-medium text-gray-600 mb-2">Uptime</p>
          <p className="text-3xl font-bold text-gray-900">98.5%</p>
          <p className="text-sm text-green-600 mt-2">Above target</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 text-center py-12">
        <Icon name="overview" size="6xl" className="mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Analytics Dashboard Coming Soon
        </h3>
        <p className="text-gray-600">
          Detailed analytics and reporting features will be available here
        </p>
      </div>
    </div>
  );
}

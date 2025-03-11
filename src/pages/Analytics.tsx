import { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Calendar, 
  ChevronDown,
  Download,
  RefreshCw,
  Eye,
  Monitor,
  PlaySquare
} from 'lucide-react';

const Analytics = () => {
  const [dateRange, setDateRange] = useState('last7Days');
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate data refresh
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Analytics</h1>
          <p className="text-secondary-500">Track performance and engagement metrics</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button 
            className="btn btn-secondary flex items-center"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </button>
          <button className="btn btn-secondary flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-100 text-primary-600 mr-4">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Total Views</p>
              <p className="text-2xl font-bold text-secondary-900">24,521</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <h3 className="text-lg font-medium text-secondary-900 mb-4">Views by Display</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Lobby Display</span>
                <span className="text-sm font-medium text-secondary-900">8,245</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Viewer Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <h3 className="text-lg font-medium text-secondary-900 mb-4">Viewer Demographics</h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="w-3 h-3 bg-primary-500 rounded-full mr-2"></span>
              <span className="text-sm text-secondary-700">Employees (45%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg border border-primary-200 p-6">
        <h3 className="text-lg font-medium text-secondary-900">AI Analytics Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-medium text-secondary-900 mb-2">Viewing Pattern Analysis</h4>
            <p className="text-sm text-secondary-600">
              Peak engagement occurs between 9-11 AM. Consider scheduling your most important content during these hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

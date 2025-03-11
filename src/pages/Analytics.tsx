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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Analytics</h1>
          <p className="text-secondary-500">Track performance and engagement metrics</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <div className="relative">
            <select
              className="input pr-10 appearance-none"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7Days">Last 7 Days</option>
              <option value="last30Days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-secondary-500">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
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
      
      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-100 text-primary-600 mr-4">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Total Views</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-secondary-900">24,521</p>
                <span className="ml-2 text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  12%
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-secondary-100">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-500">Previous period</span>
              <span className="font-medium text-secondary-900">21,893</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Unique Viewers</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-secondary-900">8,742</p>
                <span className="ml-2 text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  8%
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-secondary-100">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-500">Previous period</span>
              <span className="font-medium text-secondary-900">8,094</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Avg. View Time</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-secondary-900">2:34</p>
                <span className="ml-2 text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  15%
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-secondary-100">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-500">Previous period</span>
              <span className="font-medium text-secondary-900">2:12</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-secondary-500">Active Displays</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-secondary-900">18</p>
                <span className="ml-2 text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  2
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-secondary-100">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-500">Previous period</span>
              <span className="font-medium text-secondary-900">16</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-secondary-900">Views by Display</h3>
            <button className="text-sm text-primary-600 hover:text-primary-700">
              View Details
            </button>
          </div>
          
          {/* Mock bar chart */}
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
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Reception Display</span>
                <span className="text-sm font-medium text-secondary-900">6,382</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: '65%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Cafeteria Display</span>
                <span className="text-sm font-medium text-secondary-900">4,827</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: '50%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Conference Room A</span>
                <span className="text-sm font-medium text-secondary-900">3,156</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: '32%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Showroom Display</span>
                <span className="text-sm font-medium text-secondary-900">1,911</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: '20%' }}></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-secondary-200 p<ez1Action type="file" filePath="src/pages/Analytics.tsx">
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-secondary-900">Content Performance</h3>
            <button className="text-sm text-primary-600 hover:text-primary-700">
              View Details
            </button>
          </div>
          
          {/* Mock content performance chart */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Welcome Sequence</span>
                <span className="text-sm font-medium text-secondary-900">92% engagement</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Product Showcase</span>
                <span className="text-sm font-medium text-secondary-900">87% engagement</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '87%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Company News</span>
                <span className="text-sm font-medium text-secondary-900">76% engagement</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '76%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Holiday Special</span>
                <span className="text-sm font-medium text-secondary-900">68% engagement</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-yellow-500 h-2.5 rounded-full" style={{ width: '68%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Employee Spotlight</span>
                <span className="text-sm font-medium text-secondary-900">54% engagement</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-2.5">
                <div className="bg-yellow-500 h-2.5 rounded-full" style={{ width: '54%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Viewer demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <h3 className="text-lg font-medium text-secondary-900 mb-4">Viewer Demographics</h3>
          
          {/* Mock pie chart */}
          <div className="flex justify-center mb-4">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="3"
                  strokeDasharray="45, 100"
                  strokeLinecap="round"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#60A5FA"
                  strokeWidth="3"
                  strokeDasharray="30, 100"
                  strokeDashoffset="-45"
                  strokeLinecap="round"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="3"
                  strokeDasharray="25, 100"
                  strokeDashoffset="-75"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-secondary-900">8,742</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="w-3 h-3 bg-primary-500 rounded-full mr-2"></span>
              <span className="text-sm text-secondary-700">Employees (45%)</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
              <span className="text-sm text-secondary-700">Visitors (30%)</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-green-400 rounded-full mr-2"></span>
              <span className="text-sm text-secondary-700">Customers (25%)</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <h3 className="text-lg font-medium text-secondary-900 mb-4">Peak Viewing Hours</h3>
          
          {/* Mock line chart */}
          <div className="h-48 flex items-end space-x-2">
            {[15, 25, 40, 30, 60, 75, 65, 75, 90, 85, 65, 45, 35, 25, 35, 45, 55, 40, 30, 20, 15, 10, 5, 10].map((value, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-primary-500 rounded-t"
                  style={{ height: `${value}%` }}
                ></div>
                {index % 4 === 0 && (
                  <span className="text-xs text-secondary-500 mt-1">{index}:00</span>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-secondary-100">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-500">Peak time</span>
              <span className="font-medium text-secondary-900">9:00 AM - 11:00 AM</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-secondary-200 p-6">
          <h3 className="text-lg font-medium text-secondary-900 mb-4">Display Uptime</h3>
          
          {/* Mock gauge chart */}
          <div className="flex justify-center mb-4">
            <div className="relative w-40 h-20">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="3"
                  strokeDasharray="50, 100"
                  strokeDashoffset="25"
                  strokeLinecap="round"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3"
                  strokeDasharray="47, 100"
                  strokeDashoffset="25"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-secondary-900">98.7%</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Lobby Display</span>
                <span className="text-sm font-medium text-green-600">100%</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Reception Display</span>
                <span className="text-sm font-medium text-green-600">99.8%</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '99.8%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Cafeteria Display</span>
                <span className="text-sm font-medium text-green-600">98.2%</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '98.2%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary-700">Sales Dashboard</span>
                <span className="text-sm font-medium text-yellow-600">92.5%</span>
              </div>
              <div className="w-full bg-secondary-100 rounded-full h-1.5">
                <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: '92.5%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top performing content */}
      <div className="bg-white rounded-lg border border-secondary-200 p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-secondary-900">Top Performing Content</h3>
          <button className="text-sm text-primary-600 hover:text-primary-700">
            View All
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead>
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Content
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Views
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Avg. View Time
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Engagement
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-secondary-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1596526131083-e8c633c948d2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80" alt="" className="h-10 w-10 object-cover" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-secondary-900">Welcome Sequence</div>
                      <div className="text-sm text-secondary-500">Lobby Display</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <PlaySquare className="h-4 w-4 text-secondary-500 mr-1" />
                    <span className="text-sm text-secondary-900">Playlist</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                  8,245
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                  3:12
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-full bg-secondary-100 rounded-full h-1.5 w-24 mr-2">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                    <span className="text-sm font-medium text-secondary-900">92%</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80" alt="" className="h-10 w-10 object-cover" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-secondary-900">Product Showcase</div>
                      <div className="text-sm text-secondary-500">Showroom Display</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <PlaySquare className="h-4 w-4 text-secondary-500 mr-1" />
                    <span className="text-sm text-secondary-900">Playlist</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                  6,382
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                  2:45
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-full bg-secondary-100 rounded-full h-1.5 w-24 mr-2">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '87%' }}></div>
                    </div>
                    <span className="text-sm font-medium text-secondary-900">87%</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80" alt="" className="h-10 w-10 object-cover" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-secondary-900">Company News</div>
                      <div className="text-sm text-secondary-500">Reception Display</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <PlaySquare className="h-4 w-4 text-secondary-500 mr-1" />
                    <span className="text-sm text-secondary-900">Playlist</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                  4,827
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                  1:58
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-full bg-secondary-100 rounded-full h-1.5 w-24 mr-2">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '76%' }}></div>
                    </div>
                    <span className="text-sm font-medium text-secondary-900">76%</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1543589077-47d81606c1bf?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80" alt="" className="h-10 w-10 object-cover" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-secondary-900">Holiday Special</div>
                      <div className="text-sm text-secondary-500">All Displays</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <PlaySquare className="h-4 w-4 text-secondary-500 mr-1" />
                    <span className="text-sm text-secondary-900">Playlist</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                  3,156
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                  1:32
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-full bg-secondary-100 rounded-full h-1.5 w-24 mr-2">
                      <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: '68%' }}></div>
                    </div>
                    <span className="text-sm font-medium text-secondary-900">68%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* AI Insights */}
      <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg border border-primary-200 p-6">
        <div className="flex items-center mb-4">
          <div className="p-2 rounded-full bg-primary-100 text-primary-600 mr-3">
            <BarChart3 className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-medium text-secondary-900">AI Analytics Insights</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-medium text-secondary-900 mb-2">Viewing Pattern Analysis</h4>
            <p className="text-sm text-secondary-600">
              Peak engagement occurs between 9-11 AM. Consider scheduling your most important content during these hours for maximum impact.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-medium text-secondary-900 mb-2">Content Recommendation</h4>
            <p className="text-sm text-secondary-600">
              Product Showcase content performs 23% better when paired with promotional offers. Consider adding special offers to increase engagement.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-medium text-secondary-900 mb-2">Display Optimization</h4>
            <p className="text-sm text-secondary-600">
              Cafeteria Display shows 35% higher engagement with menu content that includes images. Consider updating your menu presentations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

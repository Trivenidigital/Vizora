import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ContentItem } from './ContentPage';

interface ContentAnalyticsProps {
  content: ContentItem;
}

interface DisplayMetric {
  displayId: string;
  displayName: string;
  views: number;
  duration: number;
  lastShown: string;
}

interface DailyMetric {
  date: string;
  views: number;
  uniqueDisplays: number;
}

interface DeviceTypeMetric {
  type: string;
  count: number;
}

interface ContentAnalytics {
  totalViews: number;
  uniqueDisplays: number;
  averageViewDuration: number;
  displayMetrics: DisplayMetric[];
  dailyMetrics: DailyMetric[];
  deviceTypes: DeviceTypeMetric[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const ContentAnalytics: React.FC<ContentAnalyticsProps> = ({ content }) => {
  const [analytics, setAnalytics] = useState<ContentAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      
      try {
        // In a real application, this would be an API call:
        // const response = await fetch(`/api/content/${content.id}/analytics?range=${dateRange}`);
        // const data = await response.json();
        
        // For demo, generate mock data
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockData: ContentAnalytics = {
          totalViews: Math.floor(Math.random() * 10000) + 1000,
          uniqueDisplays: Math.floor(Math.random() * 100) + 10,
          averageViewDuration: Math.floor(Math.random() * 300) + 30,
          displayMetrics: generateMockDisplayMetrics(),
          dailyMetrics: generateMockDailyMetrics(dateRange),
          deviceTypes: [
            { type: 'TV', count: Math.floor(Math.random() * 50) + 10 },
            { type: 'Digital Signage', count: Math.floor(Math.random() * 40) + 5 },
            { type: 'Kiosk', count: Math.floor(Math.random() * 20) + 5 },
            { type: 'Mobile', count: Math.floor(Math.random() * 10) + 2 },
            { type: 'Other', count: Math.floor(Math.random() * 5) + 1 }
          ]
        };
        
        setAnalytics(mockData);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [content.id, dateRange]);
  
  const generateMockDisplayMetrics = (): DisplayMetric[] => {
    const metrics: DisplayMetric[] = [];
    const displayCount = Math.floor(Math.random() * 8) + 3;
    
    for (let i = 1; i <= displayCount; i++) {
      metrics.push({
        displayId: `display-${i}`,
        displayName: `Display ${i}`,
        views: Math.floor(Math.random() * 1000) + 50,
        duration: Math.floor(Math.random() * 300) + 30,
        lastShown: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString()
      });
    }
    
    return metrics.sort((a, b) => b.views - a.views);
  };
  
  const generateMockDailyMetrics = (range: '7d' | '30d' | '90d'): DailyMetric[] => {
    const metrics: DailyMetric[] = [];
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      
      metrics.push({
        date: date.toISOString().split('T')[0],
        views: Math.floor(Math.random() * 500) + 10,
        uniqueDisplays: Math.floor(Math.random() * 20) + 1
      });
    }
    
    return metrics;
  };
  
  const formatDate = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center py-12">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-40 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 w-full bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available for this content.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Content Performance</h2>
        <div className="inline-flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => setDateRange('7d')}
            className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-medium ${
              dateRange === '7d' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ring-1 ring-inset ring-gray-300 focus:z-10`}
          >
            7 days
          </button>
          <button
            type="button"
            onClick={() => setDateRange('30d')}
            className={`relative -ml-px inline-flex items-center px-3 py-2 text-sm font-medium ${
              dateRange === '30d' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ring-1 ring-inset ring-gray-300 focus:z-10`}
          >
            30 days
          </button>
          <button
            type="button"
            onClick={() => setDateRange('90d')}
            className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-medium ${
              dateRange === '90d' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            } ring-1 ring-inset ring-gray-300 focus:z-10`}
          >
            90 days
          </button>
        </div>
      </div>
      
      {/* Overview metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 truncate">Total Views</div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">{analytics.totalViews.toLocaleString()}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 truncate">Unique Displays</div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">{analytics.uniqueDisplays}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 truncate">Avg. View Duration</div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">{formatDuration(analytics.averageViewDuration)}</div>
        </div>
      </div>
      
      {/* Daily views chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-base font-medium text-gray-900 mb-4">Daily Views</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analytics.dailyMetrics}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                interval={dateRange === '7d' ? 0 : dateRange === '30d' ? 4 : 14}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(label) => formatDate(label as string)}
                formatter={(value) => [value, 'Views']}
              />
              <Legend />
              <Bar dataKey="views" fill="#3B82F6" name="Views" />
              <Bar dataKey="uniqueDisplays" fill="#10B981" name="Unique Displays" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Display distribution and top displays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Display type distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-base font-medium text-gray-900 mb-4">Display Types</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.deviceTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="count"
                  label={({ type, percent }) => `${type} (${(percent * 100).toFixed(0)}%)`}
                >
                  {analytics.deviceTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} displays`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Top displays */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-base font-medium text-gray-900 mb-4">Top Displays</h3>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Display</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Duration</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.displayMetrics.slice(0, 5).map((display) => (
                  <tr key={display.displayId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{display.displayName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{display.views.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(display.duration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentAnalytics; 
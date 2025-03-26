import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, FileImage, List, Calendar, BarChart2, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Simulating data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);
  
  const stats = [
    { name: 'Active Displays', value: '12', icon: Monitor, color: 'bg-blue-500', link: '/displays' },
    { name: 'Content Items', value: '48', icon: FileImage, color: 'bg-indigo-500', link: '/content' },
    { name: 'Playlists', value: '8', icon: List, color: 'bg-purple-500', link: '/playlists' },
    { name: 'Scheduled Campaigns', value: '5', icon: Calendar, color: 'bg-pink-500', link: '/schedule' },
  ];
  
  const recentActivities = [
    { id: 1, action: 'Display connected', target: 'Reception Display', time: '5 minutes ago', status: 'success' },
    { id: 2, action: 'Content published', target: 'Summer Promotion', time: '1 hour ago', status: 'success' },
    { id: 3, action: 'Display offline', target: 'Cafeteria Display', time: '3 hours ago', status: 'error' },
    { id: 4, action: 'Playlist updated', target: 'Monthly Highlights', time: '5 hours ago', status: 'success' },
    { id: 5, action: 'New schedule created', target: 'Weekend Events', time: '1 day ago', status: 'success' },
  ];
  
  const insights = [
    { id: 1, title: 'Top performing content', description: '"Product Demo Video" has the highest engagement' },
    { id: 2, title: 'Display health', description: '92% of displays are currently online and functioning properly' },
    { id: 3, title: 'Content freshness', description: '3 displays haven\'t had content updates in the last 30 days' },
  ];
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 pb-8">
      {/* Page header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <div className="mt-3 sm:mt-0">
          <Link 
            to="/displays/add" 
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Add New Display
          </Link>
        </div>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.link}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-300"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{stat.value}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-primary-600 hover:text-primary-700">
                  View all
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Main content area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity feed */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="px-5 py-4">
                  <div className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 h-2 w-2 rounded-full ${
                      activity.status === 'success' ? 'bg-green-600' : 'bg-red-600'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">{activity.action}</span>
                        {' - '}
                        <span>{activity.target}</span>
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-5 py-3 rounded-b-lg">
              <Link 
                to="/analytics" 
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View all activity
              </Link>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div>
          <div className="bg-white shadow rounded-lg">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Insights</h3>
            </div>
            <div className="px-5 py-5 space-y-6">
              {insights.map((insight) => (
                <div key={insight.id} className="flex">
                  <div className="flex-shrink-0">
                    <BarChart2 
                      className="h-6 w-6 text-primary-600" 
                      aria-hidden="true" 
                    />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-900">{insight.title}</h4>
                    <p className="mt-1 text-sm text-gray-500">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-5 py-3 rounded-b-lg">
              <Link 
                to="/analytics" 
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View detailed analytics
              </Link>
            </div>
          </div>
          
          {/* System status */}
          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">System Status</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 rounded-md p-2">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-gray-900">All systems operational</h4>
                  <p className="mt-1 text-xs text-gray-500">Last updated 2 minutes ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Monitor, 
  AlertTriangle, 
  Zap, 
  BarChart3, 
  Clock, 
  ArrowUpRight,
  Calendar,
  PlaySquare,
  FolderOpen,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock data
  const displayStats = {
    total: 24,
    online: 22,
    offline: 2,
    scheduled: 18,
  };
  
  const contentStats = {
    total: 156,
    active: 87,
    scheduled: 64,
    aiGenerated: 42,
  };
  
  const recentActivity = [
    { id: 1, action: 'Display #12 went offline', time: '5 minutes ago', type: 'alert' },
    { id: 2, action: 'New AI content suggestion created', time: '1 hour ago', type: 'content' },
    { id: 3, action: 'Holiday playlist scheduled', time: '3 hours ago', type: 'schedule' },
    { id: 4, action: 'Weekly analytics report ready', time: 'Yesterday', type: 'analytics' },
    { id: 5, action: 'New display registered', time: '2 days ago', type: 'display' },
  ];
  
  const quickActions = [
    { name: 'Add Display', icon: Monitor, href: '/app/displays/add' },
    { name: 'Upload Content', icon: FolderOpen, href: '/app/content/upload' },
    { name: 'Create Playlist', icon: PlaySquare, href: '/app/playlists/create' },
    { name: 'Schedule Content', icon: Calendar, href: '/app/schedule/create' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
        <p className="text-secondary-500">Welcome back! Here's what's happening with your displays.</p>
      </div>
      
      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-secondary-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              to={action.href}
              className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-secondary-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-2 rounded-full bg-primary-50 text-primary-600 mb-2">
                <action.icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium text-secondary-700">{action.name}</span>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Display stats */}
        <motion.div 
          className="card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-secondary-800">Display Status</h2>
            <Link to="/app/displays" className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
              View all <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-primary-100 text-primary-600 mr-3">
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Total Displays</p>
                  <p className="text-2xl font-bold text-secondary-900">{displayStats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-green-100 text-green-600 mr-3">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Online</p>
                  <p className="text-2xl font-bold text-secondary-900">{displayStats.online}</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-red-100 text-red-600 mr-3">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Offline</p>
                  <p className="text-2xl font-bold text-secondary-900">{displayStats.offline}</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-blue-100 text-blue-600 mr-3">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Scheduled</p>
                  <p className="text-2xl font-bold text-secondary-900">{displayStats.scheduled}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button className="btn btn-secondary w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add New Display
            </button>
          </div>
        </motion.div>
        
        {/* Content stats */}
        <motion.div 
          className="card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-secondary-800">Content Overview</h2>
            <Link to="/app/content" className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
              View library <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-secondary-100 text-secondary-600 mr-3">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Total Content</p>
                  <p className="text-2xl font-bold text-secondary-900">{contentStats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-green-100 text-green-600 mr-3">
                  <PlaySquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Active</p>
                  <p className="text-2xl font-bold text-secondary-900">{contentStats.active}</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-blue-100 text-blue-600 mr-3">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">Scheduled</p>
                  <p className="text-2xl font-bold text-secondary-900">{contentStats.scheduled}</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-purple-100 text-purple-600 mr-3">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-secondary-500">AI Generated</p>
                  <p className="text-2xl font-bold text-secondary-900">{contentStats.aiGenerated}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button className="btn btn-secondary w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create New Content
            </button>
          </div>
        </motion.div>
      </div>
      
      {/* Recent activity */}
      <motion.div 
        className="card p-6 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-secondary-800">Recent Activity</h2>
          <Link to="/app/activity" className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
            View all <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-secondary-200">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="py-3 flex items-start">
              <div className={`p-2 rounded-full mr-3 ${
                activity.type === 'alert' ? 'bg-red-100 text-red-600' :
                activity.type === 'content' ? 'bg-purple-100 text-purple-600' :
                activity.type === 'schedule' ? 'bg-blue-100 text-blue-600' :
                activity.type === 'analytics' ? 'bg-green-100 text-green-600' :
                'bg-primary-100 text-primary-600'
              }`}>
                {activity.type === 'alert' && <AlertTriangle className="h-4 w-4" />}
                {activity.type === 'content' && <FolderOpen className="h-4 w-4" />}
                {activity.type === 'schedule' && <Calendar className="h-4 w-4" />}
                {activity.type === 'analytics' && <BarChart3 className="h-4 w-4" />}
                {activity.type === 'display' && <Monitor className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-medium text-secondary-800">{activity.action}</p>
                <p className="text-xs text-secondary-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
      
      {/* AI Insights */}
      <motion.div 
        className="card p-6 mb-8 bg-gradient-to-r from-primary-50 to-purple-50 border-primary-200"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className="flex items-center mb-4">
          <div className="p-2 rounded-full bg-primary-100 text-primary-600 mr-3">
            <Zap className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-medium text-secondary-800">AI Insights</h2>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm font-medium text-secondary-800">Content Recommendation</p>
            <p className="text-sm text-secondary-600 mt-1">Based on your audience analytics, promotional content performs 32% better in the afternoon. Consider scheduling your new campaign between 2-5 PM.</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm font-medium text-secondary-800">Display Optimization</p>
            <p className="text-sm text-secondary-600 mt-1">Display #8 has been showing the same content for 3 days. Consider refreshing the playlist to maintain viewer engagement.</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm font-medium text-secondary-800">Performance Alert</p>
            <p className="text-sm text-secondary-600 mt-1">Your holiday promotion is performing 18% better than average. Consider extending its run time or creating similar content.</p>
          </div>
        </div>
        <div className="mt-4">
          <Link to="/app/ai-insights" className="btn btn-primary w-full flex items-center justify-center">
            View All AI Insights
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;

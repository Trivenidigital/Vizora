import { FC } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowTrendingUpIcon,
  DeviceTabletIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const stats = [
  {
    name: 'Active Displays',
    value: '87',
    change: '+3%',
    changeType: 'positive',
    icon: DeviceTabletIcon,
    iconColor: 'bg-green-100 text-green-600',
  },
  {
    name: 'Content Items',
    value: '256',
    change: '+16%',
    changeType: 'positive',
    icon: ArrowTrendingUpIcon,
    iconColor: 'bg-blue-100 text-blue-600',
  },
  {
    name: 'Scheduled Updates',
    value: '12',
    change: '-',
    changeType: 'neutral',
    icon: ClockIcon,
    iconColor: 'bg-violet-100 text-violet-600',
  },
  {
    name: 'Alerts',
    value: '3',
    change: '+2',
    changeType: 'negative',
    icon: ExclamationTriangleIcon,
    iconColor: 'bg-amber-100 text-amber-600',
  },
];

const recentActivity = [
  {
    id: 1,
    action: 'Content Published',
    description: 'Summer promotion campaign published to 24 displays',
    timestamp: '2 hours ago',
  },
  {
    id: 2,
    action: 'New Display Connected',
    description: 'Display "Main Entrance" connected successfully',
    timestamp: '5 hours ago',
  },
  {
    id: 3,
    action: 'Content Updated',
    description: 'Product showcase updated with new items',
    timestamp: '1 day ago',
  },
  {
    id: 4,
    action: 'Alert Resolved',
    description: 'Connection issue with "Cafeteria" display resolved',
    timestamp: '2 days ago',
  },
];

const Dashboard: FC = () => {
  return (
    <div className="py-6 max-w-full overflow-x-hidden">
      <div className="mx-auto sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-neutral-900 px-4 sm:px-0">Dashboard</h1>
      </div>
      
      <div className="mx-auto sm:px-6 md:px-8">
        <div className="py-4">
          {/* Stats cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 px-4 sm:px-0">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.name}
                className="bg-white overflow-hidden shadow rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 rounded-md p-3 ${stat.iconColor}`}>
                      <stat.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-neutral-500 truncate">{stat.name}</dt>
                        <dd>
                          <div className="text-lg font-medium text-neutral-900">{stat.value}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-neutral-50 px-5 py-3">
                  <div className="text-sm">
                    <span 
                      className={`font-medium ${
                        stat.changeType === 'positive' 
                          ? 'text-green-600' 
                          : stat.changeType === 'negative' 
                            ? 'text-red-600' 
                            : 'text-neutral-600'
                      }`}
                    >
                      {stat.change}
                    </span>{' '}
                    <span className="text-neutral-500">from last month</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Recent activity */}
          <div className="mt-8 px-4 sm:px-0">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-neutral-200">
                <h3 className="text-lg leading-6 font-medium text-neutral-900">Recent Activity</h3>
              </div>
              <div className="bg-white overflow-hidden">
                <ul className="divide-y divide-neutral-200">
                  {recentActivity.map((activity, index) => (
                    <motion.li 
                      key={activity.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                    >
                      <div className="px-4 py-4 sm:px-6 hover:bg-neutral-50">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-primary-600 truncate">{activity.action}</p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-neutral-100 text-neutral-800">
                              {activity.timestamp}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="text-sm text-neutral-500">{activity.description}</p>
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Content performance preview */}
          <div className="mt-8 bg-white shadow rounded-lg px-4 sm:px-0">
            <div className="px-4 py-5 sm:px-6 border-b border-neutral-200">
              <h3 className="text-lg leading-6 font-medium text-neutral-900">Content Performance</h3>
              <p className="mt-1 text-sm text-neutral-500">
                Overview of how your content is performing across displays.
              </p>
            </div>
            <div className="p-6 flex justify-center items-center bg-neutral-50 h-64 rounded-b-lg">
              <p className="text-neutral-500">Content performance chart placeholder</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
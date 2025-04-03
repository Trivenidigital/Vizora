import { 
  ComputerDesktopIcon, 
  FilmIcon,
  InformationCircleIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDisplays } from '@/hooks/useDisplays';
import '@/styles/pages/Dashboard.css';

// Define types for our dashboard data
interface StatItem {
  id: number;
  name: string;
  value: string;
  icon: React.ElementType;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  href: string;
}

interface ActivityItem {
  id: number;
  action: string;
  time: string;
  status: 'error' | 'warning' | 'success' | 'info';
}

export const Dashboard = () => {
  // Initialize with empty data
  const [stats, setStats] = useState<StatItem[]>([
    { 
      id: 1, 
      name: 'Total Displays', 
      value: '0', 
      icon: ComputerDesktopIcon, 
      href: '/displays' 
    },
    { 
      id: 2, 
      name: 'Content Items', 
      value: '0', 
      icon: FilmIcon, 
      href: '/content' 
    },
    { 
      id: 3, 
      name: 'Active Displays', 
      value: '0', 
      icon: CheckCircleIcon, 
      href: '/displays' 
    },
    { 
      id: 4, 
      name: 'Alerts', 
      value: '0', 
      icon: ExclamationCircleIcon, 
      href: '/alerts' 
    },
  ]);

  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  return (
    <div className="space-y-6 w-full">
      <div className="mb-4">
        <h2 className="text-base font-semibold leading-6 text-gray-900">Overview</h2>
        <p className="mt-1 text-sm text-gray-500">
          Quick summary of your digital signage network
        </p>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.id}
            to={stat.href}
            className="relative overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 shadow sm:px-6 sm:pt-6 hover:shadow-md transition-shadow"
          >
            <dt>
              <div className="absolute rounded-md bg-purple-500 p-3">
                <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">{stat.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              {stat.change && (
                <p
                  className={`ml-2 flex items-baseline text-sm font-semibold ${
                    stat.changeType === 'increase' ? 'text-green-600' : 
                    stat.changeType === 'decrease' ? 'text-red-600' : 'text-gray-500'
                  }`}
                >
                  {stat.change}
                </p>
              )}
            </dd>
          </Link>
        ))}
      </div>
      
      {/* Recent activity */}
      <div className="overflow-hidden rounded-lg bg-white shadow mt-6">
        <div className="p-6">
          <div className="flex items-center">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Recent Activity</h3>
            <InformationCircleIcon className="ml-2 h-5 w-5 text-gray-400" />
          </div>
          
          {recentActivity.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-gray-100 p-3 mb-4">
                <InformationCircleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">No recent activity</h3>
              <p className="mt-1 text-sm text-gray-500 max-w-md">
                Activity will appear here as you start using the platform. Add displays or content to get started.
              </p>
              <div className="mt-6 flex gap-3">
                <Link
                  to="/displays"
                  className="inline-flex items-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
                >
                  <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                  Add Display
                </Link>
                <Link
                  to="/content"
                  className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                  Add Content
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 flow-root">
                <ul className="-my-5 divide-y divide-gray-200">
                  {recentActivity.map((item) => (
                    <li key={item.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <span 
                            className={`inline-block h-2 w-2 rounded-full ${
                              item.status === 'error' ? 'bg-red-500' : 
                              item.status === 'warning' ? 'bg-yellow-500' : 
                              item.status === 'success' ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{item.action}</p>
                          <p className="truncate text-sm text-gray-500">{item.time}</p>
                        </div>
                        <div>
                          <a
                            href="#"
                            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-sm font-medium leading-5 text-gray-700 shadow-sm hover:bg-gray-50"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6">
                <a
                  href="#"
                  className="flex w-full items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-purple-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  View all activity
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 
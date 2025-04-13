import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';
import { 
  BellIcon, 
  ArrowUpIcon, 
  ArrowDownIcon 
} from '@heroicons/react/24/outline';
import '@/styles/pages/Dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardStat {
  label: string;
  value: number;
  change: number;
  icon: React.ReactNode;
}

const Dashboard: React.FC = () => {
  const [stats, _setStats] = useState<DashboardStat[]>([
    {
      label: 'Total Displays',
      value: 32,
      change: 14.5,
      icon: <ArrowUpIcon className="h-4 w-4 text-green-500" />
    },
    {
      label: 'Active Displays',
      value: 28,
      change: 5.6,
      icon: <ArrowUpIcon className="h-4 w-4 text-green-500" />
    },
    {
      label: 'Content Items',
      value: 184,
      change: -2.3,
      icon: <ArrowDownIcon className="h-4 w-4 text-red-500" />
    },
    {
      label: 'Scheduled Items',
      value: 76,
      change: 8.2,
      icon: <ArrowUpIcon className="h-4 w-4 text-green-500" />
    },
  ]);

  const [recentActivity, _setRecentActivity] = useState([
    { id: 1, action: 'Content Updated', item: 'Summer Promotion Video', user: 'Alex Johnson', time: '2 hours ago' },
    { id: 2, action: 'Schedule Created', item: 'Weekend Specials', user: 'Maria Garcia', time: '3 hours ago' },
    { id: 3, action: 'Display Added', item: 'Lobby Display 4', user: 'Sam Wilson', time: '5 hours ago' },
    { id: 4, action: 'User Invited', item: 'content-editor@example.com', user: 'Admin', time: '1 day ago' },
    { id: 5, action: 'Content Published', item: 'New Product Announcements', user: 'Taylor Swift', time: '1 day ago' },
  ]);

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Engagements',
        data: [12500, 19200, 15700, 18900, 24100, 26800],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Views',
        data: [32000, 45000, 39000, 51000, 59000, 68000],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Content Performance',
      },
    },
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">{stat.label}</p>
                <p className="text-2xl font-semibold mt-1">{stat.value}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-full">
                {/* Icon placeholder */}
              </div>
            </div>
            <div className="flex items-center mt-4">
              {stat.icon}
              <span className={`text-sm ml-1 ${stat.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {Math.abs(stat.change)}%
              </span>
              <span className="text-gray-400 text-sm ml-1">vs last month</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <Line options={chartOptions} data={chartData} />
      </div>
      
      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <a href="#" className="text-blue-500 text-sm hover:underline">View all</a>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start border-b border-gray-100 pb-3">
              <div className="rounded-full bg-blue-100 p-2 mr-3">
                <BellIcon className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">{activity.action}: <span className="text-blue-500">{activity.item}</span></p>
                <p className="text-sm text-gray-500">By {activity.user} - {activity.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <a href="#" className="text-blue-500 text-sm hover:underline">
            Load more activity
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
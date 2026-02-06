'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { PlatformStats } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { StatCard } from '../components/StatCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  BarChart3,
  TrendingUp,
  Users,
  Building2,
  Monitor,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Calendar,
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const toast = useToast();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    loadStats();
  }, [timeRange]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPlatformStats();
      setStats(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Mock growth data for display purposes
  const mockGrowth = {
    organizations: { current: stats?.totalOrganizations || 0, growth: 12 },
    users: { current: stats?.totalUsers || 0, growth: 8 },
    screens: { current: stats?.totalScreens || 0, growth: 15 },
    mrr: { current: stats?.mrr || 0, growth: 22 },
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Platform metrics and growth insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Organizations"
          value={mockGrowth.organizations.current}
          trend={{ value: mockGrowth.organizations.growth, isPositive: true }}
          icon={<Building2 className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={mockGrowth.users.current}
          trend={{ value: mockGrowth.users.growth, isPositive: true }}
          icon={<Users className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Active Screens"
          value={mockGrowth.screens.current}
          trend={{ value: mockGrowth.screens.growth, isPositive: true }}
          icon={<Monitor className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(mockGrowth.mrr.current)}
          trend={{ value: mockGrowth.mrr.growth, isPositive: true }}
          icon={<DollarSign className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Revenue Metrics
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(stats?.mrr || 0)}
                </p>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUp className="w-4 h-4" />
                <span className="text-sm font-medium">+22%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Annual Recurring Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(stats?.arr || 0)}
                </p>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUp className="w-4 h-4" />
                <span className="text-sm font-medium">+18%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Revenue Per Account</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.totalOrganizations
                    ? formatCurrency((stats.mrr || 0) / stats.totalOrganizations)
                    : '$0'}
                </p>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUp className="w-4 h-4" />
                <span className="text-sm font-medium">+5%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Platform Usage
          </h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Screen Utilization</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats?.onlineScreens || 0} / {stats?.totalScreens || 0} online
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{
                    width: `${
                      stats?.totalScreens
                        ? ((stats.onlineScreens || 0) / stats.totalScreens) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active Organizations</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.round((stats?.totalOrganizations || 0) * 0.85)} / {stats?.totalOrganizations || 0}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '85%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Content Engagement</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">High</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '78%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Growth Chart Placeholder */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Growth Trends</h3>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">
              Chart visualization coming soon
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Historical trends and projections
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

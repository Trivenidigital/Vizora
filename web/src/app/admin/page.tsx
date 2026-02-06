'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { PlatformStats } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { StatCard } from './components/StatCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  Building2,
  Users,
  Monitor,
  DollarSign,
  TrendingUp,
  CreditCard,
  Gift,
  Shield,
  Megaphone,
  Activity,
  ArrowRight,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const toast = useToast();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPlatformStats();
      setStats(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load platform statistics');
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

  const quickActions = [
    { name: 'Manage Plans', href: '/admin/plans', icon: CreditCard, color: 'blue' },
    { name: 'Promotions', href: '/admin/promotions', icon: Gift, color: 'purple' },
    { name: 'Organizations', href: '/admin/organizations', icon: Building2, color: 'green' },
    { name: 'Security', href: '/admin/security', icon: Shield, color: 'red' },
    { name: 'Announcements', href: '/admin/announcements', icon: Megaphone, color: 'yellow' },
    { name: 'System Health', href: '/admin/health', icon: Activity, color: 'teal' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <toast.ToastContainer />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Admin Dashboard</h1>
        <p className="mt-1 text-[var(--foreground-secondary)]">
          Platform overview and management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Organizations"
          value={stats?.totalOrganizations ?? 0}
          subtitle="Active accounts"
          icon={<Building2 className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          subtitle="Across all organizations"
          icon={<Users className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Total Screens"
          value={stats?.totalScreens ?? 0}
          subtitle={`${stats?.onlineScreens ?? 0} online`}
          icon={<Monitor className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Monthly Recurring Revenue"
          value={formatCurrency(stats?.mrr ?? 0)}
          subtitle={`ARR: ${formatCurrency(stats?.arr ?? 0)}`}
          icon={<DollarSign className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="group bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 hover:shadow-md hover:border-[#00E5A0] transition-all"
            >
              <action.icon className={`w-8 h-8 text-${action.color}-500 mb-3`} />
              <p className="font-medium text-[var(--foreground)] group-hover:text-[#00E5A0] transition">
                {action.name}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Screen Status */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--foreground)]">Screen Status</h3>
            <Link
              href="/admin/health"
              className="text-sm text-[#00E5A0] hover:underline flex items-center gap-1"
            >
              View Details
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-[var(--foreground-secondary)]">Online</span>
              </div>
              <span className="font-semibold text-[var(--foreground)]">
                {stats?.onlineScreens ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[var(--foreground-tertiary)]" />
                <span className="text-[var(--foreground-secondary)]">Offline</span>
              </div>
              <span className="font-semibold text-[var(--foreground)]">
                {(stats?.totalScreens ?? 0) - (stats?.onlineScreens ?? 0)}
              </span>
            </div>
            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground-tertiary)]">Uptime Rate</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {stats?.totalScreens
                    ? Math.round(((stats.onlineScreens ?? 0) / stats.totalScreens) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Summary */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--foreground)]">Revenue Summary</h3>
            <Link
              href="/admin/analytics"
              className="text-sm text-[#00E5A0] hover:underline flex items-center gap-1"
            >
              View Analytics
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[var(--foreground-tertiary)]">
                  Monthly Recurring Revenue
                </span>
              </div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {formatCurrency(stats?.mrr ?? 0)}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[var(--foreground-tertiary)]">
                  Annual Recurring Revenue
                </span>
              </div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {formatCurrency(stats?.arr ?? 0)}
              </div>
            </div>
            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-[var(--foreground-secondary)]">
                  Average Revenue Per Organization
                </span>
                <span className="ml-auto font-medium text-[var(--foreground)]">
                  {stats?.totalOrganizations
                    ? formatCurrency((stats.mrr ?? 0) / stats.totalOrganizations)
                    : '$0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

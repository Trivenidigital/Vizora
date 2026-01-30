'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useDeviceStatus } from '@/lib/context/DeviceStatusContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { HelpIcon } from '@/components/Tooltip';
import { Icon, type IconName, iconMap } from '@/theme/icons';

// Helper to ensure valid icon names
const getValidIconName = (name: string | undefined): IconName => {
  if (!name || !(name in iconMap)) {
    return 'overview'; // fallback to overview icon
  }
  return name as IconName;
};

export default function DashboardPage() {
  const router = useRouter();
  const { deviceStatuses, isInitialized } = useDeviceStatus();
  const [stats, setStats] = useState({
    devices: { total: 0, online: 0 },
    content: { total: 0, processing: 0 },
    playlists: { total: 0, active: 0 },
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update device stats from context (real-time)
  useEffect(() => {
    if (!isInitialized) return;

    const devicesList = Object.values(deviceStatuses);
    setStats(prev => ({
      ...prev,
      devices: {
        total: devicesList.length,
        online: devicesList.filter(d => d.status === 'online').length,
      },
    }));
  }, [deviceStatuses, isInitialized]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      // Use allSettled for graceful degradation
      // Note: Device stats are now handled by DeviceStatusContext, only fetch content & playlists
      const results = await Promise.allSettled([
        apiClient.getContent(),
        apiClient.getPlaylists(),
      ]);

      // Safely extract arrays from results with fallbacks
      const content = results[0].status === 'fulfilled'
        ? Array.isArray(results[0].value?.data) ? results[0].value.data
          : Array.isArray(results[0].value) ? results[0].value
          : []
        : [];
      const playlists = results[1].status === 'fulfilled'
        ? Array.isArray(results[1].value?.data) ? results[1].value.data
          : Array.isArray(results[1].value) ? results[1].value
          : []
        : [];

      // Log any failures for debugging
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`API call ${index + 1} failed:`, result.reason);
        }
      });

      setStats(prev => ({
        ...prev,
        content: {
          total: content.length,
          processing: content.filter((c: any) => c?.status === 'processing').length,
        },
        playlists: {
          total: playlists.length,
          active: playlists.filter((p: any) => p?.isActive === true).length,
        },
      }));

      // Build recent activity feed (combining recent items from all sources)
      const devicesList = Object.values(deviceStatuses);
      const activity = [
        ...devicesList.slice(0, 3).map((d: any) => ({
          type: 'device',
          iconName: getValidIconName('devices'),
          title: d.metadata?.nickname || 'Unnamed Device',
          subtitle: `${d.status || 'unknown'} • ${d.metadata?.location || 'No location'}`,
          time: d.metadata?.lastSeen || new Date().toISOString(),
        })),
        ...content.slice(0, 3).map((c: any) => {
          const contentType = c.type?.toLowerCase() || '';
          const iconName = contentType === 'image' ? 'image' 
            : contentType === 'video' ? 'video' 
            : 'document';
          return {
            type: 'content',
            iconName: getValidIconName(iconName),
            title: c.title || 'Untitled',
            subtitle: `${c.type || 'file'} • ${c.status || 'ready'}`,
            time: c.createdAt || new Date().toISOString(),
          };
        }),
        ...playlists.slice(0, 3).map((p: any) => ({
          type: 'playlist',
          iconName: getValidIconName('playlists'),
          title: p.name || 'Untitled Playlist',
          subtitle: `${p.items?.length || 0} items`,
          time: p.updatedAt || p.createdAt || new Date().toISOString(),
        })),
      ]
        .filter((item) => item.title && item.time && item.iconName) // Filter out invalid items
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 8);

      setRecentActivity(activity);
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Failed to load stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Dashboard Overview</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Welcome to your Vizora dashboard. Here's what's happening.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <Icon name="error" size="lg" className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">
              Error loading dashboard data
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            <button
              onClick={loadStats}
              className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
          onClick={() => router.push('/dashboard/devices')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Devices</p>
            <Icon name="devices" size="2xl" className="text-gray-600 dark:text-gray-400" />
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-gray-50 mb-2">{stats.devices.total}</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-success-500 rounded-full"></span>
            <p className="text-sm text-success-600 dark:text-success-400 font-medium">
              {stats.devices.online} online
            </p>
          </div>
        </div>

        <div
          className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
          onClick={() => router.push('/dashboard/content')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Content Items</p>
            <Icon name="content" size="2xl" className="text-gray-600 dark:text-gray-400" />
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-gray-50 mb-2">{stats.content.total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stats.content.processing > 0
              ? `${stats.content.processing} processing`
              : 'All ready'}
          </p>
        </div>

        <div
          className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
          onClick={() => router.push('/dashboard/playlists')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Playlists</p>
            <Icon name="playlists" size="2xl" className="text-gray-600 dark:text-gray-400" />
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-gray-50 mb-2">{stats.playlists.total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stats.playlists.active} active
          </p>
        </div>

        <div className="bg-gradient-to-br from-primary-500 to-purple-600 dark:from-primary-600 dark:to-purple-700 p-6 rounded-lg shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 text-white">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-primary-100">System Status</p>
            <Icon name="power" size="2xl" className="text-primary-200" />
          </div>
          <p className="text-4xl font-bold mb-2">Healthy</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-success-300 rounded-full animate-pulse"></span>
            <p className="text-sm text-primary-100">All systems operational</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Quick Actions</h3>
          <HelpIcon content="Common tasks to get started quickly" position="right" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/dashboard/devices/pair')}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-all transform hover:scale-105"
          >
            <Icon name="add" size="2xl" className="text-blue-600" />
            <div className="text-left">
              <div className="font-semibold text-blue-900">Pair Device</div>
              <div className="text-xs text-blue-700">Add new display</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/content')}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-all transform hover:scale-105"
          >
            <Icon name="upload" size="2xl" className="text-purple-600" />
            <div className="text-left">
              <div className="font-semibold text-purple-900">Upload Content</div>
              <div className="text-xs text-purple-700">Add new media</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/playlists')}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-success-50 dark:from-success-900 to-success-100 dark:to-success-800 rounded-lg hover:from-success-100 dark:hover:from-success-800 hover:to-success-200 dark:hover:to-success-700 transition-all transform hover:scale-105"
          >
            <Icon name="playlists" size="2xl" className="text-success-600 dark:text-success-400" />
            <div className="text-left">
              <div className="font-semibold text-success-900 dark:text-success-100">Create Playlist</div>
              <div className="text-xs text-success-700 dark:text-success-200">Organize content</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/schedules')}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg hover:from-orange-100 hover:to-orange-200 transition-all transform hover:scale-105"
          >
            <Icon name="schedules" size="2xl" className="text-orange-600" />
            <div className="text-left">
              <div className="font-semibold text-orange-900">Schedule</div>
              <div className="text-xs text-orange-700">Set up timing</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Recent Activity</h3>
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <Icon name={item.iconName || 'overview'} size="lg" className="text-gray-600 dark:text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</div>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {new Date(item.time).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Icon name="overview" size="3xl" className="mx-auto mb-4 text-gray-400 dark:text-gray-600" />
            <p className="text-sm">No recent activity yet</p>
            <p className="text-xs mt-2">Activity will appear here as you add devices and content</p>
          </div>
        )}
      </div>

      {/* Storage Usage */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Storage Usage</h3>
          <Icon name="storage" size="xl" className="text-gray-600 dark:text-gray-400" />
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Content Storage</span>
            <span className="font-medium text-gray-900 dark:text-gray-50">
              {stats.content.total > 0
                ? `~${(stats.content.total * 2.5).toFixed(1)} MB`
                : '0 MB'} / 5 GB
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-500 to-purple-600 dark:from-primary-600 dark:to-purple-700 h-3 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((stats.content.total * 2.5 / 5000) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{stats.content.total} items stored</span>
            <span>
              {((stats.content.total * 2.5 / 5000) * 100).toFixed(1)}% used
            </span>
          </div>
        </div>
      </div>

      {/* Getting Started Guide */}
      {stats.devices.total === 0 && (
        <div className="bg-gradient-to-r from-primary-500 to-purple-600 dark:from-primary-600 dark:to-purple-700 rounded-lg shadow-lg p-8 text-white">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><Icon name="power" size="xl" className="text-white" /> Getting Started</h3>
          <p className="mb-6 text-primary-100">
            Welcome to Vizora! Follow these steps to get your digital signage system up and running:
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white text-primary-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <div className="font-semibold mb-1">Pair Your First Device</div>
                <div className="text-sm text-primary-100">
                  Connect a display device to start showing content
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white text-primary-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <div className="font-semibold mb-1">Upload Your Content</div>
                <div className="text-sm text-primary-100">
                  Add images, videos, or other media to your library
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white text-primary-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <div className="font-semibold mb-1">Create a Playlist</div>
                <div className="text-sm text-primary-100">
                  Organize your content into playlists
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white text-primary-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <div className="font-semibold mb-1">Publish & Schedule</div>
                <div className="text-sm text-primary-100">
                  Assign playlists to devices and set schedules
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/devices/pair')}
            className="mt-6 bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 dark:hover:bg-gray-100 transition shadow-md"
          >
            Get Started - Pair Device
          </button>
        </div>
      )}

    </div>
  );
}

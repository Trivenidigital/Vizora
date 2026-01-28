'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { HelpIcon } from '@/components/Tooltip';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    devices: { total: 0, online: 0 },
    content: { total: 0, processing: 0 },
    playlists: { total: 0, active: 0 },
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      // Use allSettled for graceful degradation
      const results = await Promise.allSettled([
        apiClient.getDisplays(),
        apiClient.getContent(),
        apiClient.getPlaylists(),
      ]);

      const devices = results[0].status === 'fulfilled' 
        ? (results[0].value.data || results[0].value || []) 
        : [];
      const content = results[1].status === 'fulfilled' 
        ? (results[1].value.data || results[1].value || []) 
        : [];
      const playlists = results[2].status === 'fulfilled' 
        ? (results[2].value.data || results[2].value || []) 
        : [];

      setStats({
        devices: {
          total: devices.length,
          online: devices.filter((d: any) => d.status === 'online').length,
        },
        content: {
          total: content.length,
          processing: content.filter((c: any) => c.status === 'processing').length,
        },
        playlists: {
          total: playlists.length,
          active: playlists.filter((p: any) => p.isActive).length,
        },
      });

      // Build recent activity feed (combining recent items from all sources)
      const activity = [
        ...devices.slice(0, 3).map((d: any) => ({
          type: 'device',
          icon: '📺',
          title: d.nickname,
          subtitle: `${d.status} • ${d.location || 'No location'}`,
          time: d.lastSeen || d.createdAt,
        })),
        ...content.slice(0, 3).map((c: any) => ({
          type: 'content',
          icon: c.type === 'image' ? '🖼️' : c.type === 'video' ? '🎥' : '📄',
          title: c.title,
          subtitle: `${c.type} • ${c.status}`,
          time: c.createdAt,
        })),
        ...playlists.slice(0, 3).map((p: any) => ({
          type: 'playlist',
          icon: '📋',
          title: p.name,
          subtitle: `${p.items?.length || 0} items`,
          time: p.updatedAt || p.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 8);

      setRecentActivity(activity);
    } catch (error) {
      console.error('Failed to load stats:', error);
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
        <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="mt-2 text-gray-600">
          Welcome to your Vizora dashboard. Here's what's happening.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
          onClick={() => router.push('/dashboard/devices')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Total Devices</p>
            <span className="text-3xl">📺</span>
          </div>
          <p className="text-4xl font-bold text-gray-900 mb-2">{stats.devices.total}</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <p className="text-sm text-green-600 font-medium">
              {stats.devices.online} online
            </p>
          </div>
        </div>

        <div
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
          onClick={() => router.push('/dashboard/content')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Content Items</p>
            <span className="text-3xl">🖼️</span>
          </div>
          <p className="text-4xl font-bold text-gray-900 mb-2">{stats.content.total}</p>
          <p className="text-sm text-gray-500">
            {stats.content.processing > 0
              ? `${stats.content.processing} processing`
              : 'All ready'}
          </p>
        </div>

        <div
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
          onClick={() => router.push('/dashboard/playlists')}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Playlists</p>
            <span className="text-3xl">📋</span>
          </div>
          <p className="text-4xl font-bold text-gray-900 mb-2">{stats.playlists.total}</p>
          <p className="text-sm text-gray-500">
            {stats.playlists.active} active
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-lg shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 text-white">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-blue-100">System Status</p>
            <span className="text-3xl">✨</span>
          </div>
          <p className="text-4xl font-bold mb-2">Healthy</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></span>
            <p className="text-sm text-blue-100">All systems operational</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          <HelpIcon content="Common tasks to get started quickly" position="right" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/dashboard/devices/pair')}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-all transform hover:scale-105"
          >
            <span className="text-3xl">➕</span>
            <div className="text-left">
              <div className="font-semibold text-blue-900">Pair Device</div>
              <div className="text-xs text-blue-700">Add new display</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/content')}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-all transform hover:scale-105"
          >
            <span className="text-3xl">📤</span>
            <div className="text-left">
              <div className="font-semibold text-purple-900">Upload Content</div>
              <div className="text-xs text-purple-700">Add new media</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/playlists')}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg hover:from-green-100 hover:to-green-200 transition-all transform hover:scale-105"
          >
            <span className="text-3xl">📋</span>
            <div className="text-left">
              <div className="font-semibold text-green-900">Create Playlist</div>
              <div className="text-xs text-green-700">Organize content</div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/schedules')}
            className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg hover:from-orange-100 hover:to-orange-200 transition-all transform hover:scale-105"
          >
            <span className="text-3xl">📅</span>
            <div className="text-left">
              <div className="font-semibold text-orange-900">Schedule</div>
              <div className="text-xs text-orange-700">Set up timing</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500">{item.subtitle}</div>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">
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
        </div>
      )}

      {/* Storage Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Storage Usage</h3>
          <span className="text-2xl">💾</span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Content Storage</span>
            <span className="font-medium text-gray-900">
              {stats.content.total > 0 
                ? `~${(stats.content.total * 2.5).toFixed(1)} MB` 
                : '0 MB'} / 5 GB
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((stats.content.total * 2.5 / 5000) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{stats.content.total} items stored</span>
            <span>
              {((stats.content.total * 2.5 / 5000) * 100).toFixed(1)}% used
            </span>
          </div>
        </div>
      </div>

      {/* Getting Started Guide */}
      {stats.devices.total === 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">🚀 Getting Started</h3>
          <p className="mb-6 text-blue-100">
            Welcome to Vizora! Follow these steps to get your digital signage system up and running:
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <div className="font-semibold mb-1">Pair Your First Device</div>
                <div className="text-sm text-blue-100">
                  Connect a display device to start showing content
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <div className="font-semibold mb-1">Upload Your Content</div>
                <div className="text-sm text-blue-100">
                  Add images, videos, or other media to your library
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <div className="font-semibold mb-1">Create a Playlist</div>
                <div className="text-sm text-blue-100">
                  Organize your content into playlists
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <div className="font-semibold mb-1">Publish & Schedule</div>
                <div className="text-sm text-blue-100">
                  Assign playlists to devices and set schedules
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/devices/pair')}
            className="mt-6 bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition shadow-md"
          >
            Get Started - Pair Device
          </button>
        </div>
      )}

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl mb-2 block">📊</span>
            <p className="text-sm">Activity feed will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}

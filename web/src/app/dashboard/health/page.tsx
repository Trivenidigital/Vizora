'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Display } from '@/lib/types';
import DeviceHealthMonitor, { DeviceHealth } from '@/components/DeviceHealthMonitor';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import SearchFilter from '@/components/SearchFilter';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Icon } from '@/theme/icons';

// Mock device health data generator
const generateMockDeviceHealth = (deviceId: string, deviceName: string): DeviceHealth => {
  const baseScore = Math.random() * 40 + 60; // 60-100
  return {
    deviceId,
    cpuUsage: Math.floor(Math.random() * 80),
    memoryUsage: Math.floor(Math.random() * 75),
    storageUsage: Math.floor(Math.random() * 60),
    temperature: Math.floor(Math.random() * 30 + 35),
    uptime: Math.floor(Math.random() * 720), // Up to 30 days
    lastHeartbeat: new Date(Date.now() - Math.random() * 300000),
    score: Math.floor(baseScore),
  };
};

export default function HealthMonitoringPage() {
  const toast = useToast();
  const [devices, setDevices] = useState<Display[]>([]);
  const [deviceHealthData, setDeviceHealthData] = useState<Record<string, DeviceHealth>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortBy, setSortBy] = useState<'name' | 'health' | 'cpu' | 'memory'>('health');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadDevicesAndHealth();
  }, []);

  // Auto-refresh health data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadDevicesAndHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDevicesAndHealth = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDisplays();
      const displayDevices = response.data || response || [];
      setDevices(displayDevices);

      // Generate mock health data for each device
      const healthData: Record<string, DeviceHealth> = {};
      displayDevices.forEach((device: Display) => {
        healthData[device.id] = generateMockDeviceHealth(device.id, device.nickname);
      });
      setDeviceHealthData(healthData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load device health');
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatusColor = (score: number) => {
    if (score >= 90) return 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700';
    if (score >= 70) return 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700';
    if (score >= 50) return 'bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700';
    return 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700';
  };

  const getHealthStatusLabel = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-700 dark:text-green-300' };
    if (score >= 70) return { label: 'Good', color: 'text-blue-700 dark:text-blue-300' };
    if (score >= 50) return { label: 'Fair', color: 'text-yellow-700 dark:text-yellow-300' };
    return { label: 'Poor', color: 'text-red-700 dark:text-red-300' };
  };

  // Filter devices
  const filteredDevices = devices.filter(d =>
    !debouncedSearch ||
    d.nickname.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (d.location && d.location.toLowerCase().includes(debouncedSearch.toLowerCase()))
  );

  // Sort devices
  const sortedDevices = [...filteredDevices].sort((a, b) => {
    let compareValue = 0;
    const healthA = deviceHealthData[a.id];
    const healthB = deviceHealthData[b.id];

    switch (sortBy) {
      case 'name':
        compareValue = a.nickname.localeCompare(b.nickname);
        break;
      case 'health':
        compareValue = (healthA?.score || 0) - (healthB?.score || 0);
        break;
      case 'cpu':
        compareValue = (healthA?.cpuUsage || 0) - (healthB?.cpuUsage || 0);
        break;
      case 'memory':
        compareValue = (healthA?.memoryUsage || 0) - (healthB?.memoryUsage || 0);
        break;
      default:
        compareValue = 0;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Calculate aggregate stats
  const stats = {
    totalDevices: devices.length,
    healthy: devices.filter(d => (deviceHealthData[d.id]?.score || 0) >= 80).length,
    warning: devices.filter(d => {
      const score = deviceHealthData[d.id]?.score || 0;
      return score >= 50 && score < 80;
    }).length,
    critical: devices.filter(d => (deviceHealthData[d.id]?.score || 0) < 50).length,
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Device Health</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor device performance and system health
          </p>
        </div>
        <button
          onClick={loadDevicesAndHealth}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <Icon name="download" size="lg" className="text-white" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Health Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border-t-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-2">
                {stats.totalDevices}
              </p>
            </div>
            <Icon name="devices" size="3xl" className="text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border-t-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Healthy</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                {stats.healthy}
              </p>
            </div>
            <Icon name="success" size="3xl" className="text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border-t-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Warnings</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                {stats.warning}
              </p>
            </div>
            <Icon name="warning" size="3xl" className="text-yellow-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border-t-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                {stats.critical}
              </p>
            </div>
            <Icon name="error" size="3xl" className="text-red-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex flex-col md:flex-row gap-4 md:items-end">
        <div className="flex-1">
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search devices by name or location..."
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500"
          >
            <option value="health">Sort by Health</option>
            <option value="name">Sort by Name</option>
            <option value="cpu">Sort by CPU</option>
            <option value="memory">Sort by Memory</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Device Health Grid */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : sortedDevices.length === 0 ? (
        <EmptyState
          icon="devices"
          title="No devices found"
          description="Pair a device to begin monitoring health metrics"
          action={{
            label: 'Pair Device',
            onClick: () => window.location.href = '/dashboard/devices/pair',
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedDevices.map((device) => {
            const health = deviceHealthData[device.id];
            if (!health) return null;

            const healthStatus = getHealthStatusLabel(health.score);

            return (
              <div
                key={device.id}
                className={`rounded-lg shadow border p-6 transition-all hover:shadow-lg ${getHealthStatusColor(health.score)}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                      {device.nickname}
                    </h3>
                    {device.location && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        📍 {device.location}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${healthStatus.color}`}>
                      {health.score}
                    </p>
                    <p className={`text-xs font-semibold ${healthStatus.color}`}>
                      {healthStatus.label}
                    </p>
                  </div>
                </div>

                {/* Health Monitor Component */}
                <div className="mb-4">
                  <DeviceHealthMonitor health={health} showTemperature showUptime compact={false} />
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/50 dark:bg-gray-800/50 p-2 rounded">
                    <p className="text-gray-600 dark:text-gray-400 text-xs">Uptime</p>
                    <p className="font-medium text-gray-900 dark:text-gray-50">
                      {Math.floor(health.uptime / 24)}d {health.uptime % 24}h
                    </p>
                  </div>
                  <div className="bg-white/50 dark:bg-gray-800/50 p-2 rounded">
                    <p className="text-gray-600 dark:text-gray-400 text-xs">Temp</p>
                    <p className="font-medium text-gray-900 dark:text-gray-50">
                      {health.temperature}°C
                    </p>
                  </div>
                  <div className="bg-white/50 dark:bg-gray-800/50 p-2 rounded col-span-2">
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Last Heartbeat</p>
                    <p className="font-medium text-gray-900 dark:text-gray-50 text-xs">
                      {Math.round((Date.now() - health.lastHeartbeat.getTime()) / 1000)}s ago
                    </p>
                  </div>
                </div>

                {/* Alert Banner */}
                {health.score < 50 && (
                  <div className="mt-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded p-3">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                      ⚠️ Critical: Device performance degraded. Consider maintenance.
                    </p>
                  </div>
                )}
                {health.score < 70 && health.score >= 50 && (
                  <div className="mt-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded p-3">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      ⚡ Warning: Some metrics need attention.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { fetchAllPaginated } from '@/lib/api/pagination';
import { Display } from '@/lib/types';
import DeviceHealthMonitor, { DeviceHealth } from '@/components/DeviceHealthMonitor';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import SearchFilter from '@/components/SearchFilter';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useRealtimeEvents } from '@/lib/hooks';
import { Icon } from '@/theme/icons';

const parseDisplayHeartbeat = (device: Display): Date | null => {
 const raw = device.lastHeartbeat ?? device.lastSeen ?? null;
 if (!raw) return null;
 const parsed = new Date(raw);
 return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const HEALTH_REFRESH_INTERVAL_MS = 30000;

export const deriveDeviceHealthFromDisplay = (
 device: Display,
 nowMs: number = Date.now(),
): DeviceHealth => {
 const lastHeartbeat = parseDisplayHeartbeat(device);
 const ageMs = lastHeartbeat ? Math.max(0, nowMs - lastHeartbeat.getTime()) : null;
 const ageMinutes = ageMs == null ? null : ageMs / 60000;
 const status = String(device.status ?? 'offline').toLowerCase();

 let score = 25;
 if (status === 'online') {
 if (ageMinutes == null) score = 70;
 else if (ageMinutes <= 2) score = 100;
 else if (ageMinutes <= 5) score = 85;
 else if (ageMinutes <= 15) score = 70;
 else score = 55;
 } else if (status === 'pairing') {
 score = 65;
 } else if (status === 'error') {
 score = 35;
 } else {
 score = ageMinutes != null && ageMinutes <= 15 ? 45 : 25;
 }

 return {
 deviceId: device.id,
 cpuUsage: null,
 memoryUsage: null,
 storageUsage: null,
 temperature: null,
 uptime: null,
 lastHeartbeat,
 score,
 };
};

export default function HealthMonitoringClient() {
 const toast = useToast();
 const [devices, setDevices] = useState<Display[]>([]);
 const [deviceHealthData, setDeviceHealthData] = useState<Record<string, DeviceHealth>>({});
 const [loading, setLoading] = useState(true);
 const refreshInFlightRef = useRef(false);
 const [searchQuery, setSearchQuery] = useState('');
 const debouncedSearch = useDebounce(searchQuery, 300);
 const [sortBy, setSortBy] = useState<'name' | 'health' | 'status'>('health');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
 const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline' | 'error'>('offline');
 const [activeAlerts, setActiveAlerts] = useState<Record<string, any>>({});

 // Real-time event handling for health monitoring
 useRealtimeEvents({
 enabled: true,
 onConnectionChange: (isConnected) => {
 setRealtimeStatus(isConnected ? 'connected' : 'offline');
 },
 });

 useEffect(() => {
 loadDevicesAndHealth();
 }, []);

 // Auto-refresh health data without replacing the page with a loading spinner.
 useEffect(() => {
 const interval = setInterval(() => {
 loadDevicesAndHealth(false);
 }, HEALTH_REFRESH_INTERVAL_MS);
 return () => clearInterval(interval);
 }, []);

 const loadDevicesAndHealth = async (showLoading = true) => {
 if (refreshInFlightRef.current) return;
 refreshInFlightRef.current = true;
 try {
 if (showLoading) setLoading(true);
 const displayDevices = await fetchAllPaginated((params) => apiClient.getDisplays(params), undefined, 100, 5);
 setDevices(displayDevices);

 const healthData: Record<string, DeviceHealth> = {};
 displayDevices.forEach((device: Display) => {
 healthData[device.id] = deriveDeviceHealthFromDisplay(device);
 });
 setDeviceHealthData(healthData);
 } catch (error: any) {
 toast.error(error.message || 'Failed to load device health');
 } finally {
 if (showLoading) setLoading(false);
 refreshInFlightRef.current = false;
 }
 };

 /*
  * A FOUR-RUNG LADDER ON A THREE-INK VOCABULARY.
  *
  * Excellent / Good / Fair / Poor is ordinal, and the palette has exactly three
  * AA-safe status inks (success / warning / error). Two measured facts decided
  * where the fourth rung comes from, rather than taste:
  *
  * 1. A second green INK is not available. `--success` as text on the Good fill
  *    measures 2.78:1, so the only AA-safe green in the family is
  *    `--success-ink` itself.
  * 2. A fill ramp is not available either. The status tints are deliberately
  *    low-chroma washes of the page, so all four sit between 0.74 and 0.83
  *    relative luminance and are NOT monotonic. The fills cannot carry an
  *    order, which is the same reason globals.css says status has to survive a
  *    greyscale screenshot by glyph and label rather than by hue.
  *
  * So the top rung BORROWS `--primary-ink`, a deeper green of the same family:
  * deep green -> green -> brown -> red reads as a severity ramp by ink depth,
  * at 8.40 / 5.47 / 5.41 / 4.89:1, each measured on its own fill. No new hue is
  * introduced. The borrow is the part worth knowing about, since `--primary-ink`
  * is the brand ink doing double duty here. The alternative — giving Excellent
  * and Good the same ink and separating them by fill — was rejected because
  * fact 2 makes that a flattening wearing two class names.
  *
  * The rung is never carried by colour alone: the card renders the score and
  * the word as well.
  */
 const getHealthStatusColor = (score: number) => {
 if (score >= 90) return 'bg-[var(--badge-brand-bg)] border-brand/30';
 if (score >= 70) return 'bg-[var(--status-online-bg)] border-success-ink/30';
 if (score >= 50) return 'bg-[var(--status-error-bg)] border-warning-ink/30';
 return 'bg-[var(--status-offline-bg)] border-error-ink/30';
 };

 const getHealthStatusLabel = (score: number) => {
 if (score >= 90) return { label: 'Excellent', color: 'text-[var(--primary-ink)]' };
 if (score >= 70) return { label: 'Good', color: 'text-[var(--success-ink)]' };
 if (score >= 50) return { label: 'Fair', color: 'text-[var(--warning-ink)]' };
 return { label: 'Poor', color: 'text-[var(--error-ink)]' };
 };

 // Filter devices
 const filteredDevices = devices.filter(d =>
 !debouncedSearch ||
 (d.nickname || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
 (d.location && d.location.toLowerCase().includes(debouncedSearch.toLowerCase()))
 );

 // Sort devices
 const sortedDevices = [...filteredDevices].sort((a, b) => {
 let compareValue = 0;
 const healthA = deviceHealthData[a.id];
 const healthB = deviceHealthData[b.id];

 switch (sortBy) {
 case 'name':
 compareValue = (a.nickname || '').localeCompare(b.nickname || '');
 break;
 case 'status':
 compareValue = String(a.status || '').localeCompare(String(b.status || ''));
 break;
 case 'health':
 compareValue = (healthA?.score || 0) - (healthB?.score || 0);
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
 <h2 className="text-3xl font-bold text-[var(--foreground)]">Device Health</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Monitor device performance and system health
 {realtimeStatus === 'connected' && (
 <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--success-ink)]">
 <span className="w-2 h-2 bg-[var(--success-ink)] rounded-full animate-pulse"></span>
 Real-time monitoring active
 </span>
 )}
 {realtimeStatus === 'offline' && (
 <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--warning-ink)]">
 <span className="w-2 h-2 bg-[var(--warning-ink)] rounded-full"></span>
 Polling mode
 </span>
 )}
 </p>
 </div>
 <button
 onClick={() => loadDevicesAndHealth()}
 className="bg-[var(--primary)] text-[var(--lw-on-forest)] px-6 py-3 rounded-lg hover:bg-[var(--primary-light)] transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
 >
 <Icon name="download" size="lg" className="text-[var(--lw-on-forest)]" />
 <span>Refresh</span>
 </button>
 </div>

 {/* Health Statistics Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="bg-[var(--surface)] rounded-lg shadow p-6 border-t-4 border-[var(--primary-ink)]">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">Total Devices</p>
 <p className="text-2xl font-bold text-[var(--foreground)] mt-2">
 {stats.totalDevices}
 </p>
 </div>
 <Icon name="devices" size="3xl" className="text-[var(--primary-ink)] opacity-20" />
 </div>
 </div>

 <div className="bg-[var(--surface)] rounded-lg shadow p-6 border-t-4 border-[var(--success-ink)]">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">Healthy</p>
 <p className="text-2xl font-bold text-[var(--success-ink)] mt-2">
 {stats.healthy}
 </p>
 </div>
 <Icon name="success" size="3xl" className="text-[var(--success-ink)] opacity-20" />
 </div>
 </div>

 <div className="bg-[var(--surface)] rounded-lg shadow p-6 border-t-4 border-[var(--warning-ink)]">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">Warnings</p>
 <p className="text-2xl font-bold text-[var(--warning-ink)] mt-2">
 {stats.warning}
 </p>
 </div>
 <Icon name="warning" size="3xl" className="text-[var(--warning-ink)] opacity-20" />
 </div>
 </div>

 <div className="bg-[var(--surface)] rounded-lg shadow p-6 border-t-4 border-[var(--error-ink)]">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-[var(--foreground-secondary)]">Critical</p>
 <p className="text-2xl font-bold text-[var(--error-ink)] mt-2">
 {stats.critical}
 </p>
 </div>
 <Icon name="error" size="3xl" className="text-[var(--error-ink)] opacity-20" />
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
 className="px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary-ink)]"
 >
 <option value="health">Sort by Health</option>
 <option value="name">Sort by Name</option>
 <option value="status">Sort by Status</option>
 </select>
 <button
 onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
 className="px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition font-medium"
 >
 {sortOrder === 'asc' ? '↑' : '↓'}
 </button>
 </div>
 </div>

 {/* Device Health Grid */}
 {loading ? (
 <div className="bg-[var(--surface)] rounded-lg shadow p-12">
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
 <h3 className="text-lg font-semibold text-[var(--foreground)]">
 {device.nickname}
 </h3>
 {device.location && (
 <p className="text-sm text-[var(--foreground-secondary)] mt-1">
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
 <div className="bg-surface/50 p-2 rounded">
 <p className="text-[var(--foreground-secondary)] text-xs">Uptime</p>
 <p className="font-medium text-[var(--foreground)]">
 {typeof health.uptime === 'number' ? `${Math.floor(health.uptime / 24)}d ${health.uptime % 24}h` : 'Not reported'}
 </p>
 </div>
 <div className="bg-surface/50 p-2 rounded">
 <p className="text-[var(--foreground-secondary)] text-xs">Temp</p>
 <p className="font-medium text-[var(--foreground)]">
 {typeof health.temperature === 'number' ? `${health.temperature}°C` : 'Not reported'}
 </p>
 </div>
 <div className="bg-surface/50 p-2 rounded col-span-2">
 <p className="text-[var(--foreground-secondary)] text-xs mb-1">Last Heartbeat</p>
 <p className="font-medium text-[var(--foreground)] text-xs">
 {health.lastHeartbeat ? `${Math.round((Date.now() - health.lastHeartbeat.getTime()) / 1000)}s ago` : 'Never'}
 </p>
 </div>
 </div>

 {/* Real-time Alert Banner */}
 {activeAlerts[device.id] && (
 <div
 className={`mt-4 border rounded p-3 animate-pulse ${
 activeAlerts[device.id].severity === 'critical'
 ? 'bg-[var(--status-offline-bg)] border-error-ink/30'
 : activeAlerts[device.id].severity === 'warning'
 ? 'bg-[var(--status-error-bg)] border-warning-ink/30'
 : 'bg-[var(--status-pairing-bg)] border-info-ink/30'
 }`}
 >
 <p
 className={`text-sm font-semibold ${
 activeAlerts[device.id].severity === 'critical'
 ? 'text-[var(--error-ink)]'
 : activeAlerts[device.id].severity === 'warning'
 ? 'text-[var(--warning-ink)]'
 : 'text-[var(--info-ink)]'
 }`}
 >
 🔴 {activeAlerts[device.id].message}
 </p>
 </div>
 )}

 {/* Static Alert Banners */}
 {!activeAlerts[device.id] && health.score < 50 && (
 <div className="mt-4 bg-[var(--status-offline-bg)] border border-error-ink/30 rounded p-3">
 <p className="text-sm font-semibold text-[var(--error-ink)]">
 ⚠️ Critical: Device performance degraded. Consider maintenance.
 </p>
 </div>
 )}
 {!activeAlerts[device.id] && health.score < 70 && health.score >= 50 && (
 <div className="mt-4 bg-[var(--status-error-bg)] border border-warning-ink/30 rounded p-3">
 <p className="text-sm font-semibold text-[var(--warning-ink)]">
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

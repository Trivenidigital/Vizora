'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import type { PlatformHealth, PlatformServiceStatus } from '@/lib/types';
import { StatCard } from '../components/StatCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  Activity,
  Database,
  Server,
  HardDrive,
  Wifi,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Cpu,
  MemoryStick,
} from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    name: string;
    status: 'up' | 'down' | 'degraded';
    latency?: number;
    details?: string;
  }[];
  database: {
    status: 'up' | 'down';
    connections: number;
    maxConnections: number;
    latency: number;
  };
  redis: {
    status: 'up' | 'down';
    memory: number;
    maxMemory: number;
    latency: number;
  };
  storage: {
    status: 'up' | 'down' | 'unknown';
    used: number;
    total: number;
  };
  uptime: number;
  errorRate: {
    last1h: number;
    last24h: number;
  };
}

type HealthInput = HealthStatus | PlatformHealth;

interface AdminHealthClientProps {
  initialHealth: HealthInput | null;
}

const UNAVAILABLE_HEALTH: HealthStatus = {
  status: 'down',
  services: [
    {
      name: 'Admin health API',
      status: 'down',
      details: 'Health status unavailable',
    },
  ],
  database: { status: 'down', connections: 0, maxConnections: 0, latency: 0 },
  redis: { status: 'down', memory: 0, maxMemory: 0, latency: 0 },
  storage: { status: 'unknown', used: 0, total: 0 },
  uptime: 0,
  errorRate: { last1h: 0, last24h: 0 },
};

function hasPlatformHealthShape(health: HealthInput): health is PlatformHealth {
  const maybeHealth = health as Partial<PlatformHealth>;
  const services = maybeHealth.services as Partial<PlatformHealth['services']> | undefined;

  return (
    typeof maybeHealth.overall === 'string' &&
    typeof services === 'object' &&
    services !== null &&
    !Array.isArray(services) &&
    Boolean(services.database) &&
    Boolean(services.redis) &&
    Boolean(services.middleware) &&
    Boolean(services.web) &&
    Boolean(services.realtime)
  );
}

function mapOverallStatus(overall: PlatformHealth['overall']): HealthStatus['status'] {
  return overall === 'unhealthy' ? 'down' : overall;
}

function mapServiceStatus(status: PlatformServiceStatus['status']): HealthStatus['services'][number]['status'] {
  if (status === 'healthy') return 'up';
  if (status === 'unknown') return 'degraded';
  return 'down';
}

function formatServiceName(name: string): string {
  const labels: Record<string, string> = {
    middleware: 'Middleware',
    web: 'Web',
    realtime: 'Realtime',
  };

  return labels[name] ?? name;
}

function normalizeHealthStatus(health: HealthInput | null): HealthStatus | null {
  if (!health) return null;

  if (!('overall' in health)) {
    return health;
  }

  if (!hasPlatformHealthShape(health)) {
    return UNAVAILABLE_HEALTH;
  }

  const { services } = health;

  return {
    status: mapOverallStatus(health.overall),
    services: [services.middleware, services.web, services.realtime].map((service) => ({
      name: formatServiceName(service.name),
      status: mapServiceStatus(service.status),
      latency: service.responseTime,
      details: service.error,
    })),
    database: {
      status: services.database.healthy ? 'up' : 'down',
      connections: 0,
      maxConnections: 0,
      latency: services.database.responseTime,
    },
    redis: {
      status: services.redis.healthy ? 'up' : 'down',
      memory: 0,
      maxMemory: 0,
      latency: services.redis.responseTime,
    },
    storage: {
      status: 'unknown',
      used: 0,
      total: 0,
    },
    uptime: 0,
    errorRate: { last1h: 0, last24h: 0 },
  };
}

export default function AdminHealthClient({ initialHealth }: AdminHealthClientProps) {
  const toast = useToast();
  const [health, setHealth] = useState<HealthInput | null>(initialHealth);
  const [loading, setLoading] = useState(!initialHealth);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await apiClient.getPlatformHealth();
      setHealth(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load health status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialHealth) {
      loadHealth();
    }
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => loadHealth(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return 'Not reported';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const formatLatency = (value: number | undefined) => {
    return typeof value === 'number' && Number.isFinite(value) ? `${value}ms latency` : 'Latency not reported';
  };

  const formatDbConnections = () => {
    if (healthData.database.maxConnections <= 0) return 'Not reported';
    return `${healthData.database.connections}/${healthData.database.maxConnections}`;
  };

  const formatStorageUsed = () => {
    if (healthData.storage.total <= 0) return 'Not reported';
    return formatBytes(healthData.storage.used);
  };

  const formatStorageSubtitle = () => {
    if (healthData.storage.total <= 0) return 'Usage not reported';
    return `of ${formatBytes(healthData.storage.total)}`;
  };

  const formatStorageDetail = () => {
    if (healthData.storage.total <= 0) return 'Storage metrics not reported';
    return `${formatBytes(healthData.storage.used)} / ${formatBytes(healthData.storage.total)}`;
  };

  const formatMemoryUsage = () => {
    if (healthData.redis.maxMemory <= 0) return 'Not reported';
    return `${formatBytes(healthData.redis.memory)} / ${formatBytes(healthData.redis.maxMemory)}`;
  };

  const formatPercentUsed = (used: number, total: number) => {
    if (total <= 0) return 'Unknown';
    return `${((used / total) * 100).toFixed(1)}% used`;
  };

  const getBarWidth = (used: number, total: number) => {
    if (total <= 0) return '0%';
    return `${Math.min(100, Math.max(0, (used / total) * 100))}%`;
  };

  const getOverallMessage = () => {
    const uptimeSuffix = healthData.uptime > 0 ? ` - Uptime: ${formatUptime(healthData.uptime)}` : '';
    if (healthData.status === 'healthy') {
      return `All services operational${uptimeSuffix}`;
    }
    if (healthData.status === 'degraded') {
      return `Some services need attention${uptimeSuffix}`;
    }
    return 'Health status unavailable or critical';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unknown':
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'degraded':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'unknown':
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const healthData = normalizeHealthStatus(health) ?? UNAVAILABLE_HEALTH;

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">System Health</h1>
          <p className="mt-1 text-[var(--foreground-secondary)]">
            Monitor platform services and infrastructure
          </p>
        </div>
        <button
          onClick={() => loadHealth(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      <div
        className={`p-6 rounded-xl border-2 ${
          healthData.status === 'healthy'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : healthData.status === 'degraded'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
      >
        <div className="flex items-center gap-4">
          {getStatusIcon(healthData.status)}
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] capitalize">
              System {healthData.status}
            </h2>
            <p className="text-sm text-[var(--foreground-secondary)]">
              {getOverallMessage()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Uptime" value={formatUptime(healthData.uptime)} icon={<Clock className="w-6 h-6" />} color="green" />
        <StatCard
          title="Error Rate (1h)"
          value={`${healthData.errorRate.last1h.toFixed(2)}%`}
          subtitle={`24h: ${healthData.errorRate.last24h.toFixed(2)}%`}
          icon={<AlertTriangle className="w-6 h-6" />}
          color={healthData.errorRate.last1h > 1 ? 'red' : 'green'}
        />
        <StatCard
          title="DB Connections"
          value={formatDbConnections()}
          subtitle={formatLatency(healthData.database.latency)}
          icon={<Database className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Storage Used"
          value={formatStorageUsed()}
          subtitle={formatStorageSubtitle()}
          icon={<HardDrive className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Services Status */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <Server className="w-5 h-5" />
            Services
          </h3>
          <div className="space-y-3">
            {healthData.services.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)]">
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <span className="font-medium text-[var(--foreground)]">{service.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  {service.latency !== undefined && (
                    <span className="text-sm text-[var(--foreground-tertiary)]">{service.latency}ms</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(service.status)}`}>
                    {service.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Infrastructure */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Infrastructure
          </h3>
          <div className="space-y-4">
            {/* Database */}
            <div className="p-4 rounded-lg bg-[var(--background)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#00E5A0]" />
                  <span className="font-medium text-[var(--foreground)]">PostgreSQL</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(healthData.database.status)}`}>
                  {healthData.database.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-[var(--foreground-tertiary)]">
                <span>
                  {healthData.database.maxConnections > 0
                    ? `${healthData.database.connections} / ${healthData.database.maxConnections} connections`
                    : 'Connections not reported'}
                </span>
                <span>{formatLatency(healthData.database.latency)}</span>
              </div>
              <div className="mt-2 h-2 bg-[var(--background-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00E5A0] rounded-full transition-all"
                  style={{ width: getBarWidth(healthData.database.connections, healthData.database.maxConnections) }}
                />
              </div>
            </div>

            {/* Redis */}
            <div className="p-4 rounded-lg bg-[var(--background)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MemoryStick className="w-5 h-5 text-red-500" />
                  <span className="font-medium text-[var(--foreground)]">Redis</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(healthData.redis.status)}`}>
                  {healthData.redis.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-[var(--foreground-tertiary)]">
                <span>{formatMemoryUsage()}</span>
                <span>{formatLatency(healthData.redis.latency)}</span>
              </div>
              <div className="mt-2 h-2 bg-[var(--background-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: getBarWidth(healthData.redis.memory, healthData.redis.maxMemory) }}
                />
              </div>
            </div>

            {/* Storage */}
            <div className="p-4 rounded-lg bg-[var(--background)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-purple-500" />
                  <span className="font-medium text-[var(--foreground)]">MinIO Storage</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(healthData.storage.status)}`}>
                  {healthData.storage.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-[var(--foreground-tertiary)]">
                <span>{formatStorageDetail()}</span>
                <span>{formatPercentUsed(healthData.storage.used, healthData.storage.total)}</span>
              </div>
              <div className="mt-2 h-2 bg-[var(--background-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: getBarWidth(healthData.storage.used, healthData.storage.total) }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

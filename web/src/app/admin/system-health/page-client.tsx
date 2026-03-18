'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  Activity,
  Database,
  Server,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Bell,
  Lock,
  Mail,
  CreditCard,
  FileCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelfTestCheck {
  passed: boolean;
  message: string;
  duration_ms: number;
  details?: Record<string, unknown>;
  // Type-specific fields
  failures?: string[];
  count?: number;
  configured?: boolean;
  stripe?: boolean;
  razorpay?: boolean;
  mismatches?: string[];
}

interface SelfTestResult {
  passed: boolean;
  timestamp: string;
  duration_ms: number;
  results: Record<string, SelfTestCheck>;
}

interface MonitorCheck {
  status: 'healthy' | 'warning' | 'degraded' | 'critical';
  value: number;
  message: string;
  slowest?: { endpoint: string; ms: number };
  expires_in_days?: number;
}

interface MonitorResult {
  timestamp: string;
  overall: 'healthy' | 'warning' | 'degraded' | 'critical';
  checks: Record<string, MonitorCheck>;
}

interface HealthMetrics {
  avg_latency_ms: number;
  error_rate_5xx: number;
  uptime_pct: number;
  checks_count: number;
}

interface SparklinePoint {
  t: string;
  s: string;
  l: number;
  e: number;
  d: number;
}

// ---------------------------------------------------------------------------
// Sparkline component (pure CSS, no chart library needed)
// ---------------------------------------------------------------------------

function Sparkline({ data, color = '#00E5A0', height = 32 }: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length === 0) return <div style={{ height }} className="text-xs text-[var(--foreground-tertiary)]">No data</div>;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 200;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
    healthy: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
    passed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
    warning: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: AlertTriangle },
    degraded: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', icon: AlertTriangle },
    critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: XCircle },
    failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: XCircle },
    pending: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400', icon: Clock },
    running: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: RefreshCw },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

const selfTestIcons: Record<string, typeof Database> = {
  database: Database,
  redis: Server,
  minio: Shield,
  api_endpoints: Zap,
  templates: FileCheck,
  email: Mail,
  billing: CreditCard,
  id_consistency: Lock,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SystemHealthClient() {
  const [selfTest, setSelfTest] = useState<SelfTestResult | null>(null);
  const [monitor, setMonitor] = useState<MonitorResult | null>(null);
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [history, setHistory] = useState<SparklinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);

      const [selfTestRes, monitorRes, metricsRes, historyRes] = await Promise.allSettled([
        apiClient.getHealthSelfTest(),
        apiClient.getHealthMonitorCurrent(),
        apiClient.getHealthMonitorMetrics(),
        apiClient.getHealthMonitorHistory(),
      ]);

      if (selfTestRes.status === 'fulfilled' && selfTestRes.value?.results) {
        setSelfTest(selfTestRes.value as unknown as SelfTestResult);
      }
      if (monitorRes.status === 'fulfilled' && monitorRes.value?.checks) {
        setMonitor(monitorRes.value as unknown as MonitorResult);
      }
      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value as unknown as HealthMetrics);
      }
      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)) {
        setHistory(historyRes.value as unknown as SparklinePoint[]);
      }
    } catch {
      // Individual errors handled by Promise.allSettled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRerunSelfTest = async () => {
    try {
      await apiClient.triggerHealthSelfTest();
      // Wait a few seconds for it to complete, then reload
      setTimeout(() => loadData(true), 5000);
    } catch {
      // Ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const monitorOverall = monitor?.overall || 'pending';
  const selfTestStatus = selfTest ? (selfTest.passed ? 'passed' : 'failed') : 'pending';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">System Health Monitor</h1>
          <p className="mt-1 text-[var(--foreground-secondary)]">
            Multi-layer health monitoring with sparkline trends
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall Status Banner */}
      <div
        className={`p-6 rounded-xl border-2 ${
          monitorOverall === 'healthy'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : monitorOverall === 'warning'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <StatusBadge status={monitorOverall} />
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Continuous Monitor: {monitorOverall.toUpperCase()}
              </h2>
              {monitor?.timestamp && (
                <p className="text-sm text-[var(--foreground-secondary)]">
                  Last check: {new Date(monitor.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={selfTestStatus} />
            <span className="text-sm text-[var(--foreground-secondary)]">Self-test</span>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="Avg Latency"
            value={`${metrics.avg_latency_ms}ms`}
            icon={<Zap className="w-5 h-5" />}
            sparkData={history.map((h) => h.l)}
            color={metrics.avg_latency_ms < 200 ? '#00E5A0' : metrics.avg_latency_ms < 500 ? '#EAB308' : '#EF4444'}
          />
          <MetricCard
            title="5xx Errors"
            value={String(metrics.error_rate_5xx)}
            icon={<AlertTriangle className="w-5 h-5" />}
            sparkData={history.map((h) => h.e)}
            color={metrics.error_rate_5xx === 0 ? '#00E5A0' : '#EF4444'}
          />
          <MetricCard
            title="Uptime"
            value={`${metrics.uptime_pct}%`}
            icon={<Activity className="w-5 h-5" />}
            color="#00E5A0"
          />
          <MetricCard
            title="DB Latency"
            value={monitor?.checks?.database ? `${monitor.checks.database.value}ms` : 'N/A'}
            icon={<Database className="w-5 h-5" />}
            sparkData={history.map((h) => h.d)}
            color="#3B82F6"
          />
        </div>
      )}

      {/* Continuous Monitor Checks */}
      {monitor?.checks && (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Continuous Health Checks (every 5 min)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(monitor.checks).map(([name, check]) => (
              <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)]">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={check.status} />
                  <span className="font-medium text-sm text-[var(--foreground)] truncate">
                    {name.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-xs text-[var(--foreground-tertiary)] ml-2 whitespace-nowrap">
                  {check.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Self-Test Results */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Startup Self-Test
          </h3>
          <div className="flex items-center gap-3">
            {selfTest?.timestamp && (
              <span className="text-xs text-[var(--foreground-tertiary)]">
                {new Date(selfTest.timestamp).toLocaleString()} ({selfTest.duration_ms}ms)
              </span>
            )}
            <button
              onClick={handleRerunSelfTest}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--foreground-secondary)] bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
            >
              <RefreshCw className="w-3 h-3" />
              Re-run
            </button>
          </div>
        </div>

        {selfTest?.results ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(selfTest.results).map(([name, check]) => {
              const Icon = selfTestIcons[name] || CheckCircle;
              return (
                <div
                  key={name}
                  className={`p-3 rounded-lg border ${
                    check.passed
                      ? 'border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10'
                      : 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${check.passed ? 'text-green-500' : 'text-red-500'}`} />
                      <span className="font-medium text-sm text-[var(--foreground)]">
                        {name.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--foreground-tertiary)]">{check.duration_ms}ms</span>
                  </div>
                  <p className="text-xs text-[var(--foreground-secondary)] mt-1">{check.message}</p>
                  {check.failures && check.failures.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {check.failures.map((f, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400">
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  {check.mismatches && check.mismatches.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {check.mismatches.map((m, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400">
                          {m}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--foreground-tertiary)]">Self-test has not run yet. It runs automatically on server startup.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({
  title,
  value,
  icon,
  sparkData,
  color = '#00E5A0',
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  sparkData?: number[];
  color?: string;
}) {
  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--foreground-secondary)]">{title}</span>
        <span className="text-[var(--foreground-tertiary)]">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-[var(--foreground)]" style={{ color }}>
        {value}
      </div>
      {sparkData && sparkData.length > 1 && (
        <div className="mt-2">
          <Sparkline data={sparkData} color={color} height={24} />
        </div>
      )}
    </div>
  );
}

'use client';

import { Icon } from '@/theme/icons';

export interface DeviceHealth {
  deviceId: string;
  cpuUsage: number;       // 0-100%
  memoryUsage: number;    // 0-100%
  storageUsage: number;   // 0-100%
  temperature: number;    // °C
  uptime: number;         // hours
  lastHeartbeat: Date;
  score: number;          // 0-100 health score
}

interface DeviceHealthMonitorProps {
  health: DeviceHealth;
  showTemperature?: boolean;
  showUptime?: boolean;
  compact?: boolean;
  className?: string;
}

const getHealthStatus = (score: number): { label: string; color: string; bgColor: string } => {
  if (score >= 90) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900' };
  if (score >= 70) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900' };
  if (score >= 50) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900' };
  return { label: 'Poor', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900' };
};

const getMetricStatus = (value: number, thresholds: { warning: number; critical: number }): string => {
  if (value >= thresholds.critical) return 'bg-red-500';
  if (value >= thresholds.warning) return 'bg-yellow-500';
  return 'bg-green-500';
};

const MetricBar = ({ label, value, unit, thresholds }: any) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className="text-gray-600 dark:text-gray-400">
        {value.toFixed(1)}{unit}
      </span>
    </div>
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${getMetricStatus(value, thresholds)} transition-all`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  </div>
);

export default function DeviceHealthMonitor({
  health,
  showTemperature = true,
  showUptime = true,
  compact = false,
  className = '',
}: DeviceHealthMonitorProps) {
  const healthStatus = getHealthStatus(health.score);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Health:</div>
        <div className={`px-2 py-1 rounded text-xs font-semibold ${healthStatus.bgColor} ${healthStatus.color}`}>
          {health.score}%
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{healthStatus.label}</div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4 ${className}`}>
      {/* Overall Health Score */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Device Health</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Updated {new Date(health.lastHeartbeat).toLocaleTimeString()}</p>
        </div>
        <div className={`text-right ${healthStatus.color}`}>
          <div className="text-2xl font-bold">{health.score}%</div>
          <div className="text-xs font-medium">{healthStatus.label}</div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* CPU */}
        <div className="space-y-2">
          <MetricBar
            label="CPU"
            value={health.cpuUsage}
            unit="%"
            thresholds={{ warning: 70, critical: 85 }}
          />
        </div>

        {/* Memory */}
        <div className="space-y-2">
          <MetricBar
            label="Memory"
            value={health.memoryUsage}
            unit="%"
            thresholds={{ warning: 75, critical: 90 }}
          />
        </div>

        {/* Storage */}
        <div className="space-y-2">
          <MetricBar
            label="Storage"
            value={health.storageUsage}
            unit="%"
            thresholds={{ warning: 80, critical: 95 }}
          />
        </div>

        {/* Temperature */}
        {showTemperature && (
          <div className="space-y-2">
            <MetricBar
              label="Temperature"
              value={health.temperature}
              unit="°C"
              thresholds={{ warning: 50, critical: 65 }}
            />
          </div>
        )}
      </div>

      {/* Uptime */}
      {showUptime && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">Uptime</span>
            <span className="font-semibold text-gray-900 dark:text-gray-50">
              {health.uptime >= 24
                ? `${(health.uptime / 24).toFixed(1)} days`
                : `${health.uptime.toFixed(1)} hours`}
            </span>
          </div>
        </div>
      )}

      {/* Health Alerts */}
      {health.score < 70 && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
          <div className={`px-3 py-2 rounded text-xs font-medium ${healthStatus.bgColor} ${healthStatus.color} flex items-center gap-2`}>
            <Icon name="alertTriangle" size="sm" />
            <span>
              {health.score < 50
                ? 'Device health is poor. Recommended immediate maintenance.'
                : 'Device health is degraded. Monitor closely.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

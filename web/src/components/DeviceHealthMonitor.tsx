'use client';

import { Icon } from '@/theme/icons';

export interface DeviceHealth {
  deviceId: string;
  cpuUsage: number | null;       // 0-100%, null when device telemetry is unavailable
  memoryUsage: number | null;    // 0-100%, null when device telemetry is unavailable
  storageUsage: number | null;   // 0-100%, null when device telemetry is unavailable
  temperature: number | null;    // °C, null when device telemetry is unavailable
  uptime: number | null;         // hours, null when device telemetry is unavailable
  lastHeartbeat: Date | null;
  score: number;          // 0-100 health score
}

interface DeviceHealthMonitorProps {
  health: DeviceHealth;
  showTemperature?: boolean;
  showUptime?: boolean;
  compact?: boolean;
  className?: string;
}

/*
 * The inks here were already tokens; the TINTS under them were raw `-100`
 * Tailwind steps, which are cool pastels on a warm page. They now take the
 * documented badge pairs, each measured ink-on-its-own-fill in globals.css:
 * online 5.47:1, error 5.41:1, offline 4.89:1. 'Good' already carried
 * `bg-brand/10` with `--primary-ink` (8.40:1) and is unchanged.
 */
const getHealthStatus = (score: number): { label: string; color: string; bgColor: string } => {
  if (score >= 90) return { label: 'Excellent', color: 'text-[var(--success-ink)]', bgColor: 'bg-[var(--status-online-bg)]' };
  if (score >= 70) return { label: 'Good', color: 'text-[var(--primary-ink)]', bgColor: 'bg-brand/10' };
  if (score >= 50) return { label: 'Fair', color: 'text-[var(--warning-ink)]', bgColor: 'bg-[var(--status-error-bg)]' };
  return { label: 'Poor', color: 'text-[var(--error-ink)]', bgColor: 'bg-[var(--status-offline-bg)]' };
};

/*
 * `MetricBar`'s track is `--background-tertiary`, where the `-500` fills measure
 * 3.74:1 (red), 2.47:1 (amber) and 2.55:1 (green) - two of the three under the
 * 3:1 a meaningful graphic needs. The inks are 5.01:1, 5.49:1 and 5.53:1 on the
 * same track. Same finding as `ui/Progress`, same fix.
 */
const getMetricStatus = (value: number, thresholds: { warning: number; critical: number }): string => {
  if (value >= thresholds.critical) return 'bg-[var(--error-ink)]';
  if (value >= thresholds.warning) return 'bg-[var(--warning-ink)]';
  return 'bg-[var(--success-ink)]';
};

const MetricBar = ({ label, value, unit, thresholds }: any) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="font-medium text-[var(--foreground-secondary)]">{label}</span>
      <span className="text-[var(--foreground-secondary)]">
        {typeof value === 'number' ? `${value.toFixed(1)}${unit}` : 'Not reported'}
      </span>
    </div>
    <div className="w-full h-2 bg-[var(--background-tertiary)] rounded-full overflow-hidden">
      <div
        className={`h-full ${typeof value === 'number' ? getMetricStatus(value, thresholds) : 'bg-foreground-tertiary/30'} transition-all`}
        style={{ width: `${typeof value === 'number' ? Math.min(value, 100) : 0}%` }}
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
        <div className="text-sm font-medium text-[var(--foreground-secondary)]">Health:</div>
        <div className={`px-2 py-1 rounded text-xs font-semibold ${healthStatus.bgColor} ${healthStatus.color}`}>
          {health.score}%
        </div>
        <div className="text-xs text-[var(--foreground-tertiary)]">{healthStatus.label}</div>
      </div>
    );
  }

  return (
    <div className={`bg-[var(--surface)] rounded-lg border border-[var(--border)] p-4 space-y-4 ${className}`}>
      {/* Overall Health Score */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Device Health</h3>
          <p className="text-xs text-[var(--foreground-tertiary)] mt-1">
            {health.lastHeartbeat ? `Updated ${new Date(health.lastHeartbeat).toLocaleTimeString()}` : 'No heartbeat reported'}
          </p>
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
        <div className="pt-2 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--foreground-secondary)]">Uptime</span>
            <span className="font-semibold text-[var(--foreground)]">
              {typeof health.uptime !== 'number'
                ? 'Not reported'
                : health.uptime >= 24
                ? `${(health.uptime / 24).toFixed(1)} days`
                : `${health.uptime.toFixed(1)} hours`}
            </span>
          </div>
        </div>
      )}

      {/* Health Alerts */}
      {health.score < 70 && (
        <div className="pt-2 border-t border-[var(--border)]">
          <div className={`px-3 py-2 rounded text-xs font-medium ${healthStatus.bgColor} ${healthStatus.color} flex items-center gap-2`}>
            <Icon name="warning" size="sm" />
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

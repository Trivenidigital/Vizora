'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Icon } from '@/theme/icons';

// ─── Types (mirrors scripts/ops/lib/types.ts) ──────────────────────────────

type Severity = 'critical' | 'warning' | 'info';
type SystemStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
type IncidentStatus = 'open' | 'resolved' | 'escalated';

interface Incident {
  id: string;
  agent: string;
  type: string;
  severity: Severity;
  target: string;
  targetId: string;
  detected: string;
  message: string;
  remediation: string;
  status: IncidentStatus;
  attempts: number;
  resolvedAt?: string;
  error?: string;
}

interface RemediationAction {
  agent: string;
  timestamp: string;
  action: string;
  target: string;
  targetId: string;
  method: string;
  endpoint?: string;
  before?: unknown;
  after?: unknown;
  success: boolean;
  error?: string;
}

interface AgentResult {
  agent: string;
  timestamp: string;
  durationMs: number;
  issuesFound: number;
  issuesFixed: number;
  issuesEscalated: number;
  incidents: Incident[];
}

interface OpsState {
  systemStatus: SystemStatus;
  lastUpdated: string;
  lastRun: Record<string, string>;
  incidents: Incident[];
  recentRemediations: RemediationAction[];
  agentResults: Record<string, AgentResult>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'health-guardian': 'Health Guardian',
  'content-lifecycle': 'Content Lifecycle',
  'fleet-manager': 'Fleet Manager',
  'schedule-doctor': 'Schedule Doctor',
  'ops-reporter': 'Ops Reporter',
  'db-maintainer': 'DB Maintainer',
};

const REFRESH_INTERVAL_MS = 60_000;

function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SystemStatus }) {
  const config: Record<SystemStatus, { bg: string; text: string; ring: string; dot: string }> = {
    HEALTHY: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      ring: 'ring-green-500/30',
      dot: 'bg-green-500',
    },
    DEGRADED: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-800 dark:text-amber-300',
      ring: 'ring-amber-500/30',
      dot: 'bg-amber-500',
    },
    CRITICAL: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-300',
      ring: 'ring-red-500/30',
      dot: 'bg-red-500 animate-pulse',
    },
  };

  const c = config[status] ?? config.HEALTHY;

  return (
    <span
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-bold ring-2 ${c.bg} ${c.text} ${c.ring}`}
    >
      <span className={`w-3 h-3 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

// ─── Severity Badge (for incidents table) ───────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const config: Record<Severity, { bg: string; text: string; icon: 'error' | 'warning' | 'info' }> = {
    critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: 'error' },
    warning: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', icon: 'warning' },
    info: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: 'info' },
  };
  const c = config[severity] ?? config.info;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${c.bg} ${c.text}`}>
      <Icon name={c.icon} size="sm" />
      {severity}
    </span>
  );
}

// ─── Incident Status Badge ──────────────────────────────────────────────────

function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const styles: Record<IncidentStatus, string> = {
    open: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    escalated: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styles[status] ?? styles.open}`}>
      {status}
    </span>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function OpsStatusPage() {
  const [opsData, setOpsData] = useState<OpsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchOpsStatus = useCallback(async () => {
    try {
      const data = await apiClient.get<OpsState>('/health/ops-status');
      // If the response has a systemStatus field, it's valid ops data
      if (data && typeof data === 'object' && 'systemStatus' in data) {
        setOpsData(data);
        setError(null);
      } else {
        // Endpoint returned but no ops data stored yet
        setOpsData(null);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ops status');
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchOpsStatus();
  }, [fetchOpsStatus]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchOpsStatus, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOpsStatus]);

  // ─── Agent cards data ────────────────────────────────────────────────────

  const agentEntries = opsData
    ? Object.entries(opsData.agentResults)
    : [];

  // ─── Active incidents (non-resolved, sorted critical first) ──────────────

  const activeIncidents = opsData
    ? opsData.incidents
        .filter((i) => i.status !== 'resolved')
        .sort((a, b) => {
          const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
          return (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2);
        })
    : [];

  // ─── Recent remediations (last 24h) ──────────────────────────────────────

  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentRemediations = opsData
    ? opsData.recentRemediations
        .filter((r) => new Date(r.timestamp).getTime() > twentyFourHoursAgo)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-[var(--foreground)]">Ops Status</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">Autonomous operations monitoring</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <Icon name="error" size="3xl" className="mx-auto text-red-500 mb-3" />
          <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
          <button
            onClick={fetchOpsStatus}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!opsData || !('systemStatus' in opsData) || opsData.systemStatus === ('unknown' as SystemStatus)) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-[var(--foreground)]">Ops Status</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">Autonomous operations monitoring</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-12 text-center">
          <Icon name="info" size="3xl" className="mx-auto text-[var(--foreground-tertiary)] mb-3" />
          <p className="text-lg font-medium text-[var(--foreground)]">No ops data available</p>
          <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
            Ops agents have not reported yet. Data will appear after the first agent run.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--foreground)]">Ops Status</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">
            Autonomous operations monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={opsData.systemStatus} />
          <button
            onClick={fetchOpsStatus}
            className="bg-[#00E5A0] text-[#061A21] px-5 py-2.5 rounded-lg hover:bg-[#00CC8E] transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Icon name="refresh" size="md" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Last updated ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-[var(--foreground-tertiary)]">
        <Icon name="clock" size="sm" />
        <span>
          Last updated: {formatTimestamp(opsData.lastUpdated)}
          {lastFetch && (
            <span className="ml-2">(fetched {timeAgo(lastFetch.toISOString())})</span>
          )}
        </span>
        <span className="ml-2 text-xs opacity-60">Auto-refreshes every 60s</span>
      </div>

      {/* ── Agent Status Cards ────────────────────────────────────────────── */}
      <section>
        <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">Agent Status</h3>
        {agentEntries.length === 0 ? (
          <p className="text-[var(--foreground-secondary)] text-sm">No agent results yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentEntries.map(([agentKey, result]) => {
              const displayName = AGENT_DISPLAY_NAMES[agentKey] || agentKey;
              const hasIssues = result.issuesFound > 0;
              const allFixed = result.issuesFound > 0 && result.issuesFixed === result.issuesFound;
              const hasEscalated = result.issuesEscalated > 0;

              // Determine card accent color
              let borderColor = 'border-green-500';
              let dotColor = 'bg-green-500';
              if (hasEscalated) {
                borderColor = 'border-red-500';
                dotColor = 'bg-red-500';
              } else if (hasIssues && !allFixed) {
                borderColor = 'border-amber-500';
                dotColor = 'bg-amber-500';
              }

              return (
                <div
                  key={agentKey}
                  className={`bg-[var(--surface)] rounded-lg shadow border-t-4 ${borderColor} p-5 transition hover:shadow-lg`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                      <h4 className="font-semibold text-[var(--foreground)]">{displayName}</h4>
                    </div>
                    <span className="text-xs text-[var(--foreground-tertiary)]">
                      {timeAgo(result.timestamp)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-[var(--surface-hover)] rounded-md p-2">
                      <p className="text-lg font-bold text-[var(--foreground)]">{result.issuesFound}</p>
                      <p className="text-xs text-[var(--foreground-tertiary)]">Found</p>
                    </div>
                    <div className="bg-[var(--surface-hover)] rounded-md p-2">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">{result.issuesFixed}</p>
                      <p className="text-xs text-[var(--foreground-tertiary)]">Fixed</p>
                    </div>
                    <div className="bg-[var(--surface-hover)] rounded-md p-2">
                      <p className={`text-lg font-bold ${result.issuesEscalated > 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--foreground)]'}`}>
                        {result.issuesEscalated}
                      </p>
                      <p className="text-xs text-[var(--foreground-tertiary)]">Escalated</p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-[var(--foreground-tertiary)] flex items-center gap-1">
                    <Icon name="clock" size="sm" />
                    <span>Duration: {result.durationMs}ms</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Active Incidents Table ────────────────────────────────────────── */}
      <section>
        <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">
          Active Incidents
          {activeIncidents.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[var(--foreground-secondary)]">
              ({activeIncidents.length})
            </span>
          )}
        </h3>

        {activeIncidents.length === 0 ? (
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
            <Icon name="success" size="3xl" className="mx-auto text-green-500 mb-2" />
            <p className="text-green-700 dark:text-green-300 font-medium">No active incidents</p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">All systems operating normally</p>
          </div>
        ) : (
          <div className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)]">
                <thead className="bg-[var(--surface-hover)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Detected
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {activeIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-[var(--surface-hover)] transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SeverityBadge severity={incident.severity} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground)]">
                        {incident.type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground-secondary)]">
                        <span className="font-medium">{incident.target}</span>
                        <span className="text-xs text-[var(--foreground-tertiary)] ml-1">
                          {incident.targetId.substring(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--foreground)] max-w-xs truncate">
                        {incident.message}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <IncidentStatusBadge status={incident.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground-tertiary)]">
                        {timeAgo(incident.detected)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Remediation History ───────────────────────────────────────────── */}
      <section>
        <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">
          Remediation History
          <span className="ml-2 text-sm font-normal text-[var(--foreground-secondary)]">
            (last 24h)
          </span>
        </h3>

        {recentRemediations.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 text-center">
            <p className="text-[var(--foreground-secondary)]">No remediations in the last 24 hours</p>
          </div>
        ) : (
          <div className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)]">
                <thead className="bg-[var(--surface-hover)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Result
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {recentRemediations.map((rem, idx) => (
                    <tr key={`${rem.agent}-${rem.timestamp}-${idx}`} className="hover:bg-[var(--surface-hover)] transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rem.success ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium">
                            <Icon name="success" size="sm" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-medium">
                            <Icon name="error" size="sm" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground)]">
                        {AGENT_DISPLAY_NAMES[rem.agent] || rem.agent}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--foreground)] max-w-xs truncate">
                        {rem.action}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground-secondary)]">
                        <span className="font-medium">{rem.target}</span>
                        <span className="text-xs text-[var(--foreground-tertiary)] ml-1">
                          {rem.targetId.substring(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--foreground-tertiary)]">
                        {timeAgo(rem.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

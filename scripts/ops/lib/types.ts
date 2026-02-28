/**
 * Vizora Autonomous Operations — Shared Types
 *
 * Type definitions used by all 6 ops agents. Defines the core data model
 * for incidents, remediations, agent results, and system state.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'warning' | 'info';

export type SystemStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export type IncidentStatus = 'open' | 'resolved' | 'escalated';

// ─── Incident ───────────────────────────────────────────────────────────────

export interface Incident {
  /** Deterministic ID: `${agent}:${type}:${targetId}` */
  id: string;
  /** Agent that detected the incident */
  agent: string;
  /** Incident type (e.g. 'content-missing-url', 'display-offline') */
  type: string;
  /** Severity level */
  severity: Severity;
  /** Target entity type (e.g. 'content', 'display', 'schedule') */
  target: string;
  /** Target entity ID */
  targetId: string;
  /** ISO timestamp when first detected */
  detected: string;
  /** Human-readable description */
  message: string;
  /** Attempted or recommended remediation */
  remediation: string;
  /** Current status */
  status: IncidentStatus;
  /** Number of remediation attempts */
  attempts: number;
  /** ISO timestamp when resolved (if resolved) */
  resolvedAt?: string;
  /** Error message from last failed remediation attempt */
  error?: string;
}

// ─── Remediation Action ─────────────────────────────────────────────────────

export interface RemediationAction {
  /** Agent that performed the action */
  agent: string;
  /** ISO timestamp of the action */
  timestamp: string;
  /** Human-readable action description */
  action: string;
  /** Target entity type */
  target: string;
  /** Target entity ID */
  targetId: string;
  /** HTTP method or action method used */
  method: string;
  /** API endpoint called (if applicable) */
  endpoint?: string;
  /** State before remediation */
  before?: unknown;
  /** State after remediation */
  after?: unknown;
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if the action failed */
  error?: string;
}

// ─── Agent Result ───────────────────────────────────────────────────────────

export interface AgentResult {
  /** Agent name */
  agent: string;
  /** ISO timestamp of the run */
  timestamp: string;
  /** Run duration in milliseconds */
  durationMs: number;
  /** Total issues found during this run */
  issuesFound: number;
  /** Issues auto-fixed during this run */
  issuesFixed: number;
  /** Issues escalated (could not auto-fix) */
  issuesEscalated: number;
  /** Incidents from this run */
  incidents: Incident[];
}

// ─── Ops State ──────────────────────────────────────────────────────────────

export interface OpsState {
  /** Overall system health status */
  systemStatus: SystemStatus;
  /** ISO timestamp of last state update */
  lastUpdated: string;
  /** Map of agent name to ISO timestamp of last run */
  lastRun: Record<string, string>;
  /** All tracked incidents (capped at 200) */
  incidents: Incident[];
  /** Recent remediation actions (capped at 100) */
  recentRemediations: RemediationAction[];
  /** Latest result per agent */
  agentResults: Record<string, AgentResult>;
}

/**
 * Vizora Autonomous Operations — State Management
 *
 * Persists ops state to `logs/ops-state.json`. All agents read/write through
 * these functions to maintain a single source of truth for incidents,
 * remediations, and system status.
 *
 * Uses Windows-safe path resolution (same pattern as validate-monitor.ts).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  OpsState,
  AgentResult,
  RemediationAction,
  Incident,
  SystemStatus,
} from './types.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_INCIDENTS = 200;
const MAX_REMEDIATIONS = 100;

/**
 * State file path — resolves to `<project-root>/logs/ops-state.json`.
 * The regex handles Windows drive-letter paths from `import.meta.url`
 * (e.g., `/C:/projects/...` → `C:/projects/...`).
 */
const STATE_FILE = join(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..', '..', '..', 'logs', 'ops-state.json',
);

// ─── Empty State ────────────────────────────────────────────────────────────

function emptyState(): OpsState {
  return {
    systemStatus: 'HEALTHY',
    lastUpdated: new Date().toISOString(),
    lastRun: {},
    incidents: [],
    recentRemediations: [],
    agentResults: {},
  };
}

// ─── Read / Write ───────────────────────────────────────────────────────────

/**
 * Read the ops state file. Returns an empty state if the file does not
 * exist or cannot be parsed.
 */
export function readOpsState(): OpsState {
  try {
    if (!existsSync(STATE_FILE)) return emptyState();
    const raw = readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as OpsState;
    // Ensure all required fields exist (guard against partial/corrupt files)
    return {
      systemStatus: parsed.systemStatus ?? 'HEALTHY',
      lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
      lastRun: parsed.lastRun ?? {},
      incidents: parsed.incidents ?? [],
      recentRemediations: parsed.recentRemediations ?? [],
      agentResults: parsed.agentResults ?? {},
    };
  } catch {
    return emptyState();
  }
}

/**
 * Write ops state to disk. Trims incidents to MAX_INCIDENTS and
 * remediations to MAX_REMEDIATIONS (keeping most recent).
 */
export function writeOpsState(state: OpsState): void {
  // Enforce size limits — keep most recent entries
  state.incidents = state.incidents.slice(-MAX_INCIDENTS);
  state.recentRemediations = state.recentRemediations.slice(-MAX_REMEDIATIONS);
  state.lastUpdated = new Date().toISOString();

  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── State Mutations ────────────────────────────────────────────────────────

/**
 * Record an agent run into state. Updates lastRun timestamp, merges
 * agent result, and upserts incidents by ID (updates existing, inserts new).
 */
export function recordAgentRun(state: OpsState, result: AgentResult): void {
  // Update last-run timestamp
  state.lastRun[result.agent] = result.timestamp;

  // Store latest agent result
  state.agentResults[result.agent] = result;

  // Upsert incidents by ID
  const existingMap = new Map(state.incidents.map(i => [i.id, i]));
  for (const incident of result.incidents) {
    existingMap.set(incident.id, incident);
  }
  state.incidents = Array.from(existingMap.values());

  // Recalculate system status
  state.systemStatus = determineSystemStatus(state);
}

/**
 * Append a remediation action to the state.
 */
export function addRemediation(state: OpsState, action: RemediationAction): void {
  state.recentRemediations.push(action);
}

// ─── Status Calculation ─────────────────────────────────────────────────────

/**
 * Determine overall system status based on open incidents:
 * - CRITICAL: any open incident with severity 'critical'
 * - DEGRADED: any open incident with severity 'warning'
 * - HEALTHY: no open critical or warning incidents
 */
export function determineSystemStatus(state: OpsState): SystemStatus {
  const open = state.incidents.filter(i => i.status === 'open');
  if (open.some(i => i.severity === 'critical')) return 'CRITICAL';
  if (open.some(i => i.severity === 'warning')) return 'DEGRADED';
  return 'HEALTHY';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic incident ID from agent name, type, and target ID.
 * This ensures the same issue produces the same ID across runs, enabling
 * deduplication and status tracking.
 */
export function makeIncidentId(agent: string, type: string, targetId: string): string {
  return `${agent}:${type}:${targetId}`;
}

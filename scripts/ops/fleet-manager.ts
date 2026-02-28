#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — Fleet Manager Agent
 *
 * Runs every 10 minutes via PM2 cron. Monitors display fleet health: detects
 * offline displays, resets error states, identifies cluster-wide outages,
 * and flags displays with no content assigned.
 *
 * Checks:
 *   1. Offline displays — ping recently-offline (<1hr), escalate persistent (>1hr)
 *   2. Error state displays — auto-reset status to 'inactive'
 *   3. Cluster offline — all displays in an org (3+) are offline → critical
 *   4. No content — online displays with no playlist and no schedule
 *
 * Exit codes:
 *   0 — all displays healthy
 *   1 — issues found (some may have been auto-fixed)
 *   2 — fatal error (agent could not complete)
 */

import type { Incident, AgentResult, RemediationAction } from './lib/types.js';
import { login, OpsApiClient } from './lib/api-client.js';
import {
  readOpsState,
  writeOpsState,
  recordAgentRun,
  addRemediation,
  makeIncidentId,
} from './lib/state.js';
import { log } from './lib/alerting.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'fleet-manager';

/** Minutes of silence before a display is considered offline */
const OFFLINE_THRESHOLD_MIN = 15;

/** Hours of silence before offline is considered persistent */
const PERSISTENT_THRESHOLD_HR = 1;

// ─── Types ───────────────────────────────────────────────────────────────────

interface DisplayItem {
  id: string;
  name?: string;
  status?: string;
  currentPlaylistId?: string;
  organizationId?: string;
  lastHeartbeat?: string;
  lastSeen?: string;
  error?: string;
  errorState?: string;
}

interface ScheduleItem {
  id: string;
  displayId?: string;
  isActive?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate minutes since the most recent heartbeat/lastSeen timestamp.
 * Returns Infinity if no timestamp is available.
 */
function minutesSinceLastSeen(display: DisplayItem): number {
  const ts = display.lastHeartbeat || display.lastSeen;
  if (!ts) return Infinity;
  const parsed = new Date(ts).getTime();
  if (Number.isNaN(parsed)) return Infinity;
  return (Date.now() - parsed) / (1000 * 60);
}

/**
 * Check whether a display is in an error state.
 */
function isErrorState(display: DisplayItem): boolean {
  return (
    display.status === 'error' ||
    !!display.error ||
    !!display.errorState
  );
}

/**
 * Check whether a display is considered "online" (not offline, not error).
 */
function isOnline(display: DisplayItem): boolean {
  if (isErrorState(display)) return false;
  if (display.status === 'offline') return false;
  const mins = minutesSinceLastSeen(display);
  return mins < OFFLINE_THRESHOLD_MIN;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log(AGENT, 'Starting fleet check cycle');

  // ─── Auth ────────────────────────────────────────────────────────────────

  const baseUrl = process.env.VALIDATOR_BASE_URL || 'http://localhost:3000';
  const email = process.env.OPS_EMAIL || process.env.VALIDATOR_EMAIL || '';
  const password = process.env.OPS_PASSWORD || process.env.VALIDATOR_PASSWORD || '';

  if (!email || !password) {
    log(AGENT, 'FATAL: No credentials — set OPS_EMAIL/OPS_PASSWORD or VALIDATOR_EMAIL/VALIDATOR_PASSWORD');
    process.exitCode = 2;
    return;
  }

  let token: string;
  try {
    token = await login(baseUrl, email, password);
    log(AGENT, 'Authenticated successfully');
  } catch (err) {
    log(AGENT, `FATAL: Login failed — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  const api = new OpsApiClient(baseUrl, token, AGENT);

  // ─── Fetch data in parallel ──────────────────────────────────────────────

  let displays: DisplayItem[];
  let schedules: ScheduleItem[];

  try {
    [displays, schedules] = await Promise.all([
      api.getAll<DisplayItem>('/displays'),
      api.getAll<ScheduleItem>('/schedules'),
    ]);
    log(AGENT, `Fetched ${displays.length} displays, ${schedules.length} schedules`);
  } catch (err) {
    log(AGENT, `FATAL: Could not fetch data — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  if (displays.length === 0) {
    log(AGENT, 'No displays found — nothing to check');
    process.exitCode = 0;
    return;
  }

  // Build lookup: displayId → has active schedule
  const displaysWithSchedule = new Set(
    schedules
      .filter(s => s.isActive !== false && s.displayId)
      .map(s => s.displayId!),
  );

  const state = readOpsState();
  const incidents: Incident[] = [];
  const remediations: RemediationAction[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;
  let issuesEscalated = 0;

  // ─── Check 1: Offline displays ─────────────────────────────────────────

  log(AGENT, 'Checking for offline displays');

  for (const display of displays) {
    const mins = minutesSinceLastSeen(display);
    const label = display.name || display.id;

    if (mins < OFFLINE_THRESHOLD_MIN) continue; // Online — skip

    const persistentThresholdMin = PERSISTENT_THRESHOLD_HR * 60;

    if (mins >= persistentThresholdMin) {
      // Persistent offline (>1hr) — escalate
      issuesFound++;
      const incidentId = makeIncidentId(AGENT, 'display_offline_persistent', display.id);
      const existing = state.incidents.find(i => i.id === incidentId);

      if (existing?.status === 'escalated') {
        incidents.push(existing);
        issuesEscalated++;
        continue;
      }

      log(AGENT, `${label}: offline for ${Math.round(mins)}min (persistent) — escalating`);
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'display_offline_persistent',
        severity: 'critical',
        target: 'display',
        targetId: display.id,
        detected: existing?.detected ?? new Date().toISOString(),
        message: `Display "${label}" has been offline for ${Math.round(mins)} minutes`,
        remediation: 'Manual investigation required — display unresponsive for over 1 hour',
        status: 'escalated',
        attempts: (existing?.attempts ?? 0) + 1,
      });
      issuesEscalated++;
    } else {
      // Recent offline (15min–1hr) — attempt ping/reconnect
      issuesFound++;
      const incidentId = makeIncidentId(AGENT, 'display_offline', display.id);
      const existing = state.incidents.find(i => i.id === incidentId);

      log(AGENT, `${label}: offline for ${Math.round(mins)}min — attempting ping`);

      let pingSuccess = false;
      try {
        await api.post('/displays/ping', { displayId: display.id }, {
          target: 'display',
          targetId: display.id,
          action: `Ping display "${label}" to trigger reconnect`,
          before: { lastSeen: display.lastHeartbeat || display.lastSeen, minutesOffline: Math.round(mins) },
        });
        pingSuccess = true;
        log(AGENT, `${label}: ping sent successfully`);
      } catch (err) {
        log(AGENT, `${label}: ping failed — ${err instanceof Error ? err.message : err}`);
      }

      if (pingSuccess) {
        incidents.push({
          id: incidentId,
          agent: AGENT,
          type: 'display_offline',
          severity: 'warning',
          target: 'display',
          targetId: display.id,
          detected: existing?.detected ?? new Date().toISOString(),
          message: `Display "${label}" offline for ${Math.round(mins)}min — ping sent, awaiting reconnect`,
          remediation: 'POST /displays/ping — reconnect attempt',
          status: 'open',
          attempts: (existing?.attempts ?? 0) + 1,
        });
        // Note: not counted as issuesFixed — ping was sent but display hasn't reconnected yet
      } else {
        incidents.push({
          id: incidentId,
          agent: AGENT,
          type: 'display_offline',
          severity: 'warning',
          target: 'display',
          targetId: display.id,
          detected: existing?.detected ?? new Date().toISOString(),
          message: `Display "${label}" offline for ${Math.round(mins)}min — ping failed`,
          remediation: 'POST /displays/ping failed — manual check required',
          status: 'open',
          attempts: (existing?.attempts ?? 0) + 1,
          error: 'Ping request failed',
        });
      }
    }
  }

  // ─── Check 2: Error state displays ─────────────────────────────────────

  log(AGENT, 'Checking for error-state displays');

  for (const display of displays) {
    if (!isErrorState(display)) continue;

    const label = display.name || display.id;
    const incidentId = makeIncidentId(AGENT, 'display_error', display.id);
    const existing = state.incidents.find(i => i.id === incidentId);

    issuesFound++;
    log(AGENT, `${label}: in error state (status=${display.status}, error=${display.error || display.errorState || 'none'}) — resetting to inactive`);

    let resetSuccess = false;
    try {
      await api.patch(`/displays/${display.id}`, { status: 'inactive' }, {
        target: 'display',
        targetId: display.id,
        action: `Reset error-state display "${label}" to inactive`,
        before: { status: display.status, error: display.error, errorState: display.errorState },
      });
      resetSuccess = true;
      log(AGENT, `${label}: reset to inactive successfully`);
    } catch (err) {
      log(AGENT, `${label}: reset failed — ${err instanceof Error ? err.message : err}`);
    }

    if (resetSuccess) {
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'display_error',
        severity: 'warning',
        target: 'display',
        targetId: display.id,
        detected: existing?.detected ?? new Date().toISOString(),
        message: `Display "${label}" was in error state — reset to inactive`,
        remediation: 'PATCH /displays/:id → { status: "inactive" }',
        status: 'resolved',
        attempts: (existing?.attempts ?? 0) + 1,
        resolvedAt: new Date().toISOString(),
      });
      issuesFixed++;
    } else {
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'display_error',
        severity: 'warning',
        target: 'display',
        targetId: display.id,
        detected: existing?.detected ?? new Date().toISOString(),
        message: `Display "${label}" is in error state — reset attempt failed`,
        remediation: 'PATCH /displays/:id failed — manual reset required',
        status: 'open',
        attempts: (existing?.attempts ?? 0) + 1,
        error: 'PATCH reset failed',
      });
    }
  }

  // ─── Check 3: Cluster offline ──────────────────────────────────────────

  log(AGENT, 'Checking for cluster-wide outages');

  // Group displays by organizationId
  const orgDisplays = new Map<string, DisplayItem[]>();
  for (const display of displays) {
    const orgId = display.organizationId;
    if (!orgId) continue;
    const list = orgDisplays.get(orgId) ?? [];
    list.push(display);
    orgDisplays.set(orgId, list);
  }

  for (const [orgId, orgList] of orgDisplays) {
    // Only check orgs with 3+ displays
    if (orgList.length < 3) continue;

    const allOffline = orgList.every(d => minutesSinceLastSeen(d) >= OFFLINE_THRESHOLD_MIN);
    if (!allOffline) continue;

    const incidentId = makeIncidentId(AGENT, 'cluster_offline', orgId);
    const existing = state.incidents.find(i => i.id === incidentId);

    issuesFound++;
    issuesEscalated++;
    log(AGENT, `Cluster outage: ALL ${orgList.length} displays in org ${orgId} are offline — critical`);

    incidents.push({
      id: incidentId,
      agent: AGENT,
      type: 'cluster_offline',
      severity: 'critical',
      target: 'organization',
      targetId: orgId,
      detected: existing?.detected ?? new Date().toISOString(),
      message: `All ${orgList.length} displays in organization ${orgId} are offline — possible network/infrastructure issue`,
      remediation: 'Manual investigation required — entire org fleet is unreachable',
      status: existing?.status === 'escalated' ? 'escalated' : 'open',
      attempts: (existing?.attempts ?? 0) + 1,
    });
  }

  // ─── Check 4: No content ──────────────────────────────────────────────

  log(AGENT, 'Checking for online displays with no content');

  for (const display of displays) {
    if (!isOnline(display)) continue;

    const hasPlaylist = !!display.currentPlaylistId;
    const hasSchedule = displaysWithSchedule.has(display.id);

    if (hasPlaylist || hasSchedule) continue;

    const label = display.name || display.id;
    const incidentId = makeIncidentId(AGENT, 'no_content', display.id);
    const existing = state.incidents.find(i => i.id === incidentId);

    issuesFound++;
    log(AGENT, `${label}: online but has no playlist and no active schedule`);

    incidents.push({
      id: incidentId,
      agent: AGENT,
      type: 'no_content',
      severity: 'warning',
      target: 'display',
      targetId: display.id,
      detected: existing?.detected ?? new Date().toISOString(),
      message: `Display "${label}" is online but has no playlist assigned and no active schedule`,
      remediation: 'Assign a playlist or schedule to the display via the dashboard',
      status: 'open',
      attempts: 0,
    });
  }

  // ─── Resolve stale incidents ───────────────────────────────────────────

  // If a display was previously offline but is now back, resolve the incident
  const currentIncidentIds = new Set(incidents.map(i => i.id));

  for (const existing of state.incidents) {
    if (existing.agent !== AGENT) continue;
    if (existing.status !== 'open') continue;
    if (currentIncidentIds.has(existing.id)) continue;

    // This incident was not re-raised — the issue is resolved
    log(AGENT, `Resolving stale incident: ${existing.id}`);
    incidents.push({
      ...existing,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    });
    issuesFixed++;
  }

  // ─── Record Results & Write State ──────────────────────────────────────

  const durationMs = Date.now() - startTime;

  const result: AgentResult = {
    agent: AGENT,
    timestamp: new Date().toISOString(),
    durationMs,
    issuesFound,
    issuesFixed,
    issuesEscalated,
    incidents,
  };

  recordAgentRun(state, result);

  // Add API client audit log entries as remediations
  for (const r of api.auditLog) {
    addRemediation(state, r);
  }
  for (const r of remediations) {
    addRemediation(state, r);
  }

  writeOpsState(state);

  // ─── Summary ───────────────────────────────────────────────────────────

  log(AGENT, `Cycle complete in ${durationMs}ms — found: ${issuesFound}, fixed: ${issuesFixed}, escalated: ${issuesEscalated}`);

  if (issuesFound > 0 && issuesFixed < issuesFound) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

main().catch(err => {
  log(AGENT, `FATAL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 2;
});

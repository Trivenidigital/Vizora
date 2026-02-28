#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — Ops Reporter Agent
 *
 * Runs every 30 minutes via PM2 cron. Aggregates state from all other ops
 * agents, detects status transitions, sends alerts, updates the dashboard,
 * and prunes stale data. Does NOT fix issues — read-only aggregation.
 *
 * Responsibilities:
 *   1. Read shared ops state
 *   2. Determine current system status
 *   3. Check agent freshness (detect stale agents)
 *   4. Alert on status transitions and persistent CRITICAL
 *   5. Send Slack/email notifications
 *   6. Update dashboard via API
 *   7. Prune resolved incidents and old remediations
 *
 * Exit codes:
 *   0 — system HEALTHY
 *   1 — system DEGRADED or CRITICAL
 *   2 — fatal error (agent could not complete)
 *
 * Security: Read-only. No remediation actions, no execSync, no user input.
 */

import type { SystemStatus, Incident } from './lib/types.js';
import {
  readOpsState,
  writeOpsState,
  determineSystemStatus,
} from './lib/state.js';
import {
  log,
  sendSlackAlert,
  sendEmailAlert,
  updateDashboard,
} from './lib/alerting.js';
import { login } from './lib/api-client.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'ops-reporter';

/** Alert suppression window for repeated CRITICAL status (1 hour in ms) */
const ALERT_SUPPRESSION_MS = 60 * 60 * 1000;

/** Prune threshold — remove resolved incidents and remediations older than 24h */
const PRUNE_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Expected agents and their staleness thresholds (in minutes).
 * If an agent hasn't run within its threshold, log a warning.
 */
const EXPECTED_AGENTS: Record<string, number> = {
  'health-guardian': 10,
  'content-lifecycle': 30,
  'fleet-manager': 20,
  'schedule-doctor': 30,
};

// ─── Agent Freshness Check ───────────────────────────────────────────────────

/**
 * Check each expected agent's lastRun timestamp. Log warnings for stale agents
 * but do not create incidents — freshness issues are informational.
 */
function checkAgentFreshness(lastRun: Record<string, string>): void {
  const now = Date.now();

  for (const [agentName, thresholdMinutes] of Object.entries(EXPECTED_AGENTS)) {
    const lastRunIso = lastRun[agentName];

    if (!lastRunIso) {
      log(AGENT, `WARNING: ${agentName} has never run`);
      continue;
    }

    const lastRunTime = new Date(lastRunIso).getTime();
    const elapsedMs = now - lastRunTime;
    const elapsedMinutes = Math.round(elapsedMs / 60_000);
    const thresholdMs = thresholdMinutes * 60_000;

    if (elapsedMs > thresholdMs) {
      log(
        AGENT,
        `WARNING: ${agentName} is stale — last ran ${elapsedMinutes}min ago (threshold: ${thresholdMinutes}min)`,
      );
    } else {
      log(AGENT, `${agentName}: fresh (last ran ${elapsedMinutes}min ago)`);
    }
  }
}

// ─── Alert Decision ──────────────────────────────────────────────────────────

interface AlertDecision {
  shouldAlert: boolean;
  isRecovery: boolean;
  reason: string;
}

/**
 * Decide whether to send an alert based on status transitions and suppression.
 *
 * Rules:
 * - Status changed from previous → alert
 * - CRITICAL persists and >1 hour since last alert → alert
 * - Status changed TO HEALTHY from non-HEALTHY → recovery alert
 * - Otherwise → suppress
 */
function shouldSendAlert(
  previousStatus: SystemStatus,
  currentStatus: SystemStatus,
  lastAlertIso: string | undefined,
): AlertDecision {
  const now = Date.now();
  const lastAlertTime = lastAlertIso ? new Date(lastAlertIso).getTime() : 0;
  const timeSinceLastAlert = now - lastAlertTime;

  // Recovery: transitioned TO HEALTHY
  if (currentStatus === 'HEALTHY' && previousStatus !== 'HEALTHY') {
    return {
      shouldAlert: true,
      isRecovery: true,
      reason: `Recovery: ${previousStatus} -> HEALTHY`,
    };
  }

  // Status changed (non-recovery)
  if (currentStatus !== previousStatus) {
    return {
      shouldAlert: true,
      isRecovery: false,
      reason: `Status changed: ${previousStatus} -> ${currentStatus}`,
    };
  }

  // CRITICAL persists and suppression window elapsed
  if (currentStatus === 'CRITICAL' && timeSinceLastAlert > ALERT_SUPPRESSION_MS) {
    return {
      shouldAlert: true,
      isRecovery: false,
      reason: `CRITICAL persists for >${Math.round(timeSinceLastAlert / 60_000)}min`,
    };
  }

  // No alert needed
  return {
    shouldAlert: false,
    isRecovery: false,
    reason: 'No status change; within suppression window',
  };
}

// ─── Pruning ─────────────────────────────────────────────────────────────────

/**
 * Remove resolved incidents older than 24 hours.
 * Returns the number of incidents pruned.
 */
function pruneOldIncidents(incidents: Incident[]): { pruned: number; remaining: Incident[] } {
  const cutoff = Date.now() - PRUNE_AGE_MS;
  const remaining: Incident[] = [];
  let pruned = 0;

  for (const incident of incidents) {
    if (
      incident.status === 'resolved' &&
      incident.resolvedAt &&
      new Date(incident.resolvedAt).getTime() < cutoff
    ) {
      pruned++;
    } else {
      remaining.push(incident);
    }
  }

  return { pruned, remaining };
}

/**
 * Remove remediations older than 24 hours.
 * Returns the number of remediations pruned.
 */
function pruneOldRemediations(
  remediations: { timestamp: string }[],
): { pruned: number; remaining: typeof remediations } {
  const cutoff = Date.now() - PRUNE_AGE_MS;
  const remaining: typeof remediations = [];
  let pruned = 0;

  for (const r of remediations) {
    if (new Date(r.timestamp).getTime() < cutoff) {
      pruned++;
    } else {
      remaining.push(r);
    }
  }

  return { pruned, remaining };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log(AGENT, 'Starting ops reporting cycle');

  // ─── 1. Read State ────────────────────────────────────────────────────────

  const state = readOpsState();
  const previousStatus = state.systemStatus;

  log(AGENT, `Current state: status=${previousStatus}, incidents=${state.incidents.length}, remediations=${state.recentRemediations.length}`);

  // ─── 2. Determine Status ──────────────────────────────────────────────────

  const currentStatus = determineSystemStatus(state);
  state.systemStatus = currentStatus;

  log(AGENT, `System status: ${previousStatus} -> ${currentStatus}`);

  // ─── 3. Agent Freshness Check ─────────────────────────────────────────────

  log(AGENT, 'Checking agent freshness');
  checkAgentFreshness(state.lastRun);

  // ─── 4. Alert Decision ────────────────────────────────────────────────────

  // Track last alert time in lastRun under our own agent name
  const lastAlertIso = state.lastRun[`${AGENT}:last-alert`];
  const decision = shouldSendAlert(previousStatus, currentStatus, lastAlertIso);

  log(AGENT, `Alert decision: shouldAlert=${decision.shouldAlert}, reason="${decision.reason}"`);

  // ─── 5. Send Alerts ───────────────────────────────────────────────────────

  const openIncidents = state.incidents.filter(i => i.status === 'open');
  const fixedCount = Object.values(state.agentResults).reduce(
    (sum, r) => sum + r.issuesFixed,
    0,
  );

  if (decision.shouldAlert) {
    if (decision.isRecovery) {
      // Recovery — Slack only (good news)
      log(AGENT, 'Sending recovery alert (Slack only)');
      await sendSlackAlert(currentStatus, previousStatus, openIncidents, fixedCount);
    } else {
      // Degraded or Critical — both channels
      log(AGENT, 'Sending alerts (Slack + Email)');
      await sendSlackAlert(currentStatus, previousStatus, openIncidents, fixedCount);
      await sendEmailAlert(currentStatus, openIncidents, fixedCount);
    }

    // Record alert timestamp for suppression tracking
    state.lastRun[`${AGENT}:last-alert`] = new Date().toISOString();
  } else {
    log(AGENT, 'Alert suppressed — no notification sent');
  }

  // ─── 6. Update Dashboard ──────────────────────────────────────────────────

  const dashEmail = process.env.VALIDATOR_EMAIL;
  const dashPassword = process.env.VALIDATOR_PASSWORD;

  if (dashEmail && dashPassword) {
    const baseUrl = process.env.VALIDATOR_BASE_URL || 'http://localhost:3000';
    log(AGENT, 'Updating dashboard');
    try {
      const token = await login(baseUrl, dashEmail, dashPassword);
      await updateDashboard(state, token);
      log(AGENT, 'Dashboard updated successfully');
    } catch (err) {
      log(AGENT, `Dashboard update failed: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    log(AGENT, 'Dashboard update skipped (VALIDATOR_EMAIL/VALIDATOR_PASSWORD not set)');
  }

  // ─── 7. Prune Old Data ────────────────────────────────────────────────────

  const incidentPrune = pruneOldIncidents(state.incidents);
  state.incidents = incidentPrune.remaining;

  const remediationPrune = pruneOldRemediations(state.recentRemediations);
  state.recentRemediations = remediationPrune.remaining;

  if (incidentPrune.pruned > 0 || remediationPrune.pruned > 0) {
    log(AGENT, `Pruned: ${incidentPrune.pruned} old incidents, ${remediationPrune.pruned} old remediations`);
  }

  // ─── 8. Save State ────────────────────────────────────────────────────────

  state.lastRun[AGENT] = new Date().toISOString();
  writeOpsState(state);

  // ─── Summary ──────────────────────────────────────────────────────────────

  const durationMs = Date.now() - startTime;
  const openCount = state.incidents.filter(i => i.status === 'open').length;
  const criticalCount = state.incidents.filter(
    i => i.status === 'open' && i.severity === 'critical',
  ).length;
  const warningCount = state.incidents.filter(
    i => i.status === 'open' && i.severity === 'warning',
  ).length;

  log(
    AGENT,
    `Cycle complete in ${durationMs}ms — status: ${currentStatus}, open: ${openCount} (${criticalCount} critical, ${warningCount} warning), alerted: ${decision.shouldAlert}`,
  );

  // ─── Exit Code ────────────────────────────────────────────────────────────

  if (currentStatus === 'HEALTHY') {
    process.exitCode = 0;
  } else {
    process.exitCode = 1;
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

main().catch(err => {
  log(AGENT, `FATAL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 2;
});

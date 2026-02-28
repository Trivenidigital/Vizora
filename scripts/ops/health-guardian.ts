#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — Health Guardian Agent
 *
 * Runs every 5 minutes via PM2 cron. Checks service health endpoints and
 * PM2 process status. Restarts crashed/errored services automatically.
 *
 * Checks:
 *   1. Service HTTP endpoints (middleware, realtime, web)
 *   2. PM2 process status (errored/stopped → restart, high memory → reload)
 *
 * Escalation: After 2 failed restart attempts, incident is marked 'escalated'.
 *
 * Exit codes:
 *   0 — all services healthy
 *   1 — issues found (some may have been auto-fixed)
 *   2 — fatal error (agent could not complete)
 *
 * Security note: All execSync calls use hardcoded PM2 command strings with
 * no user input interpolation. This is safe — no injection risk.
 */

import 'dotenv/config';
import { execSync } from 'node:child_process';
import type { Incident, AgentResult, RemediationAction } from './lib/types.js';
import {
  readOpsState,
  writeOpsState,
  recordAgentRun,
  addRemediation,
  makeIncidentId,
} from './lib/state.js';
import { log } from './lib/alerting.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'health-guardian';
const MAX_RESTART_ATTEMPTS = 2;
const RESTART_COOLDOWN_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 10_000;

/** Service definitions: name, health URL, PM2 process name, memory limit in bytes */
interface ServiceDef {
  name: string;
  healthUrl: string;
  pm2Name: string;
  memoryLimitBytes: number;
}

function getServiceDefs(): ServiceDef[] {
  const middlewareUrl = process.env.VALIDATOR_BASE_URL || 'http://localhost:3000';
  const realtimeUrl = process.env.REALTIME_URL || 'http://localhost:3002';
  const webUrl = process.env.WEB_URL || 'http://localhost:3001';

  return [
    {
      name: 'middleware',
      healthUrl: `${middlewareUrl}/api/v1/health/ready`,
      pm2Name: 'vizora-middleware',
      memoryLimitBytes: 512 * 1024 * 1024, // 512 MB
    },
    {
      name: 'realtime',
      healthUrl: `${realtimeUrl}/health`,
      pm2Name: 'vizora-realtime',
      memoryLimitBytes: 512 * 1024 * 1024, // 512 MB
    },
    {
      name: 'web',
      healthUrl: `${webUrl}/`,
      pm2Name: 'vizora-web',
      memoryLimitBytes: 1024 * 1024 * 1024, // 1 GB
    },
  ];
}

// ─── Health Check ────────────────────────────────────────────────────────────

/**
 * Check if a service health endpoint responds with 2xx/3xx.
 * Returns true if healthy, false if unreachable or error response.
 */
async function checkEndpoint(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    const ok = res.status >= 200 && res.status < 400;
    return { ok, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── PM2 Commands ────────────────────────────────────────────────────────────
// All execSync calls below use HARDCODED strings — no user input, no injection risk.

/** Hardcoded PM2 names — only these values are ever passed to execSync */
const VALID_PM2_NAMES = new Set(['vizora-middleware', 'vizora-realtime', 'vizora-web']);

/**
 * Restart a PM2 process by name. Uses `pm2 restart` (hard restart).
 * Returns true if the command succeeded.
 */
function pm2Restart(pm2Name: string): boolean {
  if (!VALID_PM2_NAMES.has(pm2Name)) return false; // safety guard
  try {
    execSync(`pm2 restart ${pm2Name}`, { stdio: 'pipe', timeout: 30_000 });
    return true;
  } catch (err) {
    log(AGENT, `pm2 restart ${pm2Name} failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/**
 * Gracefully reload a PM2 process (zero-downtime for cluster mode).
 * Used for high memory situations where a hard restart isn't needed.
 */
function pm2Reload(pm2Name: string): boolean {
  if (!VALID_PM2_NAMES.has(pm2Name)) return false; // safety guard
  try {
    execSync(`pm2 reload ${pm2Name}`, { stdio: 'pipe', timeout: 30_000 });
    return true;
  } catch (err) {
    log(AGENT, `pm2 reload ${pm2Name} failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/** PM2 process info from `pm2 jlist` */
interface Pm2Process {
  name: string;
  pm_id: number;
  pm2_env?: {
    status?: string;
    pm_uptime?: number;
    restart_time?: number;
  };
  monit?: {
    memory?: number;
    cpu?: number;
  };
}

/**
 * Parse PM2 process list. Returns empty array if pm2 is not available.
 */
function getPm2Processes(): Pm2Process[] {
  try {
    const output = execSync('pm2 jlist', { stdio: 'pipe', timeout: 15_000 }).toString();
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    log(AGENT, 'Failed to parse pm2 jlist — PM2 may not be running');
    return [];
  }
}

// ─── Sleep Utility ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log(AGENT, 'Starting health check cycle');

  const state = readOpsState();
  const services = getServiceDefs();
  const incidents: Incident[] = [];
  const remediations: RemediationAction[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;
  let issuesEscalated = 0;

  // ─── 1. Service Endpoint Checks ──────────────────────────────────────────

  for (const svc of services) {
    const incidentId = makeIncidentId(AGENT, 'service-down', svc.name);
    const existingIncident = state.incidents.find(i => i.id === incidentId);

    log(AGENT, `Checking ${svc.name}: ${svc.healthUrl}`);
    const result = await checkEndpoint(svc.healthUrl);

    if (result.ok) {
      log(AGENT, `${svc.name}: healthy (status ${result.status})`);

      // Resolve existing incident if service recovered
      if (existingIncident && existingIncident.status === 'open') {
        log(AGENT, `${svc.name}: recovered — resolving incident ${incidentId}`);
        incidents.push({
          ...existingIncident,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });
        issuesFixed++;
      }
      continue;
    }

    // Service is unhealthy
    issuesFound++;
    const errorDetail = result.error || `HTTP ${result.status}`;
    log(AGENT, `${svc.name}: UNHEALTHY (${errorDetail})`);

    // Check if already escalated
    if (existingIncident && existingIncident.status === 'escalated') {
      log(AGENT, `${svc.name}: already escalated — skipping restart`);
      incidents.push(existingIncident);
      issuesEscalated++;
      continue;
    }

    // Determine attempt count
    const previousAttempts = existingIncident?.attempts ?? 0;

    if (previousAttempts >= MAX_RESTART_ATTEMPTS) {
      // Escalate — too many failed attempts
      log(AGENT, `${svc.name}: ${previousAttempts} restart attempts exhausted — escalating`);
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'service-down',
        severity: 'critical',
        target: 'service',
        targetId: svc.name,
        detected: existingIncident?.detected ?? new Date().toISOString(),
        message: `${svc.name} is down and restart attempts exhausted (${previousAttempts} attempts)`,
        remediation: `pm2 restart ${svc.pm2Name}`,
        status: 'escalated',
        attempts: previousAttempts,
        error: errorDetail,
      });
      issuesEscalated++;
      continue;
    }

    // Attempt restart
    const attemptNum = previousAttempts + 1;
    log(AGENT, `${svc.name}: attempting restart (attempt ${attemptNum}/${MAX_RESTART_ATTEMPTS})`);

    const restartSuccess = pm2Restart(svc.pm2Name);

    const remediation: RemediationAction = {
      agent: AGENT,
      timestamp: new Date().toISOString(),
      action: `Restart ${svc.name} (attempt ${attemptNum})`,
      target: 'service',
      targetId: svc.name,
      method: 'pm2 restart',
      success: restartSuccess,
    };

    if (restartSuccess) {
      // Wait for cooldown, then re-check
      log(AGENT, `${svc.name}: waiting ${RESTART_COOLDOWN_MS / 1000}s for service to start`);
      await sleep(RESTART_COOLDOWN_MS);

      const recheck = await checkEndpoint(svc.healthUrl);
      if (recheck.ok) {
        log(AGENT, `${svc.name}: recovered after restart`);
        remediation.after = { status: 'healthy', httpStatus: recheck.status };
        incidents.push({
          id: incidentId,
          agent: AGENT,
          type: 'service-down',
          severity: 'critical',
          target: 'service',
          targetId: svc.name,
          detected: existingIncident?.detected ?? new Date().toISOString(),
          message: `${svc.name} was down, auto-restarted successfully`,
          remediation: `pm2 restart ${svc.pm2Name}`,
          status: 'resolved',
          attempts: attemptNum,
          resolvedAt: new Date().toISOString(),
        });
        issuesFixed++;
      } else {
        log(AGENT, `${svc.name}: still unhealthy after restart`);
        remediation.after = { status: 'unhealthy', error: recheck.error || `HTTP ${recheck.status}` };
        incidents.push({
          id: incidentId,
          agent: AGENT,
          type: 'service-down',
          severity: 'critical',
          target: 'service',
          targetId: svc.name,
          detected: existingIncident?.detected ?? new Date().toISOString(),
          message: `${svc.name} is down (attempt ${attemptNum} failed)`,
          remediation: `pm2 restart ${svc.pm2Name}`,
          status: 'open',
          attempts: attemptNum,
          error: recheck.error || `HTTP ${recheck.status}`,
        });
      }
    } else {
      // pm2 restart command itself failed
      remediation.error = 'pm2 restart command failed';
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'service-down',
        severity: 'critical',
        target: 'service',
        targetId: svc.name,
        detected: existingIncident?.detected ?? new Date().toISOString(),
        message: `${svc.name} is down and pm2 restart failed (attempt ${attemptNum})`,
        remediation: `pm2 restart ${svc.pm2Name}`,
        status: 'open',
        attempts: attemptNum,
        error: 'pm2 restart command failed',
      });
    }

    remediations.push(remediation);
  }

  // ─── 2. PM2 Process Status Checks ────────────────────────────────────────

  log(AGENT, 'Checking PM2 process statuses');
  const pm2Procs = getPm2Processes();

  for (const svc of services) {
    // Find all PM2 processes matching this service (cluster mode may have multiple)
    const procs = pm2Procs.filter(p => p.name === svc.pm2Name);

    if (procs.length === 0) {
      log(AGENT, `${svc.pm2Name}: not found in PM2 process list`);
      continue; // Not managed by PM2, or PM2 not running — skip
    }

    for (const proc of procs) {
      const status = proc.pm2_env?.status;
      const memoryBytes = proc.monit?.memory ?? 0;
      const memoryMB = Math.round(memoryBytes / (1024 * 1024));
      const memoryLimitMB = Math.round(svc.memoryLimitBytes / (1024 * 1024));
      const memoryPct = svc.memoryLimitBytes > 0 ? (memoryBytes / svc.memoryLimitBytes) * 100 : 0;
      const procLabel = `${svc.pm2Name}:${proc.pm_id}`;

      // Check for errored/stopped processes
      if (status === 'errored' || status === 'stopped') {
        issuesFound++;
        const incidentId = makeIncidentId(AGENT, 'pm2-errored', procLabel);
        const existingIncident = state.incidents.find(i => i.id === incidentId);
        const previousAttempts = existingIncident?.attempts ?? 0;

        if (existingIncident?.status === 'escalated') {
          log(AGENT, `${procLabel}: already escalated`);
          incidents.push(existingIncident);
          issuesEscalated++;
          continue;
        }

        if (previousAttempts >= MAX_RESTART_ATTEMPTS) {
          log(AGENT, `${procLabel}: restart attempts exhausted — escalating`);
          incidents.push({
            id: incidentId,
            agent: AGENT,
            type: 'pm2-errored',
            severity: 'critical',
            target: 'pm2-process',
            targetId: procLabel,
            detected: existingIncident?.detected ?? new Date().toISOString(),
            message: `PM2 process ${procLabel} is ${status} and restart attempts exhausted`,
            remediation: `pm2 restart ${svc.pm2Name}`,
            status: 'escalated',
            attempts: previousAttempts,
            error: `Process status: ${status}`,
          });
          issuesEscalated++;
          continue;
        }

        log(AGENT, `${procLabel}: status=${status} — restarting (attempt ${previousAttempts + 1})`);
        const success = pm2Restart(svc.pm2Name);

        const remediation: RemediationAction = {
          agent: AGENT,
          timestamp: new Date().toISOString(),
          action: `Restart errored PM2 process ${procLabel}`,
          target: 'pm2-process',
          targetId: procLabel,
          method: 'pm2 restart',
          before: { status, memory: memoryMB },
          success,
        };

        if (success) {
          incidents.push({
            id: incidentId,
            agent: AGENT,
            type: 'pm2-errored',
            severity: 'critical',
            target: 'pm2-process',
            targetId: procLabel,
            detected: existingIncident?.detected ?? new Date().toISOString(),
            message: `PM2 process ${procLabel} was ${status}, restarted`,
            remediation: `pm2 restart ${svc.pm2Name}`,
            status: 'resolved',
            attempts: previousAttempts + 1,
            resolvedAt: new Date().toISOString(),
          });
          issuesFixed++;
        } else {
          remediation.error = 'pm2 restart command failed';
          incidents.push({
            id: incidentId,
            agent: AGENT,
            type: 'pm2-errored',
            severity: 'critical',
            target: 'pm2-process',
            targetId: procLabel,
            detected: existingIncident?.detected ?? new Date().toISOString(),
            message: `PM2 process ${procLabel} is ${status} and restart failed`,
            remediation: `pm2 restart ${svc.pm2Name}`,
            status: 'open',
            attempts: previousAttempts + 1,
            error: 'pm2 restart command failed',
          });
        }

        remediations.push(remediation);
        continue; // Skip memory check for errored processes
      }

      // Check for high memory usage (>85% of limit)
      if (memoryPct > 85) {
        issuesFound++;
        const incidentId = makeIncidentId(AGENT, 'high-memory', procLabel);
        log(AGENT, `${procLabel}: high memory ${memoryMB}MB / ${memoryLimitMB}MB (${memoryPct.toFixed(1)}%)`);

        const success = pm2Reload(svc.pm2Name);

        const remediation: RemediationAction = {
          agent: AGENT,
          timestamp: new Date().toISOString(),
          action: `Graceful reload ${procLabel} due to high memory (${memoryMB}MB / ${memoryLimitMB}MB)`,
          target: 'pm2-process',
          targetId: procLabel,
          method: 'pm2 reload',
          before: { memory: memoryMB, memoryLimitMB, memoryPct: Math.round(memoryPct) },
          success,
        };

        if (success) {
          incidents.push({
            id: incidentId,
            agent: AGENT,
            type: 'high-memory',
            severity: 'warning',
            target: 'pm2-process',
            targetId: procLabel,
            detected: new Date().toISOString(),
            message: `${procLabel} using ${memoryMB}MB (${memoryPct.toFixed(1)}% of ${memoryLimitMB}MB limit), gracefully reloaded`,
            remediation: `pm2 reload ${svc.pm2Name}`,
            status: 'resolved',
            attempts: 1,
            resolvedAt: new Date().toISOString(),
          });
          issuesFixed++;
        } else {
          remediation.error = 'pm2 reload command failed';
          incidents.push({
            id: incidentId,
            agent: AGENT,
            type: 'high-memory',
            severity: 'warning',
            target: 'pm2-process',
            targetId: procLabel,
            detected: new Date().toISOString(),
            message: `${procLabel} using ${memoryMB}MB (${memoryPct.toFixed(1)}% of ${memoryLimitMB}MB limit), reload failed`,
            remediation: `pm2 reload ${svc.pm2Name}`,
            status: 'open',
            attempts: 1,
            error: 'pm2 reload command failed',
          });
        }

        remediations.push(remediation);
      }
    }
  }

  // ─── 3. Record Results & Write State ──────────────────────────────────────

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

  for (const r of remediations) {
    addRemediation(state, r);
  }

  writeOpsState(state);

  // ─── 4. Summary ──────────────────────────────────────────────────────────

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

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
 *   3. Customer APK install surface — /tv + /downloads/vizora-display.apk
 *      (opt-in via TV_DOWNLOAD_MONITOR_ENABLED; no auto-remediation)
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
  readOpsStateSnapshot,
  writeOpsState,
  recordAgentRun,
  addRemediation,
  makeIncidentId,
} from './lib/state.js';
import { log, pingHeartbeat } from './lib/alerting.js';
import { readEcosystemMemoryPolicy } from './lib/ecosystem.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'health-guardian';
const MAX_RESTART_ATTEMPTS = 2;
const RESTART_COOLDOWN_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 10_000;

/**
 * Customer APK install surface (https://vizora.cloud/tv + /downloads/).
 *
 * OFF BY DEFAULT, and deliberately so: the download surface does not exist
 * until an approved APK is published, and a check that fails from the moment
 * it ships teaches operators to ignore this agent. Enable it in the same
 * change that publishes the first APK, not before.
 *
 * There is no auto-remediation — a missing APK or a reverted nginx config
 * needs a human. The check exists because the failure is otherwise SILENT:
 * customers simply cannot install, and nothing else notices.
 */
const TV_DOWNLOAD_MONITOR_ENABLED = process.env.TV_DOWNLOAD_MONITOR_ENABLED === 'true';
const TV_APK_URL = process.env.TV_APK_URL || 'https://vizora.cloud/downloads/vizora-display.apk';
const TV_PAGE_URL = process.env.TV_PAGE_URL || 'https://vizora.cloud/tv';
const APK_CONTENT_TYPE = 'application/vnd.android.package-archive';

/**
 * Service definitions. `memoryLimitBytes` is DERIVED from `ecosystem.config.js`,
 * never held here.
 *
 * This agent used to keep its own copy of each limit and reload any process
 * above 85% of it. Those copies drifted: middleware's ecosystem limit was raised
 * 512M → 640M specifically to stop restart churn, but the copy here stayed at
 * 512M, so 85% remained 435MB against a process that idles at ~400MB and spikes
 * to ~455MB. The churn never stopped, it just changed owner — six reloads on
 * 2026-08-12 between 17:20 and 20:20.
 *
 * `null` means the limit could not be read. The memory check is then SKIPPED for
 * that service: reloading a healthy production process against a guessed
 * threshold is precisely the defect being removed here.
 */
interface ServiceDef {
  name: string;
  healthUrl: string;
  pm2Name: string;
  memoryLimitBytes: number | null;
}

function getServiceDefs(): ServiceDef[] {
  const middlewareUrl = process.env.VALIDATOR_BASE_URL || 'http://localhost:3000';
  const realtimeUrl = process.env.REALTIME_URL || 'http://localhost:3002';
  const webUrl = process.env.WEB_URL || 'http://localhost:3001';

  const policy = readEcosystemMemoryPolicy();
  if (policy.error) {
    log(AGENT, `WARNING: ecosystem memory policy unreadable (${policy.error}) — memory checks will be skipped`);
  }

  return [
    {
      name: 'middleware',
      healthUrl: `${middlewareUrl}/api/v1/health/ready`,
      pm2Name: 'vizora-middleware',
      memoryLimitBytes: policy.limits['vizora-middleware'] ?? null,
    },
    {
      name: 'realtime',
      healthUrl: `${realtimeUrl}/api/health`,
      pm2Name: 'vizora-realtime',
      memoryLimitBytes: policy.limits['vizora-realtime'] ?? null,
    },
    {
      name: 'web',
      healthUrl: `${webUrl}/`,
      pm2Name: 'vizora-web',
      memoryLimitBytes: policy.limits['vizora-web'] ?? null,
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

// ─── APK Download Surface Check ──────────────────────────────────────────────

/** Result of probing the customer APK install surface. */
interface DownloadSurfaceResult {
  ok: boolean;
  /** Human-readable reason for failure, or null when healthy. */
  problem: string | null;
  detail: string;
}

/**
 * Probe the customer install surface: the /tv page must load, and the APK must
 * return 200 with the Android package MIME type and a non-zero body.
 *
 * Uses HEAD so the 5-minute cadence does not re-download the APK. All three
 * assertions matter independently: a 200 with the wrong Content-Type still
 * leaves TV browsers refusing to hand the file to the package installer, and
 * a zero-length 200 is what a half-finished upload looks like.
 */
async function checkDownloadSurface(): Promise<DownloadSurfaceResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const apkRes = await fetch(TV_APK_URL, { method: 'HEAD', signal: controller.signal });

    if (apkRes.status !== 200) {
      return {
        ok: false,
        problem: `APK URL returned HTTP ${apkRes.status}`,
        detail: `${TV_APK_URL} -> HTTP ${apkRes.status}`,
      };
    }

    const contentType = apkRes.headers.get('content-type') || '(none)';
    if (!contentType.includes(APK_CONTENT_TYPE)) {
      return {
        ok: false,
        problem: `APK served with wrong Content-Type`,
        detail: `expected ${APK_CONTENT_TYPE}, got ${contentType} — check the nginx types block`,
      };
    }

    const contentLength = Number(apkRes.headers.get('content-length') || '0');
    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      return {
        ok: false,
        problem: 'APK has zero or unknown content length',
        detail: `content-length=${apkRes.headers.get('content-length') ?? '(none)'}`,
      };
    }

    const pageRes = await fetch(TV_PAGE_URL, { method: 'GET', signal: controller.signal });
    if (pageRes.status !== 200) {
      return {
        ok: false,
        problem: `Installer page returned HTTP ${pageRes.status}`,
        detail: `${TV_PAGE_URL} -> HTTP ${pageRes.status}`,
      };
    }

    return {
      ok: true,
      problem: null,
      detail: `APK ${contentLength} bytes, ${contentType}; installer page HTTP 200`,
    };
  } catch (err) {
    return {
      ok: false,
      problem: 'Install surface unreachable',
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
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

  // Lock-free snapshot for existing-incident lookups (attempt counts +
  // detected timestamps) during detection, which does slow I/O: pm2 restarts,
  // 30s restart cooldowns, health-endpoint fetches. The real locked
  // read→merge→write is at the very end. See scripts/ops/lib/state.ts.
  const priorState = readOpsStateSnapshot();
  const services = getServiceDefs();
  const incidents: Incident[] = [];
  const remediations: RemediationAction[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;
  let issuesEscalated = 0;

  // ─── 1. Service Endpoint Checks ──────────────────────────────────────────

  for (const svc of services) {
    const incidentId = makeIncidentId(AGENT, 'service-down', svc.name);
    const existingIncident = priorState.incidents.find(i => i.id === incidentId);

    log(AGENT, `Checking ${svc.name}: ${svc.healthUrl}`);
    const result = await checkEndpoint(svc.healthUrl);

    if (result.ok) {
      log(AGENT, `${svc.name}: healthy (status ${result.status})`);

      // Resolve existing incident if service recovered, including incidents
      // that were previously escalated after exhausted restart attempts.
      if (existingIncident && existingIncident.status !== 'resolved') {
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
      // A null limit means the canonical policy could not be read. Percent stays
      // 0 so the >85% branch cannot fire on an unknown threshold.
      const memoryLimitMB = svc.memoryLimitBytes ? Math.round(svc.memoryLimitBytes / (1024 * 1024)) : 0;
      const memoryPct = svc.memoryLimitBytes && svc.memoryLimitBytes > 0
        ? (memoryBytes / svc.memoryLimitBytes) * 100
        : 0;
      const procLabel = `${svc.pm2Name}:${proc.pm_id}`;
      const pm2ErroredIncidentId = makeIncidentId(AGENT, 'pm2-errored', procLabel);
      const existingPm2ErroredIncident = priorState.incidents.find(
        i => i.id === pm2ErroredIncidentId,
      );

      if (
        status === 'online' &&
        existingPm2ErroredIncident &&
        existingPm2ErroredIncident.status !== 'resolved'
      ) {
        log(AGENT, `${procLabel}: recovered — resolving incident ${pm2ErroredIncidentId}`);
        incidents.push({
          ...existingPm2ErroredIncident,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });
        issuesFixed++;
      }

      // Check for errored/stopped processes
      if (status === 'errored' || status === 'stopped') {
        issuesFound++;
        const incidentId = pm2ErroredIncidentId;
        const existingIncident = existingPm2ErroredIncident;
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

  // ─── 3. Customer APK Install Surface ──────────────────────────────────────
  // Gated off until an approved APK is published — see TV_DOWNLOAD_MONITOR_ENABLED.

  if (TV_DOWNLOAD_MONITOR_ENABLED) {
    const incidentId = makeIncidentId(AGENT, 'tv-download-surface', 'vizora-display-apk');
    const existingIncident = priorState.incidents.find(i => i.id === incidentId);

    log(AGENT, `Checking APK install surface: ${TV_APK_URL}`);
    const surface = await checkDownloadSurface();

    if (surface.ok) {
      log(AGENT, `install surface: healthy (${surface.detail})`);
      if (existingIncident && existingIncident.status !== 'resolved') {
        log(AGENT, `install surface: recovered — resolving incident ${incidentId}`);
        incidents.push({
          ...existingIncident,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });
        issuesFixed++;
      }
    } else {
      issuesFound++;
      log(AGENT, `install surface: BROKEN — ${surface.problem} (${surface.detail})`);
      // No auto-remediation: a missing APK or reverted nginx config needs a
      // human. Reported as open so ops-reporter escalates it.
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'tv-download-surface',
        severity: 'critical',
        target: 'install-surface',
        targetId: 'vizora-display-apk',
        detected: existingIncident?.detected ?? new Date().toISOString(),
        message: `Customers cannot install Vizora Display: ${surface.problem}`,
        remediation:
          'Re-publish via scripts/release/publish-display-apk.sh and confirm the ' +
          '/downloads/ location block is still present in /etc/nginx/sites-enabled/vizora',
        status: 'open',
        attempts: existingIncident?.attempts ?? 0,
        error: surface.detail,
      });
    }
  }

  // ─── 4. Record Results & Write State ──────────────────────────────────────

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

  // Brief locked read→merge→write with no I/O in between. recordAgentRun
  // upserts our incidents by id, preserving other agents' concurrent updates.
  const state = readOpsState();
  try {
    recordAgentRun(state, result);

    for (const r of remediations) {
      addRemediation(state, r);
    }
  } finally {
    writeOpsState(state);
  }

  // ─── 5. Summary ──────────────────────────────────────────────────────────

  log(AGENT, `Cycle complete in ${durationMs}ms — found: ${issuesFound}, fixed: ${issuesFixed}, escalated: ${issuesEscalated}`);

  const success = !(issuesFound > 0 && issuesFixed < issuesFound);
  process.exitCode = success ? 0 : 1;

  // External heartbeat: ping healthchecks.io (or compatible) every cycle.
  // Success path increments the dead-man counter; unfixed-issues path POSTs
  // to /fail so the external service can distinguish "ran but issues
  // remain" from "didn't run at all." If the URL is unset, no-op.
  await pingHeartbeat(
    AGENT,
    process.env.HEALTHCHECKS_HEALTH_GUARDIAN_URL,
    success ? 'success' : 'fail',
  );
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

main().catch(async err => {
  log(AGENT, `FATAL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 2;
  // Best-effort fail ping so external dead-man sees the crash. await is
  // intentional — we want this to complete before the process exits.
  await pingHeartbeat(AGENT, process.env.HEALTHCHECKS_HEALTH_GUARDIAN_URL, 'fail');
});

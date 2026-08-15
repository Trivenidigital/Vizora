#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — Health Guardian Agent
 *
 * Runs every 5 minutes via PM2 cron. Checks service health endpoints and
 * PM2 process status. Restarts crashed/errored services automatically.
 *
 * Checks:
 *   1. Service HTTP endpoints (middleware, realtime, web) — LOOPBACK ONLY
 *   2. PM2 process status (errored/stopped → restart, high memory → reload)
 *   3. Public edge watch — ALERT ONLY, never a restart (see below)
 *   4. Customer APK install surface — /tv + /downloads/vizora-display.apk
 *      (opt-in via TV_DOWNLOAD_MONITOR_ENABLED; no auto-remediation)
 *
 * Restarts key ONLY off loopback probes. `WEB_URL` is the public origin
 * (https://vizora.cloud) because email links need it, so probing it sent every
 * check through nginx + TLS and turned edge faults into `pm2 restart
 * vizora-web` — a remediation that cannot fix them. `lib/probe-targets.ts`
 * substitutes the local port for any non-loopback value and hands the original
 * back as the alert-only `edge`; `ServiceDef.probeRemediable` is the structural
 * backstop that keeps a non-loopback PROBE from ever reaching pm2. The `pm2
 * jlist` findings are not gated by it — PM2's own view of a crashed or bloated
 * process is local authoritative evidence with no edge component.
 *
 * Escalation: After 2 failed restart attempts, incident is marked 'escalated'.
 *
 * Exit codes:
 *   0 — all services healthy
 *   1 — issues found (some may have been auto-fixed)
 *   2 — fatal error (agent could not complete)
 *
 * Exit code and dead-man heartbeat DIVERGE on purpose: the heartbeat reports
 * only what this box owns (local + PM2), so an edge or install-surface fault
 * cannot make the external dead-man read "health-guardian is broken".
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
import { log, pingHeartbeat, sendInlineAlert } from './lib/alerting.js';
import { readEcosystemMemoryPolicy } from './lib/ecosystem.js';
import { isLoopback, splitProbeTargets, type ProbeService } from './lib/probe-targets.js';
import { probeWebAssets, type ProbeFetch } from './lib/web-assets.js';

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
  name: ProbeService;
  healthUrl: string;
  pm2Name: string;
  memoryLimitBytes: number | null;
  /**
   * Whether THE PROBE's verdict may key a `pm2 restart`.
   *
   * Named for its evidence, not for the service: it says "this probe observed
   * THIS box's process", so a failure it reports is a failure a restart can
   * address. False means the probe measured something through a shared edge,
   * and a restart cannot fix what it measured — the incident is still raised,
   * just never answered with pm2.
   *
   * Deliberately scoped to the probe-driven `service-down` path ONLY. The
   * `pm2 jlist` findings (errored/stopped, high memory) are local authoritative
   * evidence from PM2 itself and carry no edge component, so they are NOT
   * gated by this — see the comments at those two sites.
   *
   * `lib/probe-targets.ts` already substitutes loopback for non-loopback
   * config, so in practice this is the second layer: it holds even if a future
   * edit reintroduces a public URL as a probe target.
   */
  probeRemediable: boolean;
  /** Follow a reference from the served HTML before declaring this healthy. */
  probeAssets?: boolean;
  /** Origin the referenced asset paths are resolved against. */
  assetBaseUrl?: string;
}

interface ResolvedTargets {
  services: ServiceDef[];
  /** Public edge base URL to watch alert-only, or null. */
  edge: string | null;
  /** Why there is no edge to watch — logged instead of a silent skip. */
  noEdgeReason: string | null;
}

function getServiceDefs(): ResolvedTargets {
  const targets = splitProbeTargets(process.env);
  for (const note of targets.notes) {
    log(AGENT, note);
  }

  const middlewareUrl = targets.local.middleware;
  const realtimeUrl = targets.local.realtime;
  const webUrl = targets.local.web;

  const policy = readEcosystemMemoryPolicy();
  if (policy.error) {
    log(AGENT, `WARNING: ecosystem memory policy unreadable (${policy.error}) — memory checks will be skipped`);
  }

  const services: ServiceDef[] = [
    {
      name: 'middleware',
      healthUrl: `${middlewareUrl}/api/v1/health/ready`,
      pm2Name: 'vizora-middleware',
      memoryLimitBytes: policy.limits['vizora-middleware'] ?? null,
      probeRemediable: isLoopback(middlewareUrl),
    },
    {
      name: 'realtime',
      healthUrl: `${realtimeUrl}/api/health`,
      pm2Name: 'vizora-realtime',
      memoryLimitBytes: policy.limits['vizora-realtime'] ?? null,
      probeRemediable: isLoopback(realtimeUrl),
    },
    {
      name: 'web',
      healthUrl: `${webUrl}/`,
      pm2Name: 'vizora-web',
      memoryLimitBytes: policy.limits['vizora-web'] ?? null,
      probeRemediable: isLoopback(webUrl),
      // A 200 on the HTML shell is NOT proof the app works — see probeWebAssets.
      probeAssets: true,
      assetBaseUrl: webUrl,
    },
  ];

  for (const svc of services) {
    if (!svc.probeRemediable) {
      log(
        AGENT,
        `${svc.name}: probe target ${svc.healthUrl} is not loopback — a failing PROBE will raise an incident but never auto-restart`,
      );
    }
  }

  return { services, edge: targets.edge, noEdgeReason: targets.noEdgeReason };
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

/**
 * Follow an asset the served HTML actually references.
 *
 * WEB_HEALTH_FALSE_GREEN: on 2026-08-12 an OOM-killed `next build` wiped
 * `.next` while the running next-server kept serving HTML from already-open
 * file handles. `/` returned 200 while every `/_next/static/*` it referenced
 * returned 500, and this agent reported web healthy for 5h45m because it only
 * asked the shell. A shell that renders is not a working app.
 *
 * FAIL-CLOSED: anything that cannot establish usability — an HTML failure, a
 * non-2xx asset, or HTML with no verifiable build references — is unhealthy.
 * Decision logic lives in `lib/web-assets.ts` so it is testable without a
 * server; this only supplies the timeout-bounded fetch.
 */
async function probeWebAssetHealth(baseUrl: string): Promise<{ ok: boolean; detail: string }> {
  const boundedFetch: ProbeFetch = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      // The body MUST be consumed inside the timeout window, for two reasons:
      // an unread body leaves the socket open and keeps this cron process
      // alive past its work (the same shape as the pingHeartbeat timer leak in
      // lib/alerting.ts), and a lazy read after clearTimeout would be unbounded.
      const body = await res.text();
      return { ok: res.ok, status: res.status, text: async () => body };
    } finally {
      clearTimeout(timer);
    }
  };
  return probeWebAssets(baseUrl, boundedFetch);
}


// ─── Public Edge Watch (alert-only) ──────────────────────────────────────────

/**
 * What a VPS self-probe of the public edge can and cannot see. Carried into
 * every log line and incident so nobody reads a green edge as proof that
 * customers can reach us.
 */
const EDGE_SELF_PROBE_CAVEAT =
  'probed from the VPS itself — detects nginx/TLS/config faults, NOT external DNS/firewall reachability';

/** Operator playbook for an edge fault. Deliberately contains no pm2 command. */
const EDGE_REMEDIATION =
  'nginx -t; systemctl status nginx; certbot certificates — do NOT restart Node services; local health is green';

/**
 * Paths probed through the edge, each tagged with the LOCAL service that backs
 * it.
 *
 * The attribution is load-bearing, not documentation. nginx serves `/` from
 * web and `/api/v1/health/ready` from middleware, so a middleware outage makes
 * the edge return 502 on the API path while `/` still answers. Gating the whole
 * edge check on one service's local health (web, say) would then report a
 * middleware outage as `edge-unreachable` — a critical incident whose
 * remediation text sends the operator to nginx while the actual fault is a Node
 * process. A path is only evidence about the edge when the service behind it is
 * locally healthy.
 */
interface EdgeProbePath {
  path: string;
  backedBy: ProbeService;
}

const EDGE_PROBE_PATHS: readonly EdgeProbePath[] = [
  { path: '/', backedBy: 'web' },
  { path: '/api/v1/health/ready', backedBy: 'middleware' },
];

interface EdgeVerdict {
  verdict: 'healthy' | 'unreachable' | 'no-verdict';
  detail: string;
  /** True when every path was probed — nothing was skipped for a local outage. */
  complete: boolean;
}

/**
 * Probe the public edge. NO remediation exists on this path by construction —
 * an edge fault lives in nginx, TLS or DNS, none of which a `pm2 restart`
 * touches. The check exists because the failure is otherwise invisible from
 * inside the box: every local probe stays green while no customer can load the
 * app.
 *
 * Paths whose backing service is locally unhealthy are SKIPPED: `service-down`
 * already owns that finding, and probing them through the edge would only
 * re-measure the same outage with the wrong label. When every path is skipped
 * the result is `no-verdict` — we learned nothing, which is different from
 * learning the edge is fine.
 */
async function checkEdge(
  edgeBaseUrl: string,
  localHealthy: ReadonlyMap<ProbeService, boolean>,
): Promise<EdgeVerdict> {
  const failures: string[] = [];
  const checked: string[] = [];
  const skipped: string[] = [];

  for (const { path, backedBy } of EDGE_PROBE_PATHS) {
    if (localHealthy.get(backedBy) !== true) {
      skipped.push(`${path} (local ${backedBy} not healthy)`);
      continue;
    }
    checked.push(path);
    const res = await checkEndpoint(`${edgeBaseUrl}${path}`);
    if (!res.ok) {
      failures.push(`${path} [backed by ${backedBy}] -> ${res.error ?? `HTTP ${res.status}`}`);
    }
  }

  const complete = skipped.length === 0;
  const suffix = complete ? '' : ` (skipped: ${skipped.join('; ')})`;

  if (checked.length === 0) {
    return {
      verdict: 'no-verdict',
      detail: `no edge path had a locally healthy backing service${suffix}`,
      complete: false,
    };
  }
  if (failures.length > 0) {
    return { verdict: 'unreachable', detail: `${failures.join('; ')}${suffix}`, complete };
  }
  return { verdict: 'healthy', detail: `${checked.join(' + ')} answered${suffix}`, complete };
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
  const { services, edge, noEdgeReason } = getServiceDefs();
  const incidents: Incident[] = [];
  const remediations: RemediationAction[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;
  let issuesEscalated = 0;
  // Findings this box cannot own: the public edge and the customer install
  // surface both live outside the three PM2 processes. They are subtracted from
  // the dead-man heartbeat below — see the exit-code note in the file header.
  let offBoxFound = 0;
  let offBoxFixed = 0;
  /** Per-service local probe verdict this cycle — gates the edge alert. */
  const localHealthy = new Map<ProbeService, boolean>();

  // ─── 1. Service Endpoint Checks ──────────────────────────────────────────

  for (const svc of services) {
    const incidentId = makeIncidentId(AGENT, 'service-down', svc.name);
    const existingIncident = priorState.incidents.find(i => i.id === incidentId);

    log(AGENT, `Checking ${svc.name}: ${svc.healthUrl}`);
    let result = await checkEndpoint(svc.healthUrl);

    // The HTML shell answering 200 is necessary but not sufficient for web.
    if (result.ok && svc.probeAssets && svc.assetBaseUrl) {
      const assets = await probeWebAssetHealth(svc.assetBaseUrl);
      log(AGENT, `${svc.name}: asset probe — ${assets.detail}`);
      if (!assets.ok) {
        result = { ok: false, status: result.status, error: `referenced assets unhealthy: ${assets.detail}` };
      }
    }

    localHealthy.set(svc.name, result.ok);

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

    // A non-loopback probe observed something other than this box's process.
    // Raise the incident, never answer it with pm2 — see probeRemediable.
    if (!svc.probeRemediable) {
      log(AGENT, `${svc.name}: NOT auto-restarting — ${svc.healthUrl} is not a loopback probe target`);
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'service-down',
        severity: 'critical',
        target: 'service',
        targetId: svc.name,
        detected: existingIncident?.detected ?? new Date().toISOString(),
        message:
          `${svc.name} is unhealthy at ${svc.healthUrl}, which is not a loopback ` +
          `probe target — no restart attempted, because a restart cannot fix what a ` +
          `non-loopback probe measures`,
        remediation:
          `Investigate the path to ${svc.healthUrl} (nginx / TLS / DNS) before touching ` +
          `${svc.pm2Name}; point the probe at http://127.0.0.1:<service port> to make it remediable`,
        status: 'open',
        attempts: existingIncident?.attempts ?? 0,
        error: errorDetail,
      });
      continue;
    }

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

        // NOT gated on probeRemediable, deliberately: `pm2 jlist` is local
        // authoritative evidence straight from PM2 and carries no edge
        // component, so restarting a crashed process is correct or neutral —
        // never the wrong lever the probe-driven path could pick.
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

        // NOT gated on probeRemediable, deliberately: the memory reading comes
        // from `pm2 jlist` against the local process, so it is never an edge
        // observation and a graceful reload is always a coherent answer.
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

  // ─── 3. Public Edge Watch (alert-only, never a restart) ───────────────────

  if (edge === null) {
    // Emit the ACTUAL reason. "Everything is loopback" is the expected dev/CI
    // shape; "WEB_URL is not an http(s) URL" is a misconfiguration, and
    // reporting the second with the first's reassuring sentence hides it.
    log(AGENT, `edge watch: skipped — ${noEdgeReason ?? 'no edge resolved'}`);

    // The watch is off, so nothing will ever observe this incident recovering.
    // Leaving it open makes ops-state permanently CRITICAL over a check that
    // no longer runs — close it and say why.
    for (const stale of priorState.incidents) {
      if (stale.agent !== AGENT || stale.type !== 'edge-unreachable') continue;
      if (stale.status === 'resolved') continue;
      log(AGENT, `edge watch: closing stale incident ${stale.id} — the watch is disabled by configuration`);
      incidents.push({
        ...stale,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        message: `${stale.message} — edge watch disabled by configuration; closing stale incident`,
      });
      issuesFixed++;
      offBoxFixed++;
    }
  } else {
    const edgeHost = new URL(edge).hostname;
    const incidentId = makeIncidentId(AGENT, 'edge-unreachable', edgeHost);
    const existingIncident = priorState.incidents.find(i => i.id === incidentId);

    log(AGENT, `Checking public edge: ${edge} (${EDGE_SELF_PROBE_CAVEAT})`);
    const edgeResult = await checkEdge(edge, localHealthy);

    if (edgeResult.verdict === 'no-verdict') {
      // Every path's backing service is locally down. `service-down` owns those
      // findings; re-measuring the same outage through the edge would
      // double-count it and label it with nginx remediation.
      log(AGENT, `edge watch: no verdict — ${edgeResult.detail}`);
    } else if (edgeResult.verdict === 'healthy') {
      log(AGENT, `edge: healthy (${edgeResult.detail})`);
      if (!edgeResult.complete) {
        // Partial evidence closes nothing: the skipped path is exactly where an
        // edge fault would still be hiding.
        log(AGENT, 'edge: partial evidence only — not resolving any open incident on it');
      } else if (existingIncident && existingIncident.status !== 'resolved') {
        log(AGENT, `edge: recovered — resolving incident ${incidentId}`);
        incidents.push({
          ...existingIncident,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });
        issuesFixed++;
        offBoxFixed++;
      }
    } else {
      issuesFound++;
      offBoxFound++;
      log(AGENT, `edge: UNREACHABLE — ${edgeResult.detail}`);
      const message =
        `Public edge ${edge} failed a path whose backing service is locally healthy: ` +
        `${edgeResult.detail} — ${EDGE_SELF_PROBE_CAVEAT}`;

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'edge-unreachable',
        severity: 'critical',
        target: 'edge',
        targetId: edgeHost,
        detected: existingIncident?.detected ?? new Date().toISOString(),
        message,
        remediation: EDGE_REMEDIATION,
        status: 'open',
        attempts: existingIncident?.attempts ?? 0,
        error: edgeResult.detail,
      });

      // §12b: alert on the OPEN TRANSITION only. A continuing edge outage is
      // already visible in ops-state and the 30-min ops-reporter digest; an
      // inline alert every 5 minutes trains operators to mute the channel,
      // which is how the next real alert gets missed.
      const wasOpen = existingIncident !== undefined && existingIncident.status !== 'resolved';
      if (!wasOpen) {
        await sendInlineAlert(
          AGENT,
          'critical',
          `Public edge ${edgeHost} failed a path backed by a locally healthy service`,
          [
            edgeResult.detail,
            EDGE_SELF_PROBE_CAVEAT,
            EDGE_REMEDIATION,
          ].join('\n'),
        );
      } else {
        log(AGENT, 'edge: incident already open — inline alert suppressed (transition-only, §12b)');
      }
    }
  }

  // ─── 4. Customer APK Install Surface ──────────────────────────────────────
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
        offBoxFixed++;
      }
    } else {
      issuesFound++;
      offBoxFound++;
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

  // ─── 5. Record Results & Write State ──────────────────────────────────────

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

  // ─── 6. Summary ──────────────────────────────────────────────────────────

  log(AGENT, `Cycle complete in ${durationMs}ms — found: ${issuesFound}, fixed: ${issuesFixed}, escalated: ${issuesEscalated}`);

  // Exit code reflects EVERY finding — an edge or install-surface fault is a
  // real issue and must not exit 0.
  const success = !(issuesFound > 0 && issuesFixed < issuesFound);
  process.exitCode = success ? 0 : 1;

  // The dead-man verdict is narrower on purpose. healthchecks.io answers one
  // question — "is this box's health-guardian still doing its job?" — and
  // `edge-unreachable` / `tv-download-surface` are findings about things
  // OUTSIDE the three PM2 processes. Letting them POST /fail would make an
  // nginx cert problem read as "the ops agent is broken", which is the wrong
  // page at 3am and, worse, desensitises the one signal that means the VPS
  // itself is gone. NOTE: this changes the install-surface check's dead-man
  // contribution (moot today — TV_DOWNLOAD_MONITOR_ENABLED is false and
  // HEALTHCHECKS_HEALTH_GUARDIAN_URL is empty on prod).
  const deadManFound = issuesFound - offBoxFound;
  const deadManFixed = issuesFixed - offBoxFixed;
  const deadManOk = !(deadManFound > 0 && deadManFixed < deadManFound);
  if (deadManOk !== success) {
    log(
      AGENT,
      `dead-man reports ok=${deadManOk} while exit reports ok=${success} — ` +
        `${offBoxFound} off-box finding(s) are excluded from the heartbeat`,
    );
  }

  // External heartbeat: ping healthchecks.io (or compatible) every cycle.
  // Success path increments the dead-man counter; unfixed-issues path POSTs
  // to /fail so the external service can distinguish "ran but issues
  // remain" from "didn't run at all." If the URL is unset, no-op.
  await pingHeartbeat(
    AGENT,
    process.env.HEALTHCHECKS_HEALTH_GUARDIAN_URL,
    deadManOk ? 'success' : 'fail',
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

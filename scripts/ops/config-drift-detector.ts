/**
 * Vizora Autonomous Operations — Config Drift Detector (B1)
 *
 * Answers one question on an hourly cadence:
 *
 *     If this healthy process died right now, would it come back — and come
 *     back the same?
 *
 * The 2026-08-11 incident survived weeks unnoticed precisely because nothing
 * restarted: every service was healthy while its persisted configuration could
 * no longer recreate it. This agent detects that state.
 *
 * Design + ruling: docs/plans/2026-08-12-config-drift-detection-design.md
 * Comparison core: lib/config-drift.ts (pure, separately unit-tested)
 *
 * Beyond the three application services it also runs ONE separate small control:
 * the credentialed ops agents' own login pair, comparing what PM2's stored env
 * resolves against what a cold start would (2026-08-15 incident — a working
 * PM2-injected pair shadowed a `.env` pair that 401s, so a cold start would have
 * broken every credentialed ops agent with nothing reporting it). Each side is
 * resolved from its OWN cwd: the running agent's `pm_cwd` vs the ecosystem-derived
 * one, because that is what decides which `.env` each actually reads.
 *
 * ─── What this agent does NOT do ────────────────────────────────────────────
 *
 *   - never repairs anything (`issuesFixed` is 0 by design)
 *   - never writes, rewrites or touches ANY configuration file
 *   - never restarts or reloads a service
 *   - never exposes a new HTTP surface
 *   - never logs, persists or transmits a secret value, or anything derived
 *     from one — comparisons emit MATCH/DRIFT state tokens only
 *
 * ─── Scope note (ruling constraint 5) ───────────────────────────────────────
 *
 * Build-time `NEXT_PUBLIC_*` intent checking is NOT covered. The exclusion is
 * REPORTED on every run rather than left silent, because silence would read as
 * "checked and fine". B2 establishes the authoritative build-input record that
 * makes the check possible.
 *
 * Security note: every `execFileSync` below uses a hardcoded argv array (no
 * shell). The database password is passed to `psql` via `PGPASSWORD` in the
 * child environment, never as an argument — argv is world-readable via `ps`.
 *
 * Environment:
 *   CONFIG_DRIFT_DETECTOR_ENABLED  — 'true' to run. Default OFF.
 *   OPS_STATE_FILE                 — state file override (tests)
 */

import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { log, sendInlineAlert } from './lib/alerting.js';
import { readOpsState, recordAgentRun, writeOpsState } from './lib/state.js';
import type { AgentResult, Incident } from './lib/types.js';
import {
  AGENT,
  BUILD_TIME_EXCLUSION,
  OPS_AGENT_SCOPE,
  OPS_CREDENTIAL_KEYS,
  buildMaxConnectionsCandidates,
  analyzeDrift,
  analyzeOpsAgentCredentialDrift,
  findingsToIncidents,
  assessStability,
  parseProcEnviron,
  projectOpsCredentialKeys,
  resolveClearedFindings,
  type DotenvRead,
  type DriftFinding,
  type EnvMap,
  type OpsAgentCredentialObservation,
  type Pm2Sample,
  type ServiceName,
  type ServiceObservation,
  readDotenvFile,
  readServiceDotenv,
  serviceCwdFor,
} from './lib/config-drift.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const ENABLED = process.env.CONFIG_DRIFT_DETECTOR_ENABLED === 'true';

/**
 * Postgres container used to reach `psql` when it is not installed on the host —
 * which is prod's actual shape. Set empty to disable the container fallback.
 */
const PG_CONTAINER = process.env.CONFIG_DRIFT_PG_CONTAINER ?? 'vizora-postgres';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ECOSYSTEM_PATH = join(REPO_ROOT, 'ecosystem.config.js');

const PM2_NAME_BY_SERVICE: Record<ServiceName, string> = {
  middleware: 'vizora-middleware',
  realtime: 'vizora-realtime',
  web: 'vizora-web',
};

const SERVICES: ServiceName[] = ['middleware', 'realtime', 'web'];

/**
 * The credentialed ops agents, in sampling order.
 *
 * All of them resolve the identical credential expression from the identical
 * environment, so ONE readable sample answers for all of them — but pinning the
 * control to a single hardcoded entry made a deleted or renamed app produce an
 * `unobservable` finding every hour forever. Trying each in turn means the
 * control keeps working as long as any credentialed agent is registered.
 *
 * These are cron apps and are USUALLY `stopped` between firings — `pm2_env` is
 * readable either way, so sampling deliberately does not require a live pid.
 */
const OPS_CREDENTIALED_PM2_NAMES = [
  'ops-fleet-manager',
  'ops-schedule-doctor',
  'ops-content-lifecycle',
  'ops-reporter',
] as const;

const PM2_TIMEOUT_MS = 15_000;

/**
 * Gap between the two `pm2 jlist` samples used to detect a restart in progress,
 * and how long a generation must have been up before it is classified.
 *
 * An hourly detector loses nothing by waiting; a transient false positive costs
 * trust permanently. 90s covers PM2's graceful reload (`kill_timeout` is 30s and
 * `listen_timeout` 30s for middleware).
 */
const STABILITY_SAMPLE_GAP_MS = 5_000;
const STABILITY_MIN_SETTLED_MS = 90_000;
const ECOSYSTEM_TIMEOUT_MS = 10_000;
const PSQL_TIMEOUT_MS = 5_000;

// ─── Raw collection ─────────────────────────────────────────────────────────

interface Pm2Process {
  name: string;
  pid?: number;
  pm_id?: number;
  pm2_env?: Record<string, unknown> & {
    status?: string;
    restart_time?: number;
    pm_uptime?: number;
    /** The cwd PM2 actually started the process in — where its dotenv looked. */
    pm_cwd?: string;
  };
}

/** Block for `ms` without an async hop — `collect()` is synchronous. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Reduce PM2 process records to the fields stability assessment needs. */
function toSamples(processes: Pm2Process[]): Pm2Sample[] {
  return processes.map(p => ({
    pmId: p.pm_id,
    status: p.pm2_env?.status,
    restartTime: p.pm2_env?.restart_time,
    uptimeMs: p.pm2_env?.pm_uptime,
    pid: p.pid,
  }));
}

interface EcosystemApp {
  name: string;
  cwd?: string;
  instances?: number;
  env_production?: Record<string, unknown>;
  /** The default block — applied by a start WITHOUT `--env production`. */
  env?: Record<string, unknown>;
}

/** Coerce a PM2/ecosystem env object to the string map the core compares. */
function toEnvMap(raw: Record<string, unknown> | undefined): EnvMap {
  const out: EnvMap = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    // PM2 stores nested metadata objects alongside real env vars; only scalars
    // are environment variables.
    if (typeof value === 'string') out[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = String(value);
  }
  return out;
}

function readPm2Processes(): { processes: Pm2Process[]; error?: string } {
  try {
    const output = execFileSync('pm2', ['jlist'], { stdio: 'pipe', timeout: PM2_TIMEOUT_MS }).toString();
    const parsed = JSON.parse(output);
    return { processes: Array.isArray(parsed) ? parsed : [] };
  } catch (err) {
    return { processes: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Evaluate `ecosystem.config.js` in a CHILD PROCESS (design §9.2).
 *
 * The file is JavaScript, and web's `env_production` block *reads*
 * `web/.env.local` when required — so requiring it is not side-effect-free.
 * Isolating the evaluation keeps any such side effect out of this process.
 */
function readEcosystemApps(): { apps: EcosystemApp[]; error?: string } {
  const script = `
    const cfg = require(${JSON.stringify(ECOSYSTEM_PATH)});
    const apps = (cfg && cfg.apps) || [];
    process.stdout.write(JSON.stringify(apps.map(function (a) {
      return {
        name: a.name,
        cwd: a.cwd,
        instances: a.instances,
        env_production: a.env_production || {},
        env: a.env || {},
      };
    })));
  `;
  try {
    const out = execFileSync(process.execPath, ['-e', script], {
      stdio: 'pipe',
      timeout: ECOSYSTEM_TIMEOUT_MS,
      cwd: REPO_ROOT,
    }).toString();
    return { apps: JSON.parse(out) as EcosystemApp[] };
  } catch (err) {
    return { apps: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Read the exec-time environment of a running process (view A).
 *
 * Returns null when unreadable — which the core reports as
 * `observation-incomplete` rather than treating as agreement.
 */
function readProcEnviron(pid: number | undefined): EnvMap | null {
  if (!pid) return null;
  try {
    return parseProcEnviron(readFileSync(`/proc/${pid}/environ`, 'utf-8'));
  } catch {
    return null;
  }
}


/**
 * Live, read-only `SHOW max_connections` (ruling constraint 2).
 *
 * Tries each candidate in order and reports WHICH source answered — "unknown
 * because unreachable" and "unknown because misconfigured" need different
 * responses from an operator.
 *
 * Returns null on total failure; the core then reports the budget as UNKNOWN
 * rather than healthy. A configured expectation is deliberately NOT used as a
 * fallback source of truth: it would drift and recreate the very problem this
 * detector exists to catch.
 */
function queryMaxConnections(databaseUrl: string | undefined): {
  value: number | null;
  source: string;
  attempts: string[];
} {
  const candidates = buildMaxConnectionsCandidates(databaseUrl, PG_CONTAINER);
  if (candidates.length === 0) {
    return { value: null, source: 'none', attempts: ['no parseable DATABASE_URL'] };
  }

  const attempts: string[] = [];

  for (const candidate of candidates) {
    try {
      const out = execFileSync(candidate.command, candidate.args, {
        stdio: 'pipe',
        timeout: PSQL_TIMEOUT_MS,
        env: { ...process.env, ...candidate.env },
      }).toString().trim();

      const value = Number.parseInt(out, 10);
      if (Number.isFinite(value) && value > 0) {
        return { value, source: candidate.source, attempts };
      }
      attempts.push(`${candidate.source}: unparseable output`);
    } catch (err) {
      // Message only — never the candidate env, which may hold PGPASSWORD.
      const message = err instanceof Error ? err.message.split('\n')[0] : String(err);
      attempts.push(`${candidate.source}: ${message}`);
    }
  }

  return { value: null, source: 'none', attempts };
}

// ─── Ops-agent credential sampling ──────────────────────────────────────────

/** Do two samples agree on every credential variable? */
function sameCredentialProjection(a: EnvMap, b: EnvMap): boolean {
  return OPS_CREDENTIAL_KEYS.every(key => a[key] === b[key]);
}

/** `pm_cwd`, normalized so a path-separator difference is not read as drift. */
function pm2CwdOf(process: Pm2Process | undefined): string | undefined {
  const raw = process?.pm2_env?.pm_cwd;
  return typeof raw === 'string' && raw !== '' ? resolve(raw) : undefined;
}

/**
 * Choose a credentialed ops agent to sample and assemble its credential
 * observation.
 *
 * Exported and dependency-injected (`readDotenv`) so the selection rules are
 * unit-testable without PM2 or a filesystem: which agent gets picked, what
 * happens when one is mid-respawn, and where each side's `.env` is read from are
 * exactly the decisions that would otherwise only be exercised in production.
 *
 * BOTH `pm2 jlist` samples must agree on the credential variables and the cwd
 * before an agent is used. The detector and these cron agents fire on the same
 * minute every hour, so a read landing inside a respawn is a real possibility —
 * and it would surface as a spurious credential incident rather than as the
 * transient it is. Disagreement skips to the next agent rather than failing.
 */
export function sampleOpsAgentCredentials(
  first: Pm2Process[],
  second: Pm2Process[],
  apps: EcosystemApp[],
  repoRoot: string,
  readDotenv: (cwd: string) => DotenvRead = readDotenvFile,
): { observation: OpsAgentCredentialObservation; notes: string[] } {
  const notes: string[] = [];

  for (const name of OPS_CREDENTIALED_PM2_NAMES) {
    const before = first.find(p => p.name === name);
    const after = second.find(p => p.name === name);
    if (!before || !after) {
      notes.push(`${name}: not present in both pm2 jlist samples`);
      continue;
    }

    // Emptiness is judged on the FULL stored env: an agent whose stored env is
    // readable but simply carries no credential variable is a real, meaningful
    // observation, not an unreadable one.
    const fullAfter = toEnvMap(after.pm2_env);
    if (Object.keys(fullAfter).length === 0) {
      notes.push(`${name}: PM2 stored environment empty or unavailable`);
      continue;
    }

    const credsBefore = projectOpsCredentialKeys(toEnvMap(before.pm2_env));
    const credsAfter = projectOpsCredentialKeys(fullAfter);
    const cwdBefore = pm2CwdOf(before);
    const cwdAfter = pm2CwdOf(after);
    if (!sameCredentialProjection(credsBefore, credsAfter) || cwdBefore !== cwdAfter) {
      notes.push(`${name}: state changed between jlist samples (likely mid-respawn) — not sampled`);
      continue;
    }

    const app = apps.find(a => a.name === name);
    // Both cwds go through `resolve` so the comparison below is about the
    // DIRECTORY, never about path spelling.
    const ecosystemCwd = resolve(repoRoot, app?.cwd ?? '.');
    if (cwdAfter === undefined) {
      notes.push(
        `${name}: pm_cwd unavailable — the running agent's .env is located from the ecosystem ` +
        `entry instead, so a cwd difference would be invisible this cycle`,
      );
    }

    // Runtime side reads the file the RUNNING agent read; restart side reads the
    // one a fresh start would. Identical on prod — read once when so.
    const runtimeCwd = cwdAfter ?? ecosystemCwd;
    const runtimeDotenv = readDotenv(runtimeCwd);
    const restartDotenv = runtimeCwd === ecosystemCwd ? runtimeDotenv : readDotenv(ecosystemCwd);

    return {
      observation: {
        sampledAgent: name,
        pm2Env: projectOpsCredentialKeys(fullAfter),
        pm2Cwd: cwdAfter,
        ecosystemCwd,
        ecosystemEnvProduction: projectOpsCredentialKeys(toEnvMap(app?.env_production)),
        runtimeDotenv,
        restartDotenv,
      },
      notes,
    };
  }

  return {
    observation: {
      sampledAgent: 'none',
      pm2Env: null,
      ecosystemCwd: resolve(repoRoot),
      ecosystemEnvProduction: {},
      runtimeDotenv: { status: 'absent' },
      restartDotenv: { status: 'absent' },
    },
    notes,
  };
}

// ─── Observation assembly ───────────────────────────────────────────────────

export interface Collection {
  observations: ServiceObservation[];
  /** Non-fatal collection problems, surfaced in the run log. */
  notes: string[];
  /** Effective DATABASE_URL used for the max_connections query, if any. */
  databaseUrl?: string;
  /**
   * The credentialed ops agents' credential surface. `pm2Env: null` means no
   * credentialed agent was observable — reported, never read as agreement.
   */
  opsCredentials: OpsAgentCredentialObservation;
}

function collect(): Collection {
  const notes: string[] = [];

  const { processes, error: pm2Error } = readPm2Processes();
  if (pm2Error) notes.push(`pm2 jlist failed: ${pm2Error}`);

  // Second sample, taken after a short gap, so a restart in progress is visible
  // as a changed generation rather than classified as drift.
  sleepSync(STABILITY_SAMPLE_GAP_MS);
  const { processes: processes2, error: pm2Error2 } = readPm2Processes();
  if (pm2Error2) notes.push(`pm2 jlist (second sample) failed: ${pm2Error2}`);
  const sampledAt = Date.now();

  const { apps, error: ecoError } = readEcosystemApps();
  if (ecoError) notes.push(`ecosystem.config.js evaluation failed: ${ecoError}`);

  const observations: ServiceObservation[] = [];
  let databaseUrl: string | undefined;

  for (const service of SERVICES) {
    const pm2Name = PM2_NAME_BY_SERVICE[service];
    const instancesOfService = processes.filter(p => p.name === pm2Name);
    const online = instancesOfService.filter(p => p.pm2_env?.status === 'online');

    const app = apps.find(a => a.name === pm2Name);
    const serviceCwd = serviceCwdFor(REPO_ROOT, service, app?.cwd);

    // Fresh-start instance count comes from the ecosystem (what a restart would
    // create); the observed PM2 count is the fallback.
    const instances =
      typeof app?.instances === 'number' && app.instances > 0
        ? app.instances
        : Math.max(online.length, 1);

    if (instancesOfService.length === 0) {
      notes.push(`${service}: no PM2 process named ${pm2Name}`);
    }

    const primary = online[0] ?? instancesOfService[0];

    // Stability is assessed across EVERY instance of the service, not the
    // chosen primary. `pm2 reload` rolls a cluster one instance at a time, so
    // judging one instance would certify middleware as stable while its sibling
    // is mid-reload.
    const second = processes2.filter(p => p.name === pm2Name);
    const stability = assessStability(
      toSamples(instancesOfService),
      toSamples(second),
      sampledAt,
      STABILITY_MIN_SETTLED_MS,
    );
    if (!stability.stable) notes.push(`${service}: deferred — ${stability.reason}`);

    const procEnviron = readProcEnviron(primary?.pid);
    if (primary && procEnviron === null) {
      notes.push(`${service}: /proc/${primary.pid}/environ unreadable`);
    }

    const dotenvVars = readServiceDotenv(serviceCwd);

    observations.push({
      service,
      instances,
      procEnviron,
      pm2Env: toEnvMap(primary?.pm2_env),
      ecosystemEnvProduction: toEnvMap(app?.env_production),
      ecosystemEnvDefault: toEnvMap(app?.env),
      dotenvVars,
      stability,
    });

    if (service === 'middleware') {
      // Same precedence as view R — PM2's in-process env wins over dotenv.
      databaseUrl = {
        ...(dotenvVars ?? {}),
        ...(procEnviron ?? {}),
        ...toEnvMap(primary?.pm2_env),
      }.DATABASE_URL;
    }
  }

  // Ops-agent credential control — uses BOTH jlist samples so a mid-respawn
  // read is skipped rather than classified.
  const ops = sampleOpsAgentCredentials(processes, processes2, apps, REPO_ROOT);
  for (const note of ops.notes) notes.push(`ops credentials: ${note}`);
  if (ops.observation.pm2Env !== null) {
    notes.push(`ops credentials: sampled ${ops.observation.sampledAgent}`);
  }

  return { observations, notes, databaseUrl, opsCredentials: ops.observation };
}

// ─── Run ────────────────────────────────────────────────────────────────────

/**
 * Detect drift and build the agent result. Performs NO state writes and NO
 * alerting — `main()` owns those, so this stays a pure-ish seam.
 */
export function runDetection(collection: Collection, maxConnections: number | null): {
  result: AgentResult;
  incidents: Incident[];
  findings: DriftFinding[];
  /** Scopes fully evaluated this run — only these may have findings resolved. */
  evaluated: string[];
} {
  const started = Date.now();
  const detectedAt = new Date().toISOString();

  const { findings: serviceFindings, evaluated } = analyzeDrift(collection.observations, { maxConnections });

  // Separate small control, on a surface the three-service scope cannot see:
  // the credentialed ops agents' own login pair (2026-08-15 incident).
  const opsFindings = analyzeOpsAgentCredentialDrift(collection.opsCredentials);
  const findings = [...serviceFindings, ...opsFindings];

  // The ops scope is evaluated — and so may CLEAR a stale finding — only when
  // the runtime side was actually readable.
  if (collection.opsCredentials.pm2Env !== null) evaluated.push(OPS_AGENT_SCOPE);

  const incidents = findingsToIncidents(findings, detectedAt);

  return {
    result: {
      agent: AGENT,
      timestamp: detectedAt,
      durationMs: Date.now() - started,
      issuesFound: incidents.length,
      // Always 0 — this agent never repairs. Not a placeholder.
      issuesFixed: 0,
      issuesEscalated: incidents.filter(i => i.severity === 'critical').length,
      incidents,
    },
    incidents,
    findings,
    evaluated,
  };
}

async function main(): Promise<void> {
  if (!ENABLED) {
    log(AGENT, 'CONFIG_DRIFT_DETECTOR_ENABLED is not "true" — skipping (default off)');
    return;
  }

  const collection = collect();
  for (const note of collection.notes) log(AGENT, `collection: ${note}`);

  const maxConn = queryMaxConnections(collection.databaseUrl);
  for (const attempt of maxConn.attempts) log(AGENT, `max_connections attempt — ${attempt}`);
  if (maxConn.value === null) {
    log(AGENT, 'max_connections unavailable — connection budget will report UNKNOWN, not healthy');
  } else {
    log(AGENT, `max_connections = ${maxConn.value} (source: ${maxConn.source})`);
  }

  const { result, incidents, findings, evaluated } = runDetection(collection, maxConn.value);

  // Report the v1 scope gap explicitly. Silence would read as "checked and fine".
  log(
    AGENT,
    `scope: ${BUILD_TIME_EXCLUSION.variables.join(', ')} NOT checked — ${BUILD_TIME_EXCLUSION.reason}`,
  );

  for (const incident of incidents) {
    log(AGENT, `[${incident.severity}] ${incident.type} ${incident.targetId} — ${incident.message}`);
  }

  const criticals = incidents.filter(i => i.severity === 'critical');
  if (criticals.length > 0) {
    await sendInlineAlert(
      AGENT,
      'critical',
      `${criticals.length} configuration drift finding(s): production may not be reproducible from persisted config`,
      criticals.slice(0, 5).map(i => `${i.type} (${i.targetId}): ${i.message}`).join('\n'),
    );
  }

  // Brief locked read -> merge -> write with no I/O in between.
  //
  // Resolution happens against FRESH state inside the lock: findings this run no
  // longer reproduces are written back as `resolved`, so `systemStatus` can
  // recover on its own. Without this the detector is write-only and one
  // transient critical pins the dashboard permanently.
  const state = readOpsState();
  try {
    const cleared = resolveClearedFindings(state.incidents, findings, evaluated, result.timestamp);
    if (cleared.length > 0) {
      log(AGENT, `resolved ${cleared.length} finding(s) that no longer reproduce`);
    }
    // `issuesFixed` stays 0: a cleared drift means an operator corrected the
    // configuration, not that this detector repaired anything.
    recordAgentRun(state, { ...result, incidents: [...result.incidents, ...cleared] });
  } finally {
    writeOpsState(state);
  }

  log(
    AGENT,
    `run complete: ${result.issuesFound} finding(s), ${criticals.length} critical, ` +
    `0 repaired (by design) in ${result.durationMs}ms`,
  );

  // `info`-severity findings alone must NOT manufacture a recurring failure.
  // Same rule db-maintainer learned on 2026-08-12: a permanently-present info
  // finding (there, the missing host `redis-cli`; here, an `unobservable` ops
  // entry on a host where one was renamed) turns every single run red, and an
  // agent that always exits 1 is one whose exit code stops being read.
  const actionable = incidents.filter(i => i.severity === 'warning' || i.severity === 'critical');
  process.exitCode = actionable.length === 0 ? 0 : 1;
}

// ─── Entry Point ────────────────────────────────────────────────────────────

main().catch(err => {
  log(AGENT, `FATAL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 2;
});

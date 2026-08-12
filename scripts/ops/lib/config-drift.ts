/**
 * Vizora Autonomous Operations — persisted-config / runtime drift detection (B1)
 *
 * The pure comparison core. Answers one question on a cadence:
 *
 *     If this healthy process died right now, would it come back — and come
 *     back the same?
 *
 * Design + ruling: docs/plans/2026-08-12-config-drift-detection-design.md
 *
 * ─── The three views (design §2) ────────────────────────────────────────────
 *
 *   A  process-start / PM2 state — the environment the process was LAUNCHED
 *      with (`/proc/<pid>/environ`, immutable at exec) plus what PM2 holds and
 *      would re-inject on restart.
 *   B  persisted fresh-start config — what a process started from zero now
 *      would consume.
 *   C  effective application config — what the app is ACTUALLY using.
 *
 * `/proc/<pid>/environ` is NOT view C. It is frozen at exec; dotenv mutates
 * `process.env` INSIDE the process afterwards, so dotenv-supplied values never
 * appear there. That is why `DATABASE_URL` was absent from `/proc` on a healthy
 * service demonstrably using it. C is therefore RECONSTRUCTED with the
 * consuming application's own precedence rules — never read directly.
 *
 * ─── Two rules learned from the 2026-08-11 incident ─────────────────────────
 *
 *   1. `process.env` wins; dotenv never overrides an already-set key. This is
 *      why correcting `.env` alone did not fix realtime — PM2 kept re-injecting
 *      a stale `REDIS_URL` and dotenv politely declined.
 *   2. Never bash-source `.env`. The `DATABASE_URL` line is unquoted and
 *      contains `&`; `set -a; . ./.env` runs the assignment in a subshell and
 *      the variable is silently never set. Use the dotenv parser.
 *
 * ─── Safety posture ─────────────────────────────────────────────────────────
 *
 * Secrets are compared IN MEMORY and discarded. Only a state token
 * (`MATCH`/`DRIFT`/`BOTH_ABSENT`/`ONE_ABSENT`) ever leaves this module — no
 * hash, HMAC, truncated digest, length, or derived token of any kind reaches an
 * incident, log line, alert body, or `ops-state.json`.
 *
 * This module is PURE: no file, network, subprocess or database I/O, and it
 * never mutates its inputs. Collection lives in `config-drift-detector.ts`.
 * Nothing here repairs anything — `issuesFixed` is always 0 by design.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { parse as parseDotenv } from 'dotenv';

import { validateEnv } from '../../../middleware/src/modules/config/env.validation.js';
import type { Incident, Severity } from './types.js';
import { makeIncidentId } from './state.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EnvMap = Record<string, string>;

export type ServiceName = 'middleware' | 'realtime' | 'web';

/** Drift severity classes from design §7. */
export type DriftClass = 'CRITICAL' | 'HIGH' | 'WARNING';

/**
 * The only thing a secret comparison may emit. Never a value, never a
 * derivation of one.
 */
export type SecretVerdict = 'MATCH' | 'DRIFT' | 'BOTH_ABSENT' | 'ONE_ABSENT';

export type BudgetVerdict = 'SAFE' | 'UNSAFE' | 'UNKNOWN';

export interface ServiceObservation {
  service: ServiceName;
  /** PM2 instance count — middleware runs 2 in cluster mode. */
  instances: number;
  /** View A: exec-time environment. `null` when `/proc` could not be read. */
  procEnviron: EnvMap | null;
  /** View A: what PM2 holds and would re-inject. Empty means read failure. */
  pm2Env: EnvMap;
  /** Ecosystem-declared env for this service. */
  ecosystemEnv: EnvMap;
  /** Parsed `.env`, or `null` when the service loads no dotenv file (web). */
  dotenvVars: EnvMap | null;
}

export interface DriftFinding {
  driftClass: DriftClass;
  type: string;
  service: ServiceName;
  /** Stable across runs — drives incident dedup via `makeIncidentId`. */
  targetId: string;
  message: string;
  remediation: string;
}

export interface ConnectionBudget {
  total: number;
  /** False when any service's `connection_limit` could not be determined. */
  determinable: boolean;
  perService: Record<string, number | null>;
}

export interface PostgresParts {
  scheme: string;
  user?: string;
  password?: string;
  host: string;
  port: string;
  database: string;
  params: Record<string, string>;
}

export interface RedisParts {
  scheme: string;
  password?: string;
  host: string;
  port: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const AGENT = 'config-drift-detector';

/**
 * Drift class → the existing ops `Severity` enum (`lib/types.ts`), which has no
 * `high`. Rather than widen a shared enum every other agent depends on, the
 * drift class lives in the incident `type` and maps 1:1 here, preserving order.
 *
 * `WARNING` → `info` is deliberate: pool/tuning drift is recorded and visible on
 * the dashboard without paging anyone, since `sendSlackAlert` only enumerates
 * `critical` and `warning`.
 */
export const DRIFT_CLASS_TO_SEVERITY: Record<DriftClass, Severity> = {
  CRITICAL: 'critical',
  HIGH: 'warning',
  WARNING: 'info',
};

/**
 * Build-time `NEXT_PUBLIC_*` intent checking is OUT OF SCOPE for v1 (ruling
 * constraint 5). `.env` is provably not the intended source — the documented
 * build overrides it — and no authoritative record of intended build inputs
 * exists yet. B2's build manifest becomes that record.
 *
 * Reported on every run rather than left silent: silence reads as
 * "checked and fine".
 */
export const BUILD_TIME_EXCLUSION = {
  variables: ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SOCKET_URL'],
  reason:
    'Build-time values are baked into .next and cannot be observed from a ' +
    'running process. .env is NOT the intended source (the documented build ' +
    'overrides it), and no authoritative build-input record exists yet — ' +
    'deferred to B2, which establishes the build manifest.',
} as const;

/** Values safe to compare and print verbatim (design §4). */
const DIRECT_COMPARE_KEYS = [
  'NODE_ENV',
  'API_BASE_URL',
  'APP_URL',
  'WEB_URL',
  'CORS_ORIGIN',
  'BACKEND_URL',
  'TRUST_PROXY_HOPS',
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_BUCKET',
  'MINIO_USE_SSL',
  'MIDDLEWARE_PORT',
  'REALTIME_PORT',
  'PORT',
] as const;

/**
 * Production URLs that must not be localhost. `BACKEND_URL` is deliberately
 * ABSENT: for web it is the server-side proxy to middleware and `localhost` is
 * the correct value (design §1). Flagging it would make the detector
 * permanently noisy about something correct.
 */
const PRODUCTION_URL_KEYS = ['API_BASE_URL', 'APP_URL', 'WEB_URL', 'CORS_ORIGIN'] as const;

/** Standalone secret variables compared in memory, never emitted. */
const SECRET_KEYS = [
  'JWT_SECRET',
  'DEVICE_JWT_SECRET',
  'INTERNAL_API_SECRET',
  'MFA_ENCRYPTION_KEY',
  'SMTP_PASS',
  'RAZORPAY_KEY_ID',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
] as const;

/** Pool/tuning params carried in `DATABASE_URL`'s query string. */
const POOL_PARAMS = ['connection_limit', 'pool_timeout', 'statement_timeout'] as const;

/**
 * Boot-time required variables, transcribed from the actual validators —
 * `middleware/src/main.ts:38` and `realtime/src/main.ts:14` (+ the separate
 * `CORS_ORIGIN` throw at `realtime/src/main.ts:39`). Both are gated on
 * `NODE_ENV === 'production'`.
 */
const REQUIRED_IN_PRODUCTION: Record<ServiceName, readonly string[]> = {
  middleware: ['API_BASE_URL', 'CORS_ORIGIN', 'DATABASE_URL', 'JWT_SECRET', 'DEVICE_JWT_SECRET', 'INTERNAL_API_SECRET'],
  realtime: ['DATABASE_URL', 'REDIS_URL', 'DEVICE_JWT_SECRET', 'JWT_SECRET', 'INTERNAL_API_SECRET', 'CORS_ORIGIN'],
  web: [],
};

/** Hardcoded port enforcement (`main.ts` exits non-zero on mismatch). */
const PORT_ENFORCEMENT: Partial<Record<ServiceName, { vars: readonly string[]; port: number }>> = {
  middleware: { vars: ['MIDDLEWARE_PORT', 'PORT'], port: 3000 },
  realtime: { vars: ['REALTIME_PORT', 'PORT'], port: 3002 },
};

// ─── Parsers ────────────────────────────────────────────────────────────────

/**
 * Parse `.env` text with the dotenv library. NEVER bash-source it — see the
 * module docblock for why that silently loses the `DATABASE_URL` line.
 */
export function parseDotenvText(text: string): EnvMap {
  return { ...parseDotenv(text) };
}

/** Parse NUL-separated `/proc/<pid>/environ` content. */
export function parseProcEnviron(raw: string): EnvMap {
  const out: EnvMap = {};
  for (const pair of raw.split('\0')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

// ─── Precedence model (design §2) ───────────────────────────────────────────

/**
 * Apply the real loading precedence: an already-set process variable wins and
 * dotenv only fills the gaps. A key present in `processEnv` counts as set even
 * when its value is empty — that is what dotenv itself does, and modelling it
 * otherwise would report a fresh-start value the real loader never produces.
 */
export function resolvePrecedence(processEnv: EnvMap, dotenvVars: EnvMap | null): EnvMap {
  return { ...(dotenvVars ?? {}), ...processEnv };
}

/** View C — what the application is effectively using. Requires `/proc`. */
export function computeEffective(obs: ServiceObservation): EnvMap {
  return resolvePrecedence(obs.procEnviron ?? {}, obs.dotenvVars);
}

/**
 * View B — what a process started from zero now would consume.
 *
 * The invoking shell is modelled as EMPTY (ruling constraint 1 / §9.1), so a
 * variable that only ever arrived through operator shell inheritance shows up
 * as missing on fresh start — correctly, and loudly.
 *
 * Ecosystem-declared values win over PM2's stored env because a true
 * from-scratch `pm2 start ecosystem.config.js` re-reads the ecosystem file;
 * PM2's stored env fills whatever the ecosystem does not declare, since that is
 * what PM2 re-injects on restart.
 */
export function computeFreshStart(obs: ServiceObservation): EnvMap {
  return resolvePrecedence({ ...obs.pm2Env, ...obs.ecosystemEnv }, obs.dotenvVars);
}

// ─── URL decomposition (design §4) ──────────────────────────────────────────

/**
 * `DATABASE_URL` and `REDIS_URL` are MIXED values. The password component must
 * be treated separately from everything else — a whole-URL comparison would
 * report "credentials drifted" for a pool-parameter change, which is the wrong
 * severity and the wrong remediation.
 */
export function decomposePostgresUrl(url: string | undefined): PostgresParts | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { params[k] = v; });
    return {
      scheme: u.protocol.replace(':', ''),
      user: u.username || undefined,
      password: u.password || undefined,
      host: u.hostname,
      port: u.port,
      database: u.pathname.replace(/^\//, ''),
      params,
    };
  } catch {
    return null;
  }
}

export function decomposeRedisUrl(url: string | undefined): RedisParts | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      scheme: u.protocol.replace(':', ''),
      password: u.password || undefined,
      host: u.hostname,
      port: u.port,
    };
  } catch {
    return null;
  }
}

/**
 * MinIO's EFFECTIVE credential. `middleware/src/main.ts:223` reads
 * `MINIO_ACCESS_KEY || AWS_ACCESS_KEY_ID`, so comparing the variable name alone
 * can report a false match or a false drift.
 */
export function effectiveMinioAccessKey(env: EnvMap): string | undefined {
  return env.MINIO_ACCESS_KEY || env.AWS_ACCESS_KEY_ID || undefined;
}

export function effectiveMinioSecretKey(env: EnvMap): string | undefined {
  return env.MINIO_SECRET_KEY || env.AWS_SECRET_ACCESS_KEY || undefined;
}

// ─── max_connections query construction (ruling constraint 2) ───────────────

export interface MaxConnectionsCandidate {
  /** Reported alongside the result — "max_connections source" is part of the report. */
  source: string;
  command: string;
  args: string[];
  /** Extra child env. A secret belongs HERE and never in `args`. */
  env: Record<string, string>;
}

/**
 * Ordered candidates for reading `SHOW max_connections` live.
 *
 * Two paths exist because Postgres is not always reachable the same way. On the
 * prod VPS `psql` is NOT installed on the host at all — Postgres runs in the
 * `vizora-postgres` container — so a host-only implementation returns null
 * forever and the budget reports UNKNOWN on every run. A permanently-unknown
 * check is indistinguishable from a broken one, which is why this fallback
 * exists rather than a configured expectation.
 *
 * Secret hygiene differs between the two, deliberately:
 *
 *   - host path: password via `PGPASSWORD` in the child env, never argv (argv is
 *     world-readable through `ps`).
 *   - container path: NO password anywhere. It connects over the container's
 *     local Unix socket, which authenticates without one. `docker exec -e
 *     PGPASSWORD=...` would have put the secret back into host argv — the exact
 *     exposure the host path avoids — so the socket is strictly better here.
 *
 * The container path uses the user and database from `DATABASE_URL`, so it
 * carries the same identity as the application rather than an elevated one.
 */
export function buildMaxConnectionsCandidates(
  databaseUrl: string | undefined,
  pgContainer: string,
): MaxConnectionsCandidate[] {
  const parts = decomposePostgresUrl(databaseUrl);
  if (!parts) return [];

  const query = ['-t', '-A', '-c', 'SHOW max_connections'];
  const candidates: MaxConnectionsCandidate[] = [];

  const hostArgs: string[] = [];
  if (parts.host) hostArgs.push('-h', parts.host);
  if (parts.port) hostArgs.push('-p', parts.port);
  if (parts.user) hostArgs.push('-U', parts.user);
  if (parts.database) hostArgs.push('-d', parts.database);
  const hostEnv: Record<string, string> = { PGCONNECT_TIMEOUT: '3' };
  // Never prompt — a hung password prompt would burn the whole timeout.
  if (parts.password) hostEnv.PGPASSWORD = parts.password;
  candidates.push({
    source: 'host psql',
    command: 'psql',
    args: [...hostArgs, ...query],
    env: hostEnv,
  });

  if (pgContainer) {
    const containerArgs = ['exec', pgContainer, 'psql'];
    if (parts.user) containerArgs.push('-U', parts.user);
    if (parts.database) containerArgs.push('-d', parts.database);
    candidates.push({
      source: `docker exec ${pgContainer} psql`,
      command: 'docker',
      args: [...containerArgs, ...query],
      env: {},
    });
  }

  return candidates;
}

// ─── Secret comparison (ruling constraint 3) ────────────────────────────────

/**
 * Compare two secrets in memory and return ONLY a state token.
 *
 * Both operands are hashed to fixed-length digests so the comparison is
 * constant-time and length-independent; the digests are internal and are never
 * returned, logged, persisted or transmitted. Nothing derived from either value
 * escapes this function.
 */
export function compareSecretValues(a: string | undefined, b: string | undefined): SecretVerdict {
  const aSet = a !== undefined && a !== null;
  const bSet = b !== undefined && b !== null;
  if (!aSet && !bSet) return 'BOTH_ABSENT';
  if (aSet !== bSet) return 'ONE_ABSENT';

  const da = createHash('sha256').update(a as string, 'utf8').digest();
  const db = createHash('sha256').update(b as string, 'utf8').digest();
  return timingSafeEqual(da, db) ? 'MATCH' : 'DRIFT';
}

// ─── Fresh-start validation (design §1) ─────────────────────────────────────

/**
 * Would a fresh start actually boot? Runs the service's REAL validators.
 *
 * For middleware this deliberately calls middleware's own `validateEnv` Zod
 * schema rather than a transcription of it. A copied schema would drift from
 * the real one and the detector would then report "would start fine" when it
 * would not — the same class of failure the ruling rejected for a configured
 * `max_connections` expectation.
 *
 * BOTH middleware validators are evaluated. They fired sequentially during the
 * incident — fixing the first revealed the second — so stopping at the presence
 * check would produce a false all-clear.
 *
 * Returns human-readable failure descriptions. Validator messages are static
 * and never echo the offending value; nothing here adds one.
 */
export function validateFreshStart(service: ServiceName, env: EnvMap): string[] {
  const failures: string[] = [];
  const isProduction = env.NODE_ENV === 'production';

  // 1. Bare-presence validator (production only).
  if (isProduction) {
    const missing = REQUIRED_IN_PRODUCTION[service].filter(key => !env[key]);
    if (missing.length > 0) {
      failures.push(
        `bare-presence validator would exit 1 — missing required production ` +
        `variable(s): ${missing.join(', ')}`,
      );
    }
  }

  // 2. Port enforcement — the service exits non-zero on a mismatch.
  const portRule = PORT_ENFORCEMENT[service];
  if (portRule) {
    const assigned = portRule.vars.map(v => env[v]).find(v => v !== undefined && v !== '');
    if (assigned !== undefined && Number.parseInt(assigned, 10) !== portRule.port) {
      failures.push(
        `strict port enforcement would exit 1 — ${service} must use port ` +
        `${portRule.port}, not ${assigned}`,
      );
    }
  }

  // 3. Zod fitness schema — middleware only; realtime has no equivalent.
  if (service === 'middleware') {
    try {
      validateEnv(env);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The Zod messages are static and value-free; keep them verbatim so the
      // operator sees exactly what the real boot would print.
      failures.push(`fitness validator (Zod) would reject: ${summarizeValidationError(message)}`);
    }
  }

  return failures;
}

/** Collapse `validateEnv`'s multi-line error into one line, values untouched. */
function summarizeValidationError(message: string): string {
  return message
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('-'))
    .map(l => l.replace(/^-\s*/, ''))
    .join('; ') || message.split('\n')[0];
}

// ─── Connection budget (design §7, ruling constraint 2) ─────────────────────

/**
 * Sum `instances x connection_limit` across services, computed from view B —
 * the question is whether a RESTART would exceed the server's limit.
 *
 * An absent `connection_limit` makes the budget UNDETERMINABLE rather than
 * assumed: Prisma's default is `num_physical_cpus * 2 + 1`, which is
 * host-dependent and must not be guessed.
 */
export function computeConnectionBudget(observations: ServiceObservation[]): ConnectionBudget {
  const perService: Record<string, number | null> = {};
  let total = 0;
  let determinable = true;

  for (const obs of observations) {
    const freshStart = computeFreshStart(obs);
    const pg = decomposePostgresUrl(freshStart.DATABASE_URL);
    if (!pg) {
      // No DATABASE_URL at all (e.g. web) — contributes nothing, not unknown.
      perService[obs.service] = 0;
      continue;
    }
    const limit = pg.params.connection_limit;
    if (limit === undefined || !/^\d+$/.test(limit)) {
      perService[obs.service] = null;
      determinable = false;
      continue;
    }
    const contribution = Number.parseInt(limit, 10) * obs.instances;
    perService[obs.service] = contribution;
    total += contribution;
  }

  return { total, determinable, perService };
}

/**
 * Compare the budget against a LIVE `SHOW max_connections` reading.
 *
 * Never reports SAFE when the reading is unavailable or the budget could not be
 * computed — an unavailable query must not read as healthy (ruling constraint 2).
 */
export function evaluateConnectionBudget(
  budget: ConnectionBudget,
  maxConnections: number | null,
): { verdict: BudgetVerdict; message: string } {
  if (!budget.determinable) {
    const unknown = Object.entries(budget.perService)
      .filter(([, v]) => v === null)
      .map(([k]) => k);
    return {
      verdict: 'UNKNOWN',
      message:
        `DB_CONNECTION_BUDGET = UNKNOWN; reason = budget undeterminable for ` +
        `${unknown.join(', ')} (service unobservable, or connection_limit absent — ` +
        `Prisma's default is host-dependent and is not guessed). A partial sum ` +
        `would understate the total and could read as SAFE.`,
    };
  }

  if (maxConnections === null) {
    return {
      verdict: 'UNKNOWN',
      message:
        `DB_CONNECTION_BUDGET = UNKNOWN; reason = max_connections unavailable ` +
        `(fresh-start pool total would be ${budget.total})`,
    };
  }

  if (budget.total > maxConnections) {
    return {
      verdict: 'UNSAFE',
      message:
        `fresh-start pool total ${budget.total} exceeds server max_connections ` +
        `${maxConnections} — a restart would exhaust the connection budget`,
    };
  }

  return {
    verdict: 'SAFE',
    message: `fresh-start pool total ${budget.total} within max_connections ${maxConnections}`,
  };
}

// ─── Drift detection ────────────────────────────────────────────────────────

const NO_REPAIR = 'Investigate and correct the persisted configuration by hand. This agent never repairs.';

/**
 * Compare views B and C per service and classify every difference.
 *
 * Pure — never mutates `observations`, performs no I/O.
 */
export function detectDrift(
  observations: ServiceObservation[],
  opts: { maxConnections: number | null },
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const unobservable: ServiceName[] = [];

  for (const obs of observations) {
    // A view we could not build must never be silently treated as agreement.
    const incomplete: string[] = [];
    if (obs.procEnviron === null) {
      incomplete.push('/proc/<pid>/environ unreadable — effective config (view C) cannot be reconstructed');
    }
    if (Object.keys(obs.pm2Env).length === 0) {
      incomplete.push('PM2 stored environment empty or unavailable — fresh-start config (view B) cannot be built');
    }
    if (incomplete.length > 0) {
      findings.push({
        driftClass: 'CRITICAL',
        type: 'observation-incomplete',
        service: obs.service,
        targetId: obs.service,
        message: `cannot determine drift for ${obs.service}: ${incomplete.join('; ')}`,
        remediation:
          'Check the agent runs with sufficient privilege to read /proc for the service ' +
          'user, and that `pm2 jlist` succeeds. Absence of drift was NOT established.',
      });
      unobservable.push(obs.service);
      continue; // never emit comparisons derived from a view we could not build
    }

    const effective = computeEffective(obs);
    const freshStart = computeFreshStart(obs);

    findings.push(...detectFreshStartFailures(obs, freshStart));
    findings.push(...detectDirectDrift(obs, effective, freshStart));
    findings.push(...detectSecretDrift(obs, effective, freshStart));
    findings.push(...detectUrlComponentDrift(obs, effective, freshStart));
    findings.push(...detectPoolDrift(obs, effective, freshStart));
  }

  findings.push(...detectBudgetFindings(observations, opts.maxConnections, unobservable));

  return findings;
}

function detectFreshStartFailures(obs: ServiceObservation, freshStart: EnvMap): DriftFinding[] {
  return validateFreshStart(obs.service, freshStart).map((failure, index) => ({
    driftClass: 'CRITICAL' as const,
    type: 'fresh-start-would-fail',
    service: obs.service,
    // Index keeps concurrent failures distinct while staying stable across runs
    // for the same set of failures.
    targetId: `${obs.service}:validator-${index}`,
    message: `${obs.service} would NOT boot from persisted config: ${failure}`,
    remediation: NO_REPAIR,
  }));
}

/** Variables the validator already owns — don't double-report them. */
function isValidatorOwned(service: ServiceName, key: string): boolean {
  return REQUIRED_IN_PRODUCTION[service].includes(key);
}

function detectDirectDrift(
  obs: ServiceObservation,
  effective: EnvMap,
  freshStart: EnvMap,
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const isProduction = effective.NODE_ENV === 'production';

  for (const key of DIRECT_COMPARE_KEYS) {
    const now = effective[key];
    const fresh = freshStart[key];

    if (now === fresh) {
      // Identical — still worth flagging a localhost production URL, because
      // "would come back the same" and "would come back correct" differ.
      if (isProduction && PRODUCTION_URL_KEYS.includes(key as never) && isLocalhost(fresh)) {
        findings.push({
          driftClass: 'HIGH',
          type: 'production-url-drift',
          service: obs.service,
          targetId: `${obs.service}:${key}`,
          message: `${key} is a localhost URL under NODE_ENV=production (${fresh})`,
          remediation: NO_REPAIR,
        });
      }
      continue;
    }

    // One side absent and the validator already reports it — skip the duplicate.
    if ((now === undefined || fresh === undefined) && isValidatorOwned(obs.service, key)) {
      continue;
    }

    const isUrlKey = PRODUCTION_URL_KEYS.includes(key as never);
    findings.push({
      driftClass: isUrlKey ? 'HIGH' : 'WARNING',
      type: isUrlKey ? 'production-url-drift' : 'value-drift',
      service: obs.service,
      targetId: `${obs.service}:${key}`,
      message:
        `${key} differs between effective config and fresh start — ` +
        `effective=${describe(now)} fresh-start=${describe(fresh)}`,
      remediation: NO_REPAIR,
    });
  }

  return findings;
}

function detectSecretDrift(
  obs: ServiceObservation,
  effective: EnvMap,
  freshStart: EnvMap,
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  const comparisons: { label: string; now?: string; fresh?: string }[] = [
    ...SECRET_KEYS.map(key => ({ label: key, now: effective[key], fresh: freshStart[key] })),
    {
      label: 'MINIO effective access key',
      now: effectiveMinioAccessKey(effective),
      fresh: effectiveMinioAccessKey(freshStart),
    },
    {
      label: 'MINIO effective secret key',
      now: effectiveMinioSecretKey(effective),
      fresh: effectiveMinioSecretKey(freshStart),
    },
  ];

  for (const { label, now, fresh } of comparisons) {
    // Skip variables the boot validator already reports as missing.
    if ((now === undefined || fresh === undefined) && isValidatorOwned(obs.service, label)) continue;

    const verdict = compareSecretValues(now, fresh);
    if (verdict === 'MATCH' || verdict === 'BOTH_ABSENT') continue;

    findings.push({
      driftClass: 'CRITICAL',
      type: 'credential-drift',
      service: obs.service,
      targetId: `${obs.service}:${label}`,
      message: `${label}: ${verdict} between effective config and fresh start`,
      remediation: NO_REPAIR,
    });
  }

  return findings;
}

/** Credential + endpoint components carried inside DATABASE_URL / REDIS_URL. */
function detectUrlComponentDrift(
  obs: ServiceObservation,
  effective: EnvMap,
  freshStart: EnvMap,
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  const pgNow = decomposePostgresUrl(effective.DATABASE_URL);
  const pgFresh = decomposePostgresUrl(freshStart.DATABASE_URL);
  if (pgNow && pgFresh) {
    const credential = compareSecretValues(pgNow.password, pgFresh.password);
    if (credential !== 'MATCH' && credential !== 'BOTH_ABSENT') {
      findings.push({
        driftClass: 'CRITICAL',
        type: 'credential-drift',
        service: obs.service,
        targetId: `${obs.service}:DATABASE_URL credential`,
        message: `DATABASE_URL credential component: ${credential} between effective config and fresh start`,
        remediation: NO_REPAIR,
      });
    }
    findings.push(...compareEndpoint(obs, 'DATABASE_URL', {
      host: pgNow.host, port: pgNow.port, database: pgNow.database, user: pgNow.user,
    }, {
      host: pgFresh.host, port: pgFresh.port, database: pgFresh.database, user: pgFresh.user,
    }));
  }

  const redisNow = decomposeRedisUrl(effective.REDIS_URL);
  const redisFresh = decomposeRedisUrl(freshStart.REDIS_URL);
  if (redisNow && redisFresh) {
    const credential = compareSecretValues(redisNow.password, redisFresh.password);
    if (credential !== 'MATCH' && credential !== 'BOTH_ABSENT') {
      findings.push({
        driftClass: 'CRITICAL',
        type: 'credential-drift',
        service: obs.service,
        targetId: `${obs.service}:REDIS_URL credential`,
        message: `REDIS credential component: ${credential} between effective config and fresh start`,
        remediation: NO_REPAIR,
      });
    }
    findings.push(...compareEndpoint(obs, 'REDIS_URL',
      { host: redisNow.host, port: redisNow.port },
      { host: redisFresh.host, port: redisFresh.port }));
  }

  return findings;
}

function compareEndpoint(
  obs: ServiceObservation,
  variable: string,
  now: Record<string, string | undefined>,
  fresh: Record<string, string | undefined>,
): DriftFinding[] {
  const differing = Object.keys(now).filter(k => now[k] !== fresh[k]);
  if (differing.length === 0) return [];
  return [{
    driftClass: 'HIGH',
    type: 'endpoint-drift',
    service: obs.service,
    targetId: `${obs.service}:${variable} endpoint`,
    message:
      `${variable} endpoint differs between effective config and fresh start — ` +
      differing.map(k => `${k}: ${describe(now[k])} vs ${describe(fresh[k])}`).join(', '),
    remediation: NO_REPAIR,
  }];
}

function detectPoolDrift(
  obs: ServiceObservation,
  effective: EnvMap,
  freshStart: EnvMap,
): DriftFinding[] {
  const pgNow = decomposePostgresUrl(effective.DATABASE_URL);
  const pgFresh = decomposePostgresUrl(freshStart.DATABASE_URL);
  if (!pgNow || !pgFresh) return [];

  const differing = POOL_PARAMS.filter(p => pgNow.params[p] !== pgFresh.params[p]);
  if (differing.length === 0) return [];

  return [{
    driftClass: 'WARNING',
    type: 'pool-parameter-drift',
    service: obs.service,
    targetId: `${obs.service}:DATABASE_URL pool params`,
    message:
      `DATABASE_URL pool tuning differs between effective config and fresh start — ` +
      differing
        .map(p => `${p}: ${describe(pgNow.params[p])} vs ${describe(pgFresh.params[p])}`)
        .join(', '),
    remediation: NO_REPAIR,
  }];
}

function detectBudgetFindings(
  observations: ServiceObservation[],
  maxConnections: number | null,
  unobservable: ServiceName[],
): DriftFinding[] {
  const budget = computeConnectionBudget(observations);

  // A total summed over only the services we could observe is necessarily an
  // UNDERCOUNT, and an undercount compared against max_connections can report
  // SAFE for a budget that is actually over. Any unobservable service makes the
  // whole budget undeterminable.
  const effectiveBudget: ConnectionBudget =
    unobservable.length > 0
      ? {
          ...budget,
          determinable: false,
          perService: {
            ...budget.perService,
            ...Object.fromEntries(unobservable.map(s => [s, null])),
          },
        }
      : budget;

  const { verdict, message } = evaluateConnectionBudget(effectiveBudget, maxConnections);

  if (verdict === 'SAFE') return [];

  return [{
    driftClass: verdict === 'UNSAFE' ? 'CRITICAL' : 'WARNING',
    type: verdict === 'UNSAFE' ? 'connection-budget-unsafe' : 'connection-budget-unknown',
    service: 'middleware',
    targetId: 'db-connection-budget',
    message,
    remediation:
      verdict === 'UNSAFE'
        ? 'Lower connection_limit per service or raise the server max_connections. Do not restart until resolved.'
        : 'Restore the read-only max_connections query (or the missing connection_limit) so the budget can be evaluated. Absence of a problem was NOT established.',
  }];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isLocalhost(value: string | undefined): boolean {
  if (!value) return false;
  return /(^|\/\/|,|\s)(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|,|$)/i.test(value);
}

/** Render a non-secret value for an operator, distinguishing absence. */
function describe(value: string | undefined): string {
  return value === undefined ? '<absent>' : value === '' ? '<empty>' : value;
}

// ─── Incident mapping ───────────────────────────────────────────────────────

/**
 * Map findings to ops incidents. IDs are deterministic, so identical drift on
 * consecutive runs upserts one incident rather than accumulating duplicates.
 *
 * `status` is always `open` and `attempts` always 0 — this agent never
 * remediates, so it must never record having tried.
 */
export function findingsToIncidents(findings: DriftFinding[], detectedAt: string): Incident[] {
  return findings.map(f => ({
    id: makeIncidentId(AGENT, f.type, f.targetId),
    agent: AGENT,
    type: f.type,
    severity: DRIFT_CLASS_TO_SEVERITY[f.driftClass],
    target: 'config',
    targetId: f.targetId,
    detected: detectedAt,
    message: f.message,
    remediation: f.remediation,
    status: 'open' as const,
    attempts: 0,
  }));
}

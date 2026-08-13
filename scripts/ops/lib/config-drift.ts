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
import { decomposePostgresUrl, decomposeRedisUrl } from './pg-url.js';
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
  /**
   * Exec-time environment. `null` when `/proc` could not be read.
   *
   * An OBSERVATION SOURCE, never runtime truth. In PM2 **cluster mode** this
   * under-reports severely: middleware's `/proc` holds 25 keys and none of
   * `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` or `PORT`, because
   * PM2 applies `pm2_env` onto `process.env` inside the worker after exec.
   * Fork-mode services show 72-74 keys. Absence here proves nothing about
   * where a value came from.
   */
  procEnviron: EnvMap | null;
  /** What PM2 holds, injects in-process, and would reuse on restart. */
  pm2Env: EnvMap;
  /** Ecosystem `env_production` block — the canonical production start. */
  ecosystemEnvProduction: EnvMap;
  /**
   * Ecosystem default `env` block — what a start WITHOUT `--env production`
   * applies. Tracked because the two blocks disagree (`NODE_ENV` development
   * vs production), which makes a zero-state rebuild flag-dependent.
   */
  ecosystemEnvDefault: EnvMap;
  /** Parsed `.env`, or `null` when the service loads no dotenv file (web). */
  dotenvVars: EnvMap | null;
  /**
   * Whether PM2 state was settled when this observation was taken. An unstable
   * service is DEFERRED, never classified — see `assessStability`.
   */
  stability: StabilityVerdict;
}

/** One reading of a single PM2 instance's state. */
export interface Pm2Sample {
  /** `pm_id` — PM2's stable per-instance identifier. Required for matching. */
  pmId?: number;
  status?: string;
  /** `pm2_env.restart_time` — increments on every restart. */
  restartTime?: number;
  /** `pm2_env.pm_uptime` — epoch ms of the current generation's start. */
  uptimeMs?: number;
  pid?: number;
}

export interface StabilityVerdict {
  stable: boolean;
  reason?: string;
}

/**
 * Decide whether a service's PM2 state is settled enough to classify.
 *
 * Sampling mid-restart produces findings that evaporate moments later. Observed
 * on prod 2026-08-12: a run at 17:00:52 landed during a reload and emitted five
 * criticals; a run 115 seconds later reproduced none of them. Transient false
 * positives are worse than a skipped cycle — an hourly detector loses nothing by
 * waiting, and a detector that cries wolf gets muted.
 *
 * ─── Stability is SERVICE-WIDE, never per-instance ──────────────────────────
 *
 * middleware runs 2 instances in PM2 cluster mode, and `pm2 reload` rolls them
 * one at a time. Assessing a single chosen instance would let this pass:
 *
 *     instance A   settled old generation, >90s, unchanged across samples
 *     instance B   stopping / launching a new generation
 *     → picked A → service classified STABLE mid-reload
 *
 * which is exactly the condition the guard exists to prevent, surviving
 * whenever the chosen primary happens to be the settled sibling. So EVERY
 * instance must satisfy EVERY condition, and the instance set itself must be
 * identical across both samples — an appearing or disappearing instance is a
 * reload in progress by definition.
 *
 * For the fork-mode services (realtime, web) this reduces to the single-instance
 * check.
 */
export function assessStability(
  first: Pm2Sample[],
  second: Pm2Sample[],
  nowMs: number,
  minSettledMs: number,
): StabilityVerdict {
  if (first.length === 0 || second.length === 0) {
    return { stable: false, reason: 'PM2 process not present in both samples' };
  }
  if (first.length !== second.length) {
    return {
      stable: false,
      reason: `instance count changed between samples (${first.length} → ${second.length})`,
    };
  }

  // `pm_id` is how an instance is identified across samples. Without it two
  // instances cannot be told apart, so matching would be a guess.
  if (first.some(s => s.pmId === undefined) || second.some(s => s.pmId === undefined)) {
    return { stable: false, reason: 'pm_id missing — instances cannot be matched across samples' };
  }

  const secondById = new Map(second.map(s => [s.pmId as number, s]));
  const firstIds = [...first.map(s => s.pmId as number)].sort((a, b) => a - b);
  const secondIds = [...secondById.keys()].sort((a, b) => a - b);
  if (firstIds.join(',') !== secondIds.join(',')) {
    return {
      stable: false,
      reason: `instance set changed between samples (pm_ids ${firstIds.join('/')} → ${secondIds.join('/')})`,
    };
  }

  for (const before of first) {
    const after = secondById.get(before.pmId as number) as Pm2Sample;
    const id = `pm_id ${before.pmId}`;

    if (before.status !== 'online' || after.status !== 'online') {
      return {
        stable: false,
        reason: `${id} status is ${before.status ?? 'unknown'}/${after.status ?? 'unknown'}, not online in both samples`,
      };
    }
    if (before.restartTime !== after.restartTime) {
      return {
        stable: false,
        reason: `${id} restart generation changed between samples (${before.restartTime} → ${after.restartTime})`,
      };
    }
    if (before.pid !== after.pid) {
      return {
        stable: false,
        reason: `${id} pid changed between samples (${before.pid} → ${after.pid})`,
      };
    }
    // "older than minSettledMs" is a REQUIREMENT, so an unknown age cannot
    // satisfy it. Skipping the check when `pm_uptime` is absent would let an
    // instance that just restarted pass silently — the opposite of the guard's
    // purpose. Defer as unknown instead.
    if (typeof after.uptimeMs !== 'number') {
      return { stable: false, reason: `${id} pm_uptime missing — generation age cannot be determined` };
    }
    const ageMs = nowMs - after.uptimeMs;
    if (ageMs < minSettledMs) {
      return {
        stable: false,
        reason: `${id} generation is ${Math.round(ageMs / 1000)}s old, below the ${Math.round(minSettledMs / 1000)}s settle threshold`,
      };
    }
  }

  return { stable: true };
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
 * Build-time `NEXT_PUBLIC_*` intent is not checkable from a running process,
 * so it stays out of scope here (ruling constraint 5). `.env` is provably not
 * the intended source — the documented build overrides it.
 *
 * That record now EXISTS: `deploy/web-build-inputs.json` (B2c), enforced by
 * `scripts/ops/web-build-inputs.test.ts` in CI. This exclusion therefore no
 * longer means "nobody is checking"; it means "checked at build time, not
 * here". The variable list is the full consumed set, not just the two with
 * values, so this line does not under-report its own blind spot.
 *
 * Reported on every run rather than left silent: silence reads as
 * "checked and fine".
 */
export const BUILD_TIME_EXCLUSION = {
  variables: [
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_SOCKET_URL',
    'NEXT_PUBLIC_SENTRY_DSN',
    'NEXT_PUBLIC_SCHEDULES_ENABLED',
    'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
  ],
  reason:
    'Build-time values are baked into .next and cannot be observed from a ' +
    'running process. .env is NOT the intended source (the documented build ' +
    'overrides it). Build-input intent is recorded in ' +
    'deploy/web-build-inputs.json (B2) and enforced in CI, not here.',
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

/**
 * **R — reconstructed effective runtime.** What the application is using now.
 *
 * `pm2Env` is layered ON TOP of `procEnviron` because PM2 applies its stored
 * env to `process.env` inside the worker, which `/proc` cannot see. Proven
 * behaviourally on prod: middleware's `/proc` has no `NODE_ENV`, `.env` says
 * `development`, and the app serves Swagger's production behaviour (404 on a
 * gate reading `process.env.NODE_ENV`) — so the running value is PM2's.
 *
 * dotenv fills only what neither layer set.
 */
export function computeRuntime(obs: ServiceObservation): EnvMap {
  return resolvePrecedence({ ...(obs.procEnviron ?? {}), ...obs.pm2Env }, obs.dotenvVars);
}

/**
 * **P — PM2-managed restart.** What `pm2 restart`/`reload` would reuse:
 * PM2's stored metadata plus the ecosystem's production block.
 *
 * This is NOT a fresh start. It still depends on PM2's stored env surviving,
 * which is exactly the assumption a zero-state rebuild cannot make.
 */
export function computeRestart(obs: ServiceObservation): EnvMap {
  return resolvePrecedence({ ...obs.pm2Env, ...obs.ecosystemEnvProduction }, obs.dotenvVars);
}

/**
 * **Z — canonical zero-state start.** Empty/minimal shell + ecosystem config +
 * dotenv, with **no reliance on PM2's stored env**.
 *
 * Keeping Z distinct from P is the whole point: if PM2's stored env were folded
 * into the "fresh start" model, B1 could declare the system reproducible while
 * the zero-state rebuild path is broken — recreating the blind spot it exists
 * to remove. A value that lives ONLY in PM2's stored env is invisible to P and
 * missing from Z.
 *
 * Models the canonical `--env production` start. The flag-dependent variant is
 * covered by the shadow check, since the two ecosystem blocks disagree.
 */
export function computeZeroState(obs: ServiceObservation): EnvMap {
  return resolvePrecedence({ ...obs.ecosystemEnvProduction }, obs.dotenvVars);
}

/** Zero-state WITHOUT `--env production` — the ecosystem default `env` block. */
export function computeZeroStateDefaultFlag(obs: ServiceObservation): EnvMap {
  return resolvePrecedence({ ...obs.ecosystemEnvDefault }, obs.dotenvVars);
}

// ─── URL decomposition (design §4) ──────────────────────────────────────────

/**
 * `DATABASE_URL` and `REDIS_URL` are MIXED values. The password component must
 * be treated separately from everything else — a whole-URL comparison would
 * report "credentials drifted" for a pool-parameter change, which is the wrong
 * severity and the wrong remediation.
 *
 * Implementation lives in `pg-url.ts` so `db-maintainer` can share it without
 * pulling this module's Zod/middleware dependency chain. Re-exported so this
 * module's public surface is unchanged.
 */
export { decomposePostgresUrl, decomposeRedisUrl } from './pg-url.js';
export type { PostgresParts, RedisParts } from './pg-url.js';

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
    // Computed from R — the live pool is what actually consumes connections,
    // and a rebuild differing in `connection_limit` is reported separately as
    // pool-parameter drift.
    const runtime = computeRuntime(obs);
    const pg = decomposePostgresUrl(runtime.DATABASE_URL);
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
export interface DriftAnalysis {
  findings: DriftFinding[];
  /**
   * Scopes this run SUCCESSFULLY EVALUATED. Only these may have stale findings
   * resolved — see `resolveClearedFindings`. A service is evaluated only when
   * every view was buildable: PM2 state present, stability settled, and `/proc`
   * readable. A merely *degraded* observation is deliberately excluded, because
   * a variable that lived only in the exec environment would look absent rather
   * than unchanged, and resolving on that would be a false all-clear.
   *
   * `global` covers cross-service findings (the connection budget) and is
   * evaluated only when every service was.
   */
  evaluated: string[];
}

/** Backwards-compatible wrapper — most callers only need the findings. */
export function detectDrift(
  observations: ServiceObservation[],
  opts: { maxConnections: number | null },
): DriftFinding[] {
  return analyzeDrift(observations, opts).findings;
}

export function analyzeDrift(
  observations: ServiceObservation[],
  opts: { maxConnections: number | null },
): DriftAnalysis {
  const findings: DriftFinding[] = [];
  const unobservable: ServiceName[] = [];
  const evaluated: string[] = [];

  for (const obs of observations) {
    // A view we could not build must never be silently treated as agreement.
    // PM2's stored env is load-bearing for R, P and Z alike — without it no
    // view can be built. `/proc` is only a supplementary source: in cluster
    // mode it legitimately carries none of the app's config, so its absence is
    // degraded, not fatal.
    if (Object.keys(obs.pm2Env).length === 0) {
      findings.push({
        driftClass: 'CRITICAL',
        type: 'observation-incomplete',
        service: obs.service,
        targetId: obs.service,
        message:
          `cannot determine drift for ${obs.service}: PM2 stored environment empty or ` +
          `unavailable — none of R (runtime), P (restart) or Z (zero-state) can be built`,
        remediation:
          'Check `pm2 jlist` succeeds for the user running this agent. ' +
          'Absence of drift was NOT established.',
      });
      unobservable.push(obs.service);
      continue; // never emit comparisons derived from views we could not build
    }

    // Defer rather than guess while PM2 state is changing.
    if (!obs.stability.stable) {
      findings.push({
        driftClass: 'WARNING',
        type: 'observation-deferred',
        service: obs.service,
        targetId: `${obs.service}:stability`,
        message:
          `drift not evaluated for ${obs.service} — PM2 state is not settled: ` +
          `${obs.stability.reason}. Absence of drift was NOT established; the next ` +
          `cycle will classify it.`,
        remediation:
          'No action needed if the service was mid-restart. Persistent instability is ' +
          'health-guardian\'s domain, not this detector\'s.',
      });
      unobservable.push(obs.service);
      continue;
    }

    if (obs.procEnviron === null) {
      findings.push({
        driftClass: 'WARNING',
        type: 'observation-degraded',
        service: obs.service,
        targetId: `${obs.service}:proc`,
        message:
          `/proc/<pid>/environ unreadable for ${obs.service} — runtime (R) reconstructed from ` +
          `PM2 stored env + dotenv only. Sufficient for cluster-mode services, which carry no ` +
          `app config in their exec environment, but exec-only variables would be missed.`,
        remediation:
          'Check the agent can read /proc for the service user. Comparisons continue.',
      });
    }

    // Fully evaluated: PM2 present, stability settled, /proc readable. Anything
    // less is comparable but not trustworthy enough to CLEAR a prior finding.
    if (obs.procEnviron !== null) evaluated.push(obs.service);

    const runtime = computeRuntime(obs);
    const restart = computeRestart(obs);
    const zeroState = computeZeroState(obs);

    // Validators run against Z — the rebuild path that assumes the least.
    findings.push(...detectZeroStateFailures(obs, zeroState));
    findings.push(...detectDirectDrift(obs, runtime, restart, zeroState));
    findings.push(...detectConfigShadow(obs, runtime));
    findings.push(...detectSecretDrift(obs, runtime, zeroState));
    findings.push(...detectUrlComponentDrift(obs, runtime, zeroState));
    findings.push(...detectPoolDrift(obs, runtime, zeroState));
  }

  findings.push(...detectBudgetFindings(observations, opts.maxConnections, unobservable));

  // `global` only when every observed service was fully evaluated.
  if (observations.length > 0 && evaluated.length === observations.length) {
    evaluated.push('global');
  }

  return { findings, evaluated };
}

function detectZeroStateFailures(obs: ServiceObservation, zeroState: EnvMap): DriftFinding[] {
  return validateFreshStart(obs.service, zeroState).map((failure, index) => ({
    driftClass: 'CRITICAL' as const,
    type: 'zero-state-would-fail',
    service: obs.service,
    // Index keeps concurrent failures distinct while staying stable across runs
    // for the same set of failures.
    targetId: `${obs.service}:validator-${index}`,
    message:
      `${obs.service} would NOT boot from a zero-state rebuild (no PM2 stored env): ${failure}`,
    remediation: NO_REPAIR,
  }));
}

/**
 * Keys whose divergence is CRITICAL regardless of category.
 *
 * `NODE_ENV` earns it on code evidence, not judgement: both of middleware's
 * boot validators are gated on `NODE_ENV === 'production'`
 * (`main.ts:37` presence check, and the Zod schema's production `superRefine`
 * covering MinIO defaults and `INTERNAL_API_SECRET`). realtime's presence check
 * (`main.ts:12`) and its `CORS_ORIGIN` requirement are gated the same way. A
 * start that resolves `NODE_ENV` to anything else silently skips all of them —
 * so the config that guards production stops guarding it.
 */
const CRITICAL_KEYS = ['NODE_ENV'] as const;

/**
 * `absentOnRebuild` separates the two cases a boot-required variable can be in.
 * ABSENT is fatal — the validator exits non-zero. Present-but-different is not:
 * the service starts and behaves differently, which is HIGH, not CRITICAL.
 * Conflating them inflates every URL difference to CRITICAL.
 */
function classifyKey(service: ServiceName, key: string, absentOnRebuild: boolean): DriftClass {
  if (CRITICAL_KEYS.includes(key as never)) return 'CRITICAL';
  // A rebuild landing on different credentials fails just as hard as one that
  // cannot boot — auth simply fails later instead of at startup.
  if ((SECRET_KEYS as readonly string[]).includes(key)) return 'CRITICAL';
  if (absentOnRebuild && isValidatorOwned(service, key)) return 'CRITICAL';
  if (PRODUCTION_URL_KEYS.includes(key as never)) return 'HIGH';
  return 'WARNING';
}

/**
 * **Config shadowing** — the persisted configuration contradicts what is
 * actually running, even though the process is healthy.
 *
 * This is the reproducibility hazard the 2026-08-11 incident was made of, and
 * it is invisible to any comparison that only looks at healthy-vs-restart: a
 * higher-precedence layer (PM2's in-process env, or the ecosystem block)
 * supplies the working value while the persisted file says something else. Any
 * path that does not apply that layer gets the wrong value.
 *
 * Only `.env` is checked for shadowing. The ecosystem's default `env` block is
 * NOT — it is the development block by construction on every PM2 app, so
 * comparing it against a production runtime would fire on every service on
 * every run, forever. That is the alert-fatigue failure this detector exists to
 * avoid. Its genuine hazard — a production start that omits `--env production`
 * — is a deployment-procedure concern (B2), and it is surfaced here only as
 * supporting context on a finding that already fired on its own evidence.
 */
function detectConfigShadow(obs: ServiceObservation, runtime: EnvMap): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const tracked = [...DIRECT_COMPARE_KEYS, ...SECRET_KEYS];

  for (const key of tracked) {
    const running = runtime[key];
    if (running === undefined) continue;

    const persisted = obs.dotenvVars?.[key];
    if (persisted === undefined || persisted === running) continue;

    const isSecret = (SECRET_KEYS as readonly string[]).includes(key);
    const driftClass = classifyKey(obs.service, key, false);

    // Flag-dependency context: only when the default block would ALSO land on
    // the persisted value, i.e. a start without `--env production` reproduces
    // the wrong value through a second independent path.
    const defaultBlock = obs.ecosystemEnvDefault[key];
    const flagNote =
      defaultBlock !== undefined && defaultBlock !== running
        ? ` A start without \`--env production\` would also resolve ${key} to ` +
          `${isSecret ? 'the persisted value' : describe(defaultBlock)}, so the correct value ` +
          `depends on the start flag as well as on PM2 stored state.`
        : '';

    const validatorNote =
      key === 'NODE_ENV'
        ? ` Both boot validators are gated on NODE_ENV === 'production', so a start resolving ` +
          `it otherwise skips them silently.`
        : '';

    findings.push({
      driftClass,
      type: 'config-shadow',
      service: obs.service,
      targetId: `${obs.service}:${key}`,
      message:
        `${key} is running as ${isSecret ? '<set>' : describe(running)} but persisted .env holds ` +
        `${isSecret ? 'a different value (DRIFT)' : describe(persisted)}. The running value comes ` +
        `from a higher-precedence layer (PM2 in-process env); any start that does not apply that ` +
        `layer uses the persisted value instead.${flagNote}${validatorNote}`,
      remediation: NO_REPAIR,
    });
  }

  return findings;
}

/** Variables the validator already owns — don't double-report them. */
function isValidatorOwned(service: ServiceName, key: string): boolean {
  return REQUIRED_IN_PRODUCTION[service].includes(key);
}

/**
 * Compare the runtime against BOTH rebuild paths, reporting one finding per key
 * that names which view diverged.
 *
 * P and Z are deliberately not merged. A value that lives only in PM2's stored
 * env survives a `pm2 restart` (P matches) and vanishes from a zero-state
 * rebuild (Z does not) — the precise blind spot that folding them together
 * would reintroduce.
 */
function detectDirectDrift(
  obs: ServiceObservation,
  runtime: EnvMap,
  restart: EnvMap,
  zeroState: EnvMap,
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const isProduction = runtime.NODE_ENV === 'production';

  for (const key of DIRECT_COMPARE_KEYS) {
    const now = runtime[key];
    const onRestart = restart[key];
    const onZeroState = zeroState[key];

    const divergences: string[] = [];
    if (onRestart !== now) {
      divergences.push(`PM2 restart (P) would use ${describe(onRestart)}`);
    }
    if (onZeroState !== now) {
      divergences.push(`zero-state rebuild (Z) would use ${describe(onZeroState)}`);
    }

    if (divergences.length === 0) {
      // Identical across views — still worth flagging a localhost production
      // URL, because "would come back the same" and "would come back correct"
      // are different questions.
      if (isProduction && PRODUCTION_URL_KEYS.includes(key as never) && isLocalhost(now)) {
        findings.push({
          driftClass: 'HIGH',
          type: 'production-url-drift',
          service: obs.service,
          targetId: `${obs.service}:${key}`,
          message: `${key} is a localhost URL under NODE_ENV=production (${describe(now)})`,
          remediation: NO_REPAIR,
        });
      }
      continue;
    }

    // Absent on a rebuild AND validator-owned — the validator reports it with
    // better context. Skip the duplicate.
    if (
      (onRestart === undefined || onZeroState === undefined) &&
      isValidatorOwned(obs.service, key)
    ) {
      continue;
    }

    // A production URL that a rebuild would resolve to localhost is a more
    // specific — and more actionable — statement than "the views differ", so it
    // keeps its own type.
    const rebuildIsLocalhost =
      isProduction &&
      PRODUCTION_URL_KEYS.includes(key as never) &&
      (isLocalhost(onRestart) || isLocalhost(onZeroState));

    findings.push({
      driftClass: classifyKey(
        obs.service,
        key,
        onRestart === undefined || onZeroState === undefined,
      ),
      type: rebuildIsLocalhost ? 'production-url-drift' : 'reproducibility-drift',
      service: obs.service,
      targetId: `${obs.service}:${key}`,
      message:
        `${key} is running as ${describe(now)} but a rebuild would differ — ` +
        divergences.join('; ') +
        (rebuildIsLocalhost ? ' (a localhost URL under NODE_ENV=production)' : ''),
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
    targetId: 'global:db-connection-budget',
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
/**
 * The scope an incident belongs to, recovered from its `targetId`.
 *
 * Every finding is scoped `<service>:<detail>` (or the bare service, or
 * `global:` for cross-service findings like the connection budget), so the
 * owning scope survives persistence and can be recovered on a later run.
 */
export function incidentScope(targetId: string): string {
  const idx = targetId.indexOf(':');
  return idx === -1 ? targetId : targetId.slice(0, idx);
}

/**
 * Return RESOLVED copies of this agent's open incidents that the current run
 * both COVERED and did not reproduce.
 *
 * ─── Why coverage is required, not just absence ─────────────────────────────
 *
 * Absence from `currentFindings` is NOT evidence a drift is gone. When a
 * service is deferred (mid-restart) or its views could not be built, the
 * detector deliberately skips classification and says so — "absence of drift
 * was NOT established". Resolving on absence alone would contradict the guard's
 * own semantics and silently clear a real CRITICAL during a reload, which is
 * precisely when the operator most needs it to persist.
 *
 * So resolution requires the run to have SUCCESSFULLY EVALUATED the owning
 * scope. Coverage is passed in explicitly rather than inferred from which
 * finding types happen to be present — inference would re-couple resolution to
 * the emission logic and break again the next time a new finding type is added.
 *
 * Without this the detector is write-only: `recordAgentRun` upserts by id and
 * nothing ever clears, so a finding pins `systemStatus` at CRITICAL forever —
 * even after the underlying configuration is corrected. Observed on prod
 * 2026-08-12: five criticals from a transient mid-restart sample survived a
 * later clean run, and the dashboard stayed red until the entries were removed
 * by hand. A detector whose dashboard never clears is one people stop reading,
 * which is the failure this whole workstream exists to remove.
 *
 * Only THIS agent's incidents are touched, and only `open` ones — never another
 * agent's, and never an already-resolved row.
 *
 * Note these do NOT count toward `issuesFixed`, which stays 0 by design: a
 * cleared drift means an operator fixed the configuration, not that the
 * detector repaired anything.
 */
export function resolveClearedFindings(
  existing: Incident[],
  currentFindings: DriftFinding[],
  evaluatedScopes: Iterable<string>,
  resolvedAt: string,
): Incident[] {
  const stillPresent = new Set(
    currentFindings.map(f => makeIncidentId(AGENT, f.type, f.targetId)),
  );
  const covered = new Set(evaluatedScopes);

  return existing
    .filter(i =>
      i.agent === AGENT &&
      i.status === 'open' &&
      covered.has(incidentScope(i.targetId)) &&
      !stillPresent.has(i.id))
    .map(i => ({ ...i, status: 'resolved' as const, resolvedAt }));
}

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

/**
 * config-drift — the pure comparison core.
 *
 * Covers the design's numbered cases
 * (docs/plans/2026-08-12-config-drift-detection-design.md §8). The three safety
 * properties — no raw secret in output, no derived token in output, and never
 * reporting healthy when a source could not be read — are asserted explicitly
 * rather than left incidental.
 *
 * Every case is deterministic: no PM2, no /proc, no database, no network.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUILD_TIME_EXCLUSION,
  DRIFT_CLASS_TO_SEVERITY,
  OPS_AGENT_SCOPE,
  analyzeDrift,
  analyzeOpsAgentCredentialDrift,
  assessStability,
  incidentScope,
  resolveClearedFindings,
  buildMaxConnectionsCandidates,
  compareSecretValues,
  computeConnectionBudget,
  computeRestart,
  computeRuntime,
  computeZeroState,
  decomposePostgresUrl,
  decomposeRedisUrl,
  detectDrift,
  effectiveMinioAccessKey,
  evaluateConnectionBudget,
  findingsToIncidents,
  parseDotenvText,
  parseProcEnviron,
  resolvePrecedence,
  validateFreshStart,
  type EnvMap,
  type ServiceObservation,
} from './config-drift.js';
import type { Incident } from './types.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Distinctive secret values. Tests 10 and 15 assert none of these — and no
 * derivation of them — ever reaches an incident, message, or serialized output.
 */
const PG_PW = 'PGPW-do-not-leak-9f3a';
const REDIS_PW = 'REDISPW-do-not-leak-7b2c';
const JWT_SECRET = `JWTSECRET-do-not-leak-${'a'.repeat(16)}`;
const DEVICE_JWT_SECRET = `DEVICEJWT-do-not-leak-${'b'.repeat(16)}`;
const INTERNAL_SECRET = `INTERNAL-do-not-leak-${'c'.repeat(16)}`;
const MINIO_KEY = 'MINIOKEY-do-not-leak-1a2b';
const MINIO_SECRET = 'MINIOSECRET-do-not-leak-3c4d';

const ALL_SECRETS = [
  PG_PW, REDIS_PW, JWT_SECRET, DEVICE_JWT_SECRET,
  INTERNAL_SECRET, MINIO_KEY, MINIO_SECRET,
];

function pgUrl(pw = PG_PW, params = 'connection_limit=10&pool_timeout=20&statement_timeout=30000'): string {
  return `postgresql://vizora:${pw}@localhost:5432/vizora?${params}`;
}

function redisUrl(pw: string | null = REDIS_PW): string {
  return pw ? `redis://:${pw}@localhost:6379` : 'redis://localhost:6379';
}

/** A production env that passes both middleware validators. */
function prodEnv(over: Partial<EnvMap> = {}): EnvMap {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: pgUrl(),
    REDIS_URL: redisUrl(),
    // Mirrors prod, verified 2026-08-13: .env carries BOTH, and REDIS_URL's
    // password must equal REDIS_PASSWORD (docker-compose's --requirepass) or
    // every client is rejected with NOAUTH.
    REDIS_PASSWORD: REDIS_PW,
    API_BASE_URL: 'https://vizora.cloud',
    CORS_ORIGIN: 'https://vizora.cloud',
    APP_URL: 'https://vizora.cloud',
    WEB_URL: 'https://vizora.cloud',
    JWT_SECRET,
    DEVICE_JWT_SECRET,
    INTERNAL_API_SECRET: INTERNAL_SECRET,
    MINIO_ACCESS_KEY: MINIO_KEY,
    MINIO_SECRET_KEY: MINIO_SECRET,
    MINIO_ENDPOINT: 'localhost',
    MINIO_PORT: '9000',
    MINIO_BUCKET: 'vizora-assets',
    MINIO_USE_SSL: 'false',
    MIDDLEWARE_PORT: '3000',
    ...over,
  };
}

/**
 * Fixtures mirror the real PM2 shape: PM2 stores the MERGED environment
 * (ecosystem block layered over what it inherited), and applies it in-process.
 * So `pm2Env` is a superset, not an independent source — perturbing it alone
 * does not express drift. Drift is expressed by perturbing the PERSISTED
 * sources, which is also the shape the 2026-08-11 incident actually had.
 *
 * Ecosystem blocks are transcribed from ecosystem.config.js: every app declares
 * `env: { NODE_ENV: 'development', PORT }` and
 * `env_production: { NODE_ENV: 'production', PORT }`.
 */
function middlewareObs(over: Partial<ServiceObservation> = {}): ServiceObservation {
  const dotenv = prodEnv();
  const ecoProduction: EnvMap = { NODE_ENV: 'production', PORT: '3000' };
  const ecoDefault: EnvMap = { NODE_ENV: 'development', PORT: '3000' };
  const pm2 = { ...dotenv, ...ecoProduction };
  return {
    service: 'middleware',
    instances: 2,
    procEnviron: { ...pm2 },
    pm2Env: { ...pm2 },
    ecosystemEnvProduction: ecoProduction,
    ecosystemEnvDefault: ecoDefault,
    dotenvVars: dotenv,
    stability: { stable: true },
    ...over,
  };
}

function realtimeObs(over: Partial<ServiceObservation> = {}): ServiceObservation {
  const dotenv = prodEnv({ REALTIME_PORT: '3002' });
  delete dotenv.MIDDLEWARE_PORT;
  const ecoProduction: EnvMap = { NODE_ENV: 'production', PORT: '3002' };
  const ecoDefault: EnvMap = { NODE_ENV: 'development', PORT: '3002' };
  const pm2 = { ...dotenv, ...ecoProduction };
  return {
    service: 'realtime',
    instances: 1,
    procEnviron: { ...pm2 },
    pm2Env: { ...pm2 },
    ecosystemEnvProduction: ecoProduction,
    ecosystemEnvDefault: ecoDefault,
    dotenvVars: dotenv,
    stability: { stable: true },
    ...over,
  };
}

/** web: no `.env` in cwd at all (design §1) — `dotenvVars` is null, not empty. */
function webObs(over: Partial<ServiceObservation> = {}): ServiceObservation {
  const ecoProduction: EnvMap = {
    NODE_ENV: 'production',
    PORT: '3001',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'gsi-client-id',
    // Server-side proxy to middleware — localhost is CORRECT here.
    BACKEND_URL: 'http://localhost:3000',
  };
  const ecoDefault: EnvMap = { NODE_ENV: 'development', PORT: '3001' };
  const pm2 = { ...ecoProduction };
  return {
    service: 'web',
    instances: 1,
    procEnviron: { ...pm2 },
    pm2Env: { ...pm2 },
    ecosystemEnvProduction: ecoProduction,
    ecosystemEnvDefault: ecoDefault,
    dotenvVars: null,
    stability: { stable: true },
    ...over,
  };
}

const SAFE_MAX_CONNECTIONS = 100;

function findingsFor(
  observations: ServiceObservation[],
  maxConnections: number | null = SAFE_MAX_CONNECTIONS,
) {
  return detectDrift(observations, { maxConnections });
}

function types(findings: { type: string }[]): string[] {
  return findings.map(f => f.type).sort();
}

// ─── Precedence model (§2) ───────────────────────────────────────────────────

test('resolvePrecedence: process env wins, dotenv only fills gaps', () => {
  const resolved = resolvePrecedence({ A: 'from-process' }, { A: 'from-dotenv', B: 'from-dotenv' });
  assert.equal(resolved.A, 'from-process', 'dotenv must never override an already-set key');
  assert.equal(resolved.B, 'from-dotenv');
});

test('resolvePrecedence: an empty-string process value still counts as set', () => {
  // dotenv treats a defined key as set even when empty. Modelling it otherwise
  // would report a phantom fresh-start value the real loader never produces.
  const resolved = resolvePrecedence({ A: '' }, { A: 'from-dotenv' });
  assert.equal(resolved.A, '');
});

test('resolvePrecedence: null dotenv (web has no .env) is not an error', () => {
  const resolved = resolvePrecedence({ A: 'x' }, null);
  assert.deepEqual(resolved, { A: 'x' });
});

test('computeRuntime reconstructs R from /proc + PM2 in-process env + dotenv', () => {
  // /proc lacks DATABASE_URL; PM2 and dotenv both carry it. R must contain it.
  const obs = middlewareObs({
    procEnviron: (() => { const e = prodEnv(); delete e.DATABASE_URL; return e; })(),
  });
  assert.equal(computeRuntime(obs).DATABASE_URL, pgUrl(), 'R must be reconstructed, not read from /proc');
});

test('computeZeroState models the invoking shell as empty (§9.1)', () => {
  // JWT_SECRET reached the running process by operator shell inheritance only:
  // present in /proc, absent from PM2, ecosystem and .env.
  const env = prodEnv();
  const withoutJwt = (() => { const e = prodEnv(); delete e.JWT_SECRET; return e; })();
  const obs = middlewareObs({
    procEnviron: { ...env },
    pm2Env: { ...withoutJwt },
    dotenvVars: { ...withoutJwt },
  });
  assert.equal(computeRuntime(obs).JWT_SECRET, JWT_SECRET);
  assert.equal(
    computeZeroState(obs).JWT_SECRET,
    undefined,
    'a shell-inherited variable must be absent from Z',
  );
});

test('P and Z are distinct: a PM2-only value survives restart but not a rebuild', () => {
  // The blind spot the R/P/Z split exists to close. INTERNAL_API_SECRET lives
  // ONLY in PM2 stored env — not in the ecosystem file, not in .env.
  const withoutInternal = (() => { const e = prodEnv(); delete e.INTERNAL_API_SECRET; return e; })();
  const obs = middlewareObs({
    procEnviron: { ...withoutInternal },
    pm2Env: { ...prodEnv() },
    dotenvVars: { ...withoutInternal },
  });
  assert.equal(computeRuntime(obs).INTERNAL_API_SECRET, INTERNAL_SECRET, 'running fine today');
  assert.equal(computeRestart(obs).INTERNAL_API_SECRET, INTERNAL_SECRET, 'pm2 restart reuses it');
  assert.equal(
    computeZeroState(obs).INTERNAL_API_SECRET,
    undefined,
    'a zero-state rebuild loses it — merging P and Z would hide exactly this',
  );
});

// ─── Parsers (§3) ────────────────────────────────────────────────────────────

test('parseDotenvText handles an unquoted value containing & (case 14)', () => {
  // Regression against the bash-sourcing trap: `set -a; . ./.env` runs the
  // assignment in a subshell and silently never sets the variable.
  const parsed = parseDotenvText(
    'DATABASE_URL=postgresql://u:p@h:5432/d?connection_limit=30&pool_timeout=20\nOTHER=x\n',
  );
  assert.equal(parsed.DATABASE_URL, 'postgresql://u:p@h:5432/d?connection_limit=30&pool_timeout=20');
  assert.equal(parsed.OTHER, 'x');
});

test('parseProcEnviron splits NUL-separated pairs and keeps = inside values', () => {
  const parsed = parseProcEnviron('A=1\0DATABASE_URL=postgres://h/d?x=1&y=2\0\0');
  assert.equal(parsed.A, '1');
  assert.equal(parsed.DATABASE_URL, 'postgres://h/d?x=1&y=2');
  assert.equal(Object.keys(parsed).length, 2, 'trailing NULs must not produce empty keys');
});

// ─── URL decomposition (§4) ──────────────────────────────────────────────────

test('decomposePostgresUrl separates credential from pool params', () => {
  const parts = decomposePostgresUrl(pgUrl());
  assert.equal(parts?.host, 'localhost');
  assert.equal(parts?.port, '5432');
  assert.equal(parts?.database, 'vizora');
  assert.equal(parts?.user, 'vizora');
  assert.equal(parts?.password, PG_PW);
  assert.equal(parts?.params.connection_limit, '10');
  assert.equal(parts?.params.statement_timeout, '30000');
});

test('decomposeRedisUrl reports password presence', () => {
  assert.equal(decomposeRedisUrl(redisUrl())?.password, REDIS_PW);
  assert.equal(decomposeRedisUrl(redisUrl(null))?.password, undefined);
});

test('effectiveMinioAccessKey models the documented fallback chain', () => {
  // main.ts:223 reads MINIO_ACCESS_KEY || AWS_ACCESS_KEY_ID. Comparing the
  // variable name alone can report a false match or a false drift.
  assert.equal(effectiveMinioAccessKey({ MINIO_ACCESS_KEY: 'a' }), 'a');
  assert.equal(effectiveMinioAccessKey({ AWS_ACCESS_KEY_ID: 'b' }), 'b');
  assert.equal(effectiveMinioAccessKey({ MINIO_ACCESS_KEY: 'a', AWS_ACCESS_KEY_ID: 'b' }), 'a');
  assert.equal(effectiveMinioAccessKey({}), undefined);
});

// ─── max_connections query construction (ruling constraint 2) ────────────────

test('buildMaxConnectionsCandidates offers host psql first, then the container', () => {
  const candidates = buildMaxConnectionsCandidates(pgUrl(), 'vizora-postgres');
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].command, 'psql');
  assert.equal(candidates[1].command, 'docker');
});

test('host psql candidate keeps the password in env, never in argv', () => {
  const [host] = buildMaxConnectionsCandidates(pgUrl(), 'vizora-postgres');
  assert.equal(host.env.PGPASSWORD, PG_PW, 'password must be passed via env');
  assert.ok(
    !host.args.some(a => a.includes(PG_PW)),
    'argv is world-readable via ps — the password must never appear there',
  );
  assert.equal(host.env.PGCONNECT_TIMEOUT, '3', 'must not hang on a password prompt');
});

test('container candidate carries no password at all, in argv or env', () => {
  const [, container] = buildMaxConnectionsCandidates(pgUrl(), 'vizora-postgres');
  assert.ok(!container.args.some(a => a.includes(PG_PW)), 'password leaked into docker argv');
  assert.equal(
    JSON.stringify(container.env).includes(PG_PW),
    false,
    '`docker exec -e PGPASSWORD` would put the secret back into host argv — use socket auth',
  );
  assert.deepEqual(container.env, {});
});

test('container candidate uses the DATABASE_URL identity, not an elevated one', () => {
  const [, container] = buildMaxConnectionsCandidates(pgUrl(), 'vizora-postgres');
  assert.deepEqual(
    container.args,
    ['exec', 'vizora-postgres', 'psql', '-U', 'vizora', '-d', 'vizora', '-t', '-A', '-c', 'SHOW max_connections'],
  );
});

test('both candidates read only — the statement is always SHOW max_connections', () => {
  for (const candidate of buildMaxConnectionsCandidates(pgUrl(), 'vizora-postgres')) {
    assert.equal(candidate.args[candidate.args.length - 1], 'SHOW max_connections');
    assert.equal(candidate.args[candidate.args.length - 2], '-c');
  }
});

test('an empty container name disables the fallback', () => {
  const candidates = buildMaxConnectionsCandidates(pgUrl(), '');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].command, 'psql');
});

test('an unparseable DATABASE_URL yields no candidates (budget stays UNKNOWN)', () => {
  assert.deepEqual(buildMaxConnectionsCandidates('not-a-url', 'vizora-postgres'), []);
  assert.deepEqual(buildMaxConnectionsCandidates(undefined, 'vizora-postgres'), []);
});

test('a passwordless DATABASE_URL sets no PGPASSWORD key', () => {
  const [host] = buildMaxConnectionsCandidates(
    'postgresql://postgres@localhost:5432/vizora',
    'vizora-postgres',
  );
  assert.equal('PGPASSWORD' in host.env, false);
});

// ─── Secret comparison (§4, ruling constraint 3) ─────────────────────────────

test('compareSecretValues returns a state token and nothing derived from the value', () => {
  assert.equal(compareSecretValues('same', 'same'), 'MATCH');
  assert.equal(compareSecretValues('one', 'other'), 'DRIFT');
  assert.equal(compareSecretValues(undefined, undefined), 'BOTH_ABSENT');
  assert.equal(compareSecretValues('present', undefined), 'ONE_ABSENT');
  assert.equal(compareSecretValues(undefined, 'present'), 'ONE_ABSENT');
});

test('compareSecretValues is not confused by differing lengths', () => {
  assert.equal(compareSecretValues('short', 'a-much-longer-secret'), 'DRIFT');
  assert.equal(compareSecretValues('', 'x'), 'DRIFT');
});

// ─── Fresh-start validation (§1) ─────────────────────────────────────────────

test('validateFreshStart: a healthy production env passes both middleware validators', () => {
  assert.deepEqual(validateFreshStart('middleware', prodEnv()), []);
});

test('validateFreshStart: middleware bare-presence validator catches API_BASE_URL (case 4)', () => {
  const env = prodEnv();
  delete env.API_BASE_URL;
  const failures = validateFreshStart('middleware', env);
  assert.ok(failures.some(f => f.includes('API_BASE_URL')), `expected API_BASE_URL failure, got ${JSON.stringify(failures)}`);
});

test('validateFreshStart: middleware Zod fitness rejects minioadmin (case 5)', () => {
  const failures = validateFreshStart('middleware', prodEnv({
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
  }));
  assert.ok(failures.some(f => f.includes('MINIO_ACCESS_KEY')), `expected MinIO failure, got ${JSON.stringify(failures)}`);
});

test('validateFreshStart: both middleware validators are evaluated, not just the first', () => {
  // The incident fired them sequentially — fixing the first revealed the second.
  // A detector that stops at the presence check reports "would start fine".
  const env = prodEnv({ MINIO_ACCESS_KEY: 'minioadmin' });
  delete env.API_BASE_URL;
  const failures = validateFreshStart('middleware', env);
  assert.ok(failures.some(f => f.includes('API_BASE_URL')), 'presence failure missing');
  assert.ok(failures.some(f => f.includes('MINIO_ACCESS_KEY')), 'fitness failure missing');
});

test('validateFreshStart: realtime uses its own required set, including CORS_ORIGIN', () => {
  const env = prodEnv({ REALTIME_PORT: '3002' });
  delete env.CORS_ORIGIN;
  const failures = validateFreshStart('realtime', env);
  assert.ok(failures.some(f => f.includes('CORS_ORIGIN')), `expected CORS_ORIGIN failure, got ${JSON.stringify(failures)}`);
});

test('validateFreshStart: realtime rejects a port that is not 3002', () => {
  const failures = validateFreshStart('realtime', prodEnv({ REALTIME_PORT: '3009' }));
  assert.ok(failures.some(f => f.includes('3009') || f.includes('port')), `expected port failure, got ${JSON.stringify(failures)}`);
});

test('validateFreshStart: secret VALUES never appear in failure text', () => {
  const failures = validateFreshStart('middleware', prodEnv({ JWT_SECRET: 'too-short' }));
  const text = failures.join('\n');
  assert.ok(failures.length > 0, 'expected a JWT_SECRET length failure');
  assert.ok(!text.includes('too-short'), 'validator output must not echo the offending secret value');
});

// ─── Connection budget (§7, ruling constraint 2) ─────────────────────────────

test('computeConnectionBudget sums instances x connection_limit per service', () => {
  const budget = computeConnectionBudget([
    middlewareObs({ procEnviron: prodEnv({ DATABASE_URL: pgUrl(PG_PW, 'connection_limit=30') }), dotenvVars: prodEnv({ DATABASE_URL: pgUrl(PG_PW, 'connection_limit=30') }), pm2Env: prodEnv({ DATABASE_URL: pgUrl(PG_PW, 'connection_limit=30') }) }),
    realtimeObs({ procEnviron: prodEnv({ DATABASE_URL: pgUrl(PG_PW, 'connection_limit=30'), REALTIME_PORT: '3002' }), dotenvVars: prodEnv({ DATABASE_URL: pgUrl(PG_PW, 'connection_limit=30'), REALTIME_PORT: '3002' }), pm2Env: prodEnv({ DATABASE_URL: pgUrl(PG_PW, 'connection_limit=30'), REALTIME_PORT: '3002' }) }),
  ]);
  assert.equal(budget.total, 90, '2 x 30 (middleware cluster) + 1 x 30 (realtime)');
  assert.equal(budget.determinable, true);
});

test('computeConnectionBudget is undeterminable when connection_limit is absent', () => {
  const budget = computeConnectionBudget([
    middlewareObs({
      procEnviron: prodEnv({ DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora' }),
      pm2Env: prodEnv({ DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora' }),
      dotenvVars: prodEnv({ DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora' }),
    }),
  ]);
  assert.equal(budget.determinable, false, 'Prisma default is host-dependent — must not be guessed');
});

test('evaluateConnectionBudget: 90 against max_connections 50 is UNSAFE (case 7)', () => {
  const verdict = evaluateConnectionBudget({ total: 90, determinable: true, perService: {} }, 50);
  assert.equal(verdict.verdict, 'UNSAFE');
});

test('evaluateConnectionBudget: UNKNOWN when max_connections is unavailable (case 16)', () => {
  const verdict = evaluateConnectionBudget({ total: 30, determinable: true, perService: {} }, null);
  assert.equal(verdict.verdict, 'UNKNOWN');
  assert.notEqual(verdict.verdict, 'SAFE', 'an unavailable query must never read as healthy');
  assert.match(verdict.message, /max_connections unavailable/);
});

test('evaluateConnectionBudget: UNKNOWN when the budget itself is undeterminable', () => {
  const verdict = evaluateConnectionBudget({ total: 0, determinable: false, perService: {} }, 100);
  assert.equal(verdict.verdict, 'UNKNOWN');
});

// ─── End-to-end drift detection ──────────────────────────────────────────────

test('case 1: all sources agree across all three services — no incident', () => {
  const findings = findingsFor([middlewareObs(), realtimeObs(), webObs()]);
  assert.deepEqual(findings, [], `expected zero findings, got ${JSON.stringify(findings, null, 2)}`);
});

test('case 2: DB password differs between B and C — CRITICAL', () => {
  const drifted = prodEnv({ DATABASE_URL: pgUrl('a-different-password') });
  const findings = findingsFor([middlewareObs({ dotenvVars: drifted })]);
  const credential = findings.find(f => f.type === 'credential-drift');
  assert.ok(credential, `expected credential-drift, got ${types(findings)}`);
  assert.equal(credential.driftClass, 'CRITICAL');
});

test('case 3: Redis password present in C, absent in B — CRITICAL', () => {
  const noPw = prodEnv({ REDIS_URL: redisUrl(null) });
  const findings = findingsFor([middlewareObs({ dotenvVars: noPw })]);
  const credential = findings.find(f => f.type === 'credential-drift' && f.targetId.includes('REDIS'));
  assert.ok(credential, `expected Redis credential-drift, got ${types(findings)}`);
  assert.equal(credential.driftClass, 'CRITICAL');
});

test('case 4: API_BASE_URL absent from fresh start — CRITICAL', () => {
  const withoutApiBase = (() => { const e = prodEnv(); delete e.API_BASE_URL; return e; })();
  const findings = findingsFor([middlewareObs({ dotenvVars: withoutApiBase })]);
  const failure = findings.find(f => f.type === 'zero-state-would-fail');
  assert.ok(failure, `expected zero-state-would-fail, got ${types(findings)}`);
  assert.equal(failure.driftClass, 'CRITICAL');
  assert.match(failure.message, /API_BASE_URL/);
});

test('case 5: MinIO defaults would be rejected by the fitness validator — CRITICAL', () => {
  const defaults = prodEnv({ MINIO_ACCESS_KEY: 'minioadmin', MINIO_SECRET_KEY: 'minioadmin' });
  const findings = findingsFor([middlewareObs({ dotenvVars: defaults })]);
  const failure = findings.find(f => f.type === 'zero-state-would-fail');
  assert.ok(failure, `expected zero-state-would-fail, got ${types(findings)}`);
  assert.equal(failure.driftClass, 'CRITICAL');
});

test('case 6: localhost production URLs — HIGH', () => {
  const localhost = prodEnv({ CORS_ORIGIN: 'http://localhost:3001', APP_URL: 'http://localhost:3001' });
  const findings = findingsFor([middlewareObs({ dotenvVars: localhost })]);
  const urlFindings = findings.filter(f => f.type === 'production-url-drift');
  assert.ok(urlFindings.length > 0, `expected production-url-drift, got ${types(findings)}`);
  assert.ok(urlFindings.every(f => f.driftClass === 'HIGH'));
});

test("case 6b: web's localhost BACKEND_URL is correct and must not be flagged", () => {
  // §1: BACKEND_URL is the server-side proxy to middleware. Flagging it would
  // make the detector permanently noisy about a correct value.
  const findings = findingsFor([webObs()]);
  assert.deepEqual(findings, [], `web must be clean, got ${JSON.stringify(findings, null, 2)}`);
});

test('case 7: connection budget over max_connections — CRITICAL', () => {
  const wide = prodEnv({ DATABASE_URL: pgUrl(PG_PW, 'connection_limit=30') });
  const findings = detectDrift(
    [middlewareObs({ procEnviron: wide, pm2Env: wide, dotenvVars: wide })],
    { maxConnections: 50 },
  );
  const budget = findings.find(f => f.type === 'connection-budget-unsafe');
  assert.ok(budget, `expected connection-budget-unsafe, got ${types(findings)}`);
  assert.equal(budget.driftClass, 'CRITICAL');
});

test('case 8: statement_timeout present in C, absent in B — WARNING', () => {
  const noTimeout = prodEnv({ DATABASE_URL: pgUrl(PG_PW, 'connection_limit=10&pool_timeout=20') });
  const findings = findingsFor([middlewareObs({ dotenvVars: noTimeout })]);
  const pool = findings.find(f => f.type === 'pool-parameter-drift');
  assert.ok(pool, `expected pool-parameter-drift, got ${types(findings)}`);
  assert.equal(pool.driftClass, 'WARNING');
  assert.match(pool.message, /statement_timeout/);
});

test('case 16: max_connections unavailable reports UNKNOWN, never healthy', () => {
  const findings = detectDrift([middlewareObs()], { maxConnections: null });
  const unknown = findings.find(f => f.type === 'connection-budget-unknown');
  assert.ok(unknown, `expected connection-budget-unknown, got ${types(findings)}`);
  assert.ok(!findings.some(f => f.type === 'connection-budget-unsafe'));
});

test('case 17: a shell-inherited required var is missing on fresh start — CRITICAL', () => {
  const withoutJwt = (() => { const e = prodEnv(); delete e.JWT_SECRET; return e; })();
  const findings = findingsFor([middlewareObs({ dotenvVars: withoutJwt })]);
  const failure = findings.find(f => f.type === 'zero-state-would-fail');
  assert.ok(failure, `expected zero-state-would-fail, got ${types(findings)}`);
  assert.equal(failure.driftClass, 'CRITICAL');
  assert.match(failure.message, /JWT_SECRET/);
});

test('a value absent from /proc but present in PM2+dotenv is not a false missing', () => {
  const procWithoutDb = (() => { const e = prodEnv(); delete e.DATABASE_URL; return e; })();
  const findings = findingsFor([middlewareObs({ procEnviron: procWithoutDb })]);
  assert.deepEqual(findings, [], `expected zero findings, got ${JSON.stringify(findings, null, 2)}`);
});

test('an unreadable /proc is reported as DEGRADED, and comparisons continue', () => {
  // In cluster mode /proc legitimately carries no app config, so its absence
  // must not block detection — PM2 stored env is the load-bearing source.
  const findings = findingsFor([middlewareObs({ procEnviron: null })]);
  const degraded = findings.find(f => f.type === 'observation-degraded');
  assert.ok(degraded, `expected observation-degraded, got ${types(findings)}`);
  assert.equal(degraded.driftClass, 'WARNING');
  assert.ok(!findings.some(f => f.type === 'observation-incomplete'));
});

test('empty PM2 state is reported rather than read as "nothing configured"', () => {
  const findings = findingsFor([middlewareObs({ pm2Env: {} })]);
  assert.ok(
    findings.some(f => f.type === 'observation-incomplete'),
    `expected observation-incomplete, got ${types(findings)}`,
  );
});

// ─── Cluster-mode regressions (first-cycle findings, 2026-08-12) ─────────────

/**
 * Prod's real cluster-mode shape: middleware's `/proc` carries 25 keys and none
 * of the app's config, because PM2 applies its stored env inside the worker
 * after exec. Modelling `/proc` as runtime truth produced a false
 * `NODE_ENV: effective=development` finding on the first live cycle, disproved
 * behaviourally (Swagger 404 on a gate reading `process.env.NODE_ENV`).
 */
function clusterModeMiddleware(over: Partial<ServiceObservation> = {}): ServiceObservation {
  return middlewareObs({
    // What cluster-mode /proc actually looks like: PM2 bookkeeping only.
    procEnviron: { PM2_HOME: '/root/.pm2', HOME: '/root', PATH: '/usr/bin' },
    ...over,
  });
}

test('cluster mode: /proc missing NODE_ENV + PM2 production → runtime is production', () => {
  const obs = clusterModeMiddleware();
  assert.equal(
    computeRuntime(obs).NODE_ENV,
    'production',
    'PM2 in-process env must win — /proc absence proves nothing in cluster mode',
  );
});

test('cluster mode: no false runtime drift when PM2 and ecosystem agree', () => {
  const findings = findingsFor([clusterModeMiddleware()]);
  assert.ok(
    !findings.some(f => f.type === 'reproducibility-drift' && f.targetId.endsWith('NODE_ENV')),
    `the 2026-08-12 false positive must not recur, got ${JSON.stringify(findings, null, 2)}`,
  );
});

test('PM2 production + persisted .env development → zero-state shadow hazard, CRITICAL', () => {
  // Prod's actual state on 2026-08-12.
  const obs = clusterModeMiddleware({
    dotenvVars: prodEnv({ NODE_ENV: 'development' }),
  });
  const findings = findingsFor([obs]);
  const shadow = findings.find(f => f.type === 'config-shadow' && f.targetId.endsWith('NODE_ENV'));

  assert.ok(shadow, `expected config-shadow for NODE_ENV, got ${types(findings)}`);
  assert.equal(shadow.driftClass, 'CRITICAL', 'NODE_ENV bypasses both production-only validators');
  assert.match(shadow.message, /running as production/);
  assert.match(shadow.message, /development/);
  assert.match(shadow.message, /validators are gated/);
});

test('PM2 and persisted config agree → no shadow finding', () => {
  const findings = findingsFor([clusterModeMiddleware()]);
  assert.ok(
    !findings.some(f => f.type === 'config-shadow'),
    `no shadow expected when sources agree, got ${JSON.stringify(findings, null, 2)}`,
  );
});

test('the ecosystem default env block alone never raises a shadow finding', () => {
  // `env: { NODE_ENV: 'development' }` is the dev block on EVERY PM2 app.
  // Flagging it would fire on every service on every run — permanent noise.
  const obs = clusterModeMiddleware();
  assert.equal(obs.ecosystemEnvDefault.NODE_ENV, 'development');
  assert.ok(!findingsFor([obs]).some(f => f.type === 'config-shadow'));
});

test('/proc, PM2 and dotenv disagreeing resolves deterministically and is attributed', () => {
  const obs = middlewareObs({
    procEnviron: prodEnv({ APP_URL: 'https://from-proc.example' }),
    pm2Env: prodEnv({ APP_URL: 'https://from-pm2.example' }),
    dotenvVars: prodEnv({ APP_URL: 'https://from-dotenv.example' }),
  });

  // Deterministic precedence: PM2 in-process > /proc exec env > dotenv.
  assert.equal(computeRuntime(obs).APP_URL, 'https://from-pm2.example');
  assert.equal(computeZeroState(obs).APP_URL, 'https://from-dotenv.example');

  const shadow = findingsFor([obs]).find(
    f => f.type === 'config-shadow' && f.targetId.endsWith('APP_URL'),
  );
  assert.ok(shadow, 'a disagreement between runtime and persisted .env must be reported');
  assert.match(shadow.message, /from-pm2\.example/, 'must name the running value');
  assert.match(shadow.message, /from-dotenv\.example/, 'must name the persisted value');
});

// ─── Operating correctness: stale resolution + stability guard ───────────────

const NOW = 1_786_560_000_000;
const SETTLED = 90_000;

function sample(
  over: Partial<{ pmId: number; status: string; restartTime: number; uptimeMs: number; pid: number }> = {},
) {
  return { pmId: 36, status: 'online', restartTime: 5, uptimeMs: NOW - 10 * 60_000, pid: 1234, ...over };
}

/** middleware's real shape: 2 instances in PM2 cluster mode. */
function cluster(
  a: Partial<ReturnType<typeof sample>> = {},
  b: Partial<ReturnType<typeof sample>> = {},
) {
  return [
    sample({ pmId: 36, pid: 1234, ...a }),
    sample({ pmId: 37, pid: 5678, ...b }),
  ];
}

test('stability: a settled single instance is stable', () => {
  assert.deepEqual(assessStability([sample()], [sample()], NOW, SETTLED), { stable: true });
});

test('stability: a changed restart generation is NOT stable', () => {
  // The 2026-08-12 case: a run landed mid-reload and emitted five criticals
  // that a run 115s later reproduced none of.
  const v = assessStability([sample({ restartTime: 5 })], [sample({ restartTime: 6 })], NOW, SETTLED);
  assert.equal(v.stable, false);
  assert.match(v.reason ?? '', /restart generation changed/);
});

test('stability: a changed pid is NOT stable', () => {
  const v = assessStability([sample({ pid: 100 })], [sample({ pid: 200 })], NOW, SETTLED);
  assert.equal(v.stable, false);
  assert.match(v.reason ?? '', /pid changed/);
});

test('stability: a non-online status in either sample is NOT stable', () => {
  assert.equal(assessStability([sample({ status: 'launching' })], [sample()], NOW, SETTLED).stable, false);
  assert.equal(assessStability([sample()], [sample({ status: 'stopping' })], NOW, SETTLED).stable, false);
});

test('stability: a freshly started generation is NOT stable until it settles', () => {
  const fresh = [sample({ uptimeMs: NOW - 5_000 })];
  const v = assessStability(fresh, fresh, NOW, SETTLED);
  assert.equal(v.stable, false);
  assert.match(v.reason ?? '', /below the 90s settle threshold/);
});

test('stability: a missing process in either sample is NOT stable', () => {
  assert.equal(assessStability([], [sample()], NOW, SETTLED).stable, false);
  assert.equal(assessStability([sample()], [], NOW, SETTLED).stable, false);
});

test('stability: missing pm_uptime defers rather than silently satisfying the age requirement', () => {
  const noUptime = [sample({ uptimeMs: undefined as unknown as number })];
  const v = assessStability(noUptime, noUptime, NOW, SETTLED);
  assert.equal(v.stable, false);
  assert.match(v.reason ?? '', /pm_uptime missing/);
});

// ─── Cluster-wide stability (middleware runs 2 instances) ────────────────────

test('cluster: both instances settled → stable', () => {
  assert.deepEqual(assessStability(cluster(), cluster(), NOW, SETTLED), { stable: true });
});

test('cluster: sibling mid-reload defers the WHOLE service even when the primary is settled', () => {
  // The blocking edge: `pm2 reload` rolls a cluster one instance at a time.
  // Instance 36 is settled and unchanged; instance 37 is rolling. Judging only
  // the settled sibling would certify middleware as stable mid-reload.
  const restartGen = assessStability(
    cluster({}, { restartTime: 5 }),
    cluster({}, { restartTime: 6 }),
    NOW, SETTLED,
  );
  assert.equal(restartGen.stable, false);
  assert.match(restartGen.reason ?? '', /pm_id 37 restart generation changed/);

  const pidChange = assessStability(
    cluster({}, { pid: 5678 }),
    cluster({}, { pid: 9999 }),
    NOW, SETTLED,
  );
  assert.equal(pidChange.stable, false);
  assert.match(pidChange.reason ?? '', /pm_id 37 pid changed/);
});

test('cluster: an instance launching or stopping defers the whole service', () => {
  const launching = assessStability(cluster(), cluster({}, { status: 'launching' }), NOW, SETTLED);
  assert.equal(launching.stable, false);
  assert.match(launching.reason ?? '', /pm_id 37 status/);

  const stopping = assessStability(cluster({}, { status: 'stopping' }), cluster(), NOW, SETTLED);
  assert.equal(stopping.stable, false);
  assert.match(stopping.reason ?? '', /pm_id 37 status/);
});

test('cluster: an instance count change in either direction defers', () => {
  const shrank = assessStability(cluster(), [sample({ pmId: 36 })], NOW, SETTLED);
  assert.equal(shrank.stable, false);
  assert.match(shrank.reason ?? '', /instance count changed between samples \(2 → 1\)/);

  const grew = assessStability(cluster(), [...cluster(), sample({ pmId: 38, pid: 4242 })], NOW, SETTLED);
  assert.equal(grew.stable, false);
  assert.match(grew.reason ?? '', /instance count changed between samples \(2 → 3\)/);
});

test('cluster: the same COUNT but a different pm_id set defers', () => {
  // A replaced instance keeps the count identical, so counting alone is not
  // enough — the identity of the set has to match too.
  const v = assessStability(
    cluster(),
    [sample({ pmId: 36 }), sample({ pmId: 99, pid: 5678 })],
    NOW, SETTLED,
  );
  assert.equal(v.stable, false);
  assert.match(v.reason ?? '', /instance set changed/);
});

test('cluster: one instance missing pm_uptime defers the whole service', () => {
  const v = assessStability(
    cluster(),
    cluster({}, { uptimeMs: undefined as unknown as number }),
    NOW, SETTLED,
  );
  assert.equal(v.stable, false);
  assert.match(v.reason ?? '', /pm_id 37 pm_uptime missing/);
});

test('cluster: one instance below the settle threshold defers the whole service', () => {
  const v = assessStability(
    cluster({}, { uptimeMs: NOW - 5_000 }),
    cluster({}, { uptimeMs: NOW - 5_000 }),
    NOW, SETTLED,
  );
  assert.equal(v.stable, false);
  assert.match(v.reason ?? '', /pm_id 37 generation is 5s old/);
});

test('cluster: a missing pm_id defers — instances cannot be matched across samples', () => {
  const anonymous = [sample({ pmId: undefined as unknown as number }), sample({ pmId: 37 })];
  const v = assessStability(anonymous, anonymous, NOW, SETTLED);
  assert.equal(v.stable, false);
  assert.match(v.reason ?? '', /pm_id missing/);
});

test('cluster: instance order between samples does not matter', () => {
  // PM2 does not guarantee ordering in `jlist`; matching is by pm_id.
  const [a, b] = cluster();
  assert.deepEqual(assessStability([a, b], [b, a], NOW, SETTLED), { stable: true });
});

test('an unstable service is DEFERRED — no drift is emitted for it', () => {
  const drifted = prodEnv({ APP_URL: 'http://localhost:3001' });
  const findings = findingsFor([
    middlewareObs({
      dotenvVars: drifted,
      stability: { stable: false, reason: 'restart generation changed between samples (5 → 6)' },
    }),
  ]);

  const deferred = findings.find(f => f.type === 'observation-deferred');
  assert.ok(deferred, `expected observation-deferred, got ${types(findings)}`);
  assert.match(deferred.message, /NOT established/, 'must not read as healthy');
  assert.ok(
    !findings.some(f => f.type === 'config-shadow' || f.type === 'production-url-drift'),
    'a service mid-restart must not be classified — that is the transient false positive',
  );
});

test('a stable service with the same drift IS classified — the guard is not a mute button', () => {
  const drifted = prodEnv({ APP_URL: 'http://localhost:3001' });
  const findings = findingsFor([middlewareObs({ dotenvVars: drifted })]);
  assert.ok(findings.some(f => f.type === 'config-shadow'));
  assert.ok(!findings.some(f => f.type === 'observation-deferred'));
});

test('resolution: a finding clears when its scope WAS evaluated and it did not reproduce', () => {
  const drifted = prodEnv({ APP_URL: 'http://localhost:3001' });
  const before = findingsToIncidents(
    findingsFor([middlewareObs({ dotenvVars: drifted })]),
    '2026-08-12T10:00:00.000Z',
  );
  assert.ok(before.length > 0);

  // Next run: configuration corrected, middleware fully evaluated.
  const next = analyzeDrift([middlewareObs()], { maxConnections: SAFE_MAX_CONNECTIONS });
  assert.ok(next.evaluated.includes('middleware'));

  const cleared = resolveClearedFindings(
    before, next.findings, next.evaluated, '2026-08-12T11:00:00.000Z',
  );
  assert.equal(cleared.length, before.length, 'every stale finding must clear');
  assert.ok(cleared.every(i => i.status === 'resolved'));
  assert.ok(cleared.every(i => i.resolvedAt === '2026-08-12T11:00:00.000Z'));
  assert.deepEqual(cleared.map(i => i.id).sort(), before.map(i => i.id).sort(), 'same ids, so recordAgentRun upserts');
});

test('resolution: a DEFERRED service cannot clear its own open findings', () => {
  // The composition bug. Deferral states "absence of drift was NOT established";
  // resolving on absence at that moment contradicts the guard's own semantics
  // and would silently clear a real CRITICAL during a reload.
  const drifted = prodEnv({ NODE_ENV: 'development' });
  const before = findingsToIncidents(
    findingsFor([middlewareObs({ dotenvVars: drifted })]),
    '2026-08-12T10:00:00.000Z',
  );
  assert.ok(before.some(i => i.severity === 'critical'), 'setup: a real CRITICAL exists');

  const next = analyzeDrift(
    [middlewareObs({
      dotenvVars: drifted,
      stability: { stable: false, reason: 'restart generation changed between samples (5 → 6)' },
    })],
    { maxConnections: SAFE_MAX_CONNECTIONS },
  );
  assert.ok(!next.evaluated.includes('middleware'), 'a deferred service is not evaluated');

  assert.deepEqual(
    resolveClearedFindings(before, next.findings, next.evaluated, '2026-08-12T11:00:00.000Z'),
    [],
    'a deferred service must preserve its open findings',
  );
});

test('resolution: deferred middleware preserves its findings while evaluated realtime clears its own', () => {
  const mwDrift = prodEnv({ NODE_ENV: 'development' });
  const rtDrift = prodEnv({ REALTIME_PORT: '3002', APP_URL: 'http://localhost:9999' });
  delete rtDrift.MIDDLEWARE_PORT;

  const before = findingsToIncidents(
    findingsFor([
      middlewareObs({ dotenvVars: mwDrift }),
      realtimeObs({ dotenvVars: rtDrift }),
    ]),
    '2026-08-12T10:00:00.000Z',
  );
  const mwBefore = before.filter(i => incidentScope(i.targetId) === 'middleware');
  const rtBefore = before.filter(i => incidentScope(i.targetId) === 'realtime');
  assert.ok(mwBefore.length > 0 && rtBefore.length > 0, 'setup: both services have findings');

  // middleware restarting; realtime stable and corrected.
  const next = analyzeDrift(
    [
      middlewareObs({
        dotenvVars: mwDrift,
        stability: { stable: false, reason: 'pid changed between samples (100 → 200)' },
      }),
      realtimeObs(),
    ],
    { maxConnections: SAFE_MAX_CONNECTIONS },
  );
  assert.ok(!next.evaluated.includes('middleware'));
  assert.ok(next.evaluated.includes('realtime'));

  const clearedIds = new Set(
    resolveClearedFindings(before, next.findings, next.evaluated, '2026-08-12T11:00:00.000Z')
      .map(i => i.id),
  );
  assert.ok(
    mwBefore.every(i => !clearedIds.has(i.id)),
    'middleware findings must survive while middleware is deferred',
  );
  assert.ok(
    rtBefore.every(i => clearedIds.has(i.id)),
    'realtime findings clear because realtime WAS evaluated',
  );
});

test('resolution: an unreadable /proc (degraded) does not clear findings either', () => {
  // Comparisons still run when /proc is unreadable, but a variable that lived
  // only in the exec environment would look absent rather than unchanged —
  // resolving on that would be a false all-clear.
  const drifted = prodEnv({ APP_URL: 'http://localhost:3001' });
  const before = findingsToIncidents(
    findingsFor([middlewareObs({ dotenvVars: drifted })]),
    '2026-08-12T10:00:00.000Z',
  );

  const next = analyzeDrift([middlewareObs({ procEnviron: null })], { maxConnections: SAFE_MAX_CONNECTIONS });
  assert.ok(!next.evaluated.includes('middleware'), 'degraded is not fully evaluated');

  assert.deepEqual(
    resolveClearedFindings(before, next.findings, next.evaluated, '2026-08-12T11:00:00.000Z'),
    [],
  );
});

test('resolution: the global scope is evaluated only when every service was', () => {
  const partial = analyzeDrift(
    [middlewareObs({ stability: { stable: false, reason: 'restarting' } }), realtimeObs(), webObs()],
    { maxConnections: SAFE_MAX_CONNECTIONS },
  );
  assert.ok(!partial.evaluated.includes('global'), 'a partial sweep cannot clear cross-service findings');

  const full = analyzeDrift([middlewareObs(), realtimeObs(), webObs()], { maxConnections: SAFE_MAX_CONNECTIONS });
  assert.ok(full.evaluated.includes('global'));
});

test('incidentScope recovers the owning scope from a persisted targetId', () => {
  assert.equal(incidentScope('middleware:NODE_ENV'), 'middleware');
  assert.equal(incidentScope('middleware:DATABASE_URL pool params'), 'middleware');
  assert.equal(incidentScope('realtime'), 'realtime');
  assert.equal(incidentScope('global:db-connection-budget'), 'global');
});

test('resolution: a finding that still reproduces is NOT resolved', () => {
  const drifted = prodEnv({ APP_URL: 'http://localhost:3001' });
  const next = analyzeDrift([middlewareObs({ dotenvVars: drifted })], { maxConnections: SAFE_MAX_CONNECTIONS });
  const incidents = findingsToIncidents(next.findings, '2026-08-12T10:00:00.000Z');

  assert.deepEqual(
    resolveClearedFindings(incidents, next.findings, next.evaluated, '2026-08-12T11:00:00.000Z'),
    [],
    'a persisting drift must stay open',
  );
});

test('resolution never touches another agent\'s incidents, or already-resolved rows', () => {
  const foreign: Incident[] = [
    {
      id: 'health-guardian:service-down:realtime', agent: 'health-guardian', type: 'service-down',
      severity: 'critical', target: 'service', targetId: 'realtime', detected: '2026-08-12T09:00:00.000Z',
      message: 'down', remediation: 'restart', status: 'open', attempts: 1,
    },
    {
      id: 'config-drift-detector:config-shadow:middleware:NODE_ENV', agent: 'config-drift-detector',
      type: 'config-shadow', severity: 'critical', target: 'config', targetId: 'middleware:NODE_ENV',
      detected: '2026-08-12T09:00:00.000Z', message: 'old', remediation: 'x',
      status: 'resolved', attempts: 0, resolvedAt: '2026-08-12T09:30:00.000Z',
    },
  ];

  const cleared = resolveClearedFindings(
    foreign, [], ['middleware', 'realtime', 'web', 'global'], '2026-08-12T11:00:00.000Z',
  );
  assert.deepEqual(cleared, [], 'foreign and already-resolved incidents are left alone');
});

// ─── Incident mapping + dedup (§7, case 12) ──────────────────────────────────

test('budget is UNKNOWN when any service is unobservable, even with max_connections known', () => {
  // A sum over only the observable services is an UNDERCOUNT, and an undercount
  // can read as SAFE for a budget that is actually over.
  const findings = detectDrift(
    [middlewareObs({ pm2Env: {} }), realtimeObs()],
    { maxConnections: SAFE_MAX_CONNECTIONS },
  );
  assert.ok(
    findings.some(f => f.type === 'connection-budget-unknown'),
    `expected connection-budget-unknown, got ${types(findings)}`,
  );
  assert.ok(!findings.some(f => f.type === 'connection-budget-unsafe'));
});

test('case 12: identical drift on two runs produces one stable incident id', () => {
  const drifted = prodEnv({ DATABASE_URL: pgUrl('other-password') });
  const obs = () => middlewareObs({ dotenvVars: drifted });

  const first = findingsToIncidents(findingsFor([obs()]), '2026-08-12T10:00:00.000Z');
  const second = findingsToIncidents(findingsFor([obs()]), '2026-08-12T11:00:00.000Z');

  assert.deepEqual(first.map(i => i.id), second.map(i => i.id));
  assert.ok(first.length > 0);
  assert.ok(first.every(i => i.id.startsWith('config-drift-detector:')));
});

test('drift classes map onto the existing ops Severity enum', () => {
  assert.deepEqual(DRIFT_CLASS_TO_SEVERITY, {
    CRITICAL: 'critical',
    HIGH: 'warning',
    WARNING: 'info',
  });
});

test('incidents never claim a remediation was applied', () => {
  const drifted = prodEnv({ DATABASE_URL: pgUrl('other-password') });
  const incidents = findingsToIncidents(
    findingsFor([middlewareObs({ dotenvVars: drifted })]),
    '2026-08-12T10:00:00.000Z',
  );
  assert.ok(incidents.length > 0);
  assert.ok(incidents.every(i => i.status === 'open'), 'this agent never resolves or fixes');
  assert.ok(incidents.every(i => i.attempts === 0), 'no repair is ever attempted');
});

// ─── Safety properties (cases 10 + 15) ───────────────────────────────────────

/** Every drift shape at once, so one assertion covers the whole output surface. */
function allDriftFindings() {
  const drifted = prodEnv({
    DATABASE_URL: pgUrl('a-totally-different-pw', 'connection_limit=30'),
    REDIS_URL: redisUrl(null),
    CORS_ORIGIN: 'http://localhost:3001',
    APP_URL: 'http://localhost:3001',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
  });
  return detectDrift(
    [
      middlewareObs({ dotenvVars: drifted }),
      realtimeObs({ pm2Env: {} }),
      webObs(),
    ],
    { maxConnections: 50 },
  );
}

test('case 10: no raw secret value appears anywhere in the output', () => {
  const serialized = JSON.stringify(
    findingsToIncidents(allDriftFindings(), '2026-08-12T10:00:00.000Z'),
  );
  for (const secret of ALL_SECRETS) {
    assert.ok(!serialized.includes(secret), `secret leaked into output: ${secret.slice(0, 12)}...`);
  }
  // The drift-side values must not leak either.
  assert.ok(!serialized.includes('a-totally-different-pw'), 'fresh-start secret leaked');
});

test('case 15: no fingerprint, hash, or derived token appears in the output', () => {
  const serialized = JSON.stringify(
    findingsToIncidents(allDriftFindings(), '2026-08-12T10:00:00.000Z'),
  );
  // Any run of 12+ hex chars would be a digest/HMAC fragment. Ruling constraint 3
  // removed fingerprints from the output entirely, so none may appear.
  const hexRun = serialized.match(/\b[0-9a-f]{12,}\b/i);
  assert.equal(hexRun, null, `derived token found in output: ${hexRun?.[0]}`);
});

test('output reports the DRIFT state token rather than any value', () => {
  const findings = allDriftFindings();
  const credential = findings.filter(f => f.type === 'credential-drift');
  assert.ok(credential.length > 0);
  assert.ok(
    credential.every(f => /\b(DRIFT|ONE_ABSENT)\b/.test(f.message)),
    'credential findings must state the comparison verdict explicitly',
  );
});

test('the build-time exclusion is reported, not silent (ruling constraint 5)', () => {
  assert.match(BUILD_TIME_EXCLUSION.reason, /B2/);
  assert.ok(
    BUILD_TIME_EXCLUSION.variables.includes('NEXT_PUBLIC_API_URL'),
    'the excluded variables must be named so silence is never read as coverage',
  );
});

test('detectDrift is pure: it does not mutate the observations it is given', () => {
  const obs = middlewareObs();
  const before = JSON.stringify(obs);
  findingsFor([obs]);
  assert.equal(JSON.stringify(obs), before);
});

// ─── Ops-agent credentials (2026-08-15 incident) ─────────────────────────────

/**
 * The prod incident's exact shape: PM2's stored env carried a WORKING credential
 * pair while `/opt/vizora/app/.env` held one that 401s. dotenv never overwrites
 * an already-set variable, so the running agents authenticated fine and a cold
 * start would have FATAL'd all four credentialed ops agents at once.
 *
 * Canary values, asserted never to reach any finding.
 */
const OPS_EMAIL_LIVE = 'OPSEMAIL-do-not-leak-live@vizora.test';
const OPS_EMAIL_STALE = 'OPSEMAIL-do-not-leak-stale@vizora.test';
const OPS_PW_LIVE = 'OPSPW-do-not-leak-live-4d5e';
const OPS_PW_STALE = 'OPSPW-do-not-leak-stale-6f7a';

const OPS_CANARIES = [OPS_EMAIL_LIVE, OPS_EMAIL_STALE, OPS_PW_LIVE, OPS_PW_STALE];

test('ops credentials: both sides resolve the same pair — no finding', () => {
  const env: EnvMap = { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE };
  assert.deepEqual(analyzeOpsAgentCredentialDrift({ ...env }, { ...env }), []);
});

test('ops credentials: password differs between PM2 and .env — HIGH', () => {
  // Expressed through the VALIDATOR_* fallback, which is the pair prod actually
  // had set on 2026-08-15.
  const findings = analyzeOpsAgentCredentialDrift(
    { VALIDATOR_EMAIL: OPS_EMAIL_LIVE, VALIDATOR_PASSWORD: OPS_PW_LIVE },
    { VALIDATOR_EMAIL: OPS_EMAIL_LIVE, VALIDATOR_PASSWORD: OPS_PW_STALE },
  );
  assert.equal(findings.length, 1, `expected one finding, got ${types(findings)}`);
  assert.equal(findings[0].driftClass, 'HIGH');
  assert.equal(findings[0].type, 'config-shadow');
  assert.match(findings[0].message, /email: MATCH/);
  assert.match(findings[0].message, /password: DRIFT/);
});

test('ops credentials: email differs between PM2 and .env — HIGH', () => {
  const findings = analyzeOpsAgentCredentialDrift(
    { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE },
    { OPS_EMAIL: OPS_EMAIL_STALE, OPS_PASSWORD: OPS_PW_LIVE },
  );
  assert.equal(findings.length, 1, `expected one finding, got ${types(findings)}`);
  assert.equal(findings[0].driftClass, 'HIGH');
  assert.match(findings[0].message, /email: DRIFT/);
  assert.match(findings[0].message, /password: MATCH/);
});

test('ops credentials: .env resolves no pair while PM2 does — HIGH', () => {
  // A cold start consuming .env fresh FATALs every credentialed ops agent.
  const findings = analyzeOpsAgentCredentialDrift(
    { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE },
    { OPS_EMAIL: OPS_EMAIL_LIVE },
  );
  assert.equal(findings.length, 1, `expected one finding, got ${types(findings)}`);
  assert.equal(findings[0].driftClass, 'HIGH');
  assert.match(findings[0].message, /NO pair at all/);
});

test('ops credentials: a missing .env entirely is the same HIGH, not silence', () => {
  const findings = analyzeOpsAgentCredentialDrift(
    { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE },
    null,
  );
  assert.equal(findings.length, 1, `expected one finding, got ${types(findings)}`);
  assert.equal(findings[0].driftClass, 'HIGH');
});

test('ops credentials: neither side resolves a pair — CRITICAL', () => {
  const findings = analyzeOpsAgentCredentialDrift({ NODE_ENV: 'production' }, { NODE_ENV: 'production' });
  assert.equal(findings.length, 1, `expected one finding, got ${types(findings)}`);
  assert.equal(findings[0].driftClass, 'CRITICAL');
  assert.equal(findings[0].type, 'ops-credentials-absent');
});

test('ops credentials: PM2 shadowing the .env pair with an empty value — HIGH', () => {
  // The inverse shadow: PM2 injects an EMPTY OPS_EMAIL, which wins over the
  // file. The agents' `|| ''` chain then falls through to an absent
  // VALIDATOR_EMAIL and they FATAL on every firing while .env looks correct.
  const findings = analyzeOpsAgentCredentialDrift(
    { OPS_EMAIL: '', OPS_PASSWORD: OPS_PW_LIVE },
    { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE },
  );
  assert.equal(findings.length, 1, `expected one finding, got ${types(findings)}`);
  assert.equal(findings[0].driftClass, 'HIGH');
  assert.match(findings[0].message, /shadows/);
});

test('ops credentials: OPS_* beats VALIDATOR_* on the RUNTIME side independently', () => {
  // PM2 carries both pairs; the agents read OPS_* first. If the fallback order
  // were inverted here, runtime would resolve the stale pair and this would
  // report drift.
  const findings = analyzeOpsAgentCredentialDrift(
    {
      OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE,
      VALIDATOR_EMAIL: OPS_EMAIL_STALE, VALIDATOR_PASSWORD: OPS_PW_STALE,
    },
    { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE },
  );
  assert.deepEqual(findings, [], `expected no finding, got ${JSON.stringify(findings, null, 2)}`);
});

test('ops credentials: OPS_* beats VALIDATOR_* on the RESTART side independently', () => {
  // Same proof for the cold-start side, which resolves from .env alone. PM2
  // carries BOTH names at the LIVE value so the runtime side resolves the same
  // pair under either fallback order — leaving the restart side as the only
  // thing this case can be measuring.
  const findings = analyzeOpsAgentCredentialDrift(
    {
      OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE,
      VALIDATOR_EMAIL: OPS_EMAIL_LIVE, VALIDATOR_PASSWORD: OPS_PW_LIVE,
    },
    {
      OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE,
      VALIDATOR_EMAIL: OPS_EMAIL_STALE, VALIDATOR_PASSWORD: OPS_PW_STALE,
    },
  );
  assert.deepEqual(findings, [], `expected no finding, got ${JSON.stringify(findings, null, 2)}`);
});

test('ops credentials: VALIDATOR_* is used when OPS_* is absent on one side only', () => {
  // .env has only the VALIDATOR_* pair — the exact prod shape. Same values, so
  // the fallback must resolve to a MATCH rather than a phantom drift.
  const findings = analyzeOpsAgentCredentialDrift(
    { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE },
    { VALIDATOR_EMAIL: OPS_EMAIL_LIVE, VALIDATOR_PASSWORD: OPS_PW_LIVE },
  );
  assert.deepEqual(findings, [], `expected no finding, got ${JSON.stringify(findings, null, 2)}`);
});

test('ops credentials: an unreadable PM2 entry is reported, never read as agreement', () => {
  const findings = analyzeOpsAgentCredentialDrift(null, { OPS_EMAIL: OPS_EMAIL_LIVE });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'ops-credentials-unobservable');
  assert.equal(findings[0].driftClass, 'WARNING');
  assert.match(findings[0].message, /NOT established/);
});

test('ops credentials: findings carry their own resolvable scope', () => {
  const findings = analyzeOpsAgentCredentialDrift(
    { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE },
    { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_STALE },
  );
  assert.equal(findings[0].service, OPS_AGENT_SCOPE);
  assert.equal(incidentScope(findings[0].targetId), OPS_AGENT_SCOPE);

  // A cleared drift must resolve like any other finding.
  const incidents = findingsToIncidents(findings, '2026-08-15T10:00:00.000Z');
  const cleared = resolveClearedFindings(incidents, [], [OPS_AGENT_SCOPE], '2026-08-15T11:00:00.000Z');
  assert.equal(cleared.length, 1);
  assert.equal(cleared[0].status, 'resolved');

  // ...and must NOT resolve on a run that did not cover the ops scope.
  assert.deepEqual(
    resolveClearedFindings(incidents, [], ['middleware', 'realtime', 'web', 'global'], '2026-08-15T11:00:00.000Z'),
    [],
    'absence of drift was not established for a scope the run never evaluated',
  );
});

test('ops credentials: no credential VALUE appears in any finding', () => {
  const everyShape = [
    ...analyzeOpsAgentCredentialDrift(
      { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE },
      { OPS_EMAIL: OPS_EMAIL_STALE, OPS_PASSWORD: OPS_PW_STALE },
    ),
    ...analyzeOpsAgentCredentialDrift({ OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE }, {}),
    ...analyzeOpsAgentCredentialDrift({}, {}),
    ...analyzeOpsAgentCredentialDrift(null, { OPS_PASSWORD: OPS_PW_STALE }),
  ];
  const serialized = JSON.stringify(findingsToIncidents(everyShape, '2026-08-15T10:00:00.000Z'));

  for (const canary of OPS_CANARIES) {
    assert.ok(!serialized.includes(canary), `credential leaked into output: ${canary.slice(0, 12)}...`);
  }
  // Nor any digest fragment derived from one.
  const hexRun = serialized.match(/\b[0-9a-f]{12,}\b/i);
  assert.equal(hexRun, null, `derived token found in output: ${hexRun?.[0]}`);
});

test('ops credentials: the analysis does not mutate its inputs', () => {
  const pm2: EnvMap = { OPS_EMAIL: OPS_EMAIL_LIVE, OPS_PASSWORD: OPS_PW_LIVE };
  const dotenv: EnvMap = { OPS_EMAIL: OPS_EMAIL_STALE };
  const before = JSON.stringify([pm2, dotenv]);
  analyzeOpsAgentCredentialDrift(pm2, dotenv);
  assert.equal(JSON.stringify([pm2, dotenv]), before);
});

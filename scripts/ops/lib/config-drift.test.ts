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
  buildMaxConnectionsCandidates,
  compareSecretValues,
  computeConnectionBudget,
  computeEffective,
  computeFreshStart,
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
 * Middleware observation where every source agrees by default. Overrides let a
 * test perturb exactly one source, which is how each drift case is isolated.
 */
function middlewareObs(over: Partial<ServiceObservation> = {}): ServiceObservation {
  const env = prodEnv();
  return {
    service: 'middleware',
    instances: 2,
    procEnviron: { ...env },
    pm2Env: { ...env },
    ecosystemEnv: {},
    dotenvVars: { ...env },
    ...over,
  };
}

function realtimeObs(over: Partial<ServiceObservation> = {}): ServiceObservation {
  const env = prodEnv({ REALTIME_PORT: '3002' });
  delete env.MIDDLEWARE_PORT;
  return {
    service: 'realtime',
    instances: 1,
    procEnviron: { ...env },
    pm2Env: { ...env },
    ecosystemEnv: {},
    dotenvVars: { ...env },
    ...over,
  };
}

/** web: no .env in cwd at all (design §1) — dotenvVars is null, not empty. */
function webObs(over: Partial<ServiceObservation> = {}): ServiceObservation {
  const env: EnvMap = {
    NODE_ENV: 'production',
    PORT: '3001',
    BACKEND_URL: 'http://localhost:3000',
  };
  return {
    service: 'web',
    instances: 1,
    procEnviron: { ...env },
    pm2Env: { ...env },
    ecosystemEnv: { NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'gsi-client-id' },
    dotenvVars: null,
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

test('computeEffective reconstructs C from exec env + dotenv, not /proc alone', () => {
  // Case 18: /proc lacks DATABASE_URL; dotenv supplies it. C must contain it.
  const obs = middlewareObs({
    procEnviron: (() => { const e = prodEnv(); delete e.DATABASE_URL; return e; })(),
  });
  const effective = computeEffective(obs);
  assert.equal(effective.DATABASE_URL, pgUrl(), 'C must be reconstructed, not read from /proc');
});

test('computeFreshStart models the invoking shell as empty (§9.1)', () => {
  // JWT_SECRET reached the running process by operator shell inheritance only:
  // present in /proc, absent from PM2, ecosystem and .env.
  const env = prodEnv();
  const withoutJwt = (() => { const e = prodEnv(); delete e.JWT_SECRET; return e; })();
  const obs = middlewareObs({
    procEnviron: { ...env },
    pm2Env: { ...withoutJwt },
    dotenvVars: { ...withoutJwt },
  });
  assert.equal(computeEffective(obs).JWT_SECRET, JWT_SECRET);
  assert.equal(
    computeFreshStart(obs).JWT_SECRET,
    undefined,
    'a shell-inherited variable must be absent from B',
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
  const findings = findingsFor([middlewareObs({ pm2Env: drifted, dotenvVars: drifted })]);
  const credential = findings.find(f => f.type === 'credential-drift');
  assert.ok(credential, `expected credential-drift, got ${types(findings)}`);
  assert.equal(credential.driftClass, 'CRITICAL');
});

test('case 3: Redis password present in C, absent in B — CRITICAL', () => {
  const noPw = prodEnv({ REDIS_URL: redisUrl(null) });
  const findings = findingsFor([middlewareObs({ pm2Env: noPw, dotenvVars: noPw })]);
  const credential = findings.find(f => f.type === 'credential-drift' && f.targetId.includes('REDIS'));
  assert.ok(credential, `expected Redis credential-drift, got ${types(findings)}`);
  assert.equal(credential.driftClass, 'CRITICAL');
});

test('case 4: API_BASE_URL absent from fresh start — CRITICAL', () => {
  const withoutApiBase = (() => { const e = prodEnv(); delete e.API_BASE_URL; return e; })();
  const findings = findingsFor([middlewareObs({ pm2Env: withoutApiBase, dotenvVars: withoutApiBase })]);
  const failure = findings.find(f => f.type === 'fresh-start-would-fail');
  assert.ok(failure, `expected fresh-start-would-fail, got ${types(findings)}`);
  assert.equal(failure.driftClass, 'CRITICAL');
  assert.match(failure.message, /API_BASE_URL/);
});

test('case 5: MinIO defaults would be rejected by the fitness validator — CRITICAL', () => {
  const defaults = prodEnv({ MINIO_ACCESS_KEY: 'minioadmin', MINIO_SECRET_KEY: 'minioadmin' });
  const findings = findingsFor([middlewareObs({ pm2Env: defaults, dotenvVars: defaults })]);
  const failure = findings.find(f => f.type === 'fresh-start-would-fail');
  assert.ok(failure, `expected fresh-start-would-fail, got ${types(findings)}`);
  assert.equal(failure.driftClass, 'CRITICAL');
});

test('case 6: localhost production URLs — HIGH', () => {
  const localhost = prodEnv({ CORS_ORIGIN: 'http://localhost:3001', APP_URL: 'http://localhost:3001' });
  const findings = findingsFor([middlewareObs({ pm2Env: localhost, dotenvVars: localhost })]);
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
  const findings = findingsFor([middlewareObs({ pm2Env: noTimeout, dotenvVars: noTimeout })]);
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
  const findings = findingsFor([middlewareObs({ pm2Env: withoutJwt, dotenvVars: withoutJwt })]);
  const failure = findings.find(f => f.type === 'fresh-start-would-fail');
  assert.ok(failure, `expected fresh-start-would-fail, got ${types(findings)}`);
  assert.equal(failure.driftClass, 'CRITICAL');
  assert.match(failure.message, /JWT_SECRET/);
});

test('case 18: dotenv-supplied value absent from /proc is not a false missing', () => {
  const procWithoutDb = (() => { const e = prodEnv(); delete e.DATABASE_URL; return e; })();
  const findings = findingsFor([middlewareObs({ procEnviron: procWithoutDb })]);
  assert.deepEqual(findings, [], `expected zero findings, got ${JSON.stringify(findings, null, 2)}`);
});

test('an unreadable /proc is reported, never treated as healthy (case 13)', () => {
  const findings = findingsFor([middlewareObs({ procEnviron: null })]);
  const unreadable = findings.find(f => f.type === 'observation-incomplete');
  assert.ok(unreadable, `expected observation-incomplete, got ${types(findings)}`);
  assert.ok(
    !findings.some(f => f.type === 'credential-drift' || f.type === 'pool-parameter-drift'),
    'must not emit comparison findings from a view it could not build',
  );
});

test('empty PM2 state is reported rather than read as "nothing configured"', () => {
  const findings = findingsFor([middlewareObs({ pm2Env: {} })]);
  assert.ok(
    findings.some(f => f.type === 'observation-incomplete'),
    `expected observation-incomplete, got ${types(findings)}`,
  );
});

// ─── Incident mapping + dedup (§7, case 12) ──────────────────────────────────

test('budget is UNKNOWN when any service is unobservable, even with max_connections known', () => {
  // A sum over only the observable services is an UNDERCOUNT, and an undercount
  // can read as SAFE for a budget that is actually over.
  const findings = detectDrift(
    [middlewareObs({ procEnviron: null }), realtimeObs()],
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
  const obs = () => middlewareObs({ pm2Env: drifted, dotenvVars: drifted });

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
    findingsFor([middlewareObs({ pm2Env: drifted, dotenvVars: drifted })]),
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
      middlewareObs({ pm2Env: drifted, dotenvVars: drifted }),
      realtimeObs({ procEnviron: null }),
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

/**
 * B4 — the two Redis representations cannot silently diverge.
 *
 * REDIS_URL is what every client reads; REDIS_PASSWORD is what docker-compose
 * gives the SERVER. Nothing in either file references the other, so a rotation
 * that updates one and not the other breaks Redis for every service with no
 * warning anywhere. These tests pin the detection, and pin that no secret
 * value reaches the output.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkRedisConsistency, isRedisBroken } from './redis-config.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const PW = 'redis_secure_pass_change_me';
const URL_WITH = `redis://:${PW}@localhost:6379`;

// ─── The invariant ───────────────────────────────────────────────────────────

test('matching password on both sides is consistent', () => {
  const r = checkRedisConsistency(URL_WITH, PW);
  assert.equal(r.verdict, 'CONSISTENT');
  assert.equal(isRedisBroken(r), false);
});

test('THE FAILURE: rotating REDIS_PASSWORD without REDIS_URL is caught', () => {
  // The realistic shape: operator edits .env, recreates the container, and
  // every client keeps presenting the old password.
  const r = checkRedisConsistency(URL_WITH, 'a-freshly-rotated-password');
  assert.equal(r.verdict, 'PASSWORD_DRIFT');
  assert.equal(isRedisBroken(r), true);
});

test('a password-protected server with an unauthenticated client URL is caught', () => {
  const r = checkRedisConsistency('redis://localhost:6379', PW);
  assert.equal(r.verdict, 'URL_MISSING_PASSWORD');
  assert.equal(isRedisBroken(r), true);
  assert.match(r.detail, /NOAUTH/);
});

test('a client URL with a password but no server password is caught', () => {
  const r = checkRedisConsistency(URL_WITH, undefined);
  assert.equal(r.verdict, 'SERVER_MISSING_PASSWORD');
  assert.equal(isRedisBroken(r), true);
});

test('no password on either side is valid, not broken', () => {
  // A local unauthenticated Redis is a legitimate development configuration.
  const r = checkRedisConsistency('redis://localhost:6379', undefined);
  assert.equal(r.verdict, 'NO_PASSWORD_EITHER_SIDE');
  assert.equal(isRedisBroken(r), false);
});

test('an empty REDIS_PASSWORD counts as absent, not as an empty password', () => {
  assert.equal(checkRedisConsistency('redis://localhost:6379', '').verdict, 'NO_PASSWORD_EITHER_SIDE');
});

// ─── Unavailable / unparseable ───────────────────────────────────────────────

test('a missing REDIS_URL is reported as its own state, not as drift', () => {
  const r = checkRedisConsistency(undefined, PW);
  assert.equal(r.verdict, 'URL_UNAVAILABLE');
  assert.match(r.detail, /not set/);
  // Not "broken" — it is a different finding with a different remediation, and
  // conflating them would send the operator to rotate a credential that is fine.
  assert.equal(isRedisBroken(r), false);
});

test('an unparseable REDIS_URL is distinguished from a missing one', () => {
  const r = checkRedisConsistency('not a url', PW);
  assert.equal(r.verdict, 'URL_UNAVAILABLE');
  assert.match(r.detail, /could not be parsed/);
});

// ─── Secret safety ───────────────────────────────────────────────────────────

test('NO password value or fingerprint reaches the output', () => {
  // Same rule as B1: compare in memory, emit only the verdict. A detail string
  // that quoted either value would put a live credential into ops-state.json,
  // the dashboard, and any alert built from it.
  const canaryUrlPw = 'CANARY-URL-PASSWORD';
  const canaryServerPw = 'CANARY-SERVER-PASSWORD';

  for (const r of [
    checkRedisConsistency(`redis://:${canaryUrlPw}@localhost:6379`, canaryServerPw),
    checkRedisConsistency(`redis://:${canaryUrlPw}@localhost:6379`, undefined),
    checkRedisConsistency('redis://localhost:6379', canaryServerPw),
    checkRedisConsistency(`redis://:${canaryUrlPw}@localhost:6379`, canaryUrlPw),
  ]) {
    assert.ok(!r.detail.includes(canaryUrlPw), `leaked url password: ${r.detail}`);
    assert.ok(!r.detail.includes(canaryServerPw), `leaked server password: ${r.detail}`);
  }
});

// ─── The consuming paths this rests on ───────────────────────────────────────

test('application code reads REDIS_URL and never REDIS_PASSWORD', () => {
  // The whole canonical rule depends on this. If some service starts reading
  // REDIS_PASSWORD directly, "REDIS_URL is canonical for clients" stops being
  // true and this module's premise needs revisiting — loudly, here.
  const offenders: string[] = [];
  const skip = new Set(['node_modules', 'dist', '.next', 'coverage', '__tests__']);
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.ts$/.test(entry.name) && !/\.(spec|test)\.ts$/.test(entry.name)) {
        if (/process\.env\.REDIS_PASSWORD/.test(readFileSync(full, 'utf8'))) offenders.push(full);
      }
    }
  };
  for (const root of ['middleware/src', 'realtime/src']) walk(join(repoRoot, root));
  assert.deepEqual(offenders, []);
});

test('docker-compose still consumes REDIS_PASSWORD for the server', () => {
  // The other half of the premise: REDIS_PASSWORD is not dead config, it is
  // the server's --requirepass. If this ever stops being true the variable
  // should be deleted, not left to rot.
  const compose = readFileSync(join(repoRoot, 'docker', 'docker-compose.yml'), 'utf8');
  assert.match(compose, /requirepass \$\{REDIS_PASSWORD/);
});

// ─── Wiring into the hourly detector ─────────────────────────────────────────

test('the detector emits ONE finding for the deployment, not one per service', async () => {
  // Both values come from the same .env, which every service loads, so this is
  // a property of the deployment. Three findings for one root cause would
  // dedup into three separate incidents and read as three problems.
  const { analyzeDrift } = await import('./config-drift.js');
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora',
    REDIS_URL: 'redis://:client-side-password@localhost:6379',
    REDIS_PASSWORD: 'server-side-password-that-differs',
    API_BASE_URL: 'https://vizora.cloud',
    CORS_ORIGIN: 'https://vizora.cloud',
    JWT_SECRET: 'j'.repeat(48),
    DEVICE_JWT_SECRET: 'd'.repeat(48),
    INTERNAL_API_SECRET: 'i'.repeat(48),
    MINIO_ACCESS_KEY: 'accesskey',
    MINIO_SECRET_KEY: 'secretkey1234567',
  };
  const obs = (service: 'middleware' | 'realtime', port: string) => ({
    service,
    instances: 1,
    procEnviron: { ...env, PORT: port },
    pm2Env: { ...env, PORT: port },
    ecosystemEnvProduction: { NODE_ENV: 'production', PORT: port },
    ecosystemEnvDefault: {},
    dotenvVars: { ...env },
    stability: { stable: true },
  });

  const { findings } = analyzeDrift(
    [obs('middleware', '3000'), obs('realtime', '3002')],
    { maxConnections: 100 },
  );

  const redis = findings.filter(f => f.type === 'redis-representation-drift');
  assert.equal(redis.length, 1, JSON.stringify(redis));
  assert.equal(redis[0]?.targetId, 'global:REDIS representation');
  assert.match(redis[0]!.message, /different credentials/);
  assert.ok(!redis[0]!.message.includes('client-side-password'));
  assert.ok(!redis[0]!.message.includes('server-side-password-that-differs'));
});

test('a consistent deployment produces no Redis representation finding', async () => {
  const { analyzeDrift } = await import('./config-drift.js');
  const pw = 'same-on-both-sides';
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora',
    REDIS_URL: `redis://:${pw}@localhost:6379`,
    REDIS_PASSWORD: pw,
    API_BASE_URL: 'https://vizora.cloud',
    CORS_ORIGIN: 'https://vizora.cloud',
    JWT_SECRET: 'j'.repeat(48),
    DEVICE_JWT_SECRET: 'd'.repeat(48),
    INTERNAL_API_SECRET: 'i'.repeat(48),
    MINIO_ACCESS_KEY: 'accesskey',
    MINIO_SECRET_KEY: 'secretkey1234567',
    PORT: '3000',
  };
  const { findings } = analyzeDrift(
    [{
      service: 'middleware' as const,
      instances: 1,
      procEnviron: { ...env },
      pm2Env: { ...env },
      ecosystemEnvProduction: { NODE_ENV: 'production', PORT: '3000' },
      ecosystemEnvDefault: {},
      dotenvVars: { ...env },
      stability: { stable: true },
    }],
    { maxConnections: 100 },
  );
  assert.deepEqual(findings.filter(f => f.type === 'redis-representation-drift'), []);
});

// ─── Client-equivalence: forms ioredis accepts must not read as "no password" ──

test('the ?password= query form is read, not reported as missing', () => {
  // ioredis honours it via defaults(result, parsed.query). Reading only the
  // userinfo would have emitted a false CRITICAL every hour for a working
  // configuration.
  const r = checkRedisConsistency('redis://localhost:6379?password=' + PW, PW);
  assert.equal(r.verdict, 'CONSISTENT');
});

test('userinfo wins over the query form, mirroring the client merge order', () => {
  const r = checkRedisConsistency(`redis://:${PW}@localhost:6379?password=other`, PW);
  assert.equal(r.verdict, 'CONSISTENT');
});

test('percent-encoded passwords compare decoded, as the client sends them', () => {
  // ioredis parses with legacy url.parse(url, true, true), which decodes auth.
  // Comparing the encoded text against a raw REDIS_PASSWORD would be a false
  // PASSWORD_DRIFT on any password containing @ : / or +.
  assert.equal(checkRedisConsistency('redis://:p%40ss@h:6379', 'p@ss').verdict, 'CONSISTENT');
  assert.equal(checkRedisConsistency('redis://:pa%2Fss@h:6379', 'pa/ss').verdict, 'CONSISTENT');
});

test('an ACL username form compares only the password', () => {
  assert.equal(checkRedisConsistency(`redis://default:${PW}@h:6379`, PW).verdict, 'CONSISTENT');
});

test('rediss:// TLS scheme is handled like redis://', () => {
  assert.equal(checkRedisConsistency(`rediss://:${PW}@h:6379`, PW).verdict, 'CONSISTENT');
});

// ─── The promised URL_UNAVAILABLE finding actually exists ────────────────────

test('an unparseable REDIS_URL raises a finding rather than staying silent', async () => {
  // A bare % satisfies `new URL` (so middleware's Zod .url() passes and no
  // zero-state-would-fail fires) but throws URIError inside ioredis at client
  // construction. Silence here was the whole silent-failure shape.
  const { analyzeDrift } = await import('./config-drift.js');
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora',
    REDIS_URL: 'redis://:bad%pw@localhost:6379',
    REDIS_PASSWORD: 'bad%pw',
    API_BASE_URL: 'https://vizora.cloud',
    CORS_ORIGIN: 'https://vizora.cloud',
    JWT_SECRET: 'j'.repeat(48),
    DEVICE_JWT_SECRET: 'd'.repeat(48),
    INTERNAL_API_SECRET: 'i'.repeat(48),
    MINIO_ACCESS_KEY: 'accesskey',
    MINIO_SECRET_KEY: 'secretkey1234567',
    PORT: '3000',
  };
  const { findings } = analyzeDrift(
    [{
      service: 'middleware' as const,
      instances: 1,
      procEnviron: { ...env },
      pm2Env: { ...env },
      ecosystemEnvProduction: { NODE_ENV: 'production', PORT: '3000' },
      ecosystemEnvDefault: {},
      dotenvVars: { ...env },
      stability: { stable: true },
    }],
    { maxConnections: 100 },
  );
  const f = findings.filter(x => x.type === 'redis-url-unparseable');
  assert.equal(f.length, 1, JSON.stringify(findings.map(x => x.type)));
  assert.ok(!f[0]!.message.includes('bad%pw'), 'must not echo the URL');
});

test('an ABSENT REDIS_URL raises nothing here — the services have a documented fallback', () => {
  assert.equal(checkRedisConsistency(undefined, undefined).verdict, 'URL_UNAVAILABLE');
});

test('findings are phrased as what a REBUILD would do, never as a live outage', () => {
  // Step 1 of a rotation (edit .env, container not yet recreated) is a
  // legitimate transient state where Redis is healthy and these disagree. A
  // present-tense claim would page hourly through it and get the detector muted.
  for (const r of [
    checkRedisConsistency(URL_WITH, 'rotated'),
    checkRedisConsistency('redis://localhost:6379', PW),
    checkRedisConsistency(URL_WITH, undefined),
  ]) {
    assert.match(r.detail, /zero-state rebuild would/, r.detail);
  }
});

test('the FINDING message and remediation are counterfactual, not just the detail', async () => {
  // The previous guard asserted only on checkRedisConsistency().detail, so
  // rewording the DriftFinding message back to present tense stayed green —
  // the exact regression this change exists to prevent.
  const { analyzeDrift } = await import('./config-drift.js');
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora',
    REDIS_URL: 'redis://:one@localhost:6379',
    REDIS_PASSWORD: 'two',
    API_BASE_URL: 'https://vizora.cloud',
    CORS_ORIGIN: 'https://vizora.cloud',
    JWT_SECRET: 'j'.repeat(48),
    DEVICE_JWT_SECRET: 'd'.repeat(48),
    INTERNAL_API_SECRET: 'i'.repeat(48),
    MINIO_ACCESS_KEY: 'accesskey',
    MINIO_SECRET_KEY: 'secretkey1234567',
    PORT: '3000',
  };
  const { findings } = analyzeDrift(
    [{
      service: 'middleware' as const,
      instances: 1,
      procEnviron: { ...env },
      pm2Env: { ...env },
      ecosystemEnvProduction: { NODE_ENV: 'production', PORT: '3000' },
      ecosystemEnvDefault: {},
      dotenvVars: { ...env },
      stability: { stable: true },
    }],
    { maxConnections: 100 },
  );
  const f = findings.find(x => x.type === 'redis-representation-drift');
  assert.ok(f);
  assert.match(f.message, /would/, 'message must be counterfactual');
  assert.equal(f.driftClass, 'CRITICAL', 'severity drives whether it alerts at all');
});

test('the unparseable finding carries HIGH and does not duplicate its own sentence', async () => {
  const { analyzeDrift } = await import('./config-drift.js');
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora',
    REDIS_URL: 'redis://:bad%pw@localhost:6379',
    REDIS_PASSWORD: 'bad%pw',
    API_BASE_URL: 'https://vizora.cloud',
    CORS_ORIGIN: 'https://vizora.cloud',
    JWT_SECRET: 'j'.repeat(48),
    DEVICE_JWT_SECRET: 'd'.repeat(48),
    INTERNAL_API_SECRET: 'i'.repeat(48),
    MINIO_ACCESS_KEY: 'accesskey',
    MINIO_SECRET_KEY: 'secretkey1234567',
    PORT: '3000',
  };
  const obs = {
    service: 'middleware' as const,
    instances: 1,
    procEnviron: { ...env },
    pm2Env: { ...env },
    ecosystemEnvProduction: { NODE_ENV: 'production', PORT: '3000' },
    ecosystemEnvDefault: {},
    dotenvVars: { ...env },
    stability: { stable: true },
  };
  const f = analyzeDrift([obs], { maxConnections: 100 })
    .findings.find(x => x.type === 'redis-url-unparseable');
  assert.ok(f);
  assert.equal(f.driftClass, 'HIGH');
  assert.equal((f.message.match(/could not be parsed/g) ?? []).length, 1, 'no duplicated sentence');
  assert.ok(f.remediation.length > 0);
});

test('an ABSENT REDIS_URL emits NO finding from analyzeDrift', async () => {
  // The previous test with this name only called checkRedisConsistency, so the
  // gating line it claimed to cover was untested — deleting it left the suite
  // green while an absent URL started emitting "is set but could not be parsed".
  const { analyzeDrift } = await import('./config-drift.js');
  const env: Record<string, string> = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora',
    API_BASE_URL: 'https://vizora.cloud',
    CORS_ORIGIN: 'https://vizora.cloud',
    JWT_SECRET: 'j'.repeat(48),
    DEVICE_JWT_SECRET: 'd'.repeat(48),
    INTERNAL_API_SECRET: 'i'.repeat(48),
    MINIO_ACCESS_KEY: 'accesskey',
    MINIO_SECRET_KEY: 'secretkey1234567',
    PORT: '3000',
  };
  const { findings } = analyzeDrift(
    [{
      service: 'middleware' as const,
      instances: 1,
      procEnviron: { ...env },
      pm2Env: { ...env },
      ecosystemEnvProduction: { NODE_ENV: 'production', PORT: '3000' },
      ecosystemEnvDefault: {},
      dotenvVars: { ...env },
      stability: { stable: true },
    }],
    { maxConnections: 100 },
  );
  assert.deepEqual(findings.filter(f => f.type === 'redis-url-unparseable'), []);
  assert.deepEqual(findings.filter(f => f.type === 'redis-representation-drift'), []);
});

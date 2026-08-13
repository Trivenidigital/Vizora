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

/**
 * B3 — startup assertions block a deploy that could not come back.
 *
 * These pin the WIRING and the refusal semantics — not a transcription of the
 * schemas, which would drift. The assertion runs the services' REAL validators
 * via B1's validateFreshStart.
 *
 * NOT the 2026-08-12 incident. An earlier draft of this docblock claimed it
 * was; that is false and worth stating, because the next reader would trust
 * the wrong control. A full development-mode config PASSES every assertion
 * here (NODE_ENV=development skips the presence check and the superRefine, and
 * the port is still 3000). That incident is caught one layer up, by
 * evaluateOperation refusing any environment that is not production.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  anyServiceWouldFail,
  assertCanRestart,
  freshStartEnv,
  renderStartupAssertions,
  type PersistedServiceConfig,
} from './startup-assertions.js';

/** A middleware config that really would boot. */
function healthyMiddleware(): PersistedServiceConfig {
  return {
    service: 'middleware',
    ecosystemEnvProduction: {
      NODE_ENV: 'production',
      PORT: '3000',
    },
    dotenvVars: {
      DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora',
      REDIS_URL: 'redis://:pw@localhost:6379',
      JWT_SECRET: 'a'.repeat(48),
      DEVICE_JWT_SECRET: 'b'.repeat(48),
      INTERNAL_API_SECRET: 'c'.repeat(48),
      MINIO_ACCESS_KEY: 'realaccesskey',
      MINIO_SECRET_KEY: 'realsecretkey123456',
      CORS_ORIGIN: 'https://vizora.cloud',
      API_BASE_URL: 'https://vizora.cloud',
    },
  };
}

// ─── Precedence ──────────────────────────────────────────────────────────────

test('the fresh-start env is built from persisted config only', () => {
  const env = freshStartEnv(healthyMiddleware());
  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.PORT, '3000');
  assert.equal(env.JWT_SECRET, 'a'.repeat(48));
});

test('the ecosystem block wins over .env, matching a real production start', () => {
  // A reload applies env_production on top of whatever the dotenv file says.
  // Getting this backwards would validate a configuration nobody ever runs.
  const config = healthyMiddleware();
  config.dotenvVars = { ...config.dotenvVars, NODE_ENV: 'development' };

  assert.equal(freshStartEnv(config).NODE_ENV, 'production');
});

// ─── Refusal semantics ───────────────────────────────────────────────────────

test('a config that would boot does not block', () => {
  const assertions = assertCanRestart([healthyMiddleware()]);
  assert.deepEqual(assertions[0]?.failures, [], JSON.stringify(assertions));
  assert.equal(anyServiceWouldFail(assertions), false);
});

test('THE INCIDENT SHAPE: a missing required production variable blocks', () => {
  const broken = healthyMiddleware();
  delete broken.dotenvVars!.JWT_SECRET;

  const assertions = assertCanRestart([broken]);

  assert.ok(assertions[0]!.failures.length > 0);
  assert.match(assertions[0]!.failures.join(' '), /JWT_SECRET/);
  assert.equal(anyServiceWouldFail(assertions), true);
});

test('a wrong port blocks — the service exits non-zero on mismatch', () => {
  const broken = healthyMiddleware();
  broken.ecosystemEnvProduction.PORT = '3005';

  const failures = assertCanRestart([broken])[0]!.failures;

  assert.ok(failures.some(f => /port/i.test(f)), failures.join(' | '));
});

test('one bad service blocks the whole operation', () => {
  const broken = healthyMiddleware();
  delete broken.dotenvVars!.DATABASE_URL;

  const assertions = assertCanRestart([healthyMiddleware(), broken]);

  assert.deepEqual(assertions[0]?.failures, []);
  assert.ok(assertions[1]!.failures.length > 0);
  assert.equal(anyServiceWouldFail(assertions), true);
});

test('web is SKIPPED, not OK — no validators exist for it', () => {
  // web has no required production variables, no port rule and no Zod schema,
  // so an empty failures list proves nothing. Reporting OK there would be the
  // same false-green shape these guards exist to remove.
  const assertions = assertCanRestart([
    { service: 'web', ecosystemEnvProduction: { NODE_ENV: 'production' }, dotenvVars: null },
  ]);
  assert.equal(assertions[0]?.checked, false);
  assert.deepEqual(assertions[0]?.failures, []);

  const report = renderStartupAssertions(assertions);
  assert.match(report, /SKIPPED web/);
  assert.doesNotMatch(report, /OK\s+web/);
});

test('a dotenv file that was not found is reported as such, not as missing variables', () => {
  // The false-positive shape: reading the wrong path produced six alarming
  // "missing required production variable" lines with no hint that a file
  // lookup had failed.
  const report = renderStartupAssertions(
    assertCanRestart([{ service: 'middleware', ecosystemEnvProduction: { NODE_ENV: 'production', PORT: '3000' }, dotenvVars: null }]),
    ['middleware: dotenv /opt/vizora/app/middleware/.env NOT FOUND'],
  );
  assert.match(report, /NOT FOUND/);
  assert.match(report, /BLOCKED middleware/);
});

test('the refusal says "persisted config alone" and names the daemon-env caveat', () => {
  // A value supplied by the PM2 daemon environment is not modelled, so an
  // absolute "could not be recreated" would be a falsehood in exactly the case
  // where the operator must decide whether to bypass — and the first misfire
  // teaches them to run raw pm2, discarding the whole guard.
  const broken = healthyMiddleware();
  delete broken.dotenvVars!.JWT_SECRET;
  const report = renderStartupAssertions(assertCanRestart([broken]));
  assert.match(report, /persisted config alone/);
  assert.match(report, /PM2 daemon environment/);
});

test('every requested service is reported, in order', () => {
  const assertions = assertCanRestart([
    healthyMiddleware(),
    {
      service: 'realtime',
      ecosystemEnvProduction: { NODE_ENV: 'production', PORT: '3002' },
      dotenvVars: {},
    },
  ]);
  assert.deepEqual(assertions.map(a => a.service), ['middleware', 'realtime']);
});

// ─── Reporting ───────────────────────────────────────────────────────────────

test('the report names the blocked service and says nothing changed', () => {
  const broken = healthyMiddleware();
  delete broken.dotenvVars!.JWT_SECRET;

  const report = renderStartupAssertions(assertCanRestart([broken]));

  assert.match(report, /BLOCKED middleware/);
  assert.match(report, /REFUSING to proceed/);
  assert.match(report, /Nothing was changed/);
});

test('a healthy report does not tell the operator it refused', () => {
  const report = renderStartupAssertions(assertCanRestart([healthyMiddleware()]));
  assert.match(report, /OK\s+middleware/);
  assert.doesNotMatch(report, /REFUSING/);
});

test('NO CONFIGURED SECRET VALUE reaches the report', () => {
  // The whole point of running the real validators is that their messages are
  // static. If one ever starts echoing the offending value, this catches it
  // before the string reaches a terminal, a CI log or an alert.
  //
  // Canary values are used rather than realistic ones so a match can only mean
  // an echo — a realistic value could coincide with static text (see the next
  // test, which is exactly that case).
  const broken = healthyMiddleware();
  broken.dotenvVars!.JWT_SECRET = 'CANARY-JWT-SHOULD-NEVER-APPEAR';
  broken.dotenvVars!.DEVICE_JWT_SECRET = 'CANARY-DEVICE-SHOULD-NEVER-APPEAR';
  broken.dotenvVars!.DATABASE_URL = 'postgresql://u:CANARY-DB-PASSWORD@localhost:5432/v';

  const report = renderStartupAssertions(assertCanRestart([broken]));

  assert.ok(report.includes('BLOCKED'), 'the fixture must actually fail, or this proves nothing');
  for (const canary of [
    'CANARY-JWT-SHOULD-NEVER-APPEAR',
    'CANARY-DEVICE-SHOULD-NEVER-APPEAR',
    'CANARY-DB-PASSWORD',
  ]) {
    assert.ok(!report.includes(canary), `report echoed a configured value: ${canary}`);
  }
});

test('Zod enum DOES echo the received value — pinned, not assumed', () => {
  // The docblock used to claim validator messages never interpolate the
  // configured value. False: zod's invalid_enum_value echoes it. The only two
  // enum fields are LOG_LEVEL and NODE_ENV, neither secret-bearing, so this is
  // not a live leak — but the previous canary test used min-length/url/refine
  // fields, which structurally CANNOT echo, so it proved nothing about the
  // mechanism. This pins the real behaviour, and fails the day someone makes a
  // secret-bearing field an enum.
  const broken = healthyMiddleware();
  broken.dotenvVars!.LOG_LEVEL = 'CANARY-LOGLEVEL-VALUE';

  const report = renderStartupAssertions(assertCanRestart([broken]));

  assert.match(report, /CANARY-LOGLEVEL-VALUE/, 'enum echo is expected; if this stops, update the docs');
  assert.match(report, /LOG_LEVEL/);
});

test('naming a KNOWN-DEFAULT credential is not a leak', () => {
  // The MinIO rule reads: MINIO_SECRET_KEY must be set and not equal to
  // "minioadmin" in production. That literal lives in middleware's own
  // validator source, so the message is identical whatever the operator
  // configured — it reveals only "your value equals the published default",
  // which IS the finding. Pinned so nobody "fixes" the leak test by deleting
  // the MinIO rule, and so nobody mistakes this string for an echo.
  const broken = healthyMiddleware();
  broken.dotenvVars!.MINIO_SECRET_KEY = 'minioadmin';

  const report = renderStartupAssertions(assertCanRestart([broken]));

  assert.match(report, /MINIO_SECRET_KEY/);
  assert.match(report, /minioadmin/);
});

// ─── Soundness of the positive verdict ───────────────────────────────────────

test('realtime never reports a bare OK — its .env cannot satisfy its presence check', () => {
  // realtime/src/main.ts has no dotenv import and its process.exit(1) presence
  // check reads process.env at line 13, BEFORE NestFactory.create at line 23.
  // Reporting OK from a merged dotenv would be a false green on a BLOCKING gate.
  const assertions = assertCanRestart([
    {
      service: 'realtime',
      ecosystemEnvProduction: { NODE_ENV: 'production', PORT: '3002' },
      dotenvVars: {
        DATABASE_URL: 'postgresql://vizora:pw@localhost:5432/vizora',
        REDIS_URL: 'redis://:pw@localhost:6379',
        JWT_SECRET: 'j'.repeat(48),
        DEVICE_JWT_SECRET: 'd'.repeat(48),
        INTERNAL_API_SECRET: 'i'.repeat(48),
        CORS_ORIGIN: 'https://vizora.cloud',
      },
    },
  ]);

  assert.deepEqual(assertions[0]?.failures, [], 'nothing it CAN check should fail here');
  assert.equal(assertions[0]?.unprovable.length, 1, 'the presence dimension is unprovable');

  const report = renderStartupAssertions(assertions);
  assert.match(report, /PARTIAL realtime/);
  assert.doesNotMatch(report, /OK\s+realtime/);
  assert.doesNotMatch(report, /REFUSING/, 'unprovable is not a refusal — prod boots via PM2 injection');
});

test('middleware still reports a real OK — dotenv/config is its first import', () => {
  const report = renderStartupAssertions(assertCanRestart([healthyMiddleware()]));
  assert.match(report, /OK\s+middleware/);
  assert.doesNotMatch(report, /PARTIAL middleware/);
});

test('a service with failures is never rendered as PARTIAL or SKIPPED', () => {
  // Ordering guard: rendering must not swallow stated reasons behind a
  // secondary status. An earlier revision printed SKIPPED with failures
  // present, producing "REFUSING to proceed" with nothing stated.
  const broken = healthyMiddleware();
  delete broken.dotenvVars!.JWT_SECRET;
  const report = renderStartupAssertions(assertCanRestart([broken]));
  assert.match(report, /BLOCKED middleware/);
  assert.doesNotMatch(report, /SKIPPED middleware/);
  assert.doesNotMatch(report, /PARTIAL middleware/);
});

test('a fresh start that is not production is a FAILURE, not a quiet OK', () => {
  // NODE_ENV != production skips the presence check AND the Zod superRefine, so
  // an empty failures list would mean "almost nothing ran". That is the
  // 2026-08-12 incident shape.
  const dev = healthyMiddleware();
  dev.ecosystemEnvProduction.NODE_ENV = 'development';
  const failures = assertCanRestart([dev])[0]!.failures;
  assert.ok(failures.some(f => /not production/.test(f)), failures.join(' | '));
});

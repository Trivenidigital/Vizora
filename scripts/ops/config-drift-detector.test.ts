/**
 * config-drift-detector — agent-level safety properties.
 *
 * The comparison logic is unit-tested in `lib/config-drift.test.ts`. This file
 * covers the properties that only hold for the whole agent as it actually runs:
 *
 *   - it is OFF by default (shipping it enabled would have made it the eighth
 *     agent to start alarming on day one)
 *   - it NEVER writes a configuration file (design §8 case 11)
 *   - a missing/failing PM2 degrades to a reported failure rather than a crash
 *     or a half-report claiming health (case 13)
 *   - no secret value reaches stdout (case 10)
 *   - the v1 build-time exclusion is REPORTED, not silent (ruling constraint 5)
 *
 * The agent is spawned as a subprocess — the same shape the other ops agent
 * tests use — so the assertions cover the real entry point, not a stub.
 *
 * Coverage split, stated plainly: on a host without PM2 (CI, and any Windows
 * dev box, which has no `/proc` either) the agent degrades at COLLECTION and
 * the comparison paths are never reached. So the secret-leak assertion here
 * covers the collection and logging paths only. The comparison paths are
 * covered by `lib/config-drift.test.ts` cases 10 and 15, which drive every
 * drift shape with planted secrets and assert nothing derived from them
 * escapes. Neither file covers the other's ground.
 *
 * ─── Why the WIRING is tested here, in-process ──────────────────────────────
 *
 * A pure comparison core with a full unit suite is still dead code if nothing
 * calls it. Both seams that connect this agent's collection to that core —
 * `sampleOpsAgentCredentials` and `runDetection` — are exercised directly, with
 * their I/O injected, so deleting the call site turns tests red instead of
 * silently removing a control. The spawned-subprocess tests below cannot cover
 * this: without PM2 they never reach the comparison, which is exactly how a
 * disconnected feature stays green.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  OPS_AGENT_SCOPE,
  type DotenvRead,
  type EnvMap,
  type OpsAgentCredentialObservation,
} from './lib/config-drift.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const agentPath = join(repoRoot, 'scripts', 'ops', 'config-drift-detector.ts');

// Pinned OFF before the module is ever loaded: importing the agent runs its
// entry point, and `ENABLED` is read once at module scope. Without this an
// operator with the flag exported in their shell would kick off a real
// collection — pm2, psql and all — just by running the test suite. The import
// is deferred (and lazy) rather than static so this assignment is guaranteed to
// happen first; the subprocess tests pass their own env to the child, so they
// are unaffected.
process.env.CONFIG_DRIFT_DETECTOR_ENABLED = '';

type DetectorModule = typeof import('./config-drift-detector.js');
let detectorModule: DetectorModule | undefined;
async function loadDetector(): Promise<DetectorModule> {
  detectorModule ??= await import('./config-drift-detector.js');
  return detectorModule;
}

/**
 * Every file the agent must never modify. Any config file it reads belongs
 * here — that is the point of the assertion.
 */
const GUARDED_CONFIG_FILES = [
  'ecosystem.config.js',
  '.env',
  '.env.example',
  'middleware/.env',
  'realtime/.env',
  'web/.env',
  'web/.env.local',
];

interface FileFingerprint {
  sha256: string;
  mtimeMs: number;
  size: number;
}

function snapshotConfigFiles(): Map<string, FileFingerprint> {
  const snapshot = new Map<string, FileFingerprint>();
  for (const relative of GUARDED_CONFIG_FILES) {
    const full = join(repoRoot, relative);
    if (!existsSync(full)) continue;
    const stat = statSync(full);
    snapshot.set(relative, {
      sha256: createHash('sha256').update(readFileSync(full)).digest('hex'),
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    });
  }
  return snapshot;
}

function runAgent(env: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', agentPath], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function withTempState<T>(fn: (stateFile: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'vizora-drift-'));
  const stateFile = join(dir, 'ops-state.json');
  return fn(stateFile).finally(() => rmSync(dir, { recursive: true, force: true }));
}

// ─── Gate ────────────────────────────────────────────────────────────────────

test('is OFF by default and writes no state when disabled', async () => {
  await withTempState(async stateFile => {
    const { code, stdout } = await runAgent({
      OPS_STATE_FILE: stateFile,
      CONFIG_DRIFT_DETECTOR_ENABLED: '',
    });

    assert.equal(code, 0, 'a disabled agent must exit cleanly');
    assert.match(stdout, /skipping \(default off\)/);
    assert.equal(existsSync(stateFile), false, 'a disabled agent must not write state');
  });
});

// ─── Safety property: never writes configuration (case 11) ──────────────────

test('never writes, rewrites or touches any configuration file', async () => {
  await withTempState(async stateFile => {
    const before = snapshotConfigFiles();
    assert.ok(before.size > 0, 'expected at least one guarded config file to exist');

    await runAgent({
      OPS_STATE_FILE: stateFile,
      CONFIG_DRIFT_DETECTOR_ENABLED: 'true',
    });

    const after = snapshotConfigFiles();
    assert.deepEqual(
      [...after.keys()].sort(),
      [...before.keys()].sort(),
      'the agent must not create or delete configuration files',
    );
    for (const [relative, fingerprint] of before) {
      assert.deepEqual(
        after.get(relative),
        fingerprint,
        `configuration file was modified: ${relative}`,
      );
    }
  });
});

// ─── Safety property: degrades rather than crashing (case 13) ───────────────

test('an unavailable PM2 is reported, never crashes and never claims health', async () => {
  await withTempState(async stateFile => {
    const { code, stdout, stderr } = await runAgent({
      OPS_STATE_FILE: stateFile,
      CONFIG_DRIFT_DETECTOR_ENABLED: 'true',
      // Guarantee `pm2` and `psql` cannot be resolved regardless of the host.
      PATH: join(repoRoot, 'this-directory-does-not-exist'),
      Path: join(repoRoot, 'this-directory-does-not-exist'),
    });

    assert.notEqual(code, 2, `agent crashed instead of degrading: ${stderr}`);
    assert.doesNotMatch(stdout, /FATAL/, 'a missing PM2 must not be fatal');

    // The critical property: it must say it could not determine drift, NOT
    // stay quiet and let the absence of findings read as "all clear".
    assert.match(
      stdout,
      /observation-incomplete/,
      'an unbuildable view must be reported explicitly',
    );
    assert.match(stdout, /max_connections unavailable/);
  });
});

test('records a run whose issuesFixed is 0 — this agent never repairs', async () => {
  await withTempState(async stateFile => {
    await runAgent({
      OPS_STATE_FILE: stateFile,
      CONFIG_DRIFT_DETECTOR_ENABLED: 'true',
      PATH: join(repoRoot, 'this-directory-does-not-exist'),
      Path: join(repoRoot, 'this-directory-does-not-exist'),
    });

    assert.ok(existsSync(stateFile), 'an enabled run must record its result');
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    const result = state.agentResults['config-drift-detector'];

    assert.ok(result, 'agent result missing from state');
    assert.equal(result.issuesFixed, 0, 'issuesFixed must be 0 by design');
    assert.ok(
      (state.recentRemediations ?? []).every((r: { agent: string }) => r.agent !== 'config-drift-detector'),
      'the detector must never record a remediation',
    );
  });
});

// ─── Safety property: no secret in output (case 10) ─────────────────────────

test('no secret value from the local environment reaches stdout', async () => {
  await withTempState(async stateFile => {
    // Distinctive values planted in the agent's own environment. If any
    // comparison path ever echoed a value, these would surface.
    const planted = {
      JWT_SECRET: `PLANTED-JWT-${'z'.repeat(24)}`,
      DEVICE_JWT_SECRET: `PLANTED-DEVICE-${'y'.repeat(24)}`,
      INTERNAL_API_SECRET: `PLANTED-INTERNAL-${'x'.repeat(24)}`,
      MINIO_SECRET_KEY: 'PLANTED-MINIO-SECRET',
      DATABASE_URL: 'postgresql://vizora:PLANTED-PG-PASSWORD@localhost:5432/vizora?connection_limit=10',
      REDIS_URL: 'redis://:PLANTED-REDIS-PASSWORD@localhost:6379',
    };

    const { stdout, stderr } = await runAgent({
      OPS_STATE_FILE: stateFile,
      CONFIG_DRIFT_DETECTOR_ENABLED: 'true',
      PATH: join(repoRoot, 'this-directory-does-not-exist'),
      Path: join(repoRoot, 'this-directory-does-not-exist'),
      ...planted,
    });

    const combined = `${stdout}\n${stderr}`;
    for (const secret of ['PLANTED-PG-PASSWORD', 'PLANTED-REDIS-PASSWORD', 'PLANTED-MINIO-SECRET', planted.JWT_SECRET, planted.DEVICE_JWT_SECRET, planted.INTERNAL_API_SECRET]) {
      assert.ok(!combined.includes(secret), `secret leaked to output: ${secret.slice(0, 16)}...`);
    }

    // And nothing derived from them either.
    const hexRun = combined.match(/\b[0-9a-f]{12,}\b/i);
    assert.equal(hexRun, null, `derived token found in output: ${hexRun?.[0]}`);

    assert.ok(
      !readFileSync(stateFile, 'utf-8').includes('PLANTED-PG-PASSWORD'),
      'secret leaked into ops-state.json',
    );
  });
});

// ─── Scope reporting (ruling constraint 5) ──────────────────────────────────

test('reports the build-time exclusion rather than staying silent about it', async () => {
  await withTempState(async stateFile => {
    const { stdout } = await runAgent({
      OPS_STATE_FILE: stateFile,
      CONFIG_DRIFT_DETECTOR_ENABLED: 'true',
      PATH: join(repoRoot, 'this-directory-does-not-exist'),
      Path: join(repoRoot, 'this-directory-does-not-exist'),
    });

    assert.match(stdout, /NEXT_PUBLIC_API_URL/, 'the excluded variables must be named');
    assert.match(stdout, /NOT checked/);
    assert.match(stdout, /B2/, 'the reason must point at what closes the gap');
  });
});

// ─── Ops-agent credential control: the wiring, not just the comparison ──────

const OPS_CWD = resolve('/opt/vizora/app');

/** Planted values. Asserted never to reach an incident or the state file. */
const PLANTED_OPS_EMAIL = 'WIREDEMAIL-do-not-leak@vizora.test';
const PLANTED_OPS_PW_LIVE = 'WIREDPW-do-not-leak-live';
const PLANTED_OPS_PW_STALE = 'WIREDPW-do-not-leak-stale';

/** A `pm2 jlist` entry, reduced to the fields the sampler reads. */
function jlistEntry(name: string, pm2Env: Record<string, unknown> = {}) {
  return {
    name,
    pm_id: 7,
    pm2_env: { status: 'stopped', pm_cwd: OPS_CWD, ...pm2Env },
  };
}

/** A collection with no service observations — isolates the ops assertions. */
function opsOnlyCollection(sample: { observation: OpsAgentCredentialObservation; notes: string[] }) {
  return { observations: [], notes: sample.notes, opsCredentials: sample.observation };
}

function dotenvReader(byCwd: Record<string, EnvMap>): (cwd: string) => DotenvRead {
  return cwd => (byCwd[cwd] ? { status: 'present', vars: byCwd[cwd] } : { status: 'absent' });
}

test('wiring: a planted PM2-vs-.env credential drift reaches an incident', async () => {
  const { runDetection, sampleOpsAgentCredentials } = await loadDetector();
  const processes = [jlistEntry('ops-fleet-manager', {
    OPS_EMAIL: PLANTED_OPS_EMAIL,
    OPS_PASSWORD: PLANTED_OPS_PW_LIVE,
  })];
  const sample = sampleOpsAgentCredentials(
    processes,
    processes,
    [{ name: 'ops-fleet-manager' }],
    OPS_CWD,
    dotenvReader({ [OPS_CWD]: { OPS_EMAIL: PLANTED_OPS_EMAIL, OPS_PASSWORD: PLANTED_OPS_PW_STALE } }),
  );

  const { result, incidents, evaluated } = runDetection(opsOnlyCollection(sample), 100);

  const ops = incidents.filter(i => i.targetId.startsWith(`${OPS_AGENT_SCOPE}:`));
  assert.equal(ops.length, 1, `expected one ops incident, got ${JSON.stringify(incidents, null, 2)}`);
  assert.equal(ops[0].targetId, `${OPS_AGENT_SCOPE}:credentials`);
  assert.equal(ops[0].severity, 'warning', 'HIGH maps onto the ops Severity enum as warning');
  assert.match(ops[0].message, /password: DRIFT/);
  assert.equal(result.issuesFixed, 0, 'this agent never repairs');
  assert.ok(evaluated.includes(OPS_AGENT_SCOPE));
});

test('wiring: a matching pair produces no ops incident but still marks the scope evaluated', async () => {
  const { runDetection, sampleOpsAgentCredentials } = await loadDetector();
  const env = { OPS_EMAIL: PLANTED_OPS_EMAIL, OPS_PASSWORD: PLANTED_OPS_PW_LIVE };
  const processes = [jlistEntry('ops-fleet-manager', env)];
  const sample = sampleOpsAgentCredentials(
    processes, processes, [{ name: 'ops-fleet-manager' }], OPS_CWD, dotenvReader({ [OPS_CWD]: { ...env } }),
  );

  const { incidents, evaluated } = runDetection(opsOnlyCollection(sample), 100);

  assert.deepEqual(incidents.filter(i => i.targetId.startsWith(OPS_AGENT_SCOPE)), []);
  assert.ok(
    evaluated.includes(OPS_AGENT_SCOPE),
    'a clean run must still cover the scope, or a corrected drift could never resolve',
  );
});

test('wiring: an unobservable PM2 side reports, and does NOT mark the scope evaluated', async () => {
  const { runDetection, sampleOpsAgentCredentials } = await loadDetector();
  const sample = sampleOpsAgentCredentials([], [], [], OPS_CWD, dotenvReader({}));

  const { incidents, evaluated } = runDetection(opsOnlyCollection(sample), 100);

  const ops = incidents.filter(i => i.targetId.startsWith(`${OPS_AGENT_SCOPE}:`));
  assert.equal(ops.length, 1);
  assert.equal(ops[0].type, 'ops-credentials-unobservable');
  assert.equal(ops[0].severity, 'info', 'an unobservable read must not page anyone');
  assert.ok(
    !evaluated.includes(OPS_AGENT_SCOPE),
    'a run that established nothing must not be allowed to clear a prior finding',
  );
});

test('wiring: planted credential values never reach an incident', async () => {
  const { runDetection, sampleOpsAgentCredentials } = await loadDetector();
  const processes = [jlistEntry('ops-fleet-manager', {
    OPS_EMAIL: PLANTED_OPS_EMAIL,
    OPS_PASSWORD: PLANTED_OPS_PW_LIVE,
  })];
  const sample = sampleOpsAgentCredentials(
    processes, processes, [{ name: 'ops-fleet-manager' }], OPS_CWD,
    dotenvReader({ [OPS_CWD]: { OPS_EMAIL: PLANTED_OPS_EMAIL, OPS_PASSWORD: PLANTED_OPS_PW_STALE } }),
  );

  const serialized = JSON.stringify(runDetection(opsOnlyCollection(sample), 100).result);
  for (const planted of [PLANTED_OPS_EMAIL, PLANTED_OPS_PW_LIVE, PLANTED_OPS_PW_STALE]) {
    assert.ok(!serialized.includes(planted), `credential leaked into the recorded run: ${planted}`);
  }
  const hexRun = serialized.match(/\b[0-9a-f]{12,}\b/i);
  assert.equal(hexRun, null, `derived token found in output: ${hexRun?.[0]}`);
});

// ─── Sampling rules ─────────────────────────────────────────────────────────

test('sampling: falls through to the next credentialed agent when the first is missing', async () => {
  const { sampleOpsAgentCredentials } = await loadDetector();
  // The hardcoded-single-entry version reported `unobservable` every hour
  // forever the moment that one app was renamed or deleted.
  const processes = [jlistEntry('ops-content-lifecycle', { OPS_EMAIL: PLANTED_OPS_EMAIL })];
  const sample = sampleOpsAgentCredentials(processes, processes, [], OPS_CWD, dotenvReader({}));

  assert.equal(sample.observation.sampledAgent, 'ops-content-lifecycle');
  assert.equal(sample.observation.pm2Env?.OPS_EMAIL, PLANTED_OPS_EMAIL);
});

test('sampling: an agent whose stored env changed between jlist samples is skipped', async () => {
  const { sampleOpsAgentCredentials } = await loadDetector();
  // The detector and these cron agents fire on the same minute every hour, so a
  // read landing inside a respawn is a real possibility. It must not surface as
  // a credential incident.
  const first = [
    jlistEntry('ops-fleet-manager', { OPS_PASSWORD: PLANTED_OPS_PW_LIVE }),
    jlistEntry('ops-schedule-doctor', { OPS_PASSWORD: PLANTED_OPS_PW_LIVE }),
  ];
  const second = [
    jlistEntry('ops-fleet-manager', { OPS_PASSWORD: PLANTED_OPS_PW_STALE }),
    jlistEntry('ops-schedule-doctor', { OPS_PASSWORD: PLANTED_OPS_PW_LIVE }),
  ];
  const sample = sampleOpsAgentCredentials(first, second, [], OPS_CWD, dotenvReader({}));

  assert.equal(sample.observation.sampledAgent, 'ops-schedule-doctor', 'the unstable entry is skipped');
  assert.ok(sample.notes.some(n => /mid-respawn/.test(n)), `expected a note, got ${sample.notes}`);
});

test('sampling: an entry present in only one jlist sample is skipped', async () => {
  const { sampleOpsAgentCredentials } = await loadDetector();
  const first = [jlistEntry('ops-fleet-manager', { OPS_EMAIL: PLANTED_OPS_EMAIL })];
  const sample = sampleOpsAgentCredentials(first, [], [], OPS_CWD, dotenvReader({}));

  assert.equal(sample.observation.pm2Env, null);
  assert.ok(sample.notes.some(n => /not present in both/.test(n)));
});

test('sampling: an empty stored env is unreadable, not "no credentials configured"', async () => {
  const { sampleOpsAgentCredentials } = await loadDetector();
  const processes = [{ name: 'ops-fleet-manager', pm_id: 7, pm2_env: {} }];
  const sample = sampleOpsAgentCredentials(processes, processes, [], OPS_CWD, dotenvReader({}));

  assert.equal(sample.observation.pm2Env, null);
  assert.ok(sample.notes.some(n => /empty or unavailable/.test(n)));
});

test('sampling: the runtime side reads .env from pm_cwd, the restart side from the ecosystem cwd', async () => {
  const { runDetection, sampleOpsAgentCredentials } = await loadDetector();
  // The false negative this closes: the agents were started somewhere else, so
  // the file the running process read is NOT the repo-root one. Reading only
  // the ecosystem cwd would find a matching pair and report all clear.
  const runningCwd = resolve('/tmp/started-elsewhere');
  const processes = [jlistEntry('ops-fleet-manager', {
    pm_cwd: runningCwd,
    OPS_EMAIL: PLANTED_OPS_EMAIL,
    OPS_PASSWORD: PLANTED_OPS_PW_LIVE,
  })];
  const sample = sampleOpsAgentCredentials(
    processes, processes, [], OPS_CWD,
    dotenvReader({ [OPS_CWD]: { OPS_EMAIL: PLANTED_OPS_EMAIL, OPS_PASSWORD: PLANTED_OPS_PW_STALE } }),
  );

  assert.equal(sample.observation.pm2Cwd, runningCwd);
  assert.equal(sample.observation.ecosystemCwd, OPS_CWD);
  assert.equal(sample.observation.runtimeDotenv.status, 'absent', 'nothing to read where it runs');
  assert.equal(sample.observation.restartDotenv.status, 'present', 'the cold-start file still exists');

  const ops = runDetection(opsOnlyCollection(sample), 100).incidents
    .filter(i => i.targetId.startsWith(`${OPS_AGENT_SCOPE}:`));
  assert.ok(ops.some(i => i.targetId.endsWith(':cwd')), `expected a cwd incident, got ${ops.map(i => i.targetId)}`);
});

test('sampling: a missing pm_cwd is noted rather than guessed', async () => {
  const { sampleOpsAgentCredentials } = await loadDetector();
  const processes = [{
    name: 'ops-fleet-manager',
    pm_id: 7,
    pm2_env: { status: 'stopped', OPS_EMAIL: PLANTED_OPS_EMAIL },
  }];
  const sample = sampleOpsAgentCredentials(processes, processes, [], OPS_CWD, dotenvReader({}));

  assert.equal(sample.observation.pm2Cwd, undefined);
  assert.ok(sample.notes.some(n => /pm_cwd unavailable/.test(n)));
});

test('sampling: only credential variables leave the sampler', async () => {
  const { sampleOpsAgentCredentials } = await loadDetector();
  const processes = [jlistEntry('ops-fleet-manager', {
    OPS_EMAIL: PLANTED_OPS_EMAIL,
    JWT_SECRET: 'JWT-do-not-leak',
    DATABASE_URL: 'postgresql://u:PGPW-do-not-leak@h:5432/d',
  })];
  const sample = sampleOpsAgentCredentials(processes, processes, [], OPS_CWD, dotenvReader({}));

  assert.deepEqual(Object.keys(sample.observation.pm2Env ?? {}), ['OPS_EMAIL']);
});

test('sampling: an ops app with an explicit cwd resolves it against the repo root', async () => {
  const { sampleOpsAgentCredentials } = await loadDetector();
  const processes = [jlistEntry('ops-fleet-manager', { OPS_EMAIL: PLANTED_OPS_EMAIL })];
  const sample = sampleOpsAgentCredentials(
    processes, processes, [{ name: 'ops-fleet-manager', cwd: './ops-home' }], OPS_CWD, dotenvReader({}),
  );

  assert.equal(sample.observation.ecosystemCwd, resolve(OPS_CWD, './ops-home'));
});

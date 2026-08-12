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
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const agentPath = join(repoRoot, 'scripts', 'ops', 'config-drift-detector.ts');

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

/**
 * STARVATION_IS_NOT_A_CRASH — health-guardian must not answer CPU starvation
 * with `pm2 restart`.
 *
 * A listening-but-slow service and a dead one are identical at the socket, but
 * only one of them is fixed by a restart, and restarting the other spends the
 * exact resource that is exhausted. In the retained prod log window
 * (2026-08-19 → 2026-08-23), on a box whose CPU idle sat at 0.20% while a
 * co-tenant consumed 166% of 200%:
 *
 *   6 UNHEALTHY verdicts — 6 of 6 `AbortError` (the 10s probe timeout)
 *                        — 0 of 6 ECONNREFUSED
 *   5 `pm2 restart` attempts, every one aimed at a live listener.
 *
 * These tests pin BOTH directions: a transient timeout must not restart, and a
 * timeout that persists past the threshold still must — otherwise the fix would
 * trade a false-restart bug for a no-recovery-from-hang bug.
 *
 * The harness is deliberately separate from `health-guardian.test.ts`: this one
 * needs a pm2 shim that RECORDS its invocations (so "no restart happened" is
 * provable rather than assumed) and servers that hang (so the timeout is real
 * rather than mocked).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Incident, OpsState } from './lib/types.js';
import { TIMEOUT_RESTART_THRESHOLD } from './lib/probe-failure.js';
import { probeWebAssets, type ProbeFetch } from './lib/web-assets.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Serve a normal healthy app, except for the URLs `shouldHang` selects, which
 * are accepted and then never answered. That is what starvation looks like from
 * the guardian's side.
 */
function startServer(shouldHang: (url: string) => boolean): Promise<{ baseUrl: string; close: () => void }> {
  const sockets = new Set<{ destroy: () => void }>();

  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (shouldHang(url)) return;

    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html', connection: 'close' });
      return res.end(
        '<html><head><script src="/_next/static/chunks/test-chunk.js"></script>' +
        '</head><body>ok</body></html>',
      );
    }
    if (url.startsWith('/_next/static/')) {
      res.writeHead(200, { 'content-type': 'application/javascript', connection: 'close' });
      return res.end('console.log("chunk");');
    }
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
    res.end(JSON.stringify({ status: 'ok' }));
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        // A hung request holds its socket open, so server.close() alone would
        // never complete and the test would leak the handle.
        close: () => {
          for (const socket of sockets) socket.destroy();
          server.close();
        },
      });
    });
  });
}

const hangsMiddlewareProbe = (url: string) => url.startsWith('/api/v1/health');
const hangsWebAssets = (url: string) => url.startsWith('/_next/static/');

/** A pm2 shim that records every invocation, so "no restart" is provable. */
function writeRecordingPm2(binDir: string, recordPath: string, restartExitCode = 0): void {
  const jlist = JSON.stringify([
    { name: 'vizora-middleware', pm_id: 0, pm2_env: { status: 'online' }, monit: { memory: 64 * 1024 * 1024, cpu: 0 } },
    { name: 'vizora-realtime', pm_id: 0, pm2_env: { status: 'online' }, monit: { memory: 64 * 1024 * 1024, cpu: 0 } },
    { name: 'vizora-web', pm_id: 0, pm2_env: { status: 'online' }, monit: { memory: 64 * 1024 * 1024, cpu: 0 } },
  ]);
  const pm2Js = join(binDir, 'pm2');
  const lines = [
    '#!/usr/bin/env node',
    "const fs = require('fs');",
    'const args = process.argv.slice(2);',
    `fs.appendFileSync(${JSON.stringify(recordPath)}, args.join(' ') + '\\n');`,
    `if (args[0] === 'jlist') { process.stdout.write(${JSON.stringify(jlist)}); process.exit(0); }`,
    `if (args[0] === 'restart') { process.exit(${restartExitCode}); }`,
    'process.exit(0);',
    '',
  ];
  writeFileSync(pm2Js, lines.join('\n'));
  chmodSync(pm2Js, 0o755);
  writeFileSync(join(binDir, 'pm2.cmd'), '@echo off\r\nnode "%~dp0\\pm2" %*\r\n');
}

function readPm2Invocations(recordPath: string): string[] {
  try {
    return readFileSync(recordPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function runHealthGuardian(
  tmpRoot: string,
  baseUrl: string,
  killAfterMs: number,
  extraEnv: Record<string, string> = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', join(tmpRoot, 'scripts', 'ops', 'health-guardian.ts')],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: `${join(tmpRoot, 'bin')}${pathSeparator}${process.env.PATH ?? ''}`,
        VALIDATOR_BASE_URL: baseUrl,
        REALTIME_URL: baseUrl,
        WEB_URL: baseUrl,
        HEALTHCHECKS_HEALTH_GUARDIAN_URL: '',
        SLACK_WEBHOOK_URL: '',
        ...extraEnv,
      },
      stdio: 'pipe',
    },
  );

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill(), killAfterMs);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function prepareTmpRoot(tmpRoot: string): void {
  cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), { recursive: true });
  mkdirSync(join(tmpRoot, 'logs'), { recursive: true });
  mkdirSync(join(tmpRoot, 'bin'), { recursive: true });
}

function seedState(tmpRoot: string, incidents: Incident[]): void {
  const state: OpsState = {
    systemStatus: 'HEALTHY',
    lastUpdated: new Date().toISOString(),
    lastRun: {},
    incidents,
    recentRemediations: [],
    agentResults: {},
  };
  writeFileSync(join(tmpRoot, 'logs', 'ops-state.json'), JSON.stringify(state, null, 2));
}

const STREAK_FILE = 'health-guardian-timeout-streaks.json';

/**
 * Seed the streak file — the DECISION input. `Incident.consecutiveTimeouts` is
 * only the operator-visible copy, so seeding the incident alone proves nothing.
 */
function seedStreaks(tmpRoot: string, streaks: Record<string, number>): void {
  const at = new Date().toISOString();
  const payload = Object.fromEntries(
    Object.entries(streaks).map(([service, count]) => [service, { count, at }]),
  );
  writeFileSync(join(tmpRoot, 'logs', STREAK_FILE), JSON.stringify(payload, null, 2));
}

function readIncident(tmpRoot: string, id: string): Incident | undefined {
  const updated = JSON.parse(
    readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8'),
  ) as OpsState;
  return updated.incidents.find((item) => item.id === id);
}

const MIDDLEWARE_INCIDENT = 'health-guardian:service-down:middleware';
const WEB_INCIDENT = 'health-guardian:service-down:web';

function timeoutIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: MIDDLEWARE_INCIDENT,
    agent: 'health-guardian',
    type: 'service-down',
    severity: 'warning',
    target: 'service',
    targetId: 'middleware',
    detected: new Date().toISOString(),
    message: 'middleware is unresponsive',
    remediation: 'investigate host resource pressure',
    status: 'open',
    attempts: 0,
    ...overrides,
  };
}

// ─── The endpoint probe ─────────────────────────────────────────────────────

test('a single probe timeout raises an incident but does NOT restart the service', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startServer(hangsMiddlewareProbe);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath);
    seedState(tmpRoot, []);

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000);

    const invocations = readPm2Invocations(recordPath);
    assert.deepEqual(
      invocations.filter((line) => line.startsWith('restart')),
      [],
      `a starved-but-listening service must not be restarted; pm2 saw ${JSON.stringify(invocations)}\n${result.stdout}`,
    );
    assert.match(result.stdout, /middleware: NOT auto-restarting/);

    const incident = readIncident(tmpRoot, MIDDLEWARE_INCIDENT);
    assert.ok(incident, `the incident must still be raised on the first timeout\n${result.stdout}`);
    assert.equal(incident.status, 'open');
    assert.equal(incident.consecutiveTimeouts, 1);
    // One slow answer is a DEGRADED box, not a CRITICAL one.
    assert.equal(incident.severity, 'warning');
    // The operator must be pointed at capacity, not at pm2.
    assert.match(incident.remediation, /host resource pressure/);
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a timeout that persists to the threshold IS restarted — a real hang still gets fixed', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startServer(hangsMiddlewareProbe);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    // Exit 1 on restart: the guardian then skips its 30s post-restart cooldown,
    // which keeps this test fast while still proving the restart was attempted.
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath, 1);
    // Two prior consecutive timeouts; this run makes three.
    seedState(tmpRoot, [timeoutIncident({ consecutiveTimeouts: TIMEOUT_RESTART_THRESHOLD - 1 })]);
    seedStreaks(tmpRoot, { middleware: TIMEOUT_RESTART_THRESHOLD - 1 });

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000);

    const invocations = readPm2Invocations(recordPath);
    assert.ok(
      invocations.includes('restart vizora-middleware'),
      `a sustained hang must still be restarted; pm2 saw ${JSON.stringify(invocations)}\n${result.stdout}`,
    );
    assert.match(result.stdout, /treating it as a hang/);

    const incident = readIncident(tmpRoot, MIDDLEWARE_INCIDENT);
    assert.equal(incident?.consecutiveTimeouts, TIMEOUT_RESTART_THRESHOLD);
    assert.equal(incident?.attempts, 1);
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ─── The web asset probe ────────────────────────────────────────────────────
//
// web is the service MOST exposed to starvation, not the least: it makes up to
// three sequential 10s-bounded fetches per cycle (shell, then a sample of the
// assets the shell references) where the others make one. Stamping every asset
// failure as a broken build would leave the most-exposed service unprotected.

test('probeWebAssets reports a timeout when the HTML fetch aborts', async () => {
  const aborting: ProbeFetch = async () => {
    const err = new Error('This operation was aborted');
    err.name = 'AbortError';
    throw err;
  };
  const outcome = await probeWebAssets('http://127.0.0.1:1/', aborting);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.kind, 'timeout');
});

test('probeWebAssets reports a timeout when an ASSET fetch aborts', async () => {
  const html = '<html><head><script src="/_next/static/chunks/a.js"></script></head></html>';
  const fetchImpl: ProbeFetch = async (url: string) => {
    if (url.includes('_next')) {
      const err = new Error('This operation was aborted');
      err.name = 'AbortError';
      throw err;
    }
    return { ok: true, status: 200, text: async () => html };
  };
  const outcome = await probeWebAssets('http://127.0.0.1:1', fetchImpl);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.kind, 'timeout');
});

test('probeWebAssets leaves kind unset for a genuinely broken build', async () => {
  // A 500 throws nothing, so the caller keeps its own 'asset-failure' verdict
  // and the service is restarted immediately, exactly as before.
  const html = '<html><head><script src="/_next/static/chunks/a.js"></script></head></html>';
  const fetchImpl: ProbeFetch = async (url: string) => {
    if (url.includes('_next')) return { ok: false, status: 500, text: async () => '' };
    return { ok: true, status: 200, text: async () => html };
  };
  const outcome = await probeWebAssets('http://127.0.0.1:1', fetchImpl);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.kind, undefined);
});

test('a web asset probe that times out does NOT restart web', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  // The shell answers 200 immediately; only the referenced chunk hangs.
  const { baseUrl, close } = await startServer(hangsWebAssets);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath);
    seedState(tmpRoot, []);

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000);

    const invocations = readPm2Invocations(recordPath);
    assert.deepEqual(
      invocations.filter((line) => line.startsWith('restart')),
      [],
      `an aborted asset probe is starvation, not a broken build; pm2 saw ${JSON.stringify(invocations)}\n${result.stdout}`,
    );

    const incident = readIncident(tmpRoot, WEB_INCIDENT);
    assert.ok(incident, `expected a web incident\n${result.stdout}`);
    assert.equal(incident.consecutiveTimeouts, 1);
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ─── Ordering and operator control ──────────────────────────────────────────

test('an already-escalated incident is not walked back to open by a timeout', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startServer(hangsMiddlewareProbe);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath);
    // Escalated after two failed restarts on a NON-timeout failure, so it
    // carries no streak. The failure mode then shifts to a timeout.
    seedState(tmpRoot, [
      timeoutIncident({
        severity: 'critical',
        status: 'escalated',
        attempts: 2,
        consecutiveTimeouts: 0,
      }),
    ]);

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000);

    assert.match(result.stdout, /middleware: already escalated/);
    const incident = readIncident(tmpRoot, MIDDLEWARE_INCIDENT);
    assert.equal(
      incident?.status,
      'escalated',
      `escalated is terminal and must survive a change of failure mode\n${result.stdout}`,
    );
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('GUARDIAN_TIMEOUT_RESTART_THRESHOLD=1 restores restart-on-first-timeout', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startServer(hangsMiddlewareProbe);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath, 1);
    seedState(tmpRoot, []);

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000, {
      GUARDIAN_TIMEOUT_RESTART_THRESHOLD: '1',
    });

    assert.ok(
      readPm2Invocations(recordPath).includes('restart vizora-middleware'),
      `the operator override must take effect without a deploy\n${result.stdout}`,
    );
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('an unparseable GUARDIAN_TIMEOUT_RESTART_THRESHOLD is ignored, not obeyed', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startServer(hangsMiddlewareProbe);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath);
    seedState(tmpRoot, []);

    // 0 would disable the gate entirely if it were honoured.
    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000, {
      GUARDIAN_TIMEOUT_RESTART_THRESHOLD: '0',
    });

    assert.match(result.stdout, /is not an integer >= 1/);
    assert.deepEqual(
      readPm2Invocations(recordPath).filter((line) => line.startsWith('restart')),
      [],
      `a bad override must fall back to the default, not disable the gate\n${result.stdout}`,
    );
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a definite bad status outranks an abort in the same asset sample', async () => {
  // Positive evidence of a fault beats absence of evidence. Order-independent.
  {
    const html = '<html><head>'
      + '<script src="/_next/static/chunks/a.js"></script>'
      + '<script src="/_next/static/chunks/b.js"></script>'
      + '</head></html>';
    const build = (abortFirst: boolean): ProbeFetch => async (url: string) => {
      if (url.endsWith('a.js')) {
        if (abortFirst) {
          const err = new Error('This operation was aborted');
          err.name = 'AbortError';
          throw err;
        }
        return { ok: false, status: 500, text: async () => '' };
      }
      if (url.endsWith('b.js')) {
        if (abortFirst) return { ok: false, status: 500, text: async () => '' };
        const err = new Error('This operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      return { ok: true, status: 200, text: async () => html };
    };

    for (const abortFirst of [true, false]) {
      const outcome = await probeWebAssets('http://127.0.0.1:1', build(abortFirst));
      assert.equal(outcome.ok, false);
      assert.equal(
        outcome.kind,
        undefined,
        `abortFirst=${abortFirst}: a 500 in the sample must win, so the caller restarts`,
      );
    }
  }
});

test('an existing CRITICAL incident is never downgraded by a sub-threshold timeout', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startServer(hangsMiddlewareProbe);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath);
    // The crash-loop shape: down and refused (critical, one failed restart),
    // then the next observation aborts while the new process boots under load.
    seedState(tmpRoot, [
      timeoutIncident({ severity: 'critical', status: 'open', attempts: 1 }),
    ]);

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000);

    const incident = readIncident(tmpRoot, MIDDLEWARE_INCIDENT);
    assert.equal(
      incident?.severity,
      'critical',
      `a change of failure mode must not tell the operator an ongoing outage improved\n${result.stdout}`,
    );
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('the streak survives an ops-state.json that cannot be read', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startServer(hangsMiddlewareProbe);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath, 1);
    // The regression this sidecar exists for: the shared state file is
    // unusable, so the incident and its `detected` stamp are both gone. The
    // streak must still reach the threshold and restart a genuinely hung
    // service, instead of restarting from 1 forever.
    writeFileSync(join(tmpRoot, 'logs', 'ops-state.json'), '{ this is not json');
    seedStreaks(tmpRoot, { middleware: TIMEOUT_RESTART_THRESHOLD - 1 });

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000);

    assert.ok(
      readPm2Invocations(recordPath).includes('restart vizora-middleware'),
      `a hang must still be recovered when ops-state.json is unreadable; pm2 saw `
      + `${JSON.stringify(readPm2Invocations(recordPath))}\n${result.stdout}`,
    );
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('an UNREADABLE streak file fails toward remediation, an absent one does not', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startServer(hangsMiddlewareProbe);
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath, 1);
    seedState(tmpRoot, []);
    // Present but unusable — the streak is UNKNOWN, and an unknown streak can
    // never accumulate, so waiting on it would reproduce the closed failure.
    writeFileSync(join(tmpRoot, 'logs', STREAK_FILE), 'not json at all');

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000);

    assert.match(result.stdout, /timeout streak unavailable/);
    assert.ok(
      readPm2Invocations(recordPath).includes('restart vizora-middleware'),
      `an unknown streak must fail toward remediation\n${result.stdout}`,
    );
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

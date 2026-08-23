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
 * provable rather than assumed) and a server that hangs (so the timeout is real
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

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Serves realtime + web normally, but never answers the middleware probe. */
function startMiddlewareHangsServer(): Promise<{ baseUrl: string; close: () => void }> {
  const sockets = new Set<{ destroy: () => void }>();

  const server = createServer((req, res) => {
    const url = req.url ?? '/';

    // The middleware readiness probe: accept the connection, never answer.
    // This is what CPU starvation looks like from the guardian's side.
    if (url.startsWith('/api/v1/health')) return;

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

const INCIDENT_ID = 'health-guardian:service-down:middleware';

test('a single probe timeout raises an incident but does NOT restart the service', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startMiddlewareHangsServer();
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

    const updated = JSON.parse(
      readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8'),
    ) as OpsState;
    const incident = updated.incidents.find((item) => item.id === INCIDENT_ID);
    assert.ok(incident, `the incident must still be raised on the first timeout\n${result.stdout}`);
    assert.equal(incident.status, 'open');
    assert.equal(incident.consecutiveTimeouts, 1);
    // The operator must be pointed at capacity, not at pm2.
    assert.match(incident.remediation, /host resource pressure/);
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a timeout that persists to the threshold IS restarted — a real hang still gets fixed', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-starvation-'));
  const { baseUrl, close } = await startMiddlewareHangsServer();
  const recordPath = join(tmpRoot, 'pm2-invocations.log');

  try {
    prepareTmpRoot(tmpRoot);
    // Exit 1 on restart: the guardian then skips its 30s post-restart cooldown,
    // which keeps this test fast while still proving the restart was attempted.
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath, 1);

    seedState(tmpRoot, [
      {
        id: INCIDENT_ID,
        agent: 'health-guardian',
        type: 'service-down',
        severity: 'critical',
        target: 'service',
        targetId: 'middleware',
        detected: new Date().toISOString(),
        message: 'middleware is unresponsive',
        remediation: 'investigate host resource pressure',
        status: 'open',
        attempts: 0,
        // Two prior consecutive timeouts; this run makes three.
        consecutiveTimeouts: TIMEOUT_RESTART_THRESHOLD - 1,
      },
    ]);

    const result = await runHealthGuardian(tmpRoot, baseUrl, 90_000);

    const invocations = readPm2Invocations(recordPath);
    assert.ok(
      invocations.includes('restart vizora-middleware'),
      `a sustained hang must still be restarted; pm2 saw ${JSON.stringify(invocations)}\n${result.stdout}`,
    );
    assert.match(result.stdout, /treating it as a hang/);

    const updated = JSON.parse(
      readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8'),
    ) as OpsState;
    const incident = updated.incidents.find((item) => item.id === INCIDENT_ID);
    assert.equal(incident?.consecutiveTimeouts, TIMEOUT_RESTART_THRESHOLD);
    assert.equal(incident?.attempts, 1);
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

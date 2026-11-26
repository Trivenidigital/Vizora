/**
 * The restart budget belongs to ONE outage episode.
 *
 * Incident ids are deterministic (`agent:type:targetId`) and a resolved record
 * stays in ops-state.json, so the guardian finds the previous episode's record
 * on every later outage. It used to read `attempts` and `detected` from that
 * record without checking its status: after two outages that a restart fixed,
 * every later outage escalated immediately and was never restarted.
 *
 * But "resolved" alone does not end an episode: a service that dies again right
 * after each successful restart is one crash loop, and must still escalate
 * after MAX_RESTART_ATTEMPTS. A resolved record only ends the episode once it
 * has stayed resolved for the quiet period (30 min).
 *
 * These tests pin all three on both restart paths: a recurrence after the quiet
 * period starts a fresh budget, a crash loop inside it escalates, and an episode
 * that is still OPEN keeps accumulating to escalation exactly as before.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Incident, OpsState } from './lib/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const OLD_DETECTED = '2026-01-01T00:00:00.000Z';
const SERVICE_DOWN_ID = 'health-guardian:service-down:middleware';
const PM2_ERRORED_ID = 'health-guardian:pm2-errored:vizora-middleware:0';
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();

/**
 * - `up`: middleware healthy.
 * - `down`: middleware's readiness probe always answers 503.
 * - `crash-loop`: 503, except the ONE probe right after a pm2 restart (the
 *   guardian's post-restart recheck) answers 200 — the restart "works", then the
 *   service dies again before the next cycle.
 */
type MiddlewareMode = 'up' | 'down' | 'crash-loop';

function startServer(
  mode: MiddlewareMode,
  restartedMarker: string,
): Promise<{ baseUrl: string; close: () => void }> {
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (mode !== 'up' && url.startsWith('/api/v1/health')) {
      if (mode === 'crash-loop' && existsSync(restartedMarker)) {
        unlinkSync(restartedMarker);
        res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
        return res.end(JSON.stringify({ status: 'ok' }));
      }
      res.writeHead(503, { 'content-type': 'application/json', connection: 'close' });
      return res.end(JSON.stringify({ status: 'error' }));
    }
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

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      resolve({ baseUrl: `http://127.0.0.1:${address.port}`, close: () => server.close() });
    });
  });
}

/**
 * A pm2 shim that records every invocation and touches `restartedMarker` on
 * `restart`. With `restartExitCode` 1 the service-down path skips its 30s
 * post-restart cooldown — the attempt is still recorded and counted.
 */
function writeRecordingPm2(
  binDir: string,
  recordPath: string,
  restartedMarker: string,
  middlewareStatus: string,
  restartExitCode: number,
): void {
  const jlist = JSON.stringify([
    { name: 'vizora-middleware', pm_id: 0, pm2_env: { status: middlewareStatus }, monit: { memory: 64 * 1024 * 1024, cpu: 0 } },
    { name: 'vizora-realtime', pm_id: 0, pm2_env: { status: 'online' }, monit: { memory: 64 * 1024 * 1024, cpu: 0 } },
    { name: 'vizora-web', pm_id: 0, pm2_env: { status: 'online' }, monit: { memory: 64 * 1024 * 1024, cpu: 0 } },
  ]);
  const pm2Js = join(binDir, 'pm2');
  writeFileSync(
    pm2Js,
    [
      '#!/usr/bin/env node',
      "const fs = require('fs');",
      'const args = process.argv.slice(2);',
      `fs.appendFileSync(${JSON.stringify(recordPath)}, args.join(' ') + '\\n');`,
      `if (args[0] === 'jlist') { process.stdout.write(${JSON.stringify(jlist)}); process.exit(0); }`,
      `if (args[0] === 'restart') { fs.writeFileSync(${JSON.stringify(restartedMarker)}, ''); process.exit(${restartExitCode}); }`,
      'process.exit(0);',
      '',
    ].join('\n'),
  );
  chmodSync(pm2Js, 0o755);
  writeFileSync(join(binDir, 'pm2.cmd'), '@echo off\r\nnode "%~dp0\\pm2" %*\r\n');
}

function restartInvocations(recordPath: string): string[] {
  try {
    return readFileSync(recordPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('restart'));
  } catch {
    return [];
  }
}

function runHealthGuardian(tmpRoot: string, baseUrl: string): Promise<{ code: number | null; stdout: string }> {
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
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.resume();
  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill(), 90_000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout });
    });
  });
}

function priorIncident(overrides: Partial<Incident>): Incident {
  return {
    id: SERVICE_DOWN_ID,
    agent: 'health-guardian',
    type: 'service-down',
    severity: 'critical',
    target: 'service',
    targetId: 'middleware',
    detected: OLD_DETECTED,
    message: 'middleware was down, auto-restarted successfully',
    remediation: 'pm2 restart vizora-middleware',
    status: 'resolved',
    attempts: 2,
    // Just outside the 30-minute quiet period: a finished episode.
    resolvedAt: minutesAgo(31),
    ...overrides,
  };
}

/**
 * Run the guardian `runs` times against one persisted state, as consecutive
 * cron cycles. Returns the incident `id` after each run.
 */
async function runScenario(opts: {
  middleware: MiddlewareMode;
  pm2Status: string;
  restartExitCode: number;
  id: string;
  seed?: Incident;
  runs?: number;
}): Promise<{ incidents: (Incident | undefined)[]; restarts: string[]; stdout: string }> {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-guardian-budget-'));
  const recordPath = join(tmpRoot, 'pm2-invocations.log');
  const marker = join(tmpRoot, 'restarted.marker');
  const { baseUrl, close } = await startServer(opts.middleware, marker);
  try {
    cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), { recursive: true });
    mkdirSync(join(tmpRoot, 'logs'), { recursive: true });
    mkdirSync(join(tmpRoot, 'bin'), { recursive: true });
    writeRecordingPm2(join(tmpRoot, 'bin'), recordPath, marker, opts.pm2Status, opts.restartExitCode);
    const state: OpsState = {
      systemStatus: 'HEALTHY',
      lastUpdated: new Date().toISOString(),
      lastRun: {},
      incidents: opts.seed ? [opts.seed] : [],
      recentRemediations: [],
      agentResults: {},
    };
    writeFileSync(join(tmpRoot, 'logs', 'ops-state.json'), JSON.stringify(state, null, 2));

    const incidents: (Incident | undefined)[] = [];
    let stdout = '';
    for (let i = 0; i < (opts.runs ?? 1); i++) {
      const run = await runHealthGuardian(tmpRoot, baseUrl);
      stdout += `\n--- run ${i + 1} ---\n${run.stdout}`;
      const updated = JSON.parse(readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8')) as OpsState;
      incidents.push(updated.incidents.find((item) => item.id === opts.id));
    }
    return { incidents, restarts: restartInvocations(recordPath), stdout };
  } finally {
    close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ─── service-down path ──────────────────────────────────────────────────────

test('service-down: a recurrence after the quiet period restarts with a fresh budget', async () => {
  const { incidents, restarts, stdout } = await runScenario({
    middleware: 'down',
    pm2Status: 'online',
    restartExitCode: 1,
    id: SERVICE_DOWN_ID,
    seed: priorIncident({ status: 'resolved', attempts: 2 }),
  });
  const incident = incidents[0];

  assert.deepEqual(restarts, ['restart vizora-middleware'], `expected one restart\n${stdout}`);
  assert.equal(incident?.status, 'open', stdout);
  assert.equal(incident?.attempts, 1, 'the new episode is on its first attempt');
  assert.notEqual(incident?.detected, OLD_DETECTED, 'detected must mark the new episode');
});

test('service-down: an OPEN episode at the max still escalates without restarting', async () => {
  const { incidents, restarts, stdout } = await runScenario({
    middleware: 'down',
    pm2Status: 'online',
    restartExitCode: 1,
    id: SERVICE_DOWN_ID,
    seed: priorIncident({ status: 'open', attempts: 2, resolvedAt: undefined }),
  });
  const incident = incidents[0];

  assert.deepEqual(restarts, [], `an exhausted open episode must not restart\n${stdout}`);
  assert.equal(incident?.status, 'escalated', stdout);
  assert.equal(incident?.attempts, 2);
  assert.equal(incident?.detected, OLD_DETECTED, 'an ongoing episode keeps its start time');
});

test('service-down: a crash loop (each restart "works", then dies again) still escalates', async () => {
  // Three real cycles: two restarts that pass the post-restart recheck (each
  // waits out the guardian's 30s cooldown), then a third outage.
  const { incidents, restarts, stdout } = await runScenario({
    middleware: 'crash-loop',
    pm2Status: 'online',
    restartExitCode: 0,
    id: SERVICE_DOWN_ID,
    runs: 3,
  });

  assert.equal(incidents[0]?.status, 'resolved', stdout);
  assert.equal(incidents[0]?.attempts, 1);
  assert.equal(incidents[1]?.status, 'resolved', stdout);
  assert.equal(incidents[1]?.attempts, 2, 'a recent resolution is the same episode');
  assert.equal(incidents[1]?.detected, incidents[0]?.detected);
  assert.deepEqual(
    restarts,
    ['restart vizora-middleware', 'restart vizora-middleware'],
    `a crash loop must not earn a third restart\n${stdout}`,
  );
  assert.equal(incidents[2]?.status, 'escalated', stdout);
  assert.equal(incidents[2]?.attempts, 2);
});

// ─── pm2-errored path ───────────────────────────────────────────────────────

function priorPm2Incident(overrides: Partial<Incident>): Incident {
  return priorIncident({
    id: PM2_ERRORED_ID,
    type: 'pm2-errored',
    target: 'pm2-process',
    targetId: 'vizora-middleware:0',
    message: 'PM2 process vizora-middleware:0 was errored, restarted',
    ...overrides,
  });
}

test('pm2-errored: a recurrence after the quiet period restarts with a fresh budget', async () => {
  const { incidents, restarts, stdout } = await runScenario({
    middleware: 'up',
    pm2Status: 'errored',
    restartExitCode: 1,
    id: PM2_ERRORED_ID,
    seed: priorPm2Incident({ status: 'resolved', attempts: 2 }),
  });
  const incident = incidents[0];

  assert.deepEqual(restarts, ['restart vizora-middleware'], `expected one restart\n${stdout}`);
  assert.equal(incident?.attempts, 1, 'the new episode is on its first attempt');
  assert.notEqual(incident?.detected, OLD_DETECTED, 'detected must mark the new episode');
});

test('pm2-errored: an OPEN episode at the max still escalates without restarting', async () => {
  const { incidents, restarts, stdout } = await runScenario({
    middleware: 'up',
    pm2Status: 'errored',
    restartExitCode: 1,
    id: PM2_ERRORED_ID,
    seed: priorPm2Incident({ status: 'open', attempts: 2, resolvedAt: undefined }),
  });
  const incident = incidents[0];

  assert.deepEqual(restarts, [], `an exhausted open episode must not restart\n${stdout}`);
  assert.equal(incident?.status, 'escalated', stdout);
  assert.equal(incident?.attempts, 2);
  assert.equal(incident?.detected, OLD_DETECTED);
});

test('pm2-errored: a crash loop (each restart "works", process errors again) still escalates', async () => {
  // pm2 reports `errored` every cycle; each restart exits 0, which this path
  // records as resolved.
  const { incidents, restarts, stdout } = await runScenario({
    middleware: 'up',
    pm2Status: 'errored',
    restartExitCode: 0,
    id: PM2_ERRORED_ID,
    runs: 3,
  });

  assert.equal(incidents[0]?.status, 'resolved', stdout);
  assert.equal(incidents[0]?.attempts, 1);
  assert.equal(incidents[1]?.status, 'resolved', stdout);
  assert.equal(incidents[1]?.attempts, 2, 'a recent resolution is the same episode');
  assert.equal(incidents[1]?.detected, incidents[0]?.detected);
  assert.deepEqual(
    restarts,
    ['restart vizora-middleware', 'restart vizora-middleware'],
    `a crash loop must not earn a third restart\n${stdout}`,
  );
  assert.equal(incidents[2]?.status, 'escalated', stdout);
  assert.equal(incidents[2]?.attempts, 2);
});

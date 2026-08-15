/**
 * health-guardian — loopback remediation vs alert-only edge watch.
 *
 * `WEB_URL` means two things at once: the public origin backend email links
 * are built from (which config-drift REQUIRES to be https://vizora.cloud on
 * prod) and, until this change, the health-probe target. So every 5-minute web
 * probe went through nginx + TLS at the public edge, and an edge fault was
 * answered with `pm2 restart vizora-web` — a remediation that cannot fix it.
 * That fired on prod at 2026-08-15T06:20:07Z during a deploy reload window.
 *
 * The oracle for "no restart happened" is a real one: the fake `pm2` on PATH
 * appends every argv it is invoked with to a file. A test that expects no
 * restart asserts that file contains nothing but `jlist`.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import {
  chmodSync,
  cpSync,
  existsSync,
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

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Reserved TLD (RFC 2606) — guaranteed never to resolve. */
const DEAD_EDGE = 'https://edge.invalid';
const DEAD_EDGE_INCIDENT_ID = 'health-guardian:edge-unreachable:edge.invalid';
const WEB_DOWN_INCIDENT_ID = 'health-guardian:service-down:web';

// ─── Fixture server ──────────────────────────────────────────────────────────

type RootMode = 'healthy' | 'root-500';

/**
 * One server answering all three services' health routes. Bound to 0.0.0.0 so
 * it can also be addressed as `http://0.0.0.0:<port>` — a NON-loopback host
 * that still reaches this process, which is how the tests exercise the
 * remediable guard and the edge-recovery path without a real domain.
 */
function startServer(mode: RootMode): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const url = req.url ?? '/';

    if (url === '/') {
      if (mode === 'root-500') {
        res.writeHead(500, { connection: 'close' });
        return res.end('boom');
      }
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
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      resolve({ server, port: address.port });
    });
  });
}

/** A stub that records every request it receives. */
function startRecorder(): Promise<{ server: Server; port: number; hits: string[] }> {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    req.resume();
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
    res.end('{"ok":true}');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      resolve({ server, port: address.port, hits });
    });
  });
}

/** A port nothing is listening on — used to make a LOCAL probe genuinely fail. */
function reserveClosedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      assert.ok(address && typeof address === 'object');
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });
}

// ─── Temp root + fake pm2 ────────────────────────────────────────────────────

function pm2LogPath(tmpRoot: string): string {
  return join(tmpRoot, 'pm2-argv.log');
}

/**
 * Fake `pm2` that APPENDS every invocation's argv to a file. That file is the
 * no-restart oracle — a test asserting "we never restarted" reads it rather
 * than inferring absence from an incident field.
 */
function writeFakePm2(tmpRoot: string): void {
  const binDir = join(tmpRoot, 'bin');
  const jlist = JSON.stringify(
    ['vizora-middleware', 'vizora-realtime', 'vizora-web'].map(name => ({
      name,
      pm_id: 0,
      pm2_env: { status: 'online' },
      monit: { memory: 64 * 1024 * 1024, cpu: 0 },
    })),
  );
  const pm2Js = join(binDir, 'pm2');
  writeFileSync(
    pm2Js,
    `#!/usr/bin/env node
const fs = require('fs');
fs.appendFileSync(${JSON.stringify(pm2LogPath(tmpRoot))}, process.argv.slice(2).join(' ') + '\\n');
if (process.argv[2] === 'jlist') { process.stdout.write(${JSON.stringify(jlist)}); process.exit(0); }
process.exit(0);
`,
  );
  chmodSync(pm2Js, 0o755);
  writeFileSync(join(binDir, 'pm2.cmd'), `@echo off\r\nnode "%~dp0\\pm2" %*\r\n`);
}

function readPm2Invocations(tmpRoot: string): string[] {
  const path = pm2LogPath(tmpRoot);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean);
}

function setupTmpRoot(seedIncidents: Incident[] = []): string {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-edge-vs-local-'));
  cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), { recursive: true });
  mkdirSync(join(tmpRoot, 'logs'), { recursive: true });
  mkdirSync(join(tmpRoot, 'bin'), { recursive: true });
  writeFakePm2(tmpRoot);

  const state: OpsState = {
    systemStatus: 'HEALTHY',
    lastUpdated: new Date().toISOString(),
    lastRun: {},
    incidents: seedIncidents,
    recentRemediations: [],
    agentResults: {},
  };
  writeFileSync(join(tmpRoot, 'logs', 'ops-state.json'), JSON.stringify(state, null, 2));
  return tmpRoot;
}

const PROBE_TARGETS_REL = join('scripts', 'ops', 'lib', 'probe-targets.ts');

/**
 * Point the loopback substitution at the fixture server's ephemeral port.
 *
 * The production constant is the real 3000/3002/3001 precisely because the
 * services enforce those ports; a test cannot bind them, so it rewrites the
 * constant in its own copy of the tree. The rewrite is asserted, never assumed.
 */
function patchLocalProbePorts(
  tmpRoot: string,
  ports: { middleware: number; realtime: number; web: number },
): void {
  const path = join(tmpRoot, PROBE_TARGETS_REL);
  const before = readFileSync(path, 'utf8');
  const after = before.replace(
    /middleware: 3000,\s*\n\s*realtime: 3002,\s*\n\s*web: 3001,/,
    `middleware: ${ports.middleware},\n  realtime: ${ports.realtime},\n  web: ${ports.web},`,
  );
  assert.notEqual(after, before, 'LOCAL_PROBE_PORTS rewrite did not apply — the constant moved');
  writeFileSync(path, after);
}

/**
 * Disable the loopback substitution in the copied tree so a NON-loopback URL
 * survives into `ServiceDef.healthUrl`.
 *
 * This is deliberate: substitution and the `remediable` guard are two
 * independent layers, and layer 2 can only be observed with layer 1 switched
 * off. `isLoopback` itself is untouched — health-guardian still computes
 * `remediable` with the real predicate.
 */
function disableLoopbackSubstitution(tmpRoot: string): void {
  const path = join(tmpRoot, PROBE_TARGETS_REL);
  const before = readFileSync(path, 'utf8');
  const marker = 'if (isLoopback(raw)) {';
  assert.equal(
    before.split(marker).length - 1,
    1,
    'expected exactly one loopback-substitution branch to disable',
  );
  writeFileSync(path, before.replace(marker, 'if (raw) {'));
}

function readIncidents(tmpRoot: string): Incident[] {
  const state = JSON.parse(readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8')) as OpsState;
  return state.incidents;
}

function runAgent(
  tmpRoot: string,
  extraEnv: Record<string, string>,
  timeoutMs = 30_000,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const sep = process.platform === 'win32' ? ';' : ':';
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', join(tmpRoot, 'scripts', 'ops', 'health-guardian.ts')],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: `${join(tmpRoot, 'bin')}${sep}${process.env.PATH ?? ''}`,
        HEALTHCHECKS_HEALTH_GUARDIAN_URL: '',
        SLACK_WEBHOOK_URL: '',
        TV_DOWNLOAD_MONITOR_ENABLED: 'false',
        ...extraEnv,
      },
      stdio: 'pipe',
    },
  );

  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', c => (stdout += c));
  child.stderr.on('data', c => (stderr += c));

  return new Promise(resolve => {
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('exit', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('an unreachable public edge raises edge-unreachable and never restarts web', async () => {
  const { server, port } = await startServer('healthy');
  const tmpRoot = setupTmpRoot();
  try {
    patchLocalProbePorts(tmpRoot, { middleware: port, realtime: port, web: port });

    const result = await runAgent(tmpRoot, {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: `http://127.0.0.1:${port}`,
      // Exactly prod's shape: WEB_URL is the public origin, not a probe target.
      WEB_URL: DEAD_EDGE,
    });

    const incidents = readIncidents(tmpRoot);
    const edgeIncident = incidents.find(i => i.id === DEAD_EDGE_INCIDENT_ID);
    assert.ok(edgeIncident, `expected an edge-unreachable incident\n${result.stdout}`);
    assert.equal(edgeIncident.severity, 'critical');
    assert.equal(edgeIncident.status, 'open');
    assert.equal(edgeIncident.target, 'edge');
    assert.equal(edgeIncident.targetId, 'edge.invalid');
    assert.match(edgeIncident.remediation, /nginx -t/);
    assert.match(edgeIncident.remediation, /do NOT restart Node services/);
    assert.match(edgeIncident.message, /NOT external DNS\/firewall reachability/);

    // The local web probe was substituted to loopback, so web stayed healthy.
    assert.equal(
      incidents.find(i => i.id === WEB_DOWN_INCIDENT_ID),
      undefined,
      'an edge fault must not be reported as the local web service being down',
    );

    // The oracle: pm2 was only ever asked to list.
    const pm2Calls = readPm2Invocations(tmpRoot);
    assert.deepEqual(
      pm2Calls.filter(c => c !== 'jlist'),
      [],
      `pm2 must not be invoked for anything but jlist, got: ${JSON.stringify(pm2Calls)}`,
    );

    // Unfixed issue -> non-zero exit (the dead-man ping is a separate verdict).
    assert.equal(result.code, 1, `${result.stderr}\n${result.stdout}`);
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('local web down AND edge down produces one incident, not two', async () => {
  const { server, port } = await startServer('healthy');
  const closedPort = await reserveClosedPort();
  const tmpRoot = setupTmpRoot();
  try {
    // Local web probe points at a port nothing listens on: the service really
    // is down, and a restart really is the right answer.
    patchLocalProbePorts(tmpRoot, { middleware: port, realtime: port, web: closedPort });

    const result = await runAgent(
      tmpRoot,
      {
        VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
        REALTIME_URL: `http://127.0.0.1:${port}`,
        WEB_URL: DEAD_EDGE,
      },
      // A real restart path sleeps RESTART_COOLDOWN_MS before re-checking.
      120_000,
    );

    const incidents = readIncidents(tmpRoot);
    assert.deepEqual(
      incidents.map(i => i.id),
      [WEB_DOWN_INCIDENT_ID],
      `one outage must produce exactly one incident\n${result.stdout}`,
    );
    assert.equal(
      incidents.find(i => i.id === DEAD_EDGE_INCIDENT_ID),
      undefined,
      'edge must stay quiet while the local probe already owns the finding',
    );

    // A loopback probe DID fail, so remediation is legitimate here.
    assert.ok(
      readPm2Invocations(tmpRoot).includes('restart vizora-web'),
      `a failed loopback probe must still restart, got: ${JSON.stringify(readPm2Invocations(tmpRoot))}`,
    );
    assert.equal(result.code, 1, `${result.stderr}\n${result.stdout}`);
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a non-loopback probe target raises an incident but can never restart', async t => {
  const { server, port } = await startServer('root-500');
  const nonLoopback = `http://0.0.0.0:${port}`;
  const tmpRoot = setupTmpRoot();
  try {
    // 0.0.0.0 reaches this box on every platform we run on, but is not one of
    // the loopback hosts. If that is ever untrue here, skip rather than lie.
    let reachable = false;
    try {
      reachable = (await fetch(`${nonLoopback}/api/health`)).ok;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      return t.skip('0.0.0.0 is not routable to this process on this host');
    }

    disableLoopbackSubstitution(tmpRoot);

    const result = await runAgent(tmpRoot, {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: `http://127.0.0.1:${port}`,
      WEB_URL: nonLoopback,
    });

    const incident = readIncidents(tmpRoot).find(i => i.id === WEB_DOWN_INCIDENT_ID);
    assert.ok(incident, `expected a service-down incident\n${result.stdout}`);
    assert.equal(incident.status, 'open');
    assert.match(incident.message, /not a loopback/);
    assert.match(incident.message, /no restart attempted/);

    const pm2Calls = readPm2Invocations(tmpRoot);
    assert.deepEqual(
      pm2Calls.filter(c => c !== 'jlist'),
      [],
      `a non-loopback probe must never reach pm2, got: ${JSON.stringify(pm2Calls)}`,
    );
    assert.equal(result.code, 1, `${result.stderr}\n${result.stdout}`);
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a recovered edge resolves the open edge-unreachable incident', async t => {
  const { server, port } = await startServer('healthy');
  const edge = `http://0.0.0.0:${port}`;
  const incidentId = 'health-guardian:edge-unreachable:0.0.0.0';
  const openIncident: Incident = {
    id: incidentId,
    agent: 'health-guardian',
    type: 'edge-unreachable',
    severity: 'critical',
    target: 'edge',
    targetId: '0.0.0.0',
    detected: new Date(Date.now() - 3_600_000).toISOString(),
    message: 'Public edge was unreachable',
    remediation: 'nginx -t; systemctl status nginx; certbot certificates',
    status: 'open',
    attempts: 0,
    error: 'fetch failed',
  };

  const tmpRoot = setupTmpRoot([openIncident]);
  try {
    let reachable = false;
    try {
      reachable = (await fetch(`${edge}/api/health`)).ok;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      return t.skip('0.0.0.0 is not routable to this process on this host');
    }

    patchLocalProbePorts(tmpRoot, { middleware: port, realtime: port, web: port });

    const result = await runAgent(tmpRoot, {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: `http://127.0.0.1:${port}`,
      WEB_URL: edge,
    });

    const incident = readIncidents(tmpRoot).find(i => i.id === incidentId);
    assert.ok(incident, `incident should still be tracked after recovery\n${result.stdout}`);
    assert.equal(incident.status, 'resolved');
    assert.ok(incident.resolvedAt, 'resolvedAt must be stamped');
    assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a continuing edge outage alerts once, on the open transition only', async () => {
  const { server, port } = await startServer('healthy');
  const slack = await startRecorder();
  const tmpRoot = setupTmpRoot();
  try {
    patchLocalProbePorts(tmpRoot, { middleware: port, realtime: port, web: port });

    const env = {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: `http://127.0.0.1:${port}`,
      WEB_URL: DEAD_EDGE,
      SLACK_WEBHOOK_URL: `http://127.0.0.1:${slack.port}/hook`,
    };

    const first = await runAgent(tmpRoot, env);
    const second = await runAgent(tmpRoot, env);

    assert.ok(
      readIncidents(tmpRoot).find(i => i.id === DEAD_EDGE_INCIDENT_ID),
      `expected the edge incident to stay open\n${first.stdout}\n${second.stdout}`,
    );
    assert.deepEqual(
      slack.hits,
      ['POST /hook'],
      `a continuing outage must alert once, not every cycle — got ${JSON.stringify(slack.hits)}`,
    );
  } finally {
    slack.server.close();
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('an edge fault does not make the external dead-man report failure', async () => {
  const { server, port } = await startServer('healthy');
  const healthchecks = await startRecorder();
  const tmpRoot = setupTmpRoot();
  try {
    patchLocalProbePorts(tmpRoot, { middleware: port, realtime: port, web: port });

    const result = await runAgent(tmpRoot, {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: `http://127.0.0.1:${port}`,
      WEB_URL: DEAD_EDGE,
      HEALTHCHECKS_HEALTH_GUARDIAN_URL: `http://127.0.0.1:${healthchecks.port}/ping`,
    });

    // Local + PM2 are all green, so the dead-man says "the agent is fine" —
    // while the exit code still reports the unfixed edge issue.
    assert.deepEqual(
      healthchecks.hits,
      ['POST /ping'],
      `dead-man must not be failed by an off-box finding — got ${JSON.stringify(healthchecks.hits)}`,
    );
    assert.equal(result.code, 1, `${result.stderr}\n${result.stdout}`);
  } finally {
    healthchecks.server.close();
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

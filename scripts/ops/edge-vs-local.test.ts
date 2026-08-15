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
 * restart asserts that file contains nothing but `jlist`; a test that expects
 * one asserts the exact command is present.
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
const MIDDLEWARE_DOWN_INCIDENT_ID = 'health-guardian:service-down:middleware';

// ─── Fixture server ──────────────────────────────────────────────────────────

/**
 * `root-500` breaks only the web-backed edge path (`/`); `middleware-down`
 * breaks only the middleware-backed one (`/api/v1/health/ready`). Keeping them
 * separable is what lets the per-path attribution be tested at all.
 */
type ServerMode = 'healthy' | 'root-500' | 'middleware-down';

/**
 * One server answering all three services' health routes. Bound to 0.0.0.0 so
 * it can also be addressed as `http://0.0.0.0:<port>` — a NON-loopback host
 * that still reaches this process, which is how the tests exercise the
 * probeRemediable guard and the edge paths without a real domain.
 */
function startServer(mode: ServerMode): Promise<{ server: Server; port: number }> {
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
    if (url === '/api/v1/health/ready' && mode === 'middleware-down') {
      // What nginx returns through the edge when middleware is down, and what
      // the LOCAL middleware probe sees at the same time.
      res.writeHead(502, { connection: 'close' });
      return res.end('bad gateway');
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

/**
 * `0.0.0.0` reaches this box on every platform we run on, but is not one of the
 * loopback hosts — the only address shape that is both non-loopback and
 * guaranteed local. If that is ever untrue on a host, tests skip rather than lie.
 */
async function nonLoopbackReachable(port: number): Promise<boolean> {
  try {
    return (await fetch(`http://0.0.0.0:${port}/api/health`)).ok;
  } catch {
    return false;
  }
}

// ─── Temp root + fake pm2 ────────────────────────────────────────────────────

interface FakeProc {
  name: string;
  pm_id: number;
  status: string;
  memoryMB: number;
}

const ALL_ONLINE: FakeProc[] = [
  { name: 'vizora-middleware', pm_id: 0, status: 'online', memoryMB: 64 },
  { name: 'vizora-realtime', pm_id: 0, status: 'online', memoryMB: 64 },
  { name: 'vizora-web', pm_id: 0, status: 'online', memoryMB: 64 },
];

function pm2LogPath(tmpRoot: string): string {
  return join(tmpRoot, 'pm2-argv.log');
}

/**
 * Fake `pm2` that APPENDS every invocation's argv to a file. That file is the
 * restart oracle — both directions are asserted from it rather than inferred
 * from an incident field.
 */
function writeFakePm2(tmpRoot: string, procs: FakeProc[] = ALL_ONLINE): void {
  const binDir = join(tmpRoot, 'bin');
  const jlist = JSON.stringify(
    procs.map(p => ({
      name: p.name,
      pm_id: p.pm_id,
      pm2_env: { status: p.status },
      monit: { memory: p.memoryMB * 1024 * 1024, cpu: 0 },
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

/**
 * The memory check is SKIPPED when the canonical limit cannot be read, so a
 * test about high memory has to supply an ecosystem file in its own tree.
 */
function writeEcosystemConfig(tmpRoot: string, limits: Record<string, string>): void {
  const apps = Object.entries(limits).map(([name, max_memory_restart]) => ({ name, max_memory_restart }));
  writeFileSync(
    join(tmpRoot, 'ecosystem.config.js'),
    `module.exports = ${JSON.stringify({ apps }, null, 2)};\n`,
  );
}

function setupTmpRoot(seedIncidents: Incident[] = [], procs: FakeProc[] = ALL_ONLINE): string {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-edge-vs-local-'));
  cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), { recursive: true });
  mkdirSync(join(tmpRoot, 'logs'), { recursive: true });
  mkdirSync(join(tmpRoot, 'bin'), { recursive: true });
  writeFakePm2(tmpRoot, procs);

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
 * This is deliberate: substitution and the `probeRemediable` guard are two
 * independent layers, and layer 2 can only be observed with layer 1 switched
 * off. `isLoopback` itself is untouched — health-guardian still computes
 * `probeRemediable` with the real predicate.
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
    // Both paths were probed, and each names the service that backs it.
    assert.match(edgeIncident.error ?? '', /backed by web/);
    assert.match(edgeIncident.error ?? '', /backed by middleware/);

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

test('an edge path whose backing service is locally down is not counted twice', async t => {
  const { server, port } = await startServer('root-500');
  const closedPort = await reserveClosedPort();
  const tmpRoot = setupTmpRoot();
  try {
    if (!(await nonLoopbackReachable(port))) {
      return t.skip('0.0.0.0 is not routable to this process on this host');
    }
    // Local web probe points at a port nothing listens on: the service really
    // is down, and a restart really is the right answer. The edge is reachable
    // but fails on `/` — the path web backs — so that failure is already owned.
    patchLocalProbePorts(tmpRoot, { middleware: port, realtime: port, web: closedPort });

    const result = await runAgent(
      tmpRoot,
      {
        VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
        REALTIME_URL: `http://127.0.0.1:${port}`,
        WEB_URL: `http://0.0.0.0:${port}`,
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
      incidents.find(i => i.type === 'edge-unreachable'),
      undefined,
      'the edge path backed by the locally-down service must not raise its own incident',
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

test('a middleware outage does not masquerade as an edge fault (per-path attribution)', async t => {
  // nginx serves `/` from web and `/api/v1/health/ready` from middleware. With
  // middleware down the edge returns 502 on the API path while `/` still
  // answers — gating the whole edge check on web's local health would file a
  // critical `edge-unreachable` and send the operator to nginx.
  const { server, port } = await startServer('middleware-down');
  const tmpRoot = setupTmpRoot();
  try {
    if (!(await nonLoopbackReachable(port))) {
      return t.skip('0.0.0.0 is not routable to this process on this host');
    }
    patchLocalProbePorts(tmpRoot, { middleware: port, realtime: port, web: port });

    const result = await runAgent(
      tmpRoot,
      {
        VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
        REALTIME_URL: `http://127.0.0.1:${port}`,
        WEB_URL: `http://0.0.0.0:${port}`,
      },
      120_000,
    );

    const incidents = readIncidents(tmpRoot);
    assert.ok(
      incidents.find(i => i.id === MIDDLEWARE_DOWN_INCIDENT_ID),
      `expected the middleware outage to be reported as service-down\n${result.stdout}`,
    );
    assert.equal(
      incidents.find(i => i.type === 'edge-unreachable'),
      undefined,
      'a middleware outage must never be filed as edge-unreachable',
    );
    // Local web was healthy, so `/` was still probed through the edge — the
    // check degraded to partial evidence rather than switching off entirely.
    assert.match(result.stdout, /skipped: \/api\/v1\/health\/ready \(local middleware not healthy\)/);
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a non-loopback probe target raises an incident but can never restart', async t => {
  const { server, port } = await startServer('root-500');
  const tmpRoot = setupTmpRoot();
  try {
    if (!(await nonLoopbackReachable(port))) {
      return t.skip('0.0.0.0 is not routable to this process on this host');
    }
    disableLoopbackSubstitution(tmpRoot);

    const result = await runAgent(tmpRoot, {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: `http://127.0.0.1:${port}`,
      WEB_URL: `http://0.0.0.0:${port}`,
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

test('pm2 jlist findings still remediate when the probe target was non-loopback', async t => {
  // The durable proof of the design ruling: `probeRemediable` gates the
  // PROBE-driven path only. PM2's own view of a crashed or bloated process is
  // local authoritative evidence with no edge component, so it must still act.
  const { server, port } = await startServer('healthy');
  const tmpRoot = setupTmpRoot(
    [],
    [
      { name: 'vizora-middleware', pm_id: 0, status: 'online', memoryMB: 64 },
      { name: 'vizora-realtime', pm_id: 0, status: 'online', memoryMB: 64 },
      { name: 'vizora-web', pm_id: 0, status: 'errored', memoryMB: 64 },
      { name: 'vizora-web', pm_id: 1, status: 'online', memoryMB: 95 },
    ],
  );
  try {
    if (!(await nonLoopbackReachable(port))) {
      return t.skip('0.0.0.0 is not routable to this process on this host');
    }
    // 100M limit -> the 95MB process is at 95%, over the 85% reload threshold.
    writeEcosystemConfig(tmpRoot, { 'vizora-web': '100M' });
    disableLoopbackSubstitution(tmpRoot);

    const result = await runAgent(tmpRoot, {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: `http://127.0.0.1:${port}`,
      WEB_URL: `http://0.0.0.0:${port}`,
    });

    // The probe itself is healthy, so nothing here comes from the probe path.
    assert.equal(
      readIncidents(tmpRoot).find(i => i.id === WEB_DOWN_INCIDENT_ID),
      undefined,
      `the probe was healthy; no service-down expected\n${result.stdout}`,
    );
    assert.match(
      result.stdout,
      /web: probe target http:\/\/0\.0\.0\.0:\d+\/ is not loopback/,
      'the web probe target must genuinely be non-loopback for this test to mean anything',
    );

    const pm2Calls = readPm2Invocations(tmpRoot);
    assert.ok(
      pm2Calls.includes('restart vizora-web'),
      `an errored PM2 process must still be restarted, got: ${JSON.stringify(pm2Calls)}`,
    );
    assert.ok(
      pm2Calls.includes('reload vizora-web'),
      `an over-memory PM2 process must still be reloaded, got: ${JSON.stringify(pm2Calls)}`,
    );
    assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
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
    if (!(await nonLoopbackReachable(port))) {
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

test('disabling the edge watch closes the incident it can no longer observe', async () => {
  const { server, port } = await startServer('healthy');
  const incidentId = 'health-guardian:edge-unreachable:vizora.cloud';
  const staleIncident: Incident = {
    id: incidentId,
    agent: 'health-guardian',
    type: 'edge-unreachable',
    severity: 'critical',
    target: 'edge',
    targetId: 'vizora.cloud',
    detected: new Date(Date.now() - 86_400_000).toISOString(),
    message: 'Public edge https://vizora.cloud failed a path',
    remediation: 'nginx -t; systemctl status nginx; certbot certificates',
    status: 'open',
    attempts: 0,
    error: 'fetch failed',
  };

  const tmpRoot = setupTmpRoot([staleIncident]);
  try {
    // Loopback-only config: the watch is off, so nothing will ever observe this
    // incident recovering. Left open it pins ops-state CRITICAL forever.
    const result = await runAgent(tmpRoot, {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: `http://127.0.0.1:${port}`,
      WEB_URL: `http://127.0.0.1:${port}`,
    });

    const incident = readIncidents(tmpRoot).find(i => i.id === incidentId);
    assert.ok(incident, `incident should still be tracked\n${result.stdout}`);
    assert.equal(incident.status, 'resolved');
    assert.ok(incident.resolvedAt, 'resolvedAt must be stamped');
    assert.match(incident.message, /edge watch disabled by configuration/);
    assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a non-loopback REALTIME_URL is substituted and explicitly NOT watched', async () => {
  const { server, port } = await startServer('healthy');
  const tmpRoot = setupTmpRoot();
  try {
    patchLocalProbePorts(tmpRoot, { middleware: port, realtime: port, web: port });

    // Only WEB_URL is the public origin. A stray non-loopback REALTIME_URL must
    // not become "the edge" and inherit nginx/certbot remediation text.
    const result = await runAgent(tmpRoot, {
      VALIDATOR_BASE_URL: `http://127.0.0.1:${port}`,
      REALTIME_URL: DEAD_EDGE,
      WEB_URL: `http://127.0.0.1:${port}`,
    });

    assert.equal(
      readIncidents(tmpRoot).find(i => i.type === 'edge-unreachable'),
      undefined,
      `REALTIME_URL must never be adopted as the edge\n${result.stdout}`,
    );
    assert.match(result.stdout, /REALTIME_URL=https:\/\/edge\.invalid is NOT WATCHED as an edge/);
    // And the skip reason names WEB_URL, not a generic "everything is loopback".
    assert.match(result.stdout, /edge watch: skipped — WEB_URL is loopback \(or unset\)/);
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

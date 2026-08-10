/**
 * health-guardian — customer APK install surface checks.
 *
 * Covers the failure modes that make customers unable to install while every
 * other signal stays green: missing APK, wrong MIME type, zero-length body,
 * and a broken installer page. Also pins the opt-in gate, because shipping
 * this check enabled would have made the agent red on day one.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Incident, OpsState } from './lib/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APK_CONTENT_TYPE = 'application/vnd.android.package-archive';
const INCIDENT_ID = 'health-guardian:tv-download-surface:vizora-display-apk';

type SurfaceMode = 'healthy' | 'missing' | 'wrong-type' | 'empty' | 'page-down';

/**
 * One server that answers both the service health endpoints (so the rest of
 * the agent stays green) and the install surface (per `mode`).
 */
function startServer(mode: SurfaceMode): Promise<{ server: Server; baseUrl: string }> {
  const apkBody = Buffer.from('PKfake-apk-bytes');

  const server = createServer((req, res) => {
    const url = req.url ?? '/';

    if (url === '/downloads/vizora-display.apk') {
      if (mode === 'missing') {
        res.writeHead(404, { connection: 'close' });
        return res.end();
      }
      if (mode === 'wrong-type') {
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': String(apkBody.length),
          connection: 'close',
        });
        return res.end(req.method === 'HEAD' ? undefined : apkBody);
      }
      if (mode === 'empty') {
        res.writeHead(200, {
          'content-type': APK_CONTENT_TYPE,
          'content-length': '0',
          connection: 'close',
        });
        return res.end();
      }
      res.writeHead(200, {
        'content-type': APK_CONTENT_TYPE,
        'content-length': String(apkBody.length),
        connection: 'close',
      });
      return res.end(req.method === 'HEAD' ? undefined : apkBody);
    }

    if (url === '/tv') {
      if (mode === 'page-down') {
        res.writeHead(500, { connection: 'close' });
        return res.end();
      }
      res.writeHead(200, { 'content-type': 'text/html', connection: 'close' });
      return res.end('<html><body>Vizora Display</body></html>');
    }

    // Service health endpoints — always healthy in these tests.
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
    res.end(JSON.stringify({ status: 'ok' }));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function writeFakePm2(binDir: string): void {
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
if (process.argv[2] === 'jlist') { process.stdout.write(${JSON.stringify(jlist)}); process.exit(0); }
process.exit(0);
`,
  );
  chmodSync(pm2Js, 0o755);
  writeFileSync(join(binDir, 'pm2.cmd'), `@echo off\r\nnode "%~dp0\\pm2" %*\r\n`);
}

function runAgent(
  tmpRoot: string,
  baseUrl: string,
  extraEnv: Record<string, string>,
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
  child.stdout.on('data', c => (stdout += c));
  child.stderr.on('data', c => (stderr += c));

  return new Promise(resolve => {
    const timer = setTimeout(() => child.kill(), 20_000);
    child.on('exit', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function setupTmpRoot(seedIncidents: Incident[] = []): string {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-tv-surface-'));
  cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), { recursive: true });
  mkdirSync(join(tmpRoot, 'logs'), { recursive: true });
  mkdirSync(join(tmpRoot, 'bin'), { recursive: true });
  writeFakePm2(join(tmpRoot, 'bin'));

  const now = new Date().toISOString();
  const state: OpsState = {
    systemStatus: 'HEALTHY',
    lastUpdated: now,
    lastRun: {},
    incidents: seedIncidents,
    recentRemediations: [],
    agentResults: {},
  };
  writeFileSync(join(tmpRoot, 'logs', 'ops-state.json'), JSON.stringify(state, null, 2));
  return tmpRoot;
}

function readIncidents(tmpRoot: string): Incident[] {
  const state = JSON.parse(readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8')) as OpsState;
  return state.incidents;
}

function surfaceEnv(baseUrl: string, enabled: boolean): Record<string, string> {
  return {
    TV_DOWNLOAD_MONITOR_ENABLED: enabled ? 'true' : 'false',
    TV_APK_URL: `${baseUrl}/downloads/vizora-display.apk`,
    TV_PAGE_URL: `${baseUrl}/tv`,
  };
}

async function withServer(mode: SurfaceMode, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const { server, baseUrl } = await startServer(mode);
  try {
    await fn(baseUrl);
  } finally {
    server.close();
  }
}

test('install-surface check is OFF by default so it cannot fire before an APK is published', async () => {
  await withServer('missing', async baseUrl => {
    const tmpRoot = setupTmpRoot();
    try {
      // Note: no TV_DOWNLOAD_MONITOR_ENABLED at all — the real default.
      const result = await runAgent(tmpRoot, baseUrl, {
        TV_APK_URL: `${baseUrl}/downloads/vizora-display.apk`,
        TV_PAGE_URL: `${baseUrl}/tv`,
      });
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
      assert.equal(
        readIncidents(tmpRoot).find(i => i.id === INCIDENT_ID),
        undefined,
        'a missing APK must not raise an incident while the monitor is disabled',
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

test('healthy install surface raises no incident', async () => {
  await withServer('healthy', async baseUrl => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl, surfaceEnv(baseUrl, true));
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
      assert.equal(readIncidents(tmpRoot).find(i => i.id === INCIDENT_ID), undefined);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

for (const [mode, expectedFragment] of [
  ['missing', 'HTTP 404'],
  ['wrong-type', 'Content-Type'],
  ['empty', 'content length'],
  ['page-down', 'Installer page'],
] as const) {
  test(`broken install surface (${mode}) raises a critical incident`, async () => {
    await withServer(mode, async baseUrl => {
      const tmpRoot = setupTmpRoot();
      try {
        const result = await runAgent(tmpRoot, baseUrl, surfaceEnv(baseUrl, true));

        const incident = readIncidents(tmpRoot).find(i => i.id === INCIDENT_ID);
        assert.ok(incident, `expected a ${INCIDENT_ID} incident\n${result.stdout}`);
        assert.equal(incident.severity, 'critical');
        assert.equal(incident.status, 'open');
        assert.match(
          `${incident.message} ${incident.error}`,
          new RegExp(expectedFragment, 'i'),
          `incident should explain the ${mode} failure`,
        );
        // Unfixed issue -> non-zero exit so the dead-man ping reports failure.
        assert.equal(result.code, 1, `${result.stderr}\n${result.stdout}`);
      } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  });
}

test('recovered install surface resolves the existing incident', async () => {
  await withServer('healthy', async baseUrl => {
    const openIncident: Incident = {
      id: INCIDENT_ID,
      agent: 'health-guardian',
      type: 'tv-download-surface',
      severity: 'critical',
      target: 'install-surface',
      targetId: 'vizora-display-apk',
      detected: new Date(Date.now() - 3_600_000).toISOString(),
      message: 'Customers cannot install Vizora Display: APK URL returned HTTP 404',
      remediation: 'Re-publish via scripts/release/publish-display-apk.sh',
      status: 'open',
      attempts: 0,
      error: 'HTTP 404',
    };

    const tmpRoot = setupTmpRoot([openIncident]);
    try {
      const result = await runAgent(tmpRoot, baseUrl, surfaceEnv(baseUrl, true));
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);

      const incident = readIncidents(tmpRoot).find(i => i.id === INCIDENT_ID);
      assert.ok(incident, 'incident should still be tracked after recovery');
      assert.equal(incident.status, 'resolved');
      assert.ok(incident.resolvedAt, 'resolvedAt must be stamped');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

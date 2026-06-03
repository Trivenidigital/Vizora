import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
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

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function escalatedPm2Incident(detected: string): Incident {
  return {
    id: 'health-guardian:pm2-errored:vizora-middleware:0',
    agent: 'health-guardian',
    type: 'pm2-errored',
    severity: 'critical',
    target: 'pm2-process',
    targetId: 'vizora-middleware:0',
    detected,
    message: 'PM2 process vizora-middleware:0 is errored and restart attempts exhausted',
    remediation: 'pm2 restart vizora-middleware',
    status: 'escalated',
    attempts: 2,
    error: 'Process status: errored',
  };
}

function startHealthyServer(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((_req, res) => {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close',
    });
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
  const pm2Js = join(binDir, 'pm2');
  const pm2Cmd = join(binDir, 'pm2.cmd');
  const jlist = JSON.stringify([
    {
      name: 'vizora-middleware',
      pm_id: 0,
      pm2_env: { status: 'online' },
      monit: { memory: 64 * 1024 * 1024, cpu: 0 },
    },
    {
      name: 'vizora-realtime',
      pm_id: 0,
      pm2_env: { status: 'online' },
      monit: { memory: 64 * 1024 * 1024, cpu: 0 },
    },
    {
      name: 'vizora-web',
      pm_id: 0,
      pm2_env: { status: 'online' },
      monit: { memory: 64 * 1024 * 1024, cpu: 0 },
    },
  ]);

  writeFileSync(
    pm2Js,
    `#!/usr/bin/env node
if (process.argv[2] === 'jlist') {
  process.stdout.write(${JSON.stringify(jlist)});
  process.exit(0);
}
process.exit(0);
`,
  );
  chmodSync(pm2Js, 0o755);
  writeFileSync(pm2Cmd, `@echo off\r\nnode "%~dp0\\pm2" %*\r\n`);
}

function runHealthGuardian(
  tmpRoot: string,
  baseUrl: string,
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const child = spawn(process.execPath, [
    '--import',
    'tsx',
    join(tmpRoot, 'scripts', 'ops', 'health-guardian.ts'),
  ], {
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
  });

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
    const timer = setTimeout(() => {
      child.kill();
    }, 20_000);

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

test('health-guardian resolves escalated pm2-errored incidents when process is online', async () => {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-health-guardian-'));
  const { server, baseUrl } = await startHealthyServer();

  try {
    cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), {
      recursive: true,
    });
    mkdirSync(join(tmpRoot, 'logs'), { recursive: true });
    mkdirSync(join(tmpRoot, 'bin'), { recursive: true });
    writeFakePm2(join(tmpRoot, 'bin'));

    const now = new Date().toISOString();
    const state: OpsState = {
      systemStatus: 'CRITICAL',
      lastUpdated: now,
      lastRun: {},
      incidents: [escalatedPm2Incident(now)],
      recentRemediations: [],
      agentResults: {},
    };
    writeFileSync(
      join(tmpRoot, 'logs', 'ops-state.json'),
      JSON.stringify(state, null, 2),
    );

    const result = await runHealthGuardian(tmpRoot, baseUrl);

    assert.equal(
      result.code,
      0,
      `${result.stderr}\n${result.stdout}\nsignal=${result.signal ?? 'none'}`,
    );
    const updated = JSON.parse(
      readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8'),
    ) as OpsState;
    const incident = updated.incidents.find(
      (item) => item.id === 'health-guardian:pm2-errored:vizora-middleware:0',
    );

    assert.equal(incident?.status, 'resolved');
    assert.ok(incident?.resolvedAt, 'expected online process to record resolvedAt');
    assert.equal(updated.systemStatus, 'HEALTHY');
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

/**
 * ops-reporter — status-change and recovery alerts must actually fire.
 *
 * The reporter compared `snapshot.systemStatus` (the STORED status) with
 * `determineSystemStatus(snapshot)`. But `recordAgentRun` already recomputes
 * and stores `systemStatus` on every agent write, so by the time the reporter
 * ran the two were equal: the "status changed" and "recovery" branches of
 * `shouldSendAlert` were unreachable, and only "CRITICAL persists" could fire.
 *
 * These drive the REAL shared writer (`recordAgentRun` through
 * `readOpsState`/`writeOpsState`) against a temp state file, then run the real
 * reporter as a child process against a fake Slack webhook, and read the
 * decision it logged.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { readOpsState, recordAgentRun, writeOpsState } from './lib/state.js';
import type { Incident, OpsState } from './lib/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reporterPath = join(repoRoot, 'scripts', 'ops', 'ops-reporter.ts');

const INCIDENT_ID = 'health-guardian:service-down:middleware';

function incident(status: Incident['status']): Incident {
  const now = new Date().toISOString();
  return {
    id: INCIDENT_ID,
    agent: 'health-guardian',
    type: 'service-down',
    severity: 'critical',
    target: 'service',
    targetId: 'middleware',
    detected: now,
    message: 'middleware is down',
    remediation: 'pm2 restart',
    status,
    attempts: 1,
    ...(status === 'resolved' ? { resolvedAt: now } : {}),
  };
}

/** An agent recording a run through the real shared writer. */
function agentRecords(stateFile: string, incidents: Incident[]): void {
  const prev = process.env.OPS_STATE_FILE;
  process.env.OPS_STATE_FILE = stateFile;
  try {
    const state = readOpsState();
    try {
      recordAgentRun(state, {
        agent: 'health-guardian',
        timestamp: new Date().toISOString(),
        durationMs: 1,
        issuesFound: incidents.filter(i => i.status !== 'resolved').length,
        issuesFixed: 0,
        issuesEscalated: 0,
        incidents,
      });
    } finally {
      writeOpsState(state);
    }
  } finally {
    if (prev === undefined) delete process.env.OPS_STATE_FILE;
    else process.env.OPS_STATE_FILE = prev;
  }
}

interface Slack {
  server: Server;
  url: string;
  posts: number;
  /** HTTP status the webhook answers with. */
  status: number;
}

function startSlack(): Promise<Slack> {
  const slack: Slack = { server: undefined as unknown as Server, url: '', posts: 0, status: 200 };
  slack.server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      slack.posts++;
      res.writeHead(slack.status, { connection: 'close' });
      res.end('ok');
    });
  });
  return new Promise((resolve, reject) => {
    slack.server.once('error', reject);
    slack.server.listen(0, '127.0.0.1', () => {
      const address = slack.server.address();
      assert.ok(address && typeof address === 'object');
      slack.url = `http://127.0.0.1:${address.port}/hook`;
      resolve(slack);
    });
  });
}

function runReporter(stateFile: string, slackUrl: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', reporterPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        OPS_STATE_FILE: stateFile,
        SLACK_WEBHOOK_URL: slackUrl,
        // Email and dashboard stay inert.
        SMTP_HOST: '',
        SMTP_TO: '',
        OPS_ALERT_EMAIL: '',
        OPS_EMAIL: '',
        OPS_PASSWORD: '',
        VALIDATOR_EMAIL: '',
        VALIDATOR_PASSWORD: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', c => (stdout += c.toString()));
    child.stderr.on('data', c => (stderr += c.toString()));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

/** The `Alert decision:` line the reporter logged. */
function decisionOf(stdout: string): { shouldAlert: boolean; reason: string } {
  const m = /Alert decision: shouldAlert=(true|false), reason="([^"]*)"/.exec(stdout);
  assert.ok(m, `no alert decision logged:\n${stdout}`);
  return { shouldAlert: m[1] === 'true', reason: m[2] };
}

function readState(stateFile: string): OpsState {
  return JSON.parse(readFileSync(stateFile, 'utf8')) as OpsState;
}

async function withFixture(fn: (stateFile: string, slack: Slack) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'vizora-reporter-'));
  const slack = await startSlack();
  try {
    await fn(join(dir, 'ops-state.json'), slack);
  } finally {
    slack.server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a new critical incident recorded by an agent produces a "status changed" alert, then recovery', async () => {
  await withFixture(async (stateFile, slack) => {
    // Baseline: a healthy system the reporter has seen.
    agentRecords(stateFile, []);
    const baseline = await runReporter(stateFile, slack.url);
    assert.equal(decisionOf(baseline.stdout).shouldAlert, false, 'a steady healthy system is not an alert');

    // An agent records a critical incident; the shared writer stores CRITICAL.
    agentRecords(stateFile, [incident('open')]);
    assert.equal(readState(stateFile).systemStatus, 'CRITICAL', 'precondition: the writer stored CRITICAL');

    const down = await runReporter(stateFile, slack.url);
    assert.deepEqual(
      decisionOf(down.stdout),
      { shouldAlert: true, reason: 'Status changed: HEALTHY -> CRITICAL' },
      down.stdout,
    );
    assert.equal(slack.posts, 1, 'the transition alert was delivered');

    // The agent records the incident resolved; the writer stores HEALTHY.
    agentRecords(stateFile, [incident('resolved')]);
    const up = await runReporter(stateFile, slack.url);
    assert.deepEqual(
      decisionOf(up.stdout),
      { shouldAlert: true, reason: 'Recovery: CRITICAL -> HEALTHY' },
      up.stdout,
    );
    assert.equal(slack.posts, 2, 'the recovery alert was delivered');

    const steady = await runReporter(stateFile, slack.url);
    assert.equal(decisionOf(steady.stdout).shouldAlert, false, 'a reported recovery is not re-sent');
  });
});

test('an undelivered transition alert is retried next cycle, not forgotten', async () => {
  await withFixture(async (stateFile, slack) => {
    agentRecords(stateFile, []);
    await runReporter(stateFile, slack.url);

    agentRecords(stateFile, [incident('open')]);
    slack.status = 500;
    const failed = await runReporter(stateFile, slack.url);
    assert.equal(decisionOf(failed.stdout).reason, 'Status changed: HEALTHY -> CRITICAL');

    // Nobody heard about the transition, so it is still a transition.
    slack.status = 200;
    const retried = await runReporter(stateFile, slack.url);
    assert.deepEqual(
      decisionOf(retried.stdout),
      { shouldAlert: true, reason: 'Status changed: HEALTHY -> CRITICAL' },
      retried.stdout,
    );
  });
});

test('first run with no reported status on file does not invent a transition', async () => {
  await withFixture(async (stateFile, slack) => {
    // A state file written before the reporter tracked what it reported.
    agentRecords(stateFile, []);
    const first = await runReporter(stateFile, slack.url);
    assert.equal(decisionOf(first.stdout).shouldAlert, false, first.stdout);
    assert.equal(slack.posts, 0);
  });
});

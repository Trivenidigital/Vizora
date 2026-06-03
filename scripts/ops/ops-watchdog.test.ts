import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Incident, OpsState } from './lib/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const watchedAgents = [
  'health-guardian',
  'fleet-manager',
  'content-lifecycle',
  'schedule-doctor',
  'ops-reporter',
] as const;

function freshLastRun(timestamp: string): Record<string, string> {
  return Object.fromEntries(watchedAgents.map((agent) => [agent, timestamp]));
}

function agentSilentIncident(agent: string, detected: string): Incident {
  return {
    id: `ops-watchdog:agent-silent:${agent}`,
    agent: 'ops-watchdog',
    type: 'agent-silent',
    severity: 'critical',
    target: 'agent',
    targetId: agent,
    detected,
    message: `${agent} has not run`,
    remediation: `pm2 restart ops-${agent}; check pm2 logs ops-${agent}`,
    status: 'open',
    attempts: 0,
  };
}

function runWatchdogWithState(state: OpsState): { exitCode: number | null; state: OpsState } {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-ops-watchdog-'));

  try {
    cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), {
      recursive: true,
    });
    mkdirSync(join(tmpRoot, 'logs'), { recursive: true });

    writeFileSync(
      join(tmpRoot, 'logs', 'ops-state.json'),
      JSON.stringify(state, null, 2),
    );

    const result = spawnSync(process.execPath, [
      '--import',
      'tsx',
      join(tmpRoot, 'scripts', 'ops', 'ops-watchdog.ts'),
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        SLACK_WEBHOOK_URL: '',
      },
      stdio: 'pipe',
    });

    assert.notEqual(result.status, 2, result.stderr.toString());
    return {
      exitCode: result.status,
      state: JSON.parse(
        readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8'),
      ) as OpsState,
    };
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

test('ops-watchdog resolves recovered agent-silent incidents when agents are fresh', () => {
  const now = new Date();
  const { exitCode, state: updated } = runWatchdogWithState({
    systemStatus: 'CRITICAL',
    lastUpdated: now.toISOString(),
    lastRun: freshLastRun(now.toISOString()),
    incidents: [
      agentSilentIncident('fleet-manager', new Date(now.getTime() - 60 * 60_000).toISOString()),
    ],
    recentRemediations: [],
    agentResults: {},
  });

  assert.equal(exitCode, 0);
  const incident = updated.incidents.find(
    (item) => item.id === 'ops-watchdog:agent-silent:fleet-manager',
  );

  assert.equal(incident?.status, 'resolved');
  assert.ok(incident?.resolvedAt, 'expected recovered incident to record resolvedAt');
  assert.equal(updated.systemStatus, 'HEALTHY');
  assert.equal(updated.agentResults['ops-watchdog']?.issuesFixed, 1);
});

test('ops-watchdog does not resolve stale, missing, or malformed agent records', () => {
  const now = new Date();
  const staleAt = new Date(now.getTime() - 61 * 60_000).toISOString();
  const missingRecordAgent = 'content-lifecycle';
  const malformedRecordAgent = 'schedule-doctor';
  const { exitCode, state: updated } = runWatchdogWithState({
    systemStatus: 'CRITICAL',
    lastUpdated: now.toISOString(),
    lastRun: {
      'health-guardian': now.toISOString(),
      'fleet-manager': staleAt,
      'schedule-doctor': 'not-a-date',
      'ops-reporter': now.toISOString(),
    },
    incidents: [
      agentSilentIncident('health-guardian', staleAt),
      agentSilentIncident('fleet-manager', staleAt),
      agentSilentIncident(missingRecordAgent, staleAt),
      agentSilentIncident(malformedRecordAgent, staleAt),
    ],
    recentRemediations: [],
    agentResults: {},
  });

  assert.equal(exitCode, 1);
  const byTarget = new Map(updated.incidents.map((incident) => [incident.targetId, incident]));
  const incident = updated.incidents.find(
    (item) => item.id === 'ops-watchdog:agent-silent:health-guardian',
  );

  assert.equal(incident?.status, 'resolved');
  assert.equal(byTarget.get('fleet-manager')?.status, 'open');
  assert.equal(byTarget.get(missingRecordAgent)?.status, 'open');
  assert.equal(byTarget.get(malformedRecordAgent)?.status, 'open');
  assert.equal(updated.systemStatus, 'CRITICAL');
  assert.equal(updated.agentResults['ops-watchdog']?.issuesFound, 1);
  assert.equal(updated.agentResults['ops-watchdog']?.issuesFixed, 1);
});

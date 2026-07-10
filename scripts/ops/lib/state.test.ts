import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import {
  determineSystemStatus,
  readOpsState,
  readOpsStateSnapshot,
  writeOpsState,
} from './state.js';
import type { Incident, OpsState, IncidentStatus, Severity } from './types.js';

// Each test runs against an isolated temp state file via the OPS_STATE_FILE
// seam so the real logs/ops-state.json is never touched and cases don't
// interfere with one another.
let tmpDir: string;
let stateFile: string;
let lockFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vizora-ops-state-'));
  stateFile = join(tmpDir, 'ops-state.json');
  lockFile = `${stateFile}.lock`;
  process.env.OPS_STATE_FILE = stateFile;
  delete process.env.OPS_LOCK_TIMEOUT_MS;
});

afterEach(() => {
  delete process.env.OPS_STATE_FILE;
  delete process.env.OPS_LOCK_TIMEOUT_MS;
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── determineSystemStatus: escalated incidents stay active ──────────────────

function incident(
  status: IncidentStatus,
  severity: Severity,
  id = `${status}-${severity}`,
): Incident {
  return {
    id,
    agent: 'health-guardian',
    type: 'service-down',
    severity,
    target: 'service',
    targetId: id,
    detected: '2026-06-03T00:00:00.000Z',
    message: `${id} incident`,
    remediation: 'check service',
    status,
    attempts: 2,
  };
}

function stateWith(incidents: Incident[]): OpsState {
  return {
    systemStatus: 'HEALTHY',
    lastUpdated: '2026-06-03T00:00:00.000Z',
    lastRun: {},
    incidents,
    recentRemediations: [],
    agentResults: {},
  };
}

test('determineSystemStatus treats escalated critical incidents as active', () => {
  assert.equal(
    determineSystemStatus(stateWith([incident('escalated', 'critical')])),
    'CRITICAL',
  );
});

test('determineSystemStatus treats escalated warning incidents as degraded', () => {
  assert.equal(
    determineSystemStatus(stateWith([incident('escalated', 'warning')])),
    'DEGRADED',
  );
});

test('determineSystemStatus ignores resolved incidents', () => {
  assert.equal(
    determineSystemStatus(stateWith([
      incident('resolved', 'critical', 'resolved-critical'),
      incident('resolved', 'warning', 'resolved-warning'),
    ])),
    'HEALTHY',
  );
});

// ─── Lock / crash-safety round-trips (S2-1) ──────────────────────────────────

function sampleIncident(id: string): Incident {
  return {
    id,
    agent: 'fleet-manager',
    type: 'display_offline',
    severity: 'critical',
    target: 'display',
    targetId: 'd1',
    detected: new Date().toISOString(),
    message: 'offline',
    remediation: 'ping',
    status: 'open',
    attempts: 1,
  };
}

function makeState(incidents: Incident[]): OpsState {
  return {
    systemStatus: incidents.some((i) => i.severity === 'critical') ? 'CRITICAL' : 'HEALTHY',
    lastUpdated: new Date().toISOString(),
    lastRun: {},
    incidents,
    recentRemediations: [],
    agentResults: {},
  };
}

test('acquire → write round-trip persists state and releases the lock', () => {
  const state = readOpsState();
  state.incidents.push(sampleIncident('fleet-manager:display_offline:d1'));
  state.lastRun['fleet-manager'] = new Date().toISOString();
  writeOpsState(state);

  // If the lock were not released by writeOpsState, this second read would
  // spin to timeout and throw — so a clean read proves release.
  const readBack = readOpsState();
  try {
    assert.equal(readBack.incidents.length, 1);
    assert.equal(readBack.incidents[0].id, 'fleet-manager:display_offline:d1');
    assert.equal(readBack.lastRun['fleet-manager'], state.lastRun['fleet-manager']);
  } finally {
    writeOpsState(readBack);
  }

  assert.equal(existsSync(lockFile), false, 'lock file should be gone after release');
});

test('readOpsState THROWS on lock timeout instead of proceeding lock-less', () => {
  process.env.OPS_LOCK_TIMEOUT_MS = '150';
  // Another agent holds the lock: a fresh (non-stale) lock file.
  writeFileSync(lockFile, 'other-agent:0:123');

  assert.throws(() => readOpsState(), /lock timeout/);

  // We never acquired it, so the foreign lock must be left untouched.
  assert.equal(existsSync(lockFile), true);
  assert.equal(readFileSync(lockFile, 'utf-8'), 'other-agent:0:123');
});

test('stale lock (>30s) left by a crashed agent is reclaimed', () => {
  writeFileSync(stateFile, JSON.stringify(makeState([sampleIncident('fleet-manager:display_offline:d1')]), null, 2));
  // A lock a crashed agent never released, backdated 60s so it reads as stale.
  writeFileSync(lockFile, 'crashed-agent:0:1');
  const backdated = new Date(Date.now() - 60_000);
  utimesSync(lockFile, backdated, backdated);

  const state = readOpsState();
  try {
    assert.equal(state.incidents.length, 1);
    assert.equal(state.incidents[0].id, 'fleet-manager:display_offline:d1');
  } finally {
    writeOpsState(state);
  }

  assert.equal(existsSync(lockFile), false, 'reclaimed lock released after write');
});

test('release does NOT delete a lock owned by a different token', () => {
  writeFileSync(stateFile, JSON.stringify(makeState([]), null, 2));

  const state = readOpsState(); // acquires; our token is now in the lock file
  // Simulate our lock being reclaimed as stale and re-acquired by another
  // agent while we were still working.
  writeFileSync(lockFile, 'foreign-agent:9:9');

  writeOpsState(state); // release must compare-then-delete → token mismatch → keep

  assert.equal(existsSync(lockFile), true, 'foreign lock must survive our release');
  assert.equal(readFileSync(lockFile, 'utf-8'), 'foreign-agent:9:9');
});

test('corrupt state file is preserved as .corrupt and a later write does not wipe it', () => {
  // Truncated JSON as a crash mid-write (pre-atomic) would leave. It carries
  // real incident data whose silent loss is exactly what fix D prevents.
  const corruptBytes = '{"systemStatus":"CRITICAL","incidents":[{"id":"fleet-manager:display_offline:d1"';
  writeFileSync(stateFile, corruptBytes);

  const recovered = readOpsState(); // parse fails → preserve corrupt + return empty
  try {
    assert.equal(recovered.systemStatus, 'HEALTHY');
    assert.equal(recovered.incidents.length, 0);
  } finally {
    writeOpsState(recovered); // writes empty state atomically over STATE_FILE
  }

  const corruptFiles = readdirSync(tmpDir).filter((f) => f.includes('ops-state.json.corrupt-'));
  assert.equal(corruptFiles.length, 1, 'exactly one preserved corrupt file');
  assert.equal(
    readFileSync(join(tmpDir, corruptFiles[0]), 'utf-8'),
    corruptBytes,
    'corrupt bytes must be retained verbatim — incident history preserved, not wiped',
  );

  const persisted = JSON.parse(readFileSync(stateFile, 'utf-8')) as OpsState;
  assert.equal(persisted.systemStatus, 'HEALTHY');
  assert.equal(persisted.incidents.length, 0);
});

test('readOpsStateSnapshot is lock-free — repeatable and leaves no lock', () => {
  writeFileSync(stateFile, JSON.stringify(makeState([sampleIncident('a:b:c')]), null, 2));

  const first = readOpsStateSnapshot();
  const second = readOpsStateSnapshot(); // would deadlock if it took a lock

  assert.equal(first.incidents.length, 1);
  assert.equal(second.incidents.length, 1);
  assert.equal(existsSync(lockFile), false, 'snapshot must never create a lock file');
});

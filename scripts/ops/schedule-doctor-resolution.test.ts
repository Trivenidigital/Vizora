/**
 * schedule-doctor — incident clearing must be earned by a complete run.
 *
 * Before this, `empty_playlist_schedule` and `coverage_gap` had no resolution
 * path at all: they are raised with no auto-fix, so an operator who assigned
 * the missing playlist watched the incident sit `open` forever, pinning
 * ops-state at DEGRADED over a problem that was gone.
 *
 * Adding a sweep is only half the fix. `resolveNotReraised` reads "not
 * re-raised" as "resolved", which is a lie for any run that could not look —
 * so the NEGATIVE cases below are the load-bearing ones. A degraded run must
 * leave prior incidents open, and it must SAY it is degraded rather than
 * silently entering a permanent no-resolution regime.
 *
 * Spawn-harness pattern from tv-download-surface.test.ts: the real agent runs
 * as a child process against a fake API and a seeded ops-state.json.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Incident, OpsState } from './lib/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const COVERAGE_GAP_ID = 'schedule-doctor:coverage_gap:display-1';
const ORPHAN_ID = 'schedule-doctor:orphan_schedule:sched-orphan';
const TRUNCATED_ID = 'schedule-doctor:scan-truncated:entity-lists';

interface Fixture {
  schedules: Record<string, unknown>[];
  displays: Record<string, unknown>[];
  playlists: Record<string, unknown>[];
  /** When set, GET /schedules answers with this status instead of data. */
  schedulesStatus?: number;
}

/** A healthy tenant: one display WITH a playlist, so nothing is detected. */
function healthyFixture(): Fixture {
  return {
    schedules: [],
    displays: [{ id: 'display-1', name: 'Lobby', currentPlaylistId: 'pl-1' }],
    playlists: [{ id: 'pl-1', name: 'Main', items: [{ contentId: 'c-1' }] }],
  };
}

function startServer(fixture: Fixture): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const page = Number(url.searchParams.get('page') ?? '1');

    const json = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json', connection: 'close' });
      res.end(JSON.stringify(body));
    };

    if (path === '/api/v1/auth/login') {
      return json(200, { success: true, data: { accessToken: 'test-token' } });
    }
    if (path === '/api/v1/auth/logout') {
      return json(201, { success: true, data: {} });
    }

    // `getAll` walks 100 at a time and stops when a page comes back short.
    const paged = (all: Record<string, unknown>[]): void => {
      const slice = all.slice((page - 1) * 100, page * 100);
      json(200, { success: true, data: { items: slice } });
    };

    if (path === '/api/v1/schedules') {
      if (fixture.schedulesStatus) {
        return json(fixture.schedulesStatus, { success: false, message: 'boom' });
      }
      return paged(fixture.schedules);
    }
    if (path === '/api/v1/displays') return paged(fixture.displays);
    if (path === '/api/v1/playlists') return paged(fixture.playlists);

    // PATCH /schedules/:id — auto-fix target.
    if (path.startsWith('/api/v1/schedules/')) {
      return json(200, { success: true, data: { id: path.split('/').pop() } });
    }

    return json(200, { success: true, data: {} });
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

function setupTmpRoot(seedIncidents: Incident[] = []): string {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-sched-res-'));
  cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), { recursive: true });
  mkdirSync(join(tmpRoot, 'logs'), { recursive: true });

  const state: OpsState = {
    systemStatus: seedIncidents.length > 0 ? 'DEGRADED' : 'HEALTHY',
    lastUpdated: new Date().toISOString(),
    lastRun: {},
    incidents: seedIncidents,
    recentRemediations: [],
    agentResults: {},
  };
  writeFileSync(join(tmpRoot, 'logs', 'ops-state.json'), JSON.stringify(state, null, 2));
  return tmpRoot;
}

function runAgent(
  tmpRoot: string,
  baseUrl: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', join(tmpRoot, 'scripts', 'ops', 'schedule-doctor.ts')],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        VALIDATOR_BASE_URL: baseUrl,
        OPS_EMAIL: 'ops@example.test',
        OPS_PASSWORD: 'not-a-real-password',
        // Alerting must stay inert — these tests are about state, not delivery.
        SLACK_WEBHOOK_URL: '',
        SMTP_HOST: '',
        SMTP_TO: '',
        OPS_ALERT_EMAIL: '',
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
    const timer = setTimeout(() => child.kill(), 30_000);
    child.on('exit', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function readState(tmpRoot: string): OpsState {
  return JSON.parse(readFileSync(join(tmpRoot, 'logs', 'ops-state.json'), 'utf8')) as OpsState;
}

function seedIncident(over: Partial<Incident> = {}): Incident {
  return {
    id: COVERAGE_GAP_ID,
    agent: 'schedule-doctor',
    type: 'coverage_gap',
    severity: 'warning',
    target: 'display',
    targetId: 'display-1',
    detected: new Date(Date.now() - 7_200_000).toISOString(),
    message: 'Display "Lobby" has no currentPlaylistId and no active schedule',
    remediation: 'Manual: assign a playlist or create a schedule for this display',
    status: 'open',
    attempts: 0,
    ...over,
  } as Incident;
}

async function withServer(fixture: Fixture, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const { server, baseUrl } = await startServer(fixture);
  try {
    await fn(baseUrl);
  } finally {
    server.close();
  }
}

// ─── (a) POSITIVE: a complete healthy run clears what it no longer sees ──────

test('a complete run resolves a coverage_gap whose display now has a playlist', async () => {
  // The display that raised the incident now carries currentPlaylistId, so
  // check 4 does not re-raise it. Before this change nothing could ever clear
  // it — coverage_gap has no auto-fix path.
  await withServer(healthyFixture(), async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      const incident = state.incidents.find(i => i.id === COVERAGE_GAP_ID);
      assert.ok(incident, 'the incident must still be tracked, not deleted');
      assert.equal(incident.status, 'resolved');
      assert.ok(incident.resolvedAt, 'resolvedAt must be stamped');
      assert.equal(state.systemStatus, 'HEALTHY', 'clearing it must un-pin systemStatus');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── (b) NEGATIVE: a fetch failure resolves nothing and stamps no lastRun ────

test('NEGATIVE: a failed fetch leaves prior incidents OPEN and records no run', async () => {
  // The early return at the fetch failure is the guard. If it were removed and
  // the run continued with empty lists, EVERY prior incident would look "not
  // re-raised" and the agent would report the whole tenant recovered — off a
  // run that read nothing at all.
  const fixture = { ...healthyFixture(), schedulesStatus: 500 };
  const seeded = [
    seedIncident(),
    seedIncident({
      id: ORPHAN_ID,
      type: 'orphan_schedule',
      severity: 'critical',
      target: 'schedule',
      targetId: 'sched-orphan',
      message: 'Schedule "Ghost" targets nonexistent display display-gone',
    }),
  ];

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot(seeded);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 2, `fetch failure is fatal\n${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      for (const id of [COVERAGE_GAP_ID, ORPHAN_ID]) {
        const incident = state.incidents.find(i => i.id === id);
        assert.ok(incident, `${id} must still be present`);
        assert.equal(incident.status, 'open', `${id} must NOT be cleared by a blind run`);
        assert.equal(incident.resolvedAt, undefined);
      }
      assert.equal(
        state.lastRun['schedule-doctor'],
        undefined,
        'no lastRun stamp — ops-watchdog must see the gap and alert on the stalled agent',
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── (c) NEGATIVE: truncation resolves nothing AND is announced ──────────────

test('NEGATIVE: a truncated scan resolves nothing and raises scan-truncated', async () => {
  // 500 schedules is exactly the page-walk cap, so the list may be cut short:
  // an unseen entity cannot be evidence that its incident cleared. Silence here
  // would put a large tenant into a permanent no-resolution regime with no
  // signal saying why, so the withheld resolution must be LOUD.
  const fixture = healthyFixture();
  fixture.schedules = Array.from({ length: 500 }, (_, i) => ({
    id: `sched-${i}`,
    name: `Schedule ${i}`,
    isActive: false,
  }));

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const state = readState(tmpRoot);
      const incident = state.incidents.find(i => i.id === COVERAGE_GAP_ID);
      assert.ok(incident, 'the incident must still be present');
      assert.equal(
        incident.status,
        'open',
        'a partial scan must not clear an incident it could not verify',
      );

      const truncated = state.incidents.find(i => i.id === TRUNCATED_ID);
      assert.ok(truncated, `expected a ${TRUNCATED_ID} incident\n${result.stdout}`);
      assert.equal(truncated.status, 'open');
      assert.equal(truncated.severity, 'warning');
      assert.match(truncated.message, /page-walk cap/i);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── scan-truncated must itself be clearable ─────────────────────────────────

test('a later complete run clears a stale scan-truncated incident', async () => {
  // Otherwise the loudness above becomes its own never-clearing incident —
  // the exact defect class this change removes.
  await withServer(healthyFixture(), async baseUrl => {
    const tmpRoot = setupTmpRoot([
      seedIncident({
        id: TRUNCATED_ID,
        type: 'scan-truncated',
        target: 'schedules',
        targetId: 'entity-lists',
        message: 'Schedule audit could not see the whole tenant',
      }),
    ]);
    try {
      await runAgent(tmpRoot, baseUrl);
      const incident = readState(tmpRoot).incidents.find(i => i.id === TRUNCATED_ID);
      assert.ok(incident);
      assert.equal(incident.status, 'resolved');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── An agent must not clear another agent's incidents ───────────────────────

test('a healthy run leaves another agent incidents untouched', async () => {
  await withServer(healthyFixture(), async baseUrl => {
    const foreign = seedIncident({
      id: 'fleet-manager:display_offline:display-1',
      agent: 'fleet-manager',
      type: 'display_offline',
    });
    const tmpRoot = setupTmpRoot([foreign]);
    try {
      await runAgent(tmpRoot, baseUrl);
      const incident = readState(tmpRoot).incidents.find(i => i.id === foreign.id);
      assert.ok(incident);
      assert.equal(incident.status, 'open', 'agents must not clear each other incidents');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

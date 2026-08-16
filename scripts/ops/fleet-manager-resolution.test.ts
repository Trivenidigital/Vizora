/**
 * fleet-manager — incident clearing must be earned by a complete run.
 *
 * The agent fetched through `api.getAll`, which is `getAllScan(...).items` with
 * the `complete` verdict discarded, and then swept with the non-coverage-aware
 * `resolveNotReraised`. Past the 500-entity page-walk cap the displays the walk
 * never retrieved were never examined — yet every prior incident held against
 * them was resolved on the strength of not being re-raised. A screen dark for a
 * week read as recovered because the list stopped short of it, and that includes
 * `display_offline_persistent` and `cluster_offline`, the two critical types.
 *
 * The NEGATIVE cases below are the load-bearing ones, but the positive case is
 * not decoration: over-correcting into "nothing ever resolves" recreates the
 * never-clearing incident #327 existed to fix.
 *
 * Spawn-harness pattern from schedule-doctor-resolution.test.ts: the real agent
 * runs as a child process against a fake API and a seeded ops-state.json.
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

const OFFLINE_ID = 'fleet-manager:display_offline:display-1';
const PERSISTENT_ID = 'fleet-manager:display_offline_persistent:display-1';
const TRUNCATED_ID = 'fleet-manager:scan-truncated:entity-lists';

/** Far enough in the past to trip the 15-minute offline threshold. */
const LONG_AGO = new Date(Date.now() - 40 * 60_000).toISOString();

interface Fixture {
  displays: Record<string, unknown>[];
  schedules: Record<string, unknown>[];
  /** When set, GET /displays answers with this status instead of data. */
  displaysStatus?: number;
  /** When set, POST /displays/ping answers with this status. */
  pingStatus?: number;
  /**
   * Response shape for the list endpoints:
   *   'items'     — { items: [...] }, no total (the cap-proxy fallback path)
   *   'paginated' — { data: [...], meta: { total } }, the real API shape
   */
  shape?: 'items' | 'paginated';
}

/**
 * A healthy tenant: one display seen just now, WITH a playlist, so no check
 * fires. Kept to a single display so the 3+ threshold on cluster_offline cannot
 * be met by accident.
 */
function healthyFixture(): Fixture {
  return {
    displays: [
      {
        id: 'display-1',
        name: 'Lobby',
        status: 'online',
        organizationId: 'org-1',
        currentPlaylistId: 'pl-1',
        lastHeartbeat: new Date().toISOString(),
      },
    ],
    schedules: [],
  };
}

/** 501 healthy displays — one past the 500-entity page-walk cap. */
function oversizedFixture(): Fixture {
  return {
    displays: Array.from({ length: 501 }, (_, i) => ({
      id: `display-${i}`,
      name: `Screen ${i}`,
      status: 'online',
      organizationId: 'org-1',
      currentPlaylistId: 'pl-1',
      lastHeartbeat: new Date().toISOString(),
    })),
    schedules: [],
    shape: 'paginated',
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

    // The page walk requests 100 at a time and stops when a page comes back short.
    const paged = (all: Record<string, unknown>[]): void => {
      const slice = all.slice((page - 1) * 100, page * 100);
      if (fixture.shape === 'paginated') {
        return json(200, {
          success: true,
          data: {
            data: slice,
            meta: { page, limit: 100, total: all.length, totalPages: Math.ceil(all.length / 100) },
          },
        });
      }
      json(200, { success: true, data: { items: slice } });
    };

    // Ping is a REMEDIATION, not an observation — its failure must not read as
    // "this display was never examined".
    if (path === '/api/v1/displays/ping') {
      if (fixture.pingStatus) return json(fixture.pingStatus, { success: false, message: 'boom' });
      return json(200, { success: true, data: { ok: true } });
    }

    if (path === '/api/v1/displays') {
      if (fixture.displaysStatus) {
        return json(fixture.displaysStatus, { success: false, message: 'boom' });
      }
      return paged(fixture.displays);
    }
    if (path === '/api/v1/schedules') return paged(fixture.schedules);

    // PATCH /displays/:id — the error-state auto-reset target.
    if (path.startsWith('/api/v1/displays/')) {
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
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-fleet-res-'));
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
    ['--import', 'tsx', join(tmpRoot, 'scripts', 'ops', 'fleet-manager.ts')],
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
    const timer = setTimeout(() => child.kill(), 60_000);
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
    id: OFFLINE_ID,
    agent: 'fleet-manager',
    type: 'display_offline',
    severity: 'warning',
    target: 'display',
    targetId: 'display-1',
    detected: new Date(Date.now() - 7_200_000).toISOString(),
    message: 'Display "Lobby" offline for 40min — ping sent, awaiting reconnect',
    remediation: 'POST /displays/ping — reconnect attempt',
    status: 'open',
    attempts: 3,
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

// ─── (1) POSITIVE: a complete run clears what it no longer sees ──────────────

test('a complete run resolves display_offline for a display that is back online', async () => {
  // Guards against over-correcting into "nothing ever resolves": gating on
  // coverage must not cost the recovery path #327 added.
  await withServer(healthyFixture(), async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      const incident = state.incidents.find(i => i.id === OFFLINE_ID);
      assert.ok(incident, 'the incident must still be tracked, not deleted');
      assert.equal(incident.status, 'resolved');
      assert.ok(incident.resolvedAt, 'resolvedAt must be stamped');
      assert.equal(state.systemStatus, 'HEALTHY', 'clearing it must un-pin systemStatus');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

test('a complete run also clears an ESCALATED display_offline_persistent', async () => {
  // That type is RAISED as `escalated`, so it is the one an `open`-only sweep
  // could never clear — the regression #327 fixed. Coverage-gating the sweep
  // must not quietly reintroduce it.
  await withServer(healthyFixture(), async baseUrl => {
    const tmpRoot = setupTmpRoot([
      seedIncident({
        id: PERSISTENT_ID,
        type: 'display_offline_persistent',
        severity: 'critical',
        status: 'escalated',
        message: 'Display "Lobby" has been offline for 4000 minutes',
      }),
    ]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      const state = readState(tmpRoot);
      const incident = state.incidents.find(i => i.id === PERSISTENT_ID);
      assert.ok(incident);
      assert.equal(incident.status, 'resolved', `${result.stdout}`);
      assert.equal(state.systemStatus, 'HEALTHY', 'a recovered screen must un-pin CRITICAL');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── (2) NEGATIVE: truncation resolves nothing AND is announced ──────────────

test('NEGATIVE: a truncated scan leaves a beyond-the-cap incident OPEN', async () => {
  // 501 displays, walk retrieves 500, `meta.total` says 501. display-500 is the
  // one the walk never reached — it was never examined, so it cannot be
  // evidence that its own incident cleared. This is the whole defect: with
  // `getAll` the verdict was discarded and this incident was resolved.
  const beyondCap = seedIncident({
    id: 'fleet-manager:display_offline_persistent:display-500',
    type: 'display_offline_persistent',
    severity: 'critical',
    targetId: 'display-500',
    status: 'escalated',
    message: 'Display "Screen 500" has been offline for 9000 minutes',
  });

  await withServer(oversizedFixture(), async baseUrl => {
    const tmpRoot = setupTmpRoot([beyondCap]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const state = readState(tmpRoot);
      const incident = state.incidents.find(i => i.id === beyondCap.id);
      assert.ok(incident, 'the incident must still be present');
      assert.equal(
        incident.status,
        'escalated',
        'a partial scan must not clear an incident for a display it never retrieved',
      );
      assert.equal(incident.resolvedAt, undefined);

      const truncated = state.incidents.find(i => i.id === TRUNCATED_ID);
      assert.ok(truncated, `expected a ${TRUNCATED_ID} incident\n${result.stdout}`);
      assert.equal(truncated.status, 'open');
      // INFO, not warning: only a code change can clear this, so counting it as
      // a failure would pin a legitimately-large tenant at exit 1 forever.
      assert.equal(truncated.severity, 'info');
      assert.match(truncated.message, /page-walk cap/i);
      assert.doesNotMatch(
        truncated.remediation,
        /raise the (page-walk |getAll )?cap(?!\.)/i,
        'raising the cap re-arms the identical defect at the new number',
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

test('scan-truncated ALONE leaves the platform HEALTHY and the run green', async () => {
  // The exit-code half of the info-severity decision. A tenant that legitimately
  // exceeds the cap must not sit at exit 1 / DEGRADED on every run forever over
  // a condition only a code change can clear.
  await withServer(oversizedFixture(), async baseUrl => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      const state = readState(tmpRoot);

      assert.ok(state.incidents.find(i => i.id === TRUNCATED_ID), 'the finding is still recorded');
      assert.equal(result.code, 0, `an incomplete scan is not by itself a failed run\n${result.stdout}`);
      assert.equal(state.systemStatus, 'HEALTHY', 'an info finding must not degrade the platform');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

test('a later complete run clears a stale scan-truncated incident', async () => {
  // Otherwise the loudness above becomes its own never-clearing incident — the
  // exact defect class this change removes.
  await withServer(healthyFixture(), async baseUrl => {
    const tmpRoot = setupTmpRoot([
      seedIncident({
        id: TRUNCATED_ID,
        type: 'scan-truncated',
        severity: 'info',
        targetId: 'entity-lists',
        message: 'Fleet check could not see the whole tenant',
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

// ─── (3) NEGATIVE: the #327 fetch-failure guard must not regress ─────────────

test('NEGATIVE: a failed fetch leaves prior incidents OPEN and records no run', async () => {
  // The early return at the fetch failure is a DIFFERENT guard from the
  // truncation gate added here — the fetch either throws (this test) or
  // succeeds while stopping short (the truncation tests above). If the early
  // return were removed and the run continued with empty lists, every prior
  // incident would look "not re-raised" and the agent would report the whole
  // fleet recovered off a run that read nothing at all.
  const fixture = { ...healthyFixture(), displaysStatus: 500 };
  const seeded = [
    seedIncident(),
    seedIncident({
      id: PERSISTENT_ID,
      type: 'display_offline_persistent',
      severity: 'critical',
      status: 'escalated',
    }),
  ];

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot(seeded);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 2, `fetch failure is fatal\n${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      assert.equal(state.incidents.find(i => i.id === OFFLINE_ID)?.status, 'open');
      assert.equal(state.incidents.find(i => i.id === PERSISTENT_ID)?.status, 'escalated');
      for (const id of [OFFLINE_ID, PERSISTENT_ID]) {
        assert.equal(state.incidents.find(i => i.id === id)?.resolvedAt, undefined);
      }
      assert.equal(
        state.lastRun['fleet-manager'],
        undefined,
        'no lastRun stamp — ops-watchdog must see the gap and alert on the stalled agent',
      );
      assert.equal(
        state.incidents.find(i => i.id === TRUNCATED_ID),
        undefined,
        'a fetch that threw is not a truncated scan — it files no finding at all',
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── (4) A failed REMEDIATION is not an unexamined item ──────────────────────

test('a failed ping still re-raises the incident, so nothing clears it by silence', async () => {
  // content-lifecycle needed a per-ITEM unexamined set (K25) because a candidate
  // could be skipped mid-run without evidence. fleet-manager has no such path:
  // every predicate reads fields already on the fetched display, so the display
  // is examined before any network call. The ping is a remediation attempt AFTER
  // the verdict, and its failure raises the incident with `error` set rather
  // than dropping the display. This test pins that — it is the reason a per-item
  // set is unnecessary here rather than merely omitted.
  const fixture: Fixture = {
    displays: [
      {
        id: 'display-1',
        name: 'Lobby',
        organizationId: 'org-1',
        currentPlaylistId: 'pl-1',
        lastHeartbeat: LONG_AGO,
      },
    ],
    schedules: [],
    pingStatus: 500,
  };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const state = readState(tmpRoot);
      const incident = state.incidents.find(i => i.id === OFFLINE_ID);
      assert.ok(incident, 'the incident must survive a failed remediation');
      assert.equal(
        incident.status,
        'open',
        'a display whose ping failed was still EXAMINED — its incident stays open',
      );
      assert.equal(incident.error, 'Ping request failed');
      assert.equal(result.code, 1, `an unfixed open finding is a failing run\n${result.stdout}`);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── Don't over-block ────────────────────────────────────────────────────────

test('a genuinely empty tenant (meta.total=0) is a COMPLETE scan and resolves normally', async () => {
  // Zero entities with the server agreeing there are zero is a complete
  // observation, not a truncated one.
  const fixture: Fixture = { displays: [], schedules: [], shape: 'paginated' };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      assert.equal(
        state.incidents.find(i => i.id === OFFLINE_ID)?.status,
        'resolved',
        'the display is gone and the server confirms the collection is empty',
      );
      assert.equal(
        state.incidents.find(i => i.id === TRUNCATED_ID),
        undefined,
        'an empty-but-complete scan must not file scan-truncated',
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

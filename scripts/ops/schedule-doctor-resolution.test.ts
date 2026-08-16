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
 * K24 adds the per-ITEM axis. Completeness is a per-RUN verdict — it says every
 * entity was RETRIEVED, never that every retrieved entity was EVALUATED. Two
 * skips inside the checks reach no verdict at all (an unparseable `endDate`, an
 * undeterminable playlist item count) and used to clear their own incidents by
 * simple non-re-raise. The four K24 tests pin BOTH directions: unexamined stays
 * open, examined-and-fine still resolves. The second half is not optional —
 * without it the fix degenerates into "nothing ever clears".
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

// ── K24 per-ITEM ids ────────────────────────────────────────────────────────
const EMPTY_PLAYLIST_ID = 'schedule-doctor:empty_playlist_schedule:sched-empty';
const PAST_END_ID = 'schedule-doctor:past_end_schedule:sched-bad-date';
const OK_PAST_END_ID = 'schedule-doctor:past_end_schedule:sched-ok';
const OK_EMPTY_PLAYLIST_ID = 'schedule-doctor:empty_playlist_schedule:sched-ok';
const DISABLED_GAP_ID = 'schedule-doctor:coverage_gap:display-disabled';

interface Fixture {
  schedules: Record<string, unknown>[];
  displays: Record<string, unknown>[];
  playlists: Record<string, unknown>[];
  /** When set, GET /schedules answers with this status instead of data. */
  schedulesStatus?: number;
  /**
   * Response shape for the list endpoints:
   *   'items'        — { items: [...] }, no total (the cap-proxy fallback path)
   *   'paginated'    — { data: [...], meta: { total } }, the real API shape
   *   'unrecognized' — neither, which must now THROW rather than read as empty
   */
  shape?: 'items' | 'paginated' | 'unrecognized';
  /** Override the server-reported total for /schedules under 'paginated'. */
  scheduleTotal?: number;
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

    // The page walk requests 100 at a time and stops when a page comes back short.
    const paged = (all: Record<string, unknown>[], total?: number): void => {
      const slice = all.slice((page - 1) * 100, page * 100);
      if (fixture.shape === 'unrecognized') {
        // Neither an array, nor { items }, nor { data } — a response-shape
        // drift. This used to yield an empty list reported as success.
        return json(200, { success: true, data: { results: slice, count: slice.length } });
      }
      if (fixture.shape === 'paginated') {
        const reported = total ?? all.length;
        return json(200, {
          success: true,
          data: {
            data: slice,
            meta: { page, limit: 100, total: reported, totalPages: Math.ceil(reported / 100) },
          },
        });
      }
      json(200, { success: true, data: { items: slice } });
    };

    if (path === '/api/v1/schedules') {
      if (fixture.schedulesStatus) {
        return json(fixture.schedulesStatus, { success: false, message: 'boom' });
      }
      return paged(fixture.schedules, fixture.scheduleTotal);
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
      // INFO, not warning: only a code change can clear this, so counting it as
      // a failure would pin a legitimately-large tenant at exit 1 / DEGRADED on
      // every run forever.
      assert.equal(truncated.severity, 'info');
      assert.match(truncated.message, /page-walk cap/i);
      assert.equal(result.code, 0, 'an incomplete scan is not by itself a failed run');
      // NB: systemStatus is DEGRADED here, but from the SEEDED warning that
      // correctly stayed open — not from the info incident. The test below
      // isolates that.
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

test('scan-truncated ALONE leaves the platform HEALTHY and the run green', async () => {
  // A tenant that legitimately exceeds the cap must not sit at exit 1 /
  // DEGRADED and alert on every run forever over a condition only a code
  // change can clear — the alert-fatigue pattern the db-maintenance exit-code
  // rule exists to prevent. No seeded incidents, so scan-truncated is the only
  // thing in state.
  const fixture = healthyFixture();
  fixture.schedules = Array.from({ length: 500 }, (_, i) => ({
    id: `sched-${i}`,
    name: `Schedule ${i}`,
    isActive: false,
  }));

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      const state = readState(tmpRoot);

      assert.ok(state.incidents.find(i => i.id === TRUNCATED_ID), 'the finding is still recorded');
      assert.equal(result.code, 0, `${result.stdout}`);
      assert.equal(state.systemStatus, 'HEALTHY', 'an info finding must not degrade the platform');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── Completeness gate: the LOWER bound, not just the cap ────────────────────

test('NEGATIVE: an unrecognized list shape exits 2 and resolves nothing', async () => {
  // `getAll` used to `break` on an unrecognized shape, returning [] as a
  // SUCCESS. Zero items passes any `length < cap` completeness proxy, so a
  // response-shape drift would have made the agent resolve EVERY incident,
  // report HEALTHY and exit 0 — in silence. Pre-PR the agent resolved nothing,
  // so the sweep is what creates that harm; the throw is what closes it.
  const fixture: Fixture = { ...healthyFixture(), shape: 'unrecognized' };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 2, `${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      const incident = state.incidents.find(i => i.id === COVERAGE_GAP_ID);
      assert.ok(incident, 'the incident must survive');
      assert.equal(incident.status, 'open', 'an empty list from a shape drift must clear nothing');
      assert.equal(state.lastRun['schedule-doctor'], undefined, 'no run recorded');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

test('a genuinely empty tenant (meta.total=0) is a COMPLETE scan and resolves normally', async () => {
  // Don't over-block: zero entities with the server agreeing there are zero is
  // a complete observation, not a truncated one.
  const fixture: Fixture = {
    schedules: [],
    displays: [],
    playlists: [],
    shape: 'paginated',
  };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      assert.equal(
        state.incidents.find(i => i.id === COVERAGE_GAP_ID)?.status,
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

test('NEGATIVE: a short walk (items < meta.total) resolves nothing and files scan-truncated', async () => {
  // The exactness the cap proxy cannot give. Server reports 99 schedules but
  // the walk retrieved 1 — a server that did not honour the requested page
  // size, or a walk cut short. Well under MAX_ENTITIES, so a cap comparison
  // would have called this complete and resolved on unseen data.
  const fixture: Fixture = {
    ...healthyFixture(),
    schedules: [{ id: 'sched-1', name: 'One', isActive: false }],
    shape: 'paginated',
    scheduleTotal: 99,
  };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const state = readState(tmpRoot);
      assert.equal(
        state.incidents.find(i => i.id === COVERAGE_GAP_ID)?.status,
        'open',
        'a walk that saw 1 of 99 must not clear anything',
      );

      const truncated = state.incidents.find(i => i.id === TRUNCATED_ID);
      assert.ok(truncated, `expected scan-truncated\n${result.stdout}`);
      assert.equal(truncated.severity, 'info');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── Resolutions must never green a red run ──────────────────────────────────

test('a run with an open finding exits 1 even while it resolves a stale incident', async () => {
  // display-2 has no playlist and no schedule -> coverage_gap raised open.
  // display-1's stale incident resolves in the same run. The exit code is
  // pinned to detection, so the resolution cannot mask the live finding.
  const fixture: Fixture = {
    schedules: [],
    displays: [
      { id: 'display-1', name: 'Lobby', currentPlaylistId: 'pl-1' },
      { id: 'display-2', name: 'Cafe' },
    ],
    playlists: [{ id: 'pl-1', name: 'Main', items: [{ contentId: 'c-1' }] }],
  };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([seedIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const state = readState(tmpRoot);
      assert.equal(
        state.incidents.find(i => i.id === COVERAGE_GAP_ID)?.status,
        'resolved',
        'display-1 recovered',
      );
      assert.equal(
        state.incidents.find(i => i.id === 'schedule-doctor:coverage_gap:display-2')?.status,
        'open',
        'display-2 is a live finding',
      );
      assert.equal(
        result.code,
        1,
        `resolutions must not green a run holding an open finding\n${result.stdout}`,
      );
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

// ─── K24: a schedule the run reached NO VERDICT on cannot clear its own ──────
//
// `scanComplete` is per-RUN and says every entity was retrieved. These two
// skips happen INSIDE a check that ran, on a schedule that WAS retrieved, and
// still produce no answer about it — so "not re-raised" means "nobody looked",
// not "recovered". The K25 rule: fold the id into `currentIncidentIds`.

test('K24: an UNKNOWN playlist item count leaves empty_playlist_schedule OPEN', async () => {
  // `GET /playlists` normally hydrates `items` and derives `itemCount`, so the
  // unknown branch is unreachable today — but its failure direction is silent
  // clearing, and the old `?? -1` then `itemCount !== 0` guard treated an
  // undeterminable count exactly like a playlist full of content. Slimming this
  // list endpoint (dropping the heavy `items` array) is the obvious future
  // optimization and is precisely what would arm it.
  const fixture: Fixture = {
    schedules: [
      {
        id: 'sched-empty',
        name: 'Foyer Loop',
        isActive: true,
        displayId: 'display-1',
        playlistId: 'pl-unknown',
      },
    ],
    displays: [{ id: 'display-1', name: 'Lobby', currentPlaylistId: 'pl-unknown' }],
    // Neither `itemCount` nor `items` — the count cannot be determined.
    playlists: [{ id: 'pl-unknown', name: 'Mystery' }],
  };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([
      seedIncident({
        id: EMPTY_PLAYLIST_ID,
        type: 'empty_playlist_schedule',
        target: 'schedule',
        targetId: 'sched-empty',
        message: 'Active schedule "Foyer Loop" references playlist "Mystery" with 0 items',
      }),
    ]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const incident = readState(tmpRoot).incidents.find(i => i.id === EMPTY_PLAYLIST_ID);
      assert.ok(incident, 'the incident must still be tracked');
      assert.equal(
        incident.status,
        'open',
        `a schedule whose playlist item count could not be read must not clear its own finding\n${result.stdout}`,
      );
      assert.equal(incident.resolvedAt, undefined);
      // Visibility (§12a): a withheld resolution that says nothing is the same
      // class of invisible failure as the clearing it prevents.
      assert.match(result.stdout, /skipped WITHOUT EVIDENCE/);
      assert.match(result.stdout, /unknown playlist item count: 1/);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

test('K24: a malformed endDate leaves past_end_schedule OPEN', async () => {
  // The comparison that decides past-end never produced an answer. A bare
  // `continue` made that ignorance read as recovery to the sweep.
  const fixture: Fixture = {
    schedules: [
      {
        id: 'sched-bad-date',
        name: 'Holiday Hours',
        isActive: true,
        displayId: 'display-1',
        endDate: 'not-a-date',
      },
    ],
    displays: [{ id: 'display-1', name: 'Lobby', currentPlaylistId: 'pl-1' }],
    playlists: [{ id: 'pl-1', name: 'Main', items: [{ contentId: 'c-1' }] }],
  };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([
      seedIncident({
        id: PAST_END_ID,
        type: 'past_end_schedule',
        target: 'schedule',
        targetId: 'sched-bad-date',
        message: 'Schedule "Holiday Hours" is active but ended 2026-01-01',
      }),
    ]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const incident = readState(tmpRoot).incidents.find(i => i.id === PAST_END_ID);
      assert.ok(incident, 'the incident must still be tracked');
      assert.equal(
        incident.status,
        'open',
        `a schedule whose endDate would not parse must not clear its own finding\n${result.stdout}`,
      );
      assert.equal(incident.resolvedAt, undefined);
      assert.match(result.stdout, /unparseable endDate: 1/);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── K24 OVER-CORRECTION GUARD — the other half of the rule ──────────────────

test('K24: skips that CARRY evidence still resolve their incidents', async () => {
  // Without this, the fix degenerates into "nothing ever resolves" — which is
  // the exact defect the resolution sweep was added to remove, reintroduced
  // from the opposite side. Three evidence-bearing skips in one run:
  //
  //   1. `sched-ok` has a VALID endDate in the future — check 1 evaluated it
  //      and found it fine, so `past_end_schedule:sched-ok` must clear.
  //   2. `pl-1` reports content — check 3 evaluated it, so
  //      `empty_playlist_schedule:sched-ok` must clear.
  //   3. `display-disabled` is operator-disabled and filtered out before check
  //      4 (#259). That drop is deliberate and evidence-bearing, so
  //      `coverage_gap:display-disabled` must clear.
  //
  // None of these is a blind spot; each is a real answer about the item.
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const fixture: Fixture = {
    schedules: [
      {
        id: 'sched-ok',
        name: 'Daytime',
        isActive: true,
        displayId: 'display-1',
        playlistId: 'pl-1',
        endDate: future,
      },
    ],
    displays: [
      { id: 'display-1', name: 'Lobby', currentPlaylistId: 'pl-1' },
      { id: 'display-disabled', name: 'Storeroom', isDisabled: true },
    ],
    playlists: [{ id: 'pl-1', name: 'Main', items: [{ contentId: 'c-1' }] }],
  };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([
      seedIncident({
        id: OK_PAST_END_ID,
        type: 'past_end_schedule',
        target: 'schedule',
        targetId: 'sched-ok',
        message: 'Schedule "Daytime" is active but ended',
      }),
      seedIncident({
        id: OK_EMPTY_PLAYLIST_ID,
        type: 'empty_playlist_schedule',
        target: 'schedule',
        targetId: 'sched-ok',
        message: 'Active schedule "Daytime" references playlist "Main" with 0 items',
      }),
      seedIncident({
        id: DISABLED_GAP_ID,
        targetId: 'display-disabled',
        message: 'Display "Storeroom" has no currentPlaylistId and no active schedule',
      }),
    ]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      for (const id of [OK_PAST_END_ID, OK_EMPTY_PLAYLIST_ID, DISABLED_GAP_ID]) {
        const incident = state.incidents.find(i => i.id === id);
        assert.ok(incident, `${id} must still be tracked`);
        assert.equal(
          incident.status,
          'resolved',
          `${id} was skipped for a REASON — treating every skip as blind makes this type accumulate forever\n${result.stdout}`,
        );
      }
      assert.doesNotMatch(
        result.stdout,
        /skipped WITHOUT EVIDENCE/,
        'nothing in this run was a blind spot',
      );
      assert.equal(state.systemStatus, 'HEALTHY', 'clearing all three must un-pin systemStatus');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

test('K24: a playlist that now reports content resolves empty_playlist_schedule', async () => {
  // The direct recovery counterpart to the unknown-count test above: same
  // schedule, same playlist id, same incident id — the ONLY difference is that
  // the playlist now carries items. This is the regression guard that keeps the
  // fix from being "hold everything open".
  const fixture: Fixture = {
    schedules: [
      {
        id: 'sched-empty',
        name: 'Foyer Loop',
        isActive: true,
        displayId: 'display-1',
        playlistId: 'pl-unknown',
      },
    ],
    displays: [{ id: 'display-1', name: 'Lobby', currentPlaylistId: 'pl-unknown' }],
    playlists: [{ id: 'pl-unknown', name: 'Mystery', items: [{ contentId: 'c-1' }] }],
  };

  await withServer(fixture, async baseUrl => {
    const tmpRoot = setupTmpRoot([
      seedIncident({
        id: EMPTY_PLAYLIST_ID,
        type: 'empty_playlist_schedule',
        target: 'schedule',
        targetId: 'sched-empty',
        message: 'Active schedule "Foyer Loop" references playlist "Mystery" with 0 items',
      }),
    ]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);

      const incident = readState(tmpRoot).incidents.find(i => i.id === EMPTY_PLAYLIST_ID);
      assert.ok(incident);
      assert.equal(incident.status, 'resolved', 'the operator added content — this must clear');
      assert.ok(incident.resolvedAt, 'resolvedAt must be stamped');
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

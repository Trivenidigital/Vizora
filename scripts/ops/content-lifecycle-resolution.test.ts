/**
 * content-lifecycle — incident clearing must be scoped to the checks that ran.
 *
 * The clearest defect this fixes: `storage_high` raised at 91% could NEVER
 * clear. The healthy branch of `checkStorageUsage` pushes no incident at all,
 * so every later run at 40% left the critical incident untouched and ops-state
 * pinned at CRITICAL over storage that had recovered weeks earlier.
 *
 * This agent degrades in PARTS, which is why one blanket sweep is wrong here
 * and three scope keys are right: a run where `/health` throws has still
 * completed its content checks. Sweeping everything would report storage
 * recovered on the strength of a run that could not read storage. The MIXED
 * case below is the one that pins that distinction — one run, one state read,
 * content incidents cleared while the storage incident stays open.
 *
 * Spawn-harness pattern from tv-download-surface.test.ts.
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

const STORAGE_HIGH_ID = 'content-lifecycle:storage_high:system';
const STORAGE_FAILED_ID = 'content-lifecycle:storage_check_failed:system';
const EXPIRED_ID = 'content-lifecycle:expired_content:content-old';

interface Fixture {
  content: Record<string, unknown>[];
  playlists: Record<string, unknown>[];
  /** null → `/health` answers 500. number → that usage percentage. */
  storagePct: number | null;
  /** 'items' (default) or 'unrecognized' — neither array, { items } nor { data }. */
  shape?: 'items' | 'unrecognized';
  /**
   * Fires immediately before a `GET /content/:id` is answered, with the live
   * fixture. Lets a test land a playlist edit BETWEEN the list walk and the
   * per-item confirmation — the concurrency window the confirmation closes.
   */
  onContentDetail?: (id: string, f: Fixture) => void;
  /** Content ids whose `GET /content/:id` answers 500. */
  failDetail?: string[];
}

/** One request the agent made, as the server saw it. */
interface Recorded {
  method: string;
  path: string;
  query: Record<string, string>;
}

interface Harness {
  server: Server;
  baseUrl: string;
  /** Content ids POSTed to `/content/:id/archive`, in the order they were written. */
  archived: string[];
  /** Every request the agent issued. */
  requests: Recorded[];
}

/**
 * Exactly the keys `CONTENT_LIST_SELECT` projects, plus the `title` the response
 * mapper adds (middleware/src/modules/content/content-list-select.ts).
 *
 * The harness projects the LIST through this on purpose. `metadata`,
 * `expiresAt`, `replacementContentId` and `isGlobal` are NOT here, because the
 * real list endpoint does not send them — and a harness that leaked them would
 * let the GAP-1 / GAP-2 / global-template cases pass without the agent ever
 * making the per-item read that is the actual fix.
 */
const CONTENT_LIST_KEYS = [
  'id',
  'organizationId',
  'name',
  'type',
  'thumbnail',
  'duration',
  'fileSize',
  'status',
  'folderId',
  'createdAt',
  'updatedAt',
  'tags',
];

function projectListItem(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CONTENT_LIST_KEYS) if (k in c) out[k] = c[k];
  out.title = c.name;
  return out;
}

function fixture(over: Partial<Fixture> = {}): Fixture {
  return { content: [], playlists: [], storagePct: 40, ...over };
}

function startServer(f: Fixture): Promise<Harness> {
  const archived: string[] = [];
  const requests: Recorded[] = [];

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const page = Number(url.searchParams.get('page') ?? '1');
    requests.push({
      method: req.method ?? 'GET',
      path,
      query: Object.fromEntries(url.searchParams),
    });

    const json = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json', connection: 'close' });
      res.end(JSON.stringify(body));
    };
    const paged = (all: Record<string, unknown>[]): void => {
      const slice = all.slice((page - 1) * 100, page * 100);
      if (f.shape === 'unrecognized') {
        // A response-shape drift. This used to yield [] reported as success.
        return json(200, { success: true, data: { results: slice, count: slice.length } });
      }
      // `meta.total` is what every real `PaginatedResponse` endpoint carries and
      // it is what makes the completeness verdict EXACT — hence the sharp
      // 501-entity boundary rather than a fuzzy "somewhere around 500".
      json(200, { success: true, data: { items: slice, meta: { total: all.length } } });
    };

    /** `ContentService.findOne` — `include`-based, so every scalar comes back. */
    const detailFor = (id: string): Record<string, unknown> | null => {
      f.onContentDetail?.(id, f);
      const item = f.content.find(c => c.id === id);
      if (!item) return null;
      const playlistItems = f.playlists.flatMap(p =>
        (((p.items as { contentId: string }[] | undefined) ?? []) as { contentId: string }[])
          .filter(i => i.contentId === id)
          .map(i => ({ ...i, playlist: { id: p.id, name: p.name } })),
      );
      return { ...item, title: item.name, playlistItems };
    };

    if (path === '/api/v1/auth/login') {
      return json(200, { success: true, data: { accessToken: 'test-token' } });
    }
    if (path === '/api/v1/auth/logout') return json(201, { success: true, data: {} });

    if (path === '/api/v1/content') return paged(f.content.map(projectListItem));
    if (path === '/api/v1/playlists') return paged(f.playlists);

    if (path === '/api/v1/health') {
      if (f.storagePct === null) return json(500, { success: false, message: 'health down' });
      return json(200, { success: true, data: { storage: { usedPercent: f.storagePct } } });
    }

    const archive = /^\/api\/v1\/content\/([^/]+)\/archive$/.exec(path);
    if (archive && req.method === 'POST') {
      archived.push(archive[1]);
      return json(200, { success: true, data: { id: archive[1], status: 'archived' } });
    }

    const detail = /^\/api\/v1\/content\/([^/]+)$/.exec(path);
    if (detail && req.method === 'GET') {
      if (f.failDetail?.includes(detail[1])) {
        return json(500, { success: false, message: 'detail read failed' });
      }
      const body = detailFor(detail[1]);
      if (!body) return json(404, { success: false, message: 'Content not found' });
      return json(200, { success: true, data: body });
    }

    return json(200, { success: true, data: {} });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}`, archived, requests });
    });
  });
}

function setupTmpRoot(seedIncidents: Incident[] = []): string {
  const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-content-res-'));
  cpSync(join(repoRoot, 'scripts', 'ops'), join(tmpRoot, 'scripts', 'ops'), { recursive: true });
  mkdirSync(join(tmpRoot, 'logs'), { recursive: true });

  const state: OpsState = {
    systemStatus: seedIncidents.some(i => i.severity === 'critical') ? 'CRITICAL' : 'HEALTHY',
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
    ['--import', 'tsx', join(tmpRoot, 'scripts', 'ops', 'content-lifecycle.ts')],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        VALIDATOR_BASE_URL: baseUrl,
        OPS_EMAIL: 'ops@example.test',
        OPS_PASSWORD: 'not-a-real-password',
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

function storageHighIncident(): Incident {
  return {
    id: STORAGE_HIGH_ID,
    agent: 'content-lifecycle',
    type: 'storage_high',
    severity: 'critical',
    target: 'storage',
    targetId: 'system',
    detected: new Date(Date.now() - 86_400_000).toISOString(),
    message: 'Storage usage at 91.0% — exceeds critical threshold of 90%',
    remediation: 'Manual intervention required: expand storage or purge old content',
    status: 'open',
    attempts: 0,
  } as Incident;
}

function expiredContentIncident(): Incident {
  return {
    id: EXPIRED_ID,
    agent: 'content-lifecycle',
    type: 'expired_content',
    severity: 'warning',
    target: 'content',
    targetId: 'content-old',
    detected: new Date(Date.now() - 86_400_000).toISOString(),
    message: 'Content "Old Promo" expired - archive failed (transient)',
    remediation: 'POST /content/content-old/archive',
    status: 'open',
    attempts: 1,
    error: 'API 503',
  } as Incident;
}

async function withServer(
  f: Fixture,
  fn: (baseUrl: string, h: Harness) => Promise<void>,
): Promise<void> {
  const h = await startServer(f);
  try {
    await fn(h.baseUrl, h);
  } finally {
    h.server.close();
  }
}

// ─── Archive-invariant fixtures ─────────────────────────────────────────────

/** Comfortably past ORPHAN_AGE_DAYS (30). */
const OLD = new Date(Date.now() - 60 * 86_400_000).toISOString();

function contentItem(over: Record<string, unknown>): Record<string, unknown> {
  return {
    name: String(over.id ?? 'item'),
    type: 'image',
    status: 'active',
    createdAt: OLD,
    ...over,
  };
}

function playlistWith(id: string, contentIds: string[] = []): Record<string, unknown> {
  return {
    id,
    name: id,
    items: contentIds.map((contentId, i) => ({
      id: `${id}-item-${i}`,
      playlistId: id,
      contentId,
      order: i,
    })),
  };
}

/** `n` playlists, oldest LAST — `/playlists` is ordered `createdAt: 'desc'`. */
function playlists(n: number, tail: Record<string, unknown>[] = []): Record<string, unknown>[] {
  return [...Array.from({ length: n }, (_, i) => playlistWith(`pl-${i}`)), ...tail];
}

const SCAN_TRUNCATED_ID = 'content-lifecycle:scan-truncated:entity-lists';

// ─── (a) POSITIVE: a real storage reading clears the stale storage_high ──────

test('storage back at 40% resolves a stale storage_high raised at 91%', async () => {
  // Before this change the healthy branch pushed nothing, so this incident had
  // no exit from `open` at all.
  await withServer(fixture({ storagePct: 40 }), async baseUrl => {
    const tmpRoot = setupTmpRoot([storageHighIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      const incident = state.incidents.find(i => i.id === STORAGE_HIGH_ID);
      assert.ok(incident, 'the incident must still be tracked, not deleted');
      assert.equal(incident.status, 'resolved');
      assert.ok(incident.resolvedAt, 'resolvedAt must be stamped');
      assert.equal(state.systemStatus, 'HEALTHY', 'clearing it must un-pin systemStatus');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── (b) NEGATIVE: a dead /health resolves nothing about storage ─────────────

test('NEGATIVE: /health 500 leaves storage_high OPEN and stays CRITICAL', async () => {
  // The load-bearing case. A run that could not read storage must not report
  // storage recovered — and it must file `storage_check_failed` saying so.
  await withServer(fixture({ storagePct: null }), async baseUrl => {
    const tmpRoot = setupTmpRoot([storageHighIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const state = readState(tmpRoot);
      const high = state.incidents.find(i => i.id === STORAGE_HIGH_ID);
      assert.ok(high, 'storage_high must still be present');
      assert.equal(
        high.status,
        'open',
        'a run that could not read storage must not report storage recovered',
      );
      assert.equal(high.resolvedAt, undefined);

      const failed = state.incidents.find(i => i.id === STORAGE_FAILED_ID);
      assert.ok(failed, `expected a ${STORAGE_FAILED_ID} incident\n${result.stdout}`);
      assert.equal(failed.status, 'open');

      assert.equal(
        state.systemStatus,
        'CRITICAL',
        'the unverified critical must keep pinning systemStatus',
      );

      // Resolutions can never green a red run — the exit code is pinned to
      // detection, and storage_check_failed is a live open finding.
      assert.equal(result.code, 1, `${result.stderr}\n${result.stdout}`);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── (c) MIXED: one run, one state read, per-check outcomes ──────────────────

test('MIXED: content checks clear their incident while /health 500 keeps storage_high open', async () => {
  // This is what three scope keys buy over one boolean. Same run, same locked
  // read: the completed content checks clear `expired_content`, the failed
  // storage probe leaves `storage_high` alone.
  await withServer(fixture({ storagePct: null }), async baseUrl => {
    const tmpRoot = setupTmpRoot([storageHighIncident(), expiredContentIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      const state = readState(tmpRoot);

      const expired = state.incidents.find(i => i.id === EXPIRED_ID);
      assert.ok(expired, 'expired_content must still be tracked');
      assert.equal(
        expired.status,
        'resolved',
        `the content checks DID complete — their findings must clear\n${result.stdout}`,
      );

      const high = state.incidents.find(i => i.id === STORAGE_HIGH_ID);
      assert.ok(high);
      assert.equal(
        high.status,
        'open',
        'the storage probe did NOT complete — its finding must survive the same run',
      );

      // The load-bearing exit-code pin: this run RESOLVED an incident and
      // still holds an open storage_check_failed. It must stay red.
      assert.equal(
        result.code,
        1,
        `a resolution must not green a run with an open finding\n${result.stdout}`,
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── Ambiguity ruling: /health answers but exposes no storage fields ─────────

test('a /health with no storage fields clears storage_check_failed but not storage_high', async () => {
  // `storage_check_failed`'s subject is "the probe threw" — it didn't, so it
  // resolves. No number was read, so `storage_high` gets no verdict either way.
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const json = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json', connection: 'close' });
      res.end(JSON.stringify(body));
    };
    if (path === '/api/v1/auth/login') {
      return json(200, { success: true, data: { accessToken: 't' } });
    }
    if (path === '/api/v1/auth/logout') return json(201, { success: true, data: {} });
    if (path === '/api/v1/health') return json(200, { success: true, data: { status: 'ok' } });
    return json(200, { success: true, data: { items: [] } });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const stale: Incident = {
    id: STORAGE_FAILED_ID,
    agent: 'content-lifecycle',
    type: 'storage_check_failed',
    severity: 'warning',
    target: 'storage',
    targetId: 'system',
    detected: new Date(Date.now() - 86_400_000).toISOString(),
    message: 'Storage monitoring could not run - API 500',
    remediation: 'Check /health endpoint and storage subsystem',
    status: 'open',
    attempts: 1,
  } as Incident;

  const tmpRoot = setupTmpRoot([stale, storageHighIncident()]);
  try {
    await runAgent(tmpRoot, baseUrl);
    const state = readState(tmpRoot);

    assert.equal(
      state.incidents.find(i => i.id === STORAGE_FAILED_ID)?.status,
      'resolved',
      'the probe answered, so "the probe threw" is disproved',
    );
    assert.equal(
      state.incidents.find(i => i.id === STORAGE_HIGH_ID)?.status,
      'open',
      'no usage number was read, so no verdict on storage_high',
    );
  } finally {
    server.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ─── Completeness gate: the LOWER bound, not just the cap ────────────────────

test('NEGATIVE: an unrecognized list shape exits 2 and resolves nothing', async () => {
  // Zero items passes any `length < cap` completeness proxy, so before the
  // throw a response-shape drift would have had this agent resolve EVERY
  // incident and report HEALTHY. Storage is fine in this fixture, which is
  // exactly what makes the silent version dangerous: the run looks perfect.
  await withServer(fixture({ storagePct: 40, shape: 'unrecognized' }), async baseUrl => {
    const tmpRoot = setupTmpRoot([storageHighIncident(), expiredContentIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.equal(result.code, 2, `${result.stderr}\n${result.stdout}`);

      const state = readState(tmpRoot);
      for (const id of [STORAGE_HIGH_ID, EXPIRED_ID]) {
        assert.equal(
          state.incidents.find(i => i.id === id)?.status,
          'open',
          `${id} must not be cleared off a shape drift`,
        );
      }
      assert.equal(state.lastRun['content-lifecycle'], undefined, 'no run recorded');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── Truncation: content lists at the cap resolve no content incident ────────

test('NEGATIVE: a truncated content scan resolves nothing and raises scan-truncated', async () => {
  // 501, not 500. The harness now emits `meta.total` on every list, exactly as
  // `PaginatedResponse` does, so the completeness verdict is EXACT rather than
  // the `length < cap` proxy — and the boundary sits one item above the cap.
  const f = fixture({
    storagePct: 40,
    content: Array.from({ length: 501 }, (_, i) => ({
      id: `c-${i}`,
      name: `Item ${i}`,
      type: 'image',
      status: 'archived',
    })),
  });

  await withServer(f, async baseUrl => {
    const tmpRoot = setupTmpRoot([expiredContentIncident()]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      const state = readState(tmpRoot);

      assert.equal(
        state.incidents.find(i => i.id === EXPIRED_ID)?.status,
        'open',
        'a partial content scan must not clear a content incident',
      );

      const truncated = state.incidents.find(
        i => i.id === 'content-lifecycle:scan-truncated:entity-lists',
      );
      assert.ok(truncated, `expected a scan-truncated incident\n${result.stdout}`);
      // INFO, not warning: only a code change can clear it, so counting it as a
      // failure would pin a legitimately-large tenant at exit 1 / DEGRADED on
      // every run forever.
      assert.equal(truncated.severity, 'info');
      assert.match(truncated.message, /page-walk cap/i);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// THE ARCHIVE INVARIANT (K13)
//
// "content referenced by ANY valid playlist must never become archive-eligible
//  merely because the playlist/reference query was truncated or paginated — and,
//  by extension, must never be archived because a reference TYPE was not
//  considered at all."
//
// Archiving is a soft `status:'archived'` flip, but `isDeliverable`
// (packages/database/src/lib/effective-content.ts:85-93) drops non-active
// content from both playlist items and layout zones — so it STOPS DELIVERY to
// screens. Every assertion below is on the recorded list of
// `POST /content/:id/archive` ids, because that list IS the customer-visible
// consequence. Asserting on incidents or logs instead would have passed against
// the defective code.
//
// Each case names the mutation it kills, so it cannot be "simplified" into a
// vacuous version.
// ════════════════════════════════════════════════════════════════════════════

// ─── 1. Below the boundary: a complete scan still archives the real orphan ───

test('ARCHIVE 500 playlists (complete): archives exactly the genuine orphan', async () => {
  // The positive control. Without it, every negative case below is satisfied by
  // an agent that archives nothing, ever.
  const f = fixture({
    content: [contentItem({ id: 'pinned-a' }), contentItem({ id: 'the-orphan' })],
    playlists: [playlistWith('pl-ref', ['pinned-a']), ...playlists(499)],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(
        h.archived,
        ['the-orphan'],
        `only the unreferenced item may be archived\n${result.stdout}`,
      );
      assert.equal(
        readState(tmpRoot).incidents.find(i => i.id === SCAN_TRUNCATED_ID),
        undefined,
        '500 entities with meta.total=500 is COMPLETE — no truncation incident',
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 2. Above the boundary: the WRITE is gated, not just the resolution ─────

test('ARCHIVE 501 playlists (truncated): archives NOTHING and says why', async () => {
  // THE DEFECT. `/playlists` is ordered `createdAt: 'desc'`, so the page-walk cap
  // drops the OLDEST playlists — maximally correlated with the >30d population
  // the orphan check targets. Here the dropped 501st playlist is the only thing
  // referencing `pinned-old`, which is otherwise a perfect candidate.
  //
  // Before this change the incomplete branch logged, raised `scan-truncated`,
  // and then archived anyway. MUTATION KILLED: revert the
  // `if (counters.contentScanComplete)` gate around `checkOrphanedContent` and
  // `pinned-old` is archived — delivery stops on every screen showing it.
  const f = fixture({
    content: [contentItem({ id: 'pinned-old' }), contentItem({ id: 'the-orphan' })],
    playlists: [...playlists(500), playlistWith('pl-oldest', ['pinned-old'])],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      assert.deepEqual(
        h.archived,
        [],
        `a knowingly-partial reference universe must archive NOTHING\n${result.stdout}`,
      );

      const truncated = readState(tmpRoot).incidents.find(i => i.id === SCAN_TRUNCATED_ID);
      assert.ok(truncated, `expected a scan-truncated incident\n${result.stdout}`);
      assert.equal(truncated.severity, 'info');
      // The remediation must NOT tell the operator to raise the cap — that
      // re-arms the identical defect at the new number.
      assert.doesNotMatch(truncated.remediation ?? '', /^Raise the/i);
      assert.match(truncated.remediation ?? '', /Do NOT raise the page-walk cap/);

      assert.match(result.stdout, /SKIP orphan archive/, 'the skip must be visible in the log');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 3. Multi-page traversal: a reference on page 3 still counts ─────────────

test('ARCHIVE 250 playlists: a reference on page 3 protects its content', async () => {
  // MUTATION KILLED: make `getAllScan` return after page 1. The reference then
  // lives in the unseen tail — but the run also becomes incomplete, so the gate
  // stops the archive entirely and `the-orphan` is not archived either. That is
  // why this asserts the EXACT list rather than only "pinned-p3 survived": the
  // exact list distinguishes "traversed correctly" from "gave up".
  const f = fixture({
    content: [contentItem({ id: 'pinned-p3' }), contentItem({ id: 'the-orphan' })],
    playlists: [...playlists(249), playlistWith('pl-page3', ['pinned-p3'])],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(h.archived, ['the-orphan'], `${result.stdout}`);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 4. Content-side truncation ─────────────────────────────────────────────

test('ARCHIVE 501 content, complete playlists: nothing referenced is archived', async () => {
  // Content truncation drops the OLDEST content, i.e. candidates — so it used to
  // be purely safe-direction. It is not any more: layouts are now a reference
  // SOURCE, and a dropped layout page silently removes zone pins. The gate
  // therefore folds BOTH scans into one flag, which is why this archives nothing
  // at all rather than "the orphans it could still see".
  const f = fixture({
    content: [
      contentItem({ id: 'pinned-a' }),
      ...Array.from({ length: 500 }, (_, i) => contentItem({ id: `c-${i}` })),
    ],
    playlists: [playlistWith('pl-ref', ['pinned-a'])],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.ok(
        !h.archived.includes('pinned-a'),
        `a referenced item must never be archived\n${result.stdout}`,
      );
      assert.deepEqual(h.archived, [], 'the folded gate stops the whole archive pass');
      assert.ok(readState(tmpRoot).incidents.find(i => i.id === SCAN_TRUNCATED_ID));
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 5. GAP-1: layout zone references ───────────────────────────────────────

test('ARCHIVE GAP-1: content pinned into a layout zone is not archived', async () => {
  // Live-reachable at ANY tenant size — no truncation needed. A `type:'layout'`
  // content pins other content through `metadata.zones[].contentId`, which
  // `resolveLayoutZones` resolves and `isDeliverable` then drops if it is not
  // active. Archiving `zone-pinned` therefore BLANKS THAT ZONE on live glass.
  //
  // The agent could not even see this: `CONTENT_LIST_SELECT` omits `metadata`,
  // and the harness strips it from the list for exactly that reason. The only
  // way to pass is to read the layout's detail.
  //
  // MUTATION KILLED: drop the layout harvest and `zone-pinned` is archived.
  const f = fixture({
    content: [
      contentItem({
        id: 'the-layout',
        type: 'layout',
        metadata: { zones: [{ id: 'z1', contentId: 'zone-pinned' }, { id: 'z2' }] },
      }),
      contentItem({ id: 'zone-pinned' }),
      contentItem({ id: 'the-orphan' }),
    ],
    playlists: [],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(h.archived, ['the-orphan'], `${result.stdout}`);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 6. GAP-2: replacementContentId ─────────────────────────────────────────

test('ARCHIVE GAP-2: an expiry replacement target is not archived', async () => {
  // `Content.replacementContentId` is swapped in when the referrer expires, so
  // archiving the target lands the swap on dead content. Absent from
  // `CONTENT_LIST_SELECT`, so again only the per-item read can see it.
  //
  // `replacement-b` deliberately comes FIRST in the list. A one-pass
  // harvest-while-archiving would already have archived it before reading
  // `referrer-a`'s detail; the two-pass confirm makes the outcome
  // order-independent. MUTATION KILLED: collapse pass 1 and pass 2 into one loop.
  const f = fixture({
    content: [
      contentItem({ id: 'replacement-b' }),
      contentItem({ id: 'referrer-a', replacementContentId: 'replacement-b' }),
      contentItem({ id: 'the-orphan' }),
    ],
    playlists: [],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.ok(
        !h.archived.includes('replacement-b'),
        `the replacement target must survive\n${result.stdout}`,
      );
      // The referrer itself IS a genuine orphan by this agent's model, and the
      // unrelated orphan must still go — otherwise this passes vacuously.
      assert.deepEqual([...h.archived].sort(), ['referrer-a', 'the-orphan']);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 7. Regression guard: layouts themselves stay skipped ───────────────────

test('ARCHIVE: a layout is never itself archived, even with no zones', async () => {
  // Pins the pre-existing `if (c.type === 'layout') return false` skip. Layouts
  // are structural: they are referenced by displays and schedules, which this
  // agent does not look at at all.
  const f = fixture({
    content: [
      contentItem({ id: 'bare-layout', type: 'layout' }),
      contentItem({ id: 'the-orphan' }),
    ],
    playlists: [],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(h.archived, ['the-orphan'], `${result.stdout}`);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 8. Tenant isolation ────────────────────────────────────────────────────

test('ARCHIVE: every request stays inside the ops principal own org scope', async () => {
  // Encodes the CURRENT contract rather than asserting it is the right one: the
  // agent is scoped to whatever org its own credentials belong to (on prod that
  // is "E2E Test Org", 8 content items — so content-lifecycle has never managed
  // customer content). Whether it SHOULD be fleet-wide is a product question
  // tracked in backlog.md.
  //
  // The point of pinning it here is that widening the scope is exactly the
  // change that turns every defect above into a cross-tenant one. This trips the
  // moment someone reaches for a platform-scope query.
  const f = fixture({
    content: [contentItem({ id: 'the-orphan' })],
    playlists: [],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      await runAgent(tmpRoot, baseUrl);

      const allowed = [
        /^\/api\/v1\/auth\/(login|logout)$/,
        /^\/api\/v1\/content$/,
        /^\/api\/v1\/content\/[^/]+$/,
        /^\/api\/v1\/content\/[^/]+\/archive$/,
        /^\/api\/v1\/playlists$/,
        /^\/api\/v1\/health$/,
      ];
      const unexpected = h.requests.map(r => r.path).filter(p => !allowed.some(re => re.test(p)));
      assert.deepEqual(unexpected, [], 'the agent reached an endpoint outside its known surface');

      const crossOrg = ['organizationId', 'orgId', 'organization', 'allOrgs', 'platform', 'scope'];
      for (const r of h.requests) {
        for (const key of crossOrg) {
          assert.ok(
            !(key in r.query),
            `${r.method} ${r.path} carried a cross-org parameter "${key}"`,
          );
        }
        assert.ok(!r.path.startsWith('/api/v1/admin'), `${r.path} is an admin-scope endpoint`);
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 9. Global template-library content ─────────────────────────────────────

test('ARCHIVE: isGlobal template-library content is never archived', async () => {
  // Belt-and-braces. Prod's ops account is NOT in the Vizora System org (that was
  // verified), so this is latent — but `isGlobal` content is shared platform-wide
  // and "in no playlist of the one org this agent can see" says nothing about its
  // use elsewhere.
  //
  // `isGlobal` is absent from `CONTENT_LIST_SELECT`, so this guard can ONLY live
  // in the per-item confirmation. MUTATION KILLED: move the check to the
  // list-side filter and it silently reads `undefined` on every item.
  const f = fixture({
    content: [
      contentItem({ id: 'global-tpl', type: 'template', isGlobal: true }),
      contentItem({ id: 'the-orphan' }),
    ],
    playlists: [],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(h.archived, ['the-orphan'], `${result.stdout}`);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 10. Concurrency: the confirm read is the authority ─────────────────────

test('ARCHIVE: a playlist edit landing mid-run is seen by the per-item confirm', async () => {
  // Both lists are fetched ONCE, at the top of the run; the archive loop runs
  // afterwards with no re-read, transaction or lock, so the stale window used to
  // be the entire run. Here `/playlists` answers empty, and only once the agent
  // asks `GET /content/late-ref` does the reference exist — the shape of an
  // operator adding content to a playlist while the cron is mid-cycle.
  //
  // MUTATION KILLED: remove the per-candidate `GET /content/:id` confirmation
  // and `late-ref` is archived out from under the operator who just used it.
  const f: Fixture = fixture({
    content: [contentItem({ id: 'late-ref' })],
    playlists: [],
    onContentDetail: (id, live) => {
      if (id !== 'late-ref' || live.playlists.length > 0) return;
      live.playlists.push(playlistWith('pl-just-created', ['late-ref']));
    },
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(
        h.archived,
        [],
        `the per-item read saw the new reference and must refuse\n${result.stdout}`,
      );
      assert.match(result.stdout, /playlist reference\(s\) the list walk did not show/);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 11. The confirm read itself failing ────────────────────────────────────

test('ARCHIVE: a candidate whose confirm read FAILS is not archived', async () => {
  // The single question this whole change turns on — does the per-candidate
  // confirmation fail OPEN or CLOSED? — and until now it was verified only by
  // reading the code. `OpsApiClient.get` throws on any non-2xx, the catch
  // `continue`s without pushing to `confirmed`, and the archive loop iterates
  // `orphans ⊆ confirmed`, so an unconfirmed candidate is structurally
  // unreachable from the write. This drives that path for real.
  //
  // `other` must still be archived: without it the assertion is satisfied by an
  // agent that gives up on the whole batch after one failure, which is a
  // different (and worse) behaviour than skipping the one item.
  //
  // MUTATION KILLED: change the confirm catch's `continue` to a fall-through and
  // `the-orphan` is archived on the strength of a read that never answered.
  const f = fixture({
    content: [contentItem({ id: 'the-orphan' }), contentItem({ id: 'other' })],
    playlists: [],
    failDetail: ['the-orphan'],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot();
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(
        h.archived,
        ['other'],
        `an unconfirmed candidate must never be archived, and one failure must not ` +
          `abandon the rest of the batch\n${result.stdout}`,
      );
      assert.match(result.stdout, /could not confirm it is unreferenced/);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 12. A SKIPPED check resolves nothing ───────────────────────────────────

test('ARCHIVE: an unreadable layout fails closed and clears no orphan finding', async () => {
  // The case the two coverage keys exist to separate, and the ONLY one where
  // they differ: the tenant lists are COMPLETE — so `contentScanComplete` is
  // true and `expired_content` legitimately gets its resolution — but a layout
  // detail read failed, so the zone-pin universe is partial and the orphan check
  // returns without looking at anything.
  //
  // Fail-closed on that read is not paranoia: a missed zone pin archives content
  // that a live screen is currently rendering into a zone, which blanks it.
  //
  // MUTATION KILLED: put `orphaned_content` back into `CONTENT_SCAN_TYPES`. The
  // run then reports a false all-clear on the exact finding it was too blind to
  // re-check. (A truncated-list fixture does NOT kill that mutation — there
  // `contentScanComplete` is false, so the whole set is uncovered either way.)
  const orphanIncidentId = 'content-lifecycle:orphaned_content:content-stale';
  const stale: Incident = {
    id: orphanIncidentId,
    agent: 'content-lifecycle',
    type: 'orphaned_content',
    severity: 'info',
    target: 'content',
    targetId: 'content-stale',
    detected: new Date(Date.now() - 86_400_000).toISOString(),
    message: 'Content "Stale" is orphaned - archive failed (transient)',
    remediation: 'POST /content/content-stale/archive',
    status: 'open',
    attempts: 1,
  } as Incident;

  const f = fixture({
    content: [
      contentItem({ id: 'broken-layout', type: 'layout' }),
      contentItem({ id: 'the-orphan' }),
    ],
    playlists: [],
    failDetail: ['broken-layout'],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot([stale]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(
        h.archived,
        [],
        `an unknown zone-pin universe must archive nothing\n${result.stdout}`,
      );

      const state = readState(tmpRoot);
      assert.equal(
        state.incidents.find(i => i.id === orphanIncidentId)?.status,
        'open',
        `a check that did not run cannot clear its own finding\n${result.stdout}`,
      );
      const harvest = state.incidents.find(
        i => i.id === 'content-lifecycle:reference-scan-incomplete:layout-zones',
      );
      assert.ok(harvest, `expected a reference-scan-incomplete incident\n${result.stdout}`);
      assert.equal(harvest.severity, 'info', 'only a retry clears it — it must not pin DEGRADED');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ITEM-LEVEL CLEARING (K25)
//
// Test 12 above is the CHECK-granularity version: the orphan check did not run,
// so it clears nothing. These four are one level down — the check DID run and
// `orphaned_content` IS covered, but an individual item was skipped inside it.
//
// The distinction the four of them pin, stated once:
//
//   SKIPPED WITHOUT EVIDENCE (1, 2) — the confirm read threw, or the candidate
//     fell past the per-run cap. The run knows nothing about this item, so a
//     prior incident on it must survive.
//   SKIPPED WITH EVIDENCE (3) — isGlobal / playlistItems / named as another
//     item's replacement. The run looked and found a real reason. Its incident
//     must still clear, or the fix over-corrects into "nothing ever resolves".
//   GENUINELY GONE (4) — the item is no longer a candidate at all. Unchanged.
//
// Cases 1 and 2 assert on incident STATUS rather than on `archived`, because
// the archive side of both was already correct (test 11 pins it); the defect
// was that the skip was invisible to the resolution sweep.
// ════════════════════════════════════════════════════════════════════════════

function orphanIncident(contentId: string): Incident {
  return {
    id: `content-lifecycle:orphaned_content:${contentId}`,
    agent: 'content-lifecycle',
    type: 'orphaned_content',
    severity: 'info',
    target: 'content',
    targetId: contentId,
    detected: new Date(Date.now() - 86_400_000).toISOString(),
    message: `Content "${contentId}" is orphaned - archive failed (transient)`,
    remediation: `POST /content/${contentId}/archive`,
    status: 'open',
    attempts: 1,
    error: 'API 503',
  } as Incident;
}

// ─── 13. Unexamined: the confirm read threw ─────────────────────────────────

test('K25: a candidate whose confirm read FAILS keeps its prior incident open', async () => {
  // The recorded scenario. Run N tried to archive `flaky`, got a 503, opened
  // `orphaned_content:flaky`. Run N+1: `flaky`'s confirm read returns 500, so it
  // is skipped — and every coverage key stays true, because the orphan check
  // itself completed. `orphaned_content` was therefore in `coveredTypes`, the
  // incident was not re-raised (nobody looked at `flaky`), and it RESOLVED.
  // ops-state then read all-clear over an item still sitting there unarchived.
  //
  // `other` must still be archived: it proves the orphan check really did run
  // and `orphaned_content` really was covered this run. Without it the assertion
  // passes vacuously against an agent that skipped the whole pass.
  //
  // MUTATION KILLED: drop `state.confirmReadFailedIds.add(item.id)` from the
  // confirm catch and this incident resolves again.
  const f = fixture({
    content: [contentItem({ id: 'flaky' }), contentItem({ id: 'other' })],
    playlists: [],
    failDetail: ['flaky'],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot([orphanIncident('flaky')]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      assert.deepEqual(
        h.archived,
        ['other'],
        `the unconfirmed candidate must not be archived, and the rest of the batch ` +
          `must still run\n${result.stdout}`,
      );

      const state = readState(tmpRoot);
      assert.equal(
        state.incidents.find(i => i.id === 'content-lifecycle:orphaned_content:flaky')?.status,
        'open',
        `an item that was never examined cannot clear its own incident\n${result.stdout}`,
      );
      assert.match(result.stdout, /skipped WITHOUT EVIDENCE/);
      assert.match(result.stdout, /confirm read failed: 1/);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 14. Unexamined: deferred past the per-run cap ──────────────────────────

test('K25: a candidate deferred past the per-run cap keeps its prior incident open', async () => {
  // The second evidence-free skip, and the quieter one — no error is raised
  // anywhere, the item is simply beyond `MAX_ARCHIVE_CANDIDATES_PER_RUN` (100)
  // and its detail is never requested. The deferral was already logged by count,
  // but the resolution sweep could not see it, so a deferred item's incident
  // cleared on a run that had not read one byte about it.
  //
  // The 100 items that consume the cap are `isGlobal`, so they are confirmed and
  // skipped WITH evidence and nothing is archived — which keeps the fixture to
  // 100 detail reads and makes `archived: []` unambiguous.
  //
  // MUTATION KILLED: drop the `deferredCandidateIds` collection and
  // `orphaned_content:deferred-tail` resolves off a run that never read it.
  const f = fixture({
    content: [
      ...Array.from({ length: 100 }, (_, i) =>
        contentItem({ id: `cap-filler-${i}`, type: 'template', isGlobal: true }),
      ),
      contentItem({ id: 'deferred-tail' }),
    ],
    playlists: [],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot([orphanIncident('deferred-tail')]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);

      assert.deepEqual(
        h.archived,
        [],
        `nothing here is archivable — the cap fillers are isGlobal and the tail was ` +
          `never read\n${result.stdout}`,
      );
      assert.match(result.stdout, /Deferring 1 orphan candidate/);

      const state = readState(tmpRoot);
      assert.equal(
        state.incidents.find(i => i.id === 'content-lifecycle:orphaned_content:deferred-tail')
          ?.status,
        'open',
        `an item the run never looked at cannot clear its own incident\n${result.stdout}`,
      );
      assert.match(result.stdout, /deferred past cap: 1/);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 15. Examined: a real skip STILL resolves ───────────────────────────────

test('K25: an item skipped for a REAL reason still resolves its incident', async () => {
  // The guard that stops the fix from over-correcting. `shared-tpl` is skipped
  // too — but by the `isGlobal` branch, which fires only AFTER a successful
  // `GET /content/:id`. The run examined it and holds real evidence it is not an
  // orphan, so the prior finding is genuinely stale and must clear.
  //
  // Without this test, "collect every skipped id" passes tests 13 and 14 just as
  // well as the correct fix does, and quietly converts `orphaned_content` into a
  // type that can only ever accumulate.
  //
  // MUTATION KILLED: also add the isGlobal / playlistItems / replacement skips to
  // the unexamined set and this incident stops resolving.
  const f = fixture({
    content: [
      contentItem({ id: 'shared-tpl', type: 'template', isGlobal: true }),
      contentItem({ id: 'the-orphan' }),
    ],
    playlists: [],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot([orphanIncident('shared-tpl')]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(h.archived, ['the-orphan'], `${result.stdout}`);

      const state = readState(tmpRoot);
      assert.equal(
        state.incidents.find(i => i.id === 'content-lifecycle:orphaned_content:shared-tpl')?.status,
        'resolved',
        `an EXAMINED skip is evidence — its stale finding must still clear\n${result.stdout}`,
      );
      assert.doesNotMatch(
        result.stdout,
        /skipped WITHOUT EVIDENCE/,
        'nothing here was skipped blind, so the counter must not fire',
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ─── 16. Recovery: an item that is no longer a candidate resolves ───────────

test('K25: a genuinely recovered orphan still resolves', async () => {
  // The plain regression guard. `was-orphaned` is gone from the tenant entirely
  // (archived on a previous run), so it is not a candidate, not skipped, and not
  // in either unexamined set. Resolution here is the whole point of the sweep
  // and the change must not touch it.
  const f = fixture({
    content: [contentItem({ id: 'the-orphan' })],
    playlists: [],
  });

  await withServer(f, async (baseUrl, h) => {
    const tmpRoot = setupTmpRoot([orphanIncident('was-orphaned')]);
    try {
      const result = await runAgent(tmpRoot, baseUrl);
      assert.deepEqual(h.archived, ['the-orphan'], `${result.stdout}`);

      const state = readState(tmpRoot);
      const recovered = state.incidents.find(
        i => i.id === 'content-lifecycle:orphaned_content:was-orphaned',
      );
      assert.equal(recovered?.status, 'resolved', `${result.stdout}`);
      assert.ok(recovered?.resolvedAt, 'resolvedAt must be stamped');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

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
}

function fixture(over: Partial<Fixture> = {}): Fixture {
  return { content: [], playlists: [], storagePct: 40, ...over };
}

function startServer(f: Fixture): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const page = Number(url.searchParams.get('page') ?? '1');

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
      json(200, { success: true, data: { items: slice } });
    };

    if (path === '/api/v1/auth/login') {
      return json(200, { success: true, data: { accessToken: 'test-token' } });
    }
    if (path === '/api/v1/auth/logout') return json(201, { success: true, data: {} });

    if (path === '/api/v1/content') return paged(f.content);
    if (path === '/api/v1/playlists') return paged(f.playlists);

    if (path === '/api/v1/health') {
      if (f.storagePct === null) return json(500, { success: false, message: 'health down' });
      return json(200, { success: true, data: { storage: { usedPercent: f.storagePct } } });
    }

    // POST /content/:id/archive
    if (path.startsWith('/api/v1/content/')) {
      return json(200, { success: true, data: { id: path.split('/')[4], status: 'archived' } });
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

async function withServer(f: Fixture, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const { server, baseUrl } = await startServer(f);
  try {
    await fn(baseUrl);
  } finally {
    server.close();
  }
}

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
  const f = fixture({
    storagePct: 40,
    content: Array.from({ length: 500 }, (_, i) => ({
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

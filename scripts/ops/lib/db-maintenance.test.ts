/**
 * db-maintainer pure logic — command construction and failure semantics.
 *
 * These tests pin the four defects that let `Vacuum: 0 OK, 7 failed` run daily
 * for months while reporting success:
 *
 *   - credentials in argv (visible to `ps`)
 *   - container identity hardcoded instead of derived from DATABASE_URL
 *   - container pg_dump writing nowhere
 *   - failures counted but never surfaced as incidents or a non-zero exit
 *
 * Deterministic: no PostgreSQL, no docker, no network.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VACUUM_TABLES,
  buildMaintenanceIncidents,
  buildPgDumpCandidates,
  buildPsqlCandidates,
  summarize,
  type MaintenanceReport,
} from './db-maintenance.js';

const PG_PW = 'PGPW-do-not-leak-4f7a';
const DB_URL = `postgresql://vizora_app:${PG_PW}@db.internal:5432/vizora?connection_limit=10`;
const CONTAINER = 'vizora-postgres';
const AT = '2026-08-12T18:00:00.000Z';

function report(over: Partial<MaintenanceReport> = {}): MaintenanceReport {
  return {
    vacuum: VACUUM_TABLES.map(t => ({ table: t, success: true })),
    prune: { ok: true, deleted: 0 },
    redis: { available: true },
    backup: { attempted: false, ok: true },
    ...over,
  };
}

// ─── Table names ─────────────────────────────────────────────────────────────

test('VACUUM_TABLES uses PHYSICAL names, not Prisma model names', () => {
  // Verified against pg_class on prod: `Display` and `User` do not exist.
  assert.ok(VACUUM_TABLES.includes('devices'), 'Display is @@map("devices")');
  assert.ok(VACUUM_TABLES.includes('users'), 'User is @@map("users")');
  assert.ok(!VACUUM_TABLES.includes('Display' as never), 'model name must not be used');
  assert.ok(!VACUUM_TABLES.includes('User' as never), 'model name must not be used');
});

// ─── psql candidates ─────────────────────────────────────────────────────────

test('host psql keeps the password in env, never in argv', () => {
  const [host] = buildPsqlCandidates(DB_URL, CONTAINER);
  assert.equal(host.env.PGPASSWORD, PG_PW);
  assert.ok(
    !host.args.some(a => a.includes(PG_PW)),
    'argv is world-readable via ps — the previous implementation passed the whole DATABASE_URL there',
  );
  assert.ok(!host.args.some(a => a.startsWith('postgresql://')), 'no connection URL in argv');
});

test('container psql carries no credential at all', () => {
  const [, container] = buildPsqlCandidates(DB_URL, CONTAINER);
  assert.deepEqual(container.env, {}, 'docker exec -e would put the secret back into host argv');
  assert.ok(!container.args.some(a => a.includes(PG_PW)));
});

test('container psql derives identity from DATABASE_URL, not hardcoded postgres/vizora', () => {
  const [, container] = buildPsqlCandidates(DB_URL, CONTAINER);
  assert.deepEqual(
    container.args,
    ['exec', CONTAINER, 'psql', '-U', 'vizora_app', '-d', 'vizora'],
  );
});

test('host psql targets the URL host/port rather than assuming localhost', () => {
  const [host] = buildPsqlCandidates(DB_URL, CONTAINER);
  assert.ok(host.args.includes('db.internal'));
  assert.ok(host.args.includes('5432'));
});

test('no candidates when DATABASE_URL is missing or unparseable', () => {
  assert.deepEqual(buildPsqlCandidates(undefined, CONTAINER), []);
  assert.deepEqual(buildPsqlCandidates('not-a-url', CONTAINER), []);
});

test('an empty container name disables the fallback', () => {
  assert.equal(buildPsqlCandidates(DB_URL, '').length, 1);
});

// ─── pg_dump candidates ──────────────────────────────────────────────────────

test('host pg_dump writes to the output path directly', () => {
  const [host] = buildPgDumpCandidates(DB_URL, CONTAINER, '/tmp/dump.sql');
  assert.ok(host.args.includes('-f'));
  assert.ok(host.args.includes('/tmp/dump.sql'));
  assert.notEqual(host.capturesStdout, true);
  assert.equal(host.env.PGPASSWORD, PG_PW);
  assert.ok(!host.args.some(a => a.includes(PG_PW)));
});

test('container pg_dump is flagged capturesStdout — it cannot write a host path', () => {
  // The shipped implementation passed neither -f nor captured stdout, so a
  // container-path backup produced NO FILE and still reported success.
  const [, container] = buildPgDumpCandidates(DB_URL, CONTAINER, '/tmp/dump.sql');
  assert.equal(container.capturesStdout, true, 'caller must persist stdout itself');
  assert.ok(
    !container.args.includes('-f'),
    '-f would resolve inside the container, not on the host',
  );
  assert.ok(!container.args.includes('/tmp/dump.sql'));
});

// ─── Incident mapping ────────────────────────────────────────────────────────

test('a fully healthy run produces no incidents and exit code 0', () => {
  const incidents = buildMaintenanceIncidents(report(), AT);
  assert.deepEqual(incidents, []);
  assert.deepEqual(summarize(incidents), {
    issuesFound: 0, issuesFixed: 0, issuesEscalated: 0, exitCode: 0,
  });
});

test('a missing configured table is CRITICAL — the silent-ineffectiveness class', () => {
  const incidents = buildMaintenanceIncidents(
    report({ vacuum: [{ table: 'Display', success: false, missing: true }] }),
    AT,
  );
  const missing = incidents.find(i => i.type === 'vacuum-table-missing');
  assert.ok(missing);
  assert.equal(missing.severity, 'critical');
  assert.match(missing.remediation, /@@map/);
});

test('total VACUUM failure is CRITICAL and reported once, not per table', () => {
  const incidents = buildMaintenanceIncidents(
    report({ vacuum: VACUUM_TABLES.map(t => ({ table: t, success: false, error: 'ENOENT' })) }),
    AT,
  );
  const all = incidents.filter(i => i.type === 'vacuum-all-failed');
  assert.equal(all.length, 1, 'one aggregate incident, not seven');
  assert.equal(all[0].severity, 'critical');
  assert.equal(incidents.filter(i => i.type === 'vacuum-failed').length, 0);
});

test('a single VACUUM failure is WARNING — autovacuum still covers it', () => {
  const vacuum = VACUUM_TABLES.map(t => ({ table: t, success: true }));
  vacuum[0] = { table: vacuum[0].table, success: false, error: 'lock timeout' };
  const incidents = buildMaintenanceIncidents(report({ vacuum }), AT);
  const one = incidents.find(i => i.type === 'vacuum-failed');
  assert.ok(one);
  assert.equal(one.severity, 'warning');
  assert.match(one.message, /lock timeout/, 'the reason must reach the incident, not just a log');
});

test('prune failure is WARNING and names the unbounded table', () => {
  const incidents = buildMaintenanceIncidents(
    report({ prune: { ok: false, deleted: null, error: 'permission denied' } }),
    AT,
  );
  const p = incidents.find(i => i.type === 'alert-fire-prune-failed');
  assert.ok(p);
  assert.equal(p.severity, 'warning');
  assert.equal(p.targetId, 'alert_rule_fires');
});

test('Redis unobservability is explicit and INFO, never silently "unknown"', () => {
  const incidents = buildMaintenanceIncidents(
    report({ redis: { available: false, reason: 'redis-cli not installed on host' } }),
    AT,
  );
  const r = incidents.find(i => i.type === 'redis-unobservable');
  assert.ok(r, 'an unreadable Redis must surface as an incident, not a bare "unknown" string');
  assert.equal(r.severity, 'info');
  assert.match(r.message, /redis-cli not installed/);
});

test('backup failure is CRITICAL only when a backup was attempted', () => {
  const skipped = buildMaintenanceIncidents(
    report({ backup: { attempted: false, ok: false } }),
    AT,
  );
  assert.equal(skipped.filter(i => i.type === 'backup-failed').length, 0, 'skipped is not failed');

  const failed = buildMaintenanceIncidents(
    report({ backup: { attempted: true, ok: false, error: 'empty dump file' } }),
    AT,
  );
  const b = failed.find(i => i.type === 'backup-failed');
  assert.ok(b);
  assert.equal(b.severity, 'critical');
});

// ─── Exit-code rule: info=0, warning/critical=1 ──────────────────────────────

test('exit 0 when the only incident is INFO — a permanent info finding is not a failed run', () => {
  // redis-cli is not installed on the prod host and will not be, so
  // redis-unobservable fires on every run forever. Exiting non-zero for it
  // would manufacture a daily false failure.
  const incidents = buildMaintenanceIncidents(
    report({ redis: { available: false, reason: 'redis-cli is not installed on this host' } }),
    AT,
  );
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].severity, 'info');

  const s = summarize(incidents);
  assert.equal(s.exitCode, 0, 'info alone must not fail the process');
  assert.equal(s.issuesFound, 1, 'but the finding is still recorded');
  assert.equal(s.issuesEscalated, 0);
});

test('exit 1 when a WARNING is present', () => {
  const incidents = buildMaintenanceIncidents(
    report({ prune: { ok: false, deleted: null, error: 'permission denied' } }),
    AT,
  );
  assert.ok(incidents.some(i => i.severity === 'warning'));
  assert.ok(!incidents.some(i => i.severity === 'critical'));
  assert.equal(summarize(incidents).exitCode, 1);
});

test('exit 1 when a CRITICAL is present', () => {
  const incidents = buildMaintenanceIncidents(
    report({ vacuum: [{ table: 'devices', success: false, missing: true }] }),
    AT,
  );
  assert.ok(incidents.some(i => i.severity === 'critical'));
  assert.equal(summarize(incidents).exitCode, 1);
});

test('an INFO incident alongside a WARNING still exits 1 — info never masks', () => {
  const incidents = buildMaintenanceIncidents(
    report({
      prune: { ok: false, deleted: null, error: 'boom' },
      redis: { available: false, reason: 'redis-cli is not installed on this host' },
    }),
    AT,
  );
  assert.ok(incidents.some(i => i.severity === 'info'));
  assert.ok(incidents.some(i => i.severity === 'warning'));
  assert.equal(summarize(incidents).exitCode, 1);
});

test('failures produce a NON-ZERO exit code — the core regression', () => {
  // The shipped agent always exited 0, so PM2 and any human reading exit
  // status saw success while every VACUUM failed.
  const incidents = buildMaintenanceIncidents(
    report({ vacuum: VACUUM_TABLES.map(t => ({ table: t, success: false, error: 'ENOENT' })) }),
    AT,
  );
  const s = summarize(incidents);
  assert.equal(s.exitCode, 1);
  assert.ok(s.issuesFound > 0, 'issuesFound was hardcoded to 0 before');
  assert.ok(s.issuesEscalated > 0);
  assert.equal(s.issuesFixed, 0, 'this agent repairs nothing');
});

test('incident ids are deterministic so repeat failures dedup', () => {
  const a = buildMaintenanceIncidents(report({ prune: { ok: false, deleted: null, error: 'x' } }), AT);
  const b = buildMaintenanceIncidents(
    report({ prune: { ok: false, deleted: null, error: 'x' } }),
    '2026-08-13T18:00:00.000Z',
  );
  assert.deepEqual(a.map(i => i.id), b.map(i => i.id));
  assert.ok(a.every(i => i.id.startsWith('db-maintainer:')));
});

test('no incident claims a repair was attempted', () => {
  const incidents = buildMaintenanceIncidents(
    report({ vacuum: [{ table: 'users', success: false, error: 'boom' }] }),
    AT,
  );
  assert.ok(incidents.every(i => i.attempts === 0 && i.status === 'open'));
});

test('no credential appears in any incident', () => {
  const serialized = JSON.stringify(
    buildMaintenanceIncidents(
      report({
        vacuum: [{ table: 'users', success: false, error: `connection to ${DB_URL} failed` }],
        backup: { attempted: true, ok: false, error: `pg_dump ${DB_URL}` },
      }),
      AT,
    ),
  );
  assert.ok(
    !serialized.includes(PG_PW),
    'an error string can carry the URL — incidents must not leak the password',
  );
});

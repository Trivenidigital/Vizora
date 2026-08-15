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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AGENT,
  VACUUM_TABLES,
  buildMaintenanceIncidents,
  buildPgDumpCandidates,
  buildPsqlCandidates,
  resolveClearedMaintenanceIncidents,
  summarize,
  type MaintenanceCoverage,
  type MaintenanceReport,
  type VacuumOutcome,
} from './db-maintenance.js';
import { makeIncidentId } from './state.js';
import type { Incident } from './types.js';

const PG_PW = 'PGPW-do-not-leak-4f7a';
const DB_URL = `postgresql://vizora_app:${PG_PW}@db.internal:5432/vizora?connection_limit=10`;
const CONTAINER = 'vizora-postgres';
const AT = '2026-08-12T18:00:00.000Z';

function report(over: Partial<MaintenanceReport> = {}): MaintenanceReport {
  return {
    vacuum: VACUUM_TABLES.map(t => ({ table: t, success: true })),
    prune: { ok: true, deleted: 0 },
    redis: { available: true },
    backup: { attempted: false, ok: true, configured: false },
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
  // Annotated: without it the element type is inferred as {table, success}
  // and assigning an `error` below is a type error — invisible under tsx,
  // which strips types without checking them.
  const vacuum: VacuumOutcome[] = VACUUM_TABLES.map(t => ({ table: t, success: true }));
  vacuum[0] = { table: vacuum[0]!.table, success: false, error: 'lock timeout' };
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
    report({ backup: { attempted: false, ok: false, configured: false } }),
    AT,
  );
  assert.equal(skipped.filter(i => i.type === 'backup-failed').length, 0, 'skipped is not failed');

  const failed = buildMaintenanceIncidents(
    report({ backup: { attempted: true, ok: false, configured: true, error: 'empty dump file' } }),
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

// ─── Incident clearing ───────────────────────────────────────────────────────
//
// Before this, NONE of this agent's incidents could clear — including the
// `vacuum-all-failed` prod actually carried, which stayed open long after the
// psql reachability problem behind it was fixed. A blanket sweep is right here
// (single path, every task every run, fully recomputed incident set) with one
// carve-out for the check that can silently not run.

function priorIncident(over: Partial<Incident> = {}): Incident {
  return {
    id: makeIncidentId(AGENT, 'vacuum-failed', 'Content'),
    agent: AGENT,
    type: 'vacuum-failed',
    severity: 'warning',
    target: 'database',
    targetId: 'Content',
    detected: '2026-08-11T03:00:00.000Z',
    message: 'VACUUM ANALYZE "Content" failed: connection refused',
    remediation: 'Inspect the reported error. autovacuum still covers this table.',
    status: 'open',
    attempts: 0,
    ...over,
  } as Incident;
}

function idsOf(incidents: Incident[]): Set<string> {
  return new Set(incidents.map(i => i.id));
}

/** Default coverage: everything observable. Override the axis under test. */
function cover(over: Partial<MaintenanceCoverage> = {}): MaintenanceCoverage {
  return { tableCheckRan: true, backupConfigured: true, ...over };
}

test('a clean report resolves a prior vacuum-failed incident', () => {
  const detected = buildMaintenanceIncidents(report(), AT);
  assert.equal(detected.length, 0, 'a fully healthy report raises nothing');

  const resolved = resolveClearedMaintenanceIncidents([priorIncident()], idsOf(detected), cover({ tableCheckRan: true }), AT);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].status, 'resolved');
  assert.equal(resolved[0].resolvedAt, AT);
});

test('NEGATIVE: a still-failing VACUUM is re-raised, so it is NOT resolved', () => {
  // The whole point: an incident the run reproduced must survive the sweep.
  // Only Content fails — an all-fail report would collapse into the single
  // `vacuum-all-failed` incident instead, which is a different id.
  const detected = buildMaintenanceIncidents(
    report({
      vacuum: VACUUM_TABLES.map(t =>
        t === 'Content' ? { table: t, success: false, error: 'connection refused' } : { table: t, success: true },
      ),
    }),
    AT,
  );
  assert.ok(detected.some(i => i.type === 'vacuum-failed'));

  const resolved = resolveClearedMaintenanceIncidents([priorIncident()], idsOf(detected), cover({ tableCheckRan: true }), AT);
  assert.equal(resolved.length, 0, 'a still-failing check must not be reported as cleared');
  assert.equal(summarize(detected).exitCode, 1, 'and the run still exits non-zero');
});

test('NEGATIVE: an unrun table-existence check keeps vacuum-table-missing OPEN', () => {
  // `findMissingTables` returns { missing: [], checked: false } when psql is
  // unreachable, so nothing is marked missing and the incident is not re-raised.
  // An empty list from a check that never executed is not evidence the table
  // exists — clearing it here would let the failure mode that HIDES the defect
  // also erase the record of it.
  const prior = [priorIncident({
    id: makeIncidentId(AGENT, 'vacuum-table-missing', 'Display'),
    type: 'vacuum-table-missing',
    severity: 'critical',
    targetId: 'Display',
    message: 'configured maintenance table "Display" does not exist',
  })];

  assert.equal(
    resolveClearedMaintenanceIncidents(prior, new Set(), cover({ tableCheckRan: false }), AT).length,
    0,
    'tableCheckRan=false must withhold resolution',
  );

  const resolved = resolveClearedMaintenanceIncidents(prior, new Set(), cover({ tableCheckRan: true }), AT);
  assert.equal(resolved.length, 1, 'a check that DID run and found it present clears it');
  assert.equal(resolved[0].status, 'resolved');
});

test('the carve-out is scoped: other types clear even when the table check did not run', () => {
  const resolved = resolveClearedMaintenanceIncidents([priorIncident()], new Set(), cover({ tableCheckRan: false }), AT);
  assert.equal(resolved.length, 1, 'vacuum-failed does not depend on the existence check');
});

test('EXIT-CODE PIN: one critical plus five resolutions still exits 1', () => {
  // `summarize` must run on the DETECTED set. If the agent ever computes it
  // after merging resolutions in, a run that cleared five stale findings would
  // report success while a backup it just watched fail sits open.
  const detected = buildMaintenanceIncidents(
    report({ backup: { attempted: true, ok: false, configured: true, error: 'empty dump file' } }),
    AT,
  );
  assert.equal(detected.filter(i => i.severity === 'critical').length, 1);

  const prior = ['Content', 'Schedule', 'Playlist', 'AuditLog', 'users'].map(t =>
    priorIncident({ id: makeIncidentId(AGENT, 'vacuum-failed', t), targetId: t }),
  );
  const resolved = resolveClearedMaintenanceIncidents(prior, idsOf(detected), cover({ tableCheckRan: true }), AT);
  assert.equal(resolved.length, 5);

  assert.equal(
    summarize(detected).exitCode,
    1,
    'resolutions must never green a run that detected a critical',
  );
  // And the merged set that reaches ops-state carries both.
  const merged = [...detected, ...resolved];
  assert.equal(merged.filter(i => i.status === 'resolved').length, 5);
  assert.equal(merged.filter(i => i.status === 'open').length, 1);
});

// ─── Backup: skipped vs failed is the whole boundary ─────────────────────────

function backupFailedIncident(): Incident {
  return priorIncident({
    id: makeIncidentId(AGENT, 'backup-failed', 'pg_dump'),
    type: 'backup-failed',
    severity: 'critical',
    targetId: 'pg_dump',
    message: 'database backup failed: empty dump file',
  });
}

test('an UNCONFIGURED backup target closes a stale backup-failed, naming the cause', () => {
  // The check no longer runs, so nothing will ever observe it recovering, and
  // leaving it open pins ops-state CRITICAL forever over a check the operator
  // switched off (health-guardian's disabled-edge-watch precedent). But the
  // message must say WHY — a bare "resolved" here would read as "the backup
  // succeeded", which is the exact false all-clear this workstream removes.
  const resolved = resolveClearedMaintenanceIncidents(
    [backupFailedIncident()],
    new Set(),
    cover({ backupConfigured: false }),
    AT,
  );

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].status, 'resolved');
  assert.match(resolved[0].message, /no longer configured/i);
  assert.match(resolved[0].message, /BACKUP_S3_BUCKET is unset/);
  assert.match(
    resolved[0].message,
    /does NOT mean a backup succeeded/i,
    'the audit trail must not imply a successful backup',
  );
});

test('a CONFIGURED backup target closes a stale backup-failed without the config caveat', () => {
  // Backups are on and this run did not reproduce the failure — an ordinary
  // recovery, so no "target went away" language.
  const resolved = resolveClearedMaintenanceIncidents(
    [backupFailedIncident()],
    new Set(),
    cover({ backupConfigured: true }),
    AT,
  );
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].status, 'resolved');
  assert.doesNotMatch(resolved[0].message, /no longer configured/i);
});

test('NEGATIVE: a MALFORMED bucket RAISES backup-failed — it is not a skip', () => {
  // The blocker. `runBackup` used to return { attempted: false, ok: true } for
  // a bucket that failed the format check, which buildMaintenanceIncidents
  // reads as "no backup requested" — so a typo produced no backup, no incident
  // and exit 0. Worse, once the sweep existed it would then CLEAR a real prior
  // backup-failed critical. Configured + attempted + failed is the truth.
  const detected = buildMaintenanceIncidents(
    report({
      backup: {
        attempted: true,
        ok: false,
        configured: true,
        error: 'BACKUP_S3_BUCKET is set but has an invalid format — no backup was taken',
      },
    }),
    AT,
  );

  const raised = detected.find(i => i.type === 'backup-failed');
  assert.ok(raised, 'a malformed bucket must raise backup-failed');
  assert.equal(raised.severity, 'critical');
  assert.equal(summarize(detected).exitCode, 1, 'and it must fail the run');

  // And because it IS re-raised, the sweep leaves the prior incident alone.
  const resolved = resolveClearedMaintenanceIncidents(
    [backupFailedIncident()],
    idsOf(detected),
    cover({ backupConfigured: true }),
    AT,
  );
  assert.equal(resolved.length, 0, 'a still-failing backup must never be cleared');
});

test('runBackup reports a malformed bucket as configured+attempted+failed', () => {
  // Pins the shape at the boundary the sweep depends on. Source-level because
  // runBackup reads process.env and shells out; the contract is what matters.
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'db-maintainer.ts'),
    'utf8',
  );
  const invalidBranch = src.slice(src.indexOf('has an invalid format') - 600, src.indexOf('has an invalid format') + 200);
  assert.match(invalidBranch, /attempted:\s*true/, 'a malformed bucket is an ATTEMPT that failed');
  assert.match(invalidBranch, /ok:\s*false/, 'a malformed bucket is a FAILURE, not a disable');
});

test('ORDERING: db-maintainer computes summarize() BEFORE resolving stale incidents', () => {
  // The exit-code contract is enforced BY PLACEMENT, so placement is what has
  // to be pinned. `summarize` runs on the detected set at one point in the
  // file; the sweep runs later, inside the locked block. Swap them and
  // `counts.exitCode` starts seeing resolved incidents — a run that cleared
  // five stale findings would exit 0 with a failed VACUUM still open.
  //
  // A behavioural test cannot reach this: db-maintainer's whole body needs a
  // live psql/docker. Source order is the observable, so this follows the
  // source-scan precedent in log-retention.test.ts.
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'db-maintainer.ts'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const summarizeAt = src.indexOf('summarize(incidents)');
  const resolveAt = src.indexOf('resolveClearedMaintenanceIncidents(');

  assert.ok(summarizeAt > 0, 'db-maintainer must still call summarize(incidents)');
  assert.ok(resolveAt > 0, 'db-maintainer must still resolve cleared incidents');
  assert.ok(
    summarizeAt < resolveAt,
    'summarize() must run on the DETECTED set — move it after the sweep and resolutions can green a red run',
  );

  // And it must summarize the detected array, never the merged one.
  assert.ok(
    !/summarize\(\s*result\.incidents/.test(src),
    'summarize must not be fed the post-resolution incident set',
  );
});

test('an agent may not clear another agent incidents', () => {
  const foreign = priorIncident({
    id: 'content-lifecycle:storage_high:system',
    agent: 'content-lifecycle',
    type: 'storage_high',
  });
  assert.equal(resolveClearedMaintenanceIncidents([foreign], new Set(), cover({ tableCheckRan: true }), AT).length, 0);
});

test('an already-resolved incident is not resolved twice', () => {
  const done = priorIncident({ status: 'resolved', resolvedAt: '2026-08-11T04:00:00.000Z' });
  assert.equal(resolveClearedMaintenanceIncidents([done], new Set(), cover({ tableCheckRan: true }), AT).length, 0);
});

test('no credential appears in any incident', () => {
  const serialized = JSON.stringify(
    buildMaintenanceIncidents(
      report({
        vacuum: [{ table: 'users', success: false, error: `connection to ${DB_URL} failed` }],
        backup: { attempted: true, ok: false, configured: true, error: `pg_dump ${DB_URL}` },
      }),
      AT,
    ),
  );
  assert.ok(
    !serialized.includes(PG_PW),
    'an error string can carry the URL — incidents must not leak the password',
  );
});

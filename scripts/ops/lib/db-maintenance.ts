/**
 * Vizora Autonomous Operations — db-maintainer pure logic
 *
 * Command construction and outcome→incident mapping, separated from I/O so the
 * failure semantics are testable without touching PostgreSQL.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * On 2026-08-12 `db-maintainer` had been reporting `Vacuum: 0 OK, 7 failed`
 * with an empty error log and `issuesFound: 0`, daily, unnoticed. Three
 * independent defects combined:
 *
 *   1. `psql` is not installed on the prod host (Postgres runs in a container),
 *      so every invocation failed at exec.
 *   2. The agent ran `pm2 flush` mid-run, truncating the very log file holding
 *      the per-table failure reasons it had just written.
 *   3. `issuesFound`/`incidents` were hardcoded to 0/[] with the comment
 *      "routine maintenance — no incidents", and the process exited 0. A total
 *      maintenance failure was therefore indistinguishable from success at
 *      every layer: logs, ops-state, dashboard, exit code.
 *
 * A fourth defect hid under the first: two of the seven configured table names
 * do not exist. Prisma `@@map`s `Display`→`devices` and `User`→`users`, so
 * those VACUUMs could never have succeeded even with a working `psql`.
 */

import { decomposePostgresUrl } from './pg-url.js';
import { makeIncidentId } from './state.js';
import type { Incident, Severity } from './types.js';

export const AGENT = 'db-maintainer';

/**
 * PHYSICAL table names — verified against `pg_class` on prod 2026-08-12.
 *
 * These are physical names, NOT Prisma model names. `Display` and `User` are
 * models; their tables are `devices` and `users` via `@@map`. Configuring model
 * names here is what produced two permanently-failing VACUUMs. `assertTablesExist`
 * turns any future mismatch into a loud incident rather than a silent per-table
 * failure.
 */
export const VACUUM_TABLES = [
  'Content',
  'devices',              // model Display  @@map("devices")
  'Schedule',
  'Playlist',
  'AuditLog',
  'users',                // model User     @@map("users")
  'content_impressions',  // model ContentImpression @@map("content_impressions")
] as const;

export interface PgCandidate {
  source: string;
  command: string;
  args: string[];
  /** Extra child env. Credentials belong HERE, never in `args`. */
  env: Record<string, string>;
  /**
   * True when the command writes its payload to stdout rather than a file —
   * the caller must capture and persist it. `docker exec pg_dump` cannot use
   * `-f` because the path would resolve inside the container.
   */
  capturesStdout?: boolean;
}

/**
 * Ordered `psql` candidates: host first, container second.
 *
 * Credential handling differs by path, deliberately:
 *   - host: password via `PGPASSWORD` in the child env. The previous
 *     implementation passed the whole `DATABASE_URL` as argv, which exposes the
 *     password to any user running `ps`.
 *   - container: no credential at all — the container's local socket
 *     authenticates without one. `docker exec -e PGPASSWORD=…` would put the
 *     secret straight back into host argv, so socket auth is strictly safer.
 *
 * Both paths derive user/database from `DATABASE_URL` instead of hardcoding
 * `-U postgres -d vizora`, so a future credential change cannot silently make
 * the container path operate as a different identity than the app.
 */
export function buildPsqlCandidates(
  databaseUrl: string | undefined,
  container: string,
): PgCandidate[] {
  const parts = decomposePostgresUrl(databaseUrl);
  if (!parts) return [];

  const candidates: PgCandidate[] = [];

  const hostArgs: string[] = [];
  if (parts.host) hostArgs.push('-h', parts.host);
  if (parts.port) hostArgs.push('-p', parts.port);
  if (parts.user) hostArgs.push('-U', parts.user);
  if (parts.database) hostArgs.push('-d', parts.database);
  const hostEnv: Record<string, string> = { PGCONNECT_TIMEOUT: '5' };
  if (parts.password) hostEnv.PGPASSWORD = parts.password;
  candidates.push({ source: 'host psql', command: 'psql', args: hostArgs, env: hostEnv });

  if (container) {
    const containerArgs = ['exec', container, 'psql'];
    if (parts.user) containerArgs.push('-U', parts.user);
    if (parts.database) containerArgs.push('-d', parts.database);
    candidates.push({
      source: `docker exec ${container} psql`,
      command: 'docker',
      args: containerArgs,
      env: {},
    });
  }

  return candidates;
}

/**
 * Ordered `pg_dump` candidates.
 *
 * The container variant sets `capturesStdout`, because the previously shipped
 * implementation passed `-f <hostPath>` only on the host branch and passed
 * NOTHING on the container branch — so a container-path backup wrote its dump
 * to a captured stdout buffer that was then discarded, producing no file and
 * reporting success. That is a data-loss-shaped failure; it is currently masked
 * only because `BACKUP_S3_BUCKET` is unset.
 */
export function buildPgDumpCandidates(
  databaseUrl: string | undefined,
  container: string,
  outputPath: string,
): PgCandidate[] {
  const parts = decomposePostgresUrl(databaseUrl);
  if (!parts) return [];

  const candidates: PgCandidate[] = [];

  const hostArgs: string[] = [];
  if (parts.host) hostArgs.push('-h', parts.host);
  if (parts.port) hostArgs.push('-p', parts.port);
  if (parts.user) hostArgs.push('-U', parts.user);
  if (parts.database) hostArgs.push(parts.database);
  hostArgs.push('-f', outputPath);
  const hostEnv: Record<string, string> = { PGCONNECT_TIMEOUT: '5' };
  if (parts.password) hostEnv.PGPASSWORD = parts.password;
  candidates.push({ source: 'host pg_dump', command: 'pg_dump', args: hostArgs, env: hostEnv });

  if (container) {
    const containerArgs = ['exec', container, 'pg_dump'];
    if (parts.user) containerArgs.push('-U', parts.user);
    if (parts.database) containerArgs.push(parts.database);
    candidates.push({
      source: `docker exec ${container} pg_dump`,
      command: 'docker',
      args: containerArgs,
      env: {},
      capturesStdout: true,
    });
  }

  return candidates;
}

// ─── Redaction ──────────────────────────────────────────────────────────────

/**
 * Strip credentials out of any URL embedded in free text.
 *
 * Error strings from `psql`/`pg_dump` routinely echo the connection string, so
 * putting a raw error into an incident would publish the DB password to
 * `ops-state.json`, the dashboard and any alert. Matches generically on
 * `scheme://user:password@` so it also covers `redis://:password@host`, and
 * needs no knowledge of the secret's value.
 */
export function redactUrlCredentials(text: string): string {
  return text.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^:/\s@]*):([^@\s/]+)@/g, '$1:***@');
}

// ─── Outcome → incidents ────────────────────────────────────────────────────

export interface VacuumOutcome {
  table: string;
  success: boolean;
  error?: string;
  /** Configured but absent from the database — a configuration defect. */
  missing?: boolean;
}

export interface MaintenanceReport {
  vacuum: VacuumOutcome[];
  prune: { ok: boolean; deleted: number | null; error?: string };
  redis: { available: boolean; reason?: string };
  backup: { attempted: boolean; ok: boolean; error?: string };
}

/**
 * Map maintenance outcomes to real incidents.
 *
 * Severity rationale, stated so it is arguable rather than assumed:
 *
 *   - missing table      CRITICAL — the agent is configured to maintain
 *                        something that does not exist, so it is silently doing
 *                        less than it claims. This is the defect class that hid
 *                        for months.
 *   - all VACUUMs failed CRITICAL — maintenance is structurally ineffective.
 *   - one VACUUM failed  WARNING  — degraded. Postgres `autovacuum` is enabled
 *                        and remains the primary mechanism, so a single missed
 *                        manual VACUUM is not an emergency.
 *   - prune failed       WARNING  — `alert_rule_fires` grows unbounded.
 *   - redis unavailable  INFO     — observability gap, not a data risk.
 *   - backup failed      CRITICAL — only raised when a backup was ATTEMPTED.
 */
export function buildMaintenanceIncidents(
  report: MaintenanceReport,
  detectedAt: string,
): Incident[] {
  const incidents: Incident[] = [];
  const push = (
    type: string,
    severity: Severity,
    targetId: string,
    message: string,
    remediation: string,
  ) => {
    incidents.push({
      id: makeIncidentId(AGENT, type, targetId),
      agent: AGENT,
      type,
      severity,
      target: 'database',
      targetId,
      detected: detectedAt,
      // Redact at the single choke point so no future call site can bypass it.
      message: redactUrlCredentials(message),
      remediation,
      status: 'open',
      attempts: 0,
    });
  };

  for (const v of report.vacuum.filter(v => v.missing)) {
    push(
      'vacuum-table-missing',
      'critical',
      v.table,
      `configured maintenance table "${v.table}" does not exist — VACUUM cannot ever succeed for it`,
      'Correct VACUUM_TABLES to the PHYSICAL table name (Prisma @@map renames models, e.g. Display→devices, User→users).',
    );
  }

  const attempted = report.vacuum.filter(v => !v.missing);
  const failed = attempted.filter(v => !v.success);

  if (attempted.length > 0 && failed.length === attempted.length) {
    push(
      'vacuum-all-failed',
      'critical',
      'all-tables',
      `every VACUUM ANALYZE failed (${failed.length}/${attempted.length}) — manual maintenance is structurally ineffective`,
      'Check psql reachability (host binary vs container) and DB identity. Postgres autovacuum still runs.',
    );
  } else {
    for (const v of failed) {
      push(
        'vacuum-failed',
        'warning',
        v.table,
        `VACUUM ANALYZE "${v.table}" failed: ${v.error ?? 'unknown error'}`,
        'Inspect the reported error. autovacuum still covers this table.',
      );
    }
  }

  if (!report.prune.ok) {
    push(
      'alert-fire-prune-failed',
      'warning',
      'alert_rule_fires',
      `alert_rule_fires prune failed: ${report.prune.error ?? 'unknown error'}`,
      'Table grows unbounded until this succeeds.',
    );
  }

  if (!report.redis.available) {
    push(
      'redis-unobservable',
      'info',
      'redis',
      `Redis status could not be read: ${report.redis.reason ?? 'unknown'}`,
      'Install redis-cli on the host, or accept that Redis memory/keys are unmonitored by this agent.',
    );
  }

  if (report.backup.attempted && !report.backup.ok) {
    push(
      'backup-failed',
      'critical',
      'pg_dump',
      `database backup failed: ${report.backup.error ?? 'unknown error'}`,
      'No fresh dump exists. Verify pg_dump reachability and that the dump file is non-empty.',
    );
  }

  return incidents;
}

/**
 * Counts for `AgentResult`. `issuesFixed` is 0 — this agent repairs nothing.
 *
 * ─── Exit-code rule ─────────────────────────────────────────────────────────
 *
 *   info-only incidents          → 0
 *   any warning or critical      → 1
 *   fatal agent failure          → 2  (set by the caller's catch block)
 *
 * `info` must NOT fail the process. `redis-cli` is not installed on the prod
 * host and will not be, so `redis-unobservable` is a permanent info finding —
 * treating it as process failure would make the agent exit non-zero every day
 * forever, which is exactly the alert-fatigue pattern this whole workstream
 * exists to remove. The finding is still recorded and still visible; it just
 * stops masquerading as a failed run.
 *
 * Incident recording is deliberately unchanged: `issuesFound` still counts
 * every incident regardless of severity.
 */
export function summarize(incidents: Incident[]): {
  issuesFound: number;
  issuesFixed: number;
  issuesEscalated: number;
  exitCode: number;
} {
  const actionable = incidents.filter(
    i => i.severity === 'critical' || i.severity === 'warning',
  );
  return {
    issuesFound: incidents.length,
    issuesFixed: 0,
    issuesEscalated: incidents.filter(i => i.severity === 'critical').length,
    exitCode: actionable.length === 0 ? 0 : 1,
  };
}

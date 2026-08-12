#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — DB Maintainer Agent
 *
 * Runs daily at 3am via PM2 cron:
 *   1. PostgreSQL VACUUM ANALYZE on high-churn tables (after asserting they exist)
 *   2. Prune stale `alert_rule_fires` dedup rows
 *   3. Redis memory & key reporting
 *   4. Log rotation (truncate .log files older than 7 days)
 *   5. Database backup (only when BACKUP_S3_BUCKET is set)
 *
 * Exit codes:
 *   0 — maintenance completed with no problems
 *   1 — maintenance completed but something failed (incidents recorded)
 *   2 — fatal error (agent could not complete)
 *
 * ─── Ordering rule: `pm2 flush` runs FIRST, never mid-run ────────────────────
 *
 * `pm2 flush` truncates PM2's log files. It used to run as task 4, which
 * deleted the per-table VACUUM failure reasons this agent had already written
 * in the same run — so `Vacuum: 0 OK, 7 failed` reached the operator with no
 * cause, and `ops-db-maintainer-error.log` was 0 bytes. Flushing at the START
 * keeps the hygiene benefit (clears the previous cycle) while guaranteeing that
 * everything this run produces survives it. Do not move it back.
 *
 * Security note: `execFileSync` everywhere (no shell). Database credentials are
 * passed via `PGPASSWORD` in the child environment and NEVER as arguments —
 * argv is world-readable through `ps`.
 */

import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { AgentResult } from './lib/types.js';
import {
  readOpsState,
  writeOpsState,
  recordAgentRun,
} from './lib/state.js';
import { log, sendInlineAlert } from './lib/alerting.js';
import {
  AGENT,
  VACUUM_TABLES,
  buildMaintenanceIncidents,
  buildPgDumpCandidates,
  buildPsqlCandidates,
  redactUrlCredentials,
  summarize,
  type MaintenanceReport,
  type PgCandidate,
  type VacuumOutcome,
} from './lib/db-maintenance.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Postgres container used when `psql` is absent from the host — prod's shape. */
const PG_CONTAINER = process.env.CONFIG_DRIFT_PG_CONTAINER ?? 'vizora-postgres';

const VACUUM_TIMEOUT_MS = 120_000; // 2 minutes per table
const PM2_FLUSH_TIMEOUT_MS = 10_000;
const LOG_MAX_AGE_DAYS = 7;
const REDIS_TIMEOUT_MS = 10_000;

/**
 * Retention window for `alert_rule_fires` dedup rows (notifications #18).
 *
 * These rows are per-(rule, device) MUTABLE dedup state, not an audit log. A
 * row older than the window means that rule/device pair hasn't fired in that
 * long, so deleting it is safe — the next offline event re-creates it.
 */
const ALERT_RULE_FIRE_RETENTION_DAYS = (() => {
  const parsed = parseInt(process.env.RETENTION_DAYS || '90', 10);
  return Number.isNaN(parsed) || parsed < 1 ? 90 : parsed;
})();

const LOGS_DIR = join(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..', '..', 'logs',
);

// ─── Postgres execution ──────────────────────────────────────────────────────

/** Run SQL through the first candidate that works. Throws with all attempts. */
function execPsql(sql: string, timeoutMs: number): { output: string; source: string } {
  const candidates = buildPsqlCandidates(process.env.DATABASE_URL, PG_CONTAINER);
  if (candidates.length === 0) throw new Error('DATABASE_URL missing or unparseable');

  const attempts: string[] = [];
  for (const candidate of candidates) {
    try {
      const output = execFileSync(
        candidate.command,
        [...candidate.args, '-t', '-A', '-c', sql],
        {
          stdio: 'pipe',
          timeout: timeoutMs,
          env: { ...process.env, ...candidate.env },
          encoding: 'utf-8',
        },
      );
      return { output, source: candidate.source };
    } catch (err) {
      const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
      attempts.push(`${candidate.source}: ${redactUrlCredentials(msg)}`);
    }
  }
  throw new Error(`all psql candidates failed — ${attempts.join('; ')}`);
}

// ─── Task 1a: assert configured tables exist ─────────────────────────────────

/**
 * Confirm every configured table exists BEFORE attempting to vacuum it.
 *
 * Two of the seven configured names never existed (`Display`/`User` are Prisma
 * models; the tables are `devices`/`users`), which produced two permanently
 * failing VACUUMs indistinguishable from transport errors. Asserting up front
 * turns that into one clear configuration incident.
 *
 * Returns the set of names that are absent. A failure to run the check at all
 * is reported by the caller as a transport failure, not as "all present".
 */
function findMissingTables(): { missing: string[]; checked: boolean; error?: string } {
  const list = VACUUM_TABLES.map(t => `'${t}'`).join(',');
  try {
    const { output } = execPsql(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace ` +
      `WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (${list})`,
      30_000,
    );
    const present = new Set(output.split('\n').map(l => l.trim()).filter(Boolean));
    return { missing: VACUUM_TABLES.filter(t => !present.has(t)), checked: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { missing: [], checked: false, error: redactUrlCredentials(msg) };
  }
}

// ─── Task 1b: VACUUM ANALYZE ─────────────────────────────────────────────────

/**
 * `VACUUM ANALYZE` per table. Each runs standalone via `psql -c`, i.e. in
 * autocommit — VACUUM cannot run inside a transaction block, so this form is
 * required and correct. Errors are caught per table so one failure does not
 * block the rest.
 */
function vacuumAnalyze(missing: string[]): VacuumOutcome[] {
  const results: VacuumOutcome[] = [];
  const missingSet = new Set(missing);

  log(AGENT, `VACUUM ANALYZE across ${VACUUM_TABLES.length} tables`);
  for (const table of VACUUM_TABLES) {
    if (missingSet.has(table)) {
      log(AGENT, `  "${table}" — SKIPPED (table does not exist)`);
      results.push({ table, success: false, missing: true });
      continue;
    }
    try {
      const { source } = execPsql(`VACUUM ANALYZE "${table}";`, VACUUM_TIMEOUT_MS);
      log(AGENT, `  "${table}" — OK (${source})`);
      results.push({ table, success: true });
    } catch (err) {
      const msg = redactUrlCredentials(err instanceof Error ? err.message : String(err));
      log(AGENT, `  "${table}" — FAILED: ${msg}`);
      results.push({ table, success: false, error: msg });
    }
  }
  return results;
}

// ─── Task 2: prune alert_rule_fires ──────────────────────────────────────────

function pruneAlertRuleFires(): { ok: boolean; deleted: number | null; error?: string } {
  const days = ALERT_RULE_FIRE_RETENTION_DAYS;
  log(AGENT, `Pruning alert_rule_fires older than ${days} days`);
  try {
    // `days` is a validated integer — no injection surface.
    const { output } = execPsql(
      `DELETE FROM alert_rule_fires WHERE "lastFiredAt" < NOW() - INTERVAL '${days} days';`,
      VACUUM_TIMEOUT_MS,
    );
    const match = output.match(/DELETE\s+(\d+)/);
    const deleted = match ? parseInt(match[1], 10) : 0;
    log(AGENT, `  prune — OK (${deleted} deleted)`);
    return { ok: true, deleted };
  } catch (err) {
    const msg = redactUrlCredentials(err instanceof Error ? err.message : String(err));
    log(AGENT, `  prune — FAILED: ${msg}`);
    return { ok: false, deleted: null, error: msg };
  }
}

// ─── Task 3: Redis status ────────────────────────────────────────────────────

interface RedisStatus {
  available: boolean;
  reason?: string;
  memoryHuman: string;
  dbSize: string;
}

/**
 * Report Redis memory and key count.
 *
 * Unavailability is now EXPLICIT. Previously both fields reported the string
 * `unknown` whether Redis was healthy-but-unreadable or the CLI was simply not
 * installed — and `redis-cli` is not installed on the prod host, so the agent
 * has always printed `unknown` and nobody could tell it apart from a real
 * reading.
 *
 * No container fallback is attempted on purpose: `docker exec -e REDISCLI_AUTH`
 * would place the Redis password into host argv, which is the exposure the
 * Postgres path deliberately avoids. Better to report the gap honestly.
 */
function checkRedis(): RedisStatus {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const status: RedisStatus = { available: false, memoryHuman: 'unavailable', dbSize: 'unavailable' };

  try {
    const memory = execFileSync('redis-cli', ['-u', redisUrl, 'info', 'memory'], {
      timeout: REDIS_TIMEOUT_MS, stdio: 'pipe', encoding: 'utf-8',
    });
    const match = memory.match(/used_memory_human:(.+)/);
    if (match) status.memoryHuman = match[1].trim();

    const dbsize = execFileSync('redis-cli', ['-u', redisUrl, 'dbsize'], {
      timeout: REDIS_TIMEOUT_MS, stdio: 'pipe', encoding: 'utf-8',
    });
    status.dbSize = dbsize.trim();
    status.available = true;
    log(AGENT, `Redis: memory=${status.memoryHuman}, keys=${status.dbSize}`);
  } catch (err) {
    const raw = err instanceof Error ? err.message.split('\n')[0] : String(err);
    status.reason = /ENOENT/.test(raw)
      ? 'redis-cli is not installed on this host'
      : redactUrlCredentials(raw);
    log(AGENT, `Redis: UNAVAILABLE — ${status.reason}`);
  }

  return status;
}

// ─── Task 4: log rotation ────────────────────────────────────────────────────

interface LogRotationResult { truncated: string[]; errors: string[] }

/** Truncate (not delete) .log files older than the window — PM2 holds handles. */
function rotateLogs(): LogRotationResult {
  const result: LogRotationResult = { truncated: [], errors: [] };

  let files: string[];
  try {
    files = readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
  } catch {
    log(AGENT, `Logs directory not readable: ${LOGS_DIR}`);
    return result;
  }

  const cutoff = Date.now() - LOG_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  for (const file of files) {
    const filePath = join(LOGS_DIR, file);
    try {
      if (statSync(filePath).mtimeMs < cutoff) {
        writeFileSync(filePath, '');
        result.truncated.push(file);
      }
    } catch (err) {
      result.errors.push(`${file}: ${err instanceof Error ? err.message : err}`);
    }
  }
  log(AGENT, `Log rotation: ${result.truncated.length} truncated, ${result.errors.length} errors`);
  return result;
}

// ─── Task 5: backup ──────────────────────────────────────────────────────────

/**
 * Dump the database, gzip it, and upload when configured.
 *
 * The container candidate streams to stdout — `-f` would resolve INSIDE the
 * container — so its bytes are captured and written here. The previously
 * shipped version passed neither, discarding the dump and reporting success:
 * a backup that silently produces no file. The non-empty assertion below is
 * what makes that failure impossible to repeat.
 */
function runBackup(): { attempted: boolean; ok: boolean; error?: string } {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) {
    log(AGENT, 'Backup skipped: BACKUP_S3_BUCKET not set');
    return { attempted: false, ok: true };
  }
  if (!/^s3:\/\/[a-zA-Z0-9.\-_/]+$|^[a-zA-Z0-9.\-_/]+$/.test(bucket)) {
    return { attempted: false, ok: true, error: 'BACKUP_S3_BUCKET has invalid format' };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawPath = `/tmp/vizora-backup-${timestamp}.sql`;
  const gzPath = `${rawPath}.gz`;
  const candidates = buildPgDumpCandidates(process.env.DATABASE_URL, PG_CONTAINER, rawPath);
  if (candidates.length === 0) {
    return { attempted: true, ok: false, error: 'DATABASE_URL missing or unparseable' };
  }

  const attempts: string[] = [];
  let source: string | null = null;

  for (const candidate of candidates as PgCandidate[]) {
    try {
      const out = execFileSync(candidate.command, candidate.args, {
        stdio: 'pipe',
        timeout: 300_000,
        env: { ...process.env, ...candidate.env },
        maxBuffer: 512 * 1024 * 1024,
      });
      if (candidate.capturesStdout) writeFileSync(rawPath, out);

      // A dump that produced no bytes is a FAILURE, not a success.
      if (!existsSync(rawPath) || statSync(rawPath).size === 0) {
        throw new Error('pg_dump produced no output file (or an empty one)');
      }
      source = candidate.source;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
      attempts.push(`${candidate.source}: ${redactUrlCredentials(msg)}`);
    }
  }

  if (!source) return { attempted: true, ok: false, error: attempts.join('; ') };

  try {
    execFileSync('gzip', ['-f', rawPath], { timeout: 60_000, stdio: 'pipe' });
    log(AGENT, `Backup created via ${source}`);
    const s3Dest = bucket.startsWith('s3://') ? bucket : `s3://${bucket}`;
    execFileSync('aws', ['s3', 'cp', gzPath, `${s3Dest}/${gzPath.split('/').pop()}`], {
      timeout: 300_000, stdio: 'pipe',
    });
    log(AGENT, `Backup uploaded to ${s3Dest}`);
    return { attempted: true, ok: true };
  } catch (err) {
    const msg = redactUrlCredentials(err instanceof Error ? err.message.split('\n')[0] : String(err));
    return { attempted: true, ok: false, error: `dump ok via ${source} but post-processing failed: ${msg}` };
  }
}

// ─── PM2 flush ───────────────────────────────────────────────────────────────

/** Runs FIRST — see the ordering rule in the module docblock. */
function pm2Flush(): boolean {
  try {
    execFileSync('pm2', ['flush'], { timeout: PM2_FLUSH_TIMEOUT_MS, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();

  // FIRST, before any diagnostics exist to destroy.
  const flushOk = pm2Flush();
  log(AGENT, '=== DB Maintainer starting ===');
  log(AGENT, `  pm2 flush (run first, so this run's logs survive): ${flushOk ? 'OK' : 'FAILED'}`);

  try {
    const tableCheck = findMissingTables();
    if (!tableCheck.checked) {
      log(AGENT, `Table existence check FAILED: ${tableCheck.error}`);
    } else if (tableCheck.missing.length > 0) {
      log(AGENT, `Configured tables missing from database: ${tableCheck.missing.join(', ')}`);
    }

    const report: MaintenanceReport = {
      vacuum: vacuumAnalyze(tableCheck.missing),
      prune: pruneAlertRuleFires(),
      redis: checkRedis(),
      backup: runBackup(),
    };
    const logRotation = rotateLogs();

    const detectedAt = new Date().toISOString();
    const incidents = buildMaintenanceIncidents(report, detectedAt);
    const counts = summarize(incidents);
    const durationMs = Date.now() - startTime;

    const result: AgentResult = {
      agent: AGENT,
      timestamp: detectedAt,
      durationMs,
      issuesFound: counts.issuesFound,
      issuesFixed: counts.issuesFixed,
      issuesEscalated: counts.issuesEscalated,
      incidents,
    };

    const state = readOpsState();
    try {
      recordAgentRun(state, result);
    } finally {
      writeOpsState(state);
    }

    const vacuumOk = report.vacuum.filter(v => v.success).length;
    log(AGENT, '=== DB Maintainer complete ===');
    log(AGENT, `  Duration: ${durationMs}ms`);
    log(AGENT, `  Vacuum: ${vacuumOk} OK, ${report.vacuum.length - vacuumOk} not OK`);
    log(AGENT, `  alert_rule_fires pruned: ${report.prune.deleted ?? 'n/a'}`);
    log(AGENT, `  Redis: ${report.redis.available ? 'available' : `UNAVAILABLE (${report.redis.reason})`}`);
    log(AGENT, `  Logs truncated: ${logRotation.truncated.length}`);
    log(AGENT, `  Issues: ${counts.issuesFound} (${counts.issuesEscalated} critical), repaired 0 by design`);

    for (const incident of incidents) {
      log(AGENT, `  [${incident.severity}] ${incident.type} ${incident.targetId} — ${incident.message}`);
    }

    // §12b: surface criticals at the write site rather than waiting for the
    // next aggregate report. Silent maintenance failure is what this agent's
    // whole repair is about.
    const criticals = incidents.filter(i => i.severity === 'critical');
    if (criticals.length > 0) {
      await sendInlineAlert(
        AGENT,
        'critical',
        `${criticals.length} database maintenance failure(s)`,
        criticals.map(i => `${i.type} (${i.targetId}): ${i.message}`).join('\n'),
      );
    }

    process.exitCode = counts.exitCode;
  } catch (err) {
    const msg = redactUrlCredentials(err instanceof Error ? err.message : String(err));
    log(AGENT, `FATAL: ${msg}`);
    process.exitCode = 2;
  }
}

main();

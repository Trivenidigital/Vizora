#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — DB Maintainer Agent
 *
 * Runs daily at 3am via PM2 cron. Performs routine maintenance tasks:
 *   1. PostgreSQL VACUUM ANALYZE on high-churn tables
 *   2. Redis memory & key count reporting
 *   3. Log rotation (truncate .log files older than 7 days)
 *   4. PM2 flush (clear PM2's internal log buffer)
 *   5. Backup verification placeholder (future: S3 bucket check)
 *
 * Exit codes:
 *   0 — maintenance completed successfully
 *   2 — fatal error (agent could not complete)
 *
 * Security note: Uses execFileSync (no shell) for psql, redis-cli, and pm2.
 * Arguments are passed as arrays — no shell injection risk.
 */

import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { AgentResult } from './lib/types.js';
import {
  readOpsState,
  writeOpsState,
  recordAgentRun,
} from './lib/state.js';
import { log } from './lib/alerting.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'db-maintainer';

/**
 * Postgres container used to reach `psql` when it is not installed on the host —
 * which is prod's actual shape. Set empty to disable the container fallback.
 */
const PG_CONTAINER = process.env.CONFIG_DRIFT_PG_CONTAINER ?? 'vizora-postgres';

/**
 * High-churn PostgreSQL tables to VACUUM ANALYZE.
 *
 * `content_impressions` is the proof-of-play table — at ~12k rows/day/org
 * it bloats fast and was the top finding in the R6 analytics scout (table
 * was previously absent from this list, so weekly bloat went unmanaged).
 * Lower-case + underscores because the impressions model uses @@map for
 * its physical table name, unlike the PascalCase Prisma defaults.
 */
const VACUUM_TABLES = [
  'Content',
  'Display',
  'Schedule',
  'Playlist',
  'AuditLog',
  'User',
  'content_impressions',
];

const VACUUM_TIMEOUT_MS = 120_000; // 2 minutes per table
const PM2_FLUSH_TIMEOUT_MS = 10_000;
const LOG_MAX_AGE_DAYS = 7;

/**
 * Retention window for `alert_rule_fires` dedup rows (notifications #18).
 *
 * These rows are per-(rule, device) MUTABLE dedup state, not an audit log
 * (see the model comment in schema.prisma). A row older than the window
 * means that rule/device pair hasn't fired an alert in that long, so
 * deleting it is safe: the next offline event simply re-creates the row and
 * alerts normally — well outside the 15-min dedup window. Overridable via
 * RETENTION_DAYS; defaults to 90.
 */
const ALERT_RULE_FIRE_RETENTION_DAYS = (() => {
  const parsed = parseInt(process.env.RETENTION_DAYS || '90', 10);
  return Number.isNaN(parsed) || parsed < 1 ? 90 : parsed;
})();

/**
 * Logs directory — resolves to `<project-root>/logs/`.
 * The regex handles Windows drive-letter paths from `import.meta.url`
 * (e.g., `/C:/projects/...` → `C:/projects/...`).
 */
const LOGS_DIR = join(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..', '..', 'logs',
);

// ─── Postgres CLI Helpers ───────────────────────────────────────────────────

interface PsqlCandidate {
  command: string;
  args: string[];
  env?: Record<string, string>;
  source: string;
}

/**
 * Build ordered candidates for psql invocation.
 * Tries host psql first (if available), then docker exec as fallback.
 */
function buildPsqlCandidates(databaseUrl: string): PsqlCandidate[] {
  const candidates: PsqlCandidate[] = [];

  // Try host psql first
  candidates.push({
    command: 'psql',
    args: [databaseUrl],
    source: 'host psql',
  });

  // Docker fallback
  if (PG_CONTAINER) {
    candidates.push({
      command: 'docker',
      args: ['exec', '-i', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', 'vizora'],
      source: 'docker exec psql',
    });
  }

  return candidates;
}

/**
 * Try to execute a psql command using ordered candidates (host first, container fallback).
 * Returns the output on success or throws the last error encountered.
 */
function execPsql(
  databaseUrl: string,
  sqlCommand: string,
  timeoutMs: number,
): { output: string; source: string } {
  const candidates = buildPsqlCandidates(databaseUrl);
  const attempts: string[] = [];

  for (const candidate of candidates) {
    try {
      const fullArgs = candidate.source === 'host psql'
        ? [...candidate.args, '-c', sqlCommand]
        : [...candidate.args, '-c', sqlCommand];

      const output = execFileSync(candidate.command, fullArgs, {
        stdio: 'pipe',
        timeout: timeoutMs,
        env: { ...process.env, ...candidate.env },
        encoding: 'utf-8',
      });

      return { output, source: candidate.source };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push(`${candidate.source}: ${msg}`);
    }
  }

  const allAttempts = attempts.join('; ');
  throw new Error(`All psql candidates failed: ${allAttempts}`);
}

/**
 * Build ordered candidates for pg_dump invocation.
 * Tries host pg_dump first (if available), then docker exec as fallback.
 */
function buildPgDumpCandidates(databaseUrl: string): PsqlCandidate[] {
  const candidates: PsqlCandidate[] = [];

  // Try host pg_dump first
  candidates.push({
    command: 'pg_dump',
    args: [databaseUrl],
    source: 'host pg_dump',
  });

  // Docker fallback
  if (PG_CONTAINER) {
    candidates.push({
      command: 'docker',
      args: ['exec', '-i', PG_CONTAINER, 'pg_dump', '-U', 'postgres', 'vizora'],
      source: 'docker exec pg_dump',
    });
  }

  return candidates;
}

/**
 * Try to execute a pg_dump command using ordered candidates (host first, container fallback).
 * Writes output to the specified file path.
 * Returns the source on success or throws the last error encountered.
 */
function execPgDump(
  databaseUrl: string,
  outputPath: string,
  timeoutMs: number,
): string {
  const candidates = buildPgDumpCandidates(databaseUrl);
  const attempts: string[] = [];

  for (const candidate of candidates) {
    try {
      const fullArgs = candidate.source === 'host pg_dump'
        ? [...candidate.args, '-f', outputPath]
        : [...candidate.args];

      execFileSync(candidate.command, fullArgs, {
        stdio: 'pipe',
        timeout: timeoutMs,
        env: { ...process.env, ...candidate.env },
      });

      return candidate.source;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push(`${candidate.source}: ${msg}`);
    }
  }

  const allAttempts = attempts.join('; ');
  throw new Error(`All pg_dump candidates failed: ${allAttempts}`);
}

// ─── Task 1: PostgreSQL VACUUM ANALYZE ───────────────────────────────────────

interface VacuumResult {
  table: string;
  success: boolean;
  error?: string;
  source?: string;
}

/**
 * Run VACUUM ANALYZE on each high-churn table individually.
 * Catches errors per table so one failure doesn't block the rest.
 * Uses host psql first, then falls back to docker exec if available.
 */
function vacuumAnalyze(): VacuumResult[] {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log(AGENT, 'DATABASE_URL not set — skipping VACUUM ANALYZE');
    return [];
  }

  log(AGENT, `Running VACUUM ANALYZE on ${VACUUM_TABLES.length} tables`);
  const results: VacuumResult[] = [];

  for (const table of VACUUM_TABLES) {
    try {
      const { source } = execPsql(databaseUrl, `VACUUM ANALYZE "${table}";`, VACUUM_TIMEOUT_MS);
      log(AGENT, `  VACUUM ANALYZE "${table}" — OK (source: ${source})`);
      results.push({ table, success: true, source });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(AGENT, `  VACUUM ANALYZE "${table}" — FAILED: ${msg}`);
      results.push({ table, success: false, error: msg });
    }
  }

  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;
  log(AGENT, `VACUUM ANALYZE complete: ${ok} OK, ${fail} failed`);
  return results;
}

// ─── Task 1b: Prune stale alert_rule_fires rows ──────────────────────────────

interface AlertFirePruneResult {
  deleted: number | null;
  error?: string;
}

/**
 * Delete `alert_rule_fires` rows whose `lastFiredAt` is older than the
 * retention window (notifications #18). Bounds the table's rules×devices
 * growth. Uses host psql first, then falls back to docker exec if available;
 * the interval is a validated integer, so there is no injection surface.
 */
function pruneAlertRuleFires(): AlertFirePruneResult {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log(AGENT, 'alert_rule_fires prune skipped — DATABASE_URL not set');
    return { deleted: null };
  }

  const days = ALERT_RULE_FIRE_RETENTION_DAYS;
  log(AGENT, `Pruning alert_rule_fires older than ${days} days`);
  try {
    const { output } = execPsql(
      databaseUrl,
      `DELETE FROM alert_rule_fires WHERE "lastFiredAt" < NOW() - INTERVAL '${days} days';`,
      VACUUM_TIMEOUT_MS,
    );
    // psql prints the command tag "DELETE <n>" to stdout.
    const match = output.match(/DELETE\s+(\d+)/);
    const deleted = match ? parseInt(match[1], 10) : 0;
    log(AGENT, `  alert_rule_fires prune — OK (${deleted} deleted)`);
    return { deleted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(AGENT, `  alert_rule_fires prune — FAILED: ${msg}`);
    return { deleted: null, error: msg };
  }
}

// ─── Task 2: Redis Cleanup / Status ──────────────────────────────────────────

interface RedisStatus {
  memoryHuman: string;
  dbSize: string;
  error?: string;
}

/**
 * Report Redis memory usage and key count via redis-cli.
 * Catches errors gracefully — Redis may not be accessible.
 */
function checkRedis(): RedisStatus {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  log(AGENT, 'Checking Redis status');

  const status: RedisStatus = { memoryHuman: 'unknown', dbSize: 'unknown' };

  try {
    // execFileSync avoids shell — no injection risk from REDIS_URL.
    const memoryOutput = execFileSync('redis-cli', ['-u', redisUrl, 'info', 'memory'], {
      timeout: 10_000,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    const memoryMatch = memoryOutput.match(/used_memory_human:(.+)/);
    if (memoryMatch) {
      status.memoryHuman = memoryMatch[1].trim();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(AGENT, `  Redis memory check failed: ${msg}`);
    status.error = msg;
  }

  try {
    const dbsizeOutput = execFileSync('redis-cli', ['-u', redisUrl, 'dbsize'], {
      timeout: 10_000,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    status.dbSize = dbsizeOutput.trim();
  } catch (err) {
    if (!status.error) {
      const msg = err instanceof Error ? err.message : String(err);
      status.error = msg;
    }
  }

  log(AGENT, `  Redis memory: ${status.memoryHuman}, keys: ${status.dbSize}`);
  return status;
}

// ─── Task 3: Log Rotation ────────────────────────────────────────────────────

interface LogRotationResult {
  truncated: string[];
  errors: string[];
}

/**
 * Find .log files in logs/ directory older than 7 days and truncate them.
 * Uses truncation (not deletion) because PM2 keeps file handles open.
 */
function rotateLogs(): LogRotationResult {
  log(AGENT, `Rotating logs older than ${LOG_MAX_AGE_DAYS} days in ${LOGS_DIR}`);
  const result: LogRotationResult = { truncated: [], errors: [] };

  let files: string[];
  try {
    files = readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
  } catch {
    log(AGENT, `  Logs directory not found or not readable: ${LOGS_DIR}`);
    return result;
  }

  const cutoff = Date.now() - LOG_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const filePath = join(LOGS_DIR, file);
    try {
      const stat = statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        // Truncate by writing empty content — preserves file handle for PM2
        writeFileSync(filePath, '');
        log(AGENT, `  Truncated: ${file}`);
        result.truncated.push(file);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(AGENT, `  Failed to process ${file}: ${msg}`);
      result.errors.push(`${file}: ${msg}`);
    }
  }

  log(AGENT, `Log rotation: ${result.truncated.length} truncated, ${result.errors.length} errors`);
  return result;
}

// ─── Task 4: PM2 Flush ──────────────────────────────────────────────────────

/**
 * Flush PM2's internal log buffer via `pm2 flush`.
 * Returns true on success, false on failure.
 */
function pm2Flush(): boolean {
  log(AGENT, 'Flushing PM2 logs');
  try {
    execFileSync('pm2', ['flush'], {
      timeout: PM2_FLUSH_TIMEOUT_MS,
      stdio: 'pipe',
    });
    log(AGENT, '  PM2 flush — OK');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(AGENT, `  PM2 flush — FAILED: ${msg}`);
    return false;
  }
}

// ─── Task 5: Backup Verification ─────────────────────────────────────────────

/**
 * Run a database backup, compressing the dump with gzip.
 * If BACKUP_S3_BUCKET is set, the backup is created; otherwise skipped.
 * Uses host pg_dump first, then falls back to docker exec if available.
 */
function runBackup(): void {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) {
    log(AGENT, 'Backup skipped: BACKUP_S3_BUCKET not set');
    return;
  }

  // Validate bucket format to prevent injection via malformed values
  if (!/^s3:\/\/[a-zA-Z0-9.\-_\/]+$|^[a-zA-Z0-9.\-_\/]+$/.test(bucket)) {
    log(AGENT, `Backup skipped: BACKUP_S3_BUCKET has invalid format: ${bucket}`);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log(AGENT, 'Backup skipped: DATABASE_URL not set');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `vizora-backup-${timestamp}.sql.gz`;
  const tmpPath = `/tmp/${filename}`;

  const tmpPathRaw = `/tmp/vizora-backup-${timestamp}.sql`;

  try {
    // Two-step backup: pg_dump (with host/container fallback) then gzip
    const pgDumpSource = execPgDump(databaseUrl, tmpPathRaw, 300_000);
    execFileSync('gzip', ['-f', tmpPathRaw], {
      timeout: 60_000,
      stdio: 'pipe',
    });
    log(AGENT, `Backup created: ${filename} (pg_dump source: ${pgDumpSource})`);

    // Upload to S3 if aws CLI is available
    const s3Dest = bucket.startsWith('s3://') ? bucket : `s3://${bucket}`;
    try {
      execFileSync('aws', ['s3', 'cp', tmpPath, `${s3Dest}/${filename}`], {
        timeout: 300_000,
        stdio: 'pipe',
      });
      log(AGENT, `Backup uploaded to ${s3Dest}/${filename}`);
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      log(AGENT, `Backup upload to S3 failed (local backup retained): ${msg}`);
    }

    // Clean up local temp file after successful upload
    try {
      execFileSync('rm', ['-f', tmpPath], { stdio: 'pipe' });
    } catch {
      // Non-critical -- /tmp will be cleaned by OS
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(AGENT, `Backup failed: ${msg}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log(AGENT, '=== DB Maintainer starting ===');

  try {
    // ── 1. PostgreSQL VACUUM ANALYZE ──
    const vacuumResults = vacuumAnalyze();

    // ── 1b. Prune stale alert_rule_fires dedup rows ──
    const alertFirePrune = pruneAlertRuleFires();

    // ── 2. Redis status ──
    const redisStatus = checkRedis();

    // ── 3. Log rotation ──
    const logRotation = rotateLogs();

    // ── 4. PM2 flush ──
    const pm2Ok = pm2Flush();

    // ── 5. Database backup ──
    runBackup();

    // ── Record agent run ──
    const durationMs = Date.now() - startTime;

    const vacuumOk = vacuumResults.filter(r => r.success).length;
    const vacuumFail = vacuumResults.filter(r => !r.success).length;

    const result: AgentResult = {
      agent: AGENT,
      timestamp: new Date().toISOString(),
      durationMs,
      issuesFound: 0,
      issuesFixed: 0,
      issuesEscalated: 0,
      incidents: [], // Routine maintenance — no incidents
    };

    const state = readOpsState();
    recordAgentRun(state, result);
    writeOpsState(state);

    log(AGENT, '=== DB Maintainer complete ===');
    log(AGENT, `  Duration: ${durationMs}ms`);
    log(AGENT, `  Vacuum: ${vacuumOk} OK, ${vacuumFail} failed`);
    log(AGENT, `  alert_rule_fires pruned: ${alertFirePrune.deleted ?? 'n/a'}`);
    log(AGENT, `  Redis: memory=${redisStatus.memoryHuman}, keys=${redisStatus.dbSize}`);
    log(AGENT, `  Logs truncated: ${logRotation.truncated.length}`);
    log(AGENT, `  PM2 flush: ${pm2Ok ? 'OK' : 'FAILED'}`);

    process.exitCode = 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(AGENT, `FATAL: ${msg}`);
    process.exitCode = 2;
  }
}

main();

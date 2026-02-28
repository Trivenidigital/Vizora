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
 * Security note: All execSync calls use hardcoded command strings or
 * environment variable references — no user input interpolation.
 * This is safe — no injection risk. execSync is required here because
 * we need to invoke system tools (psql, redis-cli, pm2) that are not
 * available through the application's execFileNoThrow utility.
 */

import { execSync } from 'node:child_process';
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

/** High-churn PostgreSQL tables to VACUUM ANALYZE */
const VACUUM_TABLES = [
  'Content',
  'Display',
  'Schedule',
  'Playlist',
  'AuditLog',
  'User',
];

const VACUUM_TIMEOUT_MS = 120_000; // 2 minutes per table
const PM2_FLUSH_TIMEOUT_MS = 10_000;
const LOG_MAX_AGE_DAYS = 7;

/**
 * Logs directory — resolves to `<project-root>/logs/`.
 * The regex handles Windows drive-letter paths from `import.meta.url`
 * (e.g., `/C:/projects/...` → `C:/projects/...`).
 */
const LOGS_DIR = join(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..', '..', 'logs',
);

// ─── Task 1: PostgreSQL VACUUM ANALYZE ───────────────────────────────────────

interface VacuumResult {
  table: string;
  success: boolean;
  error?: string;
}

/**
 * Run VACUUM ANALYZE on each high-churn table individually.
 * Catches errors per table so one failure doesn't block the rest.
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
      // Hardcoded table names from VACUUM_TABLES constant — safe, no user input.
      // execSync is required to invoke psql CLI tool.
      execSync(
        `psql "${databaseUrl}" -c 'VACUUM ANALYZE "${table}";'`,
        { timeout: VACUUM_TIMEOUT_MS, stdio: 'pipe', shell: '/bin/bash' },
      );
      log(AGENT, `  VACUUM ANALYZE "${table}" — OK`);
      results.push({ table, success: true });
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
    // Hardcoded redis-cli command with env var — safe, no user input.
    const memoryOutput = execSync(
      `redis-cli -u "${redisUrl}" info memory`,
      { timeout: 10_000, stdio: 'pipe', shell: '/bin/bash', encoding: 'utf-8' },
    );
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
    // Hardcoded redis-cli command with env var — safe, no user input.
    const dbsizeOutput = execSync(
      `redis-cli -u "${redisUrl}" dbsize`,
      { timeout: 10_000, stdio: 'pipe', shell: '/bin/bash', encoding: 'utf-8' },
    );
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
    // Hardcoded command — safe, no user input.
    execSync('pm2 flush', {
      timeout: PM2_FLUSH_TIMEOUT_MS,
      stdio: 'pipe',
      shell: '/bin/bash',
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
 * Placeholder for backup verification. If BACKUP_S3_BUCKET is set,
 * logs a message indicating future implementation.
 */
function checkBackups(): void {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (bucket) {
    log(AGENT, `Backup verification: S3 bucket "${bucket}" configured — verification not yet implemented`);
  } else {
    log(AGENT, 'Backup verification: BACKUP_S3_BUCKET not set — skipping');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log(AGENT, '=== DB Maintainer starting ===');

  try {
    // ── 1. PostgreSQL VACUUM ANALYZE ──
    const vacuumResults = vacuumAnalyze();

    // ── 2. Redis status ──
    const redisStatus = checkRedis();

    // ── 3. Log rotation ──
    const logRotation = rotateLogs();

    // ── 4. PM2 flush ──
    const pm2Ok = pm2Flush();

    // ── 5. Backup verification ──
    checkBackups();

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

/**
 * Vizora Autonomous Operations — log retention
 *
 * Bounds the size of PM2's log files WITHOUT destroying recent history.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * `db-maintainer` used to call `pm2 flush` on every daily run. Called bare,
 * `pm2 flush` truncates the logs of EVERY app PM2 manages — middleware,
 * realtime, web, and the other fifteen apps — as a side effect of database
 * maintenance. That destroyed cross-service diagnostic history daily at 03:00
 * and has now materially harmed two separate investigations.
 *
 * `pm2 flush [api]` does accept a target, so a scoped flush was available. It
 * is still not the fix: emptying is the wrong primitive. A targeted flush
 * destroys that agent's own history and bounds nothing else.
 *
 * It was also buying almost nothing. Measured on prod 2026-08-13: the entire
 * log corpus was 184 KB against 42 GB free, i.e. under ~2 MB/day. The trade
 * was "delete every service's evidence, daily" for "reclaim two megabytes".
 *
 * ─── Why size, not age ──────────────────────────────────────────────────────
 *
 * The mechanism this replaces also emptied any file whose mtime was older than
 * seven days. That is precisely backwards for forensics: a log with an old
 * mtime belongs to a service that STOPPED writing, and the last thing it said
 * before stopping is the single most valuable line in it. Age-based emptying
 * deletes exactly that.
 *
 * Retention here is therefore size-based only. A file under the cap is never
 * touched, however old. A file over the cap keeps its most recent bytes and
 * loses its oldest — the opposite end from the one that matters. The ceiling is
 * bounded: 18 apps × 2 streams × `maxBytes`.
 *
 * Trimming always leaves a marker line, so a reader can never mistake a trimmed
 * file for a complete one.
 */

import { closeSync, openSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** 5 MiB per file before trimming. */
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
/**
 * Bytes of the tail that survive a trim — half the cap.
 *
 * A trim only fires during an anomaly, and the anomaly that produces it is
 * usually a crash loop, whose ROOT CAUSE is at the start of the burst while the
 * tail holds only the latest repetition. Keeping half rather than a fifth
 * halves what that costs, at no added complexity.
 */
export const DEFAULT_KEEP_TAIL_BYTES = 2.5 * 1024 * 1024;

export interface LogRetentionOptions {
  maxBytes?: number;
  keepTailBytes?: number;
}

export interface LogRetentionResult {
  /** Files trimmed to their tail, with the byte counts involved. */
  trimmed: Array<{ file: string; wasBytes: number; nowBytes: number }>;
  /** Files inspected and left alone because they were under the cap. */
  untouched: number;
  errors: string[];
}

/** Marker prepended to a trimmed file. Asserted by tests. */
export function trimMarker(nowIso: string, dropped: number, kept: number): string {
  return (
    `[log-retention] ${nowIso} — this file exceeded its size cap; ` +
    `dropped the oldest ${dropped} bytes, kept the most recent ${kept}. ` +
    `Earlier history is gone — it was NOT empty.\n`
  );
}

/**
 * Trim one file to its most recent `keepTailBytes`, prepending a marker.
 *
 * Reads only the tail, so a large file is never loaded whole. The first
 * (partial) line of the tail is dropped so the result never begins mid-record.
 *
 * PM2 holds these files open in append mode, where each write targets the
 * current end-of-file, so rewriting a shorter file does not strand the writer
 * at a stale offset or leave a sparse hole.
 *
 * There is a narrow read-then-write window: lines appended between the tail
 * read and the rewrite are lost. It is sub-millisecond, applies only to files
 * already over the cap, and the alternative — holding a lock across the rewrite
 * of a file PM2 is actively writing — is worse than losing a line at 03:00.
 */
function trimToTail(
  filePath: string,
  size: number,
  keepTailBytes: number,
  nowIso: string,
): { wasBytes: number; nowBytes: number } {
  const fd = openSync(filePath, 'r');
  let tail: string;
  try {
    const buf = Buffer.alloc(keepTailBytes);
    const read = readSync(fd, buf, 0, keepTailBytes, size - keepTailBytes);
    tail = buf.subarray(0, read).toString('utf8');
  } finally {
    closeSync(fd);
  }

  // Drop the partial first line so the file never starts mid-record. When the
  // tail holds no newline at all there is no line to drop, so strip any
  // replacement char left by a read that began mid-UTF-8-sequence.
  const firstNewline = tail.indexOf('\n');
  if (firstNewline !== -1) tail = tail.slice(firstNewline + 1);
  else tail = tail.replace(/^\uFFFD+/, '');

  const kept = Buffer.byteLength(tail, 'utf8');
  const contents = trimMarker(nowIso, size - kept, kept) + tail;
  writeFileSync(filePath, contents);
  return { wasBytes: size, nowBytes: Buffer.byteLength(contents, 'utf8') };
}

/**
 * Apply size-based retention to every `.log` file in `dir`.
 *
 * Never deletes a file and never empties one. Files under the cap are left
 * exactly as they are regardless of age.
 */
export function applyLogRetention(
  dir: string,
  options: LogRetentionOptions = {},
  now: Date = new Date(),
): LogRetentionResult {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  // Keeping at least as much as the cap would make trimming a no-op loop, so
  // the tail is clamped strictly below it.
  const keepTailBytes = Math.min(
    options.keepTailBytes ?? DEFAULT_KEEP_TAIL_BYTES,
    Math.max(1, Math.floor(maxBytes / 2)),
  );

  const result: LogRetentionResult = { trimmed: [], untouched: 0, errors: [] };

  let files: string[];
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.log'));
  } catch (err) {
    result.errors.push(`logs directory not readable: ${err instanceof Error ? err.message : err}`);
    return result;
  }

  const nowIso = now.toISOString();
  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const stat = statSync(filePath);
      // A directory named `*.log` is not a log. Its reported size is
      // platform-dependent, so without this it would either be silently
      // counted as a healthy file or attempt a read that fails.
      if (!stat.isFile()) continue;
      const size = stat.size;
      if (size <= maxBytes) {
        result.untouched += 1;
        continue;
      }
      const { wasBytes, nowBytes } = trimToTail(filePath, size, keepTailBytes, nowIso);
      result.trimmed.push({ file, wasBytes, nowBytes });
    } catch (err) {
      result.errors.push(`${file}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return result;
}

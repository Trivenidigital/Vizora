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
 * loses its oldest — the opposite end from the one that matters.
 *
 * The ceiling is 18 apps × 2 streams × `maxBytes` (180 MiB) — but only as of
 * each run. Nothing bounds growth BETWEEN daily runs, so the cadence, not this
 * mechanism, is the binding constraint for a runaway writer. That was equally
 * true of the `pm2 flush` it replaces; it is stated here because the docblock
 * previously implied a continuous guarantee it never had.
 *
 * Trimming always leaves a marker line, so a reader can never mistake a trimmed
 * file for a complete one.
 *
 * ─── Deliberate limits ──────────────────────────────────────────────────────
 *
 *   - Bytes are preserved verbatim. The tail is never decoded to a string, so
 *     a log containing invalid UTF-8 (PM2 `out` streams carry arbitrary child
 *     stdout) survives byte-for-byte instead of being rewritten with U+FFFD.
 *   - If a file has NO newline in its tail there is no partial record to drop,
 *     so the survivor may begin mid-record. Documented rather than papered
 *     over: the alternative is discarding the whole tail.
 *   - A file that changed between stat and read (service restarted, operator
 *     truncated it) is SKIPPED, not rewritten. Writing a marker over a file
 *     that is no longer the one we measured would destroy the new process's
 *     first lines and claim a byte count that was never true.
 */

import {
  closeSync,
  fstatSync,
  openSync,
  readSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
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

/** Result of trimming one file. `null` means the file was left untouched. */
export type TrimOutcome = { wasBytes: number; nowBytes: number } | null;

export type TrimFile = (
  filePath: string,
  size: number,
  keepTailBytes: number,
  nowIso: string,
) => TrimOutcome;

export interface LogRetentionOptions {
  maxBytes?: number;
  keepTailBytes?: number;
  /**
   * Seam for tests, mirroring the injected `fetchImpl` in lib/web-assets.ts.
   * Production always uses the default. The per-file failure path cannot be
   * provoked portably through the filesystem (a symlink is EPERM on Windows,
   * and chmod 000 does not deny access there), and that path is what
   * guarantees one bad file cannot abort the sweep for the other 35.
   */
  trimFile?: TrimFile;
}

export interface LogRetentionResult {
  /** Files trimmed to their tail, with the byte counts involved. */
  trimmed: Array<{ file: string; wasBytes: number; nowBytes: number }>;
  /** Files inspected and left alone because they were under the cap. */
  untouched: number;
  /** Files over the cap that changed underneath us and were left alone. */
  skipped: number;
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
 * Reads only the tail, so a large file is never loaded whole, and keeps it as a
 * Buffer so the surviving bytes are written back exactly as they were.
 *
 * PM2 holds these files open in append mode, where each write targets the
 * current end-of-file, so rewriting a shorter file does not strand the writer
 * at a stale offset or leave a sparse hole.
 *
 * ─── The concurrent-writer hazard, and why this defers instead ─────────────
 *
 * `writeFileSync` truncates, so every byte at offset >= `size` is discarded.
 * The exposure therefore starts at the `statSync` that produced `size` — not
 * at the read — and spans the whole read+write. Measured against a real
 * separate process appending in O_APPEND at 5 MiB: ~9 ms, losing a contiguous
 * ~130 KB block out of the middle of the surviving range, silently.
 *
 * That is unacceptable for a change whose entire thesis is "never destroy
 * evidence", and it bites hardest exactly where it matters most: loss scales
 * with write rate, so the worst case is the crash loop this mechanism exists
 * to survive. So the file is re-stat'd after the read and SKIPPED if anything
 * changed. A hot file is deferred to the next run rather than holed.
 *
 * The cost of deferring is that a continuously-written file may not be trimmed
 * for several runs. That is the right side to err on: the daily cadence never
 * bounded between-run growth anyway (see the ceiling note above), whereas a
 * punched hole is unrecoverable.
 *
 * Returns `null` when the file no longer matches `size`, in which case it is
 * left completely alone.
 */
export function trimToTail(
  filePath: string,
  size: number,
  keepTailBytes: number,
  nowIso: string,
): TrimOutcome {
  const start = Math.max(0, size - keepTailBytes);
  const want = size - start;

  const fd = openSync(filePath, 'r');
  let tail: Buffer;
  try {
    const buf = Buffer.alloc(want);
    const read = readSync(fd, buf, 0, want, start);
    // A short read means the file shrank (service restarted, operator
    // truncated). Rewriting would overwrite the new process's first lines with
    // a marker asserting a byte count that was never true.
    if (read < want) return null;
    // And if it GREW, truncating now would discard everything appended since
    // the stat. Defer instead — see the hazard note above.
    if (fstatSync(fd).size !== size) return null;
    tail = buf.subarray(0, read);
  } finally {
    closeSync(fd);
  }

  // Drop the partial first record. With no newline there is nothing to drop —
  // see "Deliberate limits" above.
  const firstNewline = tail.indexOf(0x0a);
  const body = firstNewline !== -1 ? tail.subarray(firstNewline + 1) : tail;

  const kept = body.length;
  const marker = Buffer.from(trimMarker(nowIso, size - kept, kept), 'utf8');
  const contents = Buffer.concat([marker, body]);
  writeFileSync(filePath, contents);
  return { wasBytes: size, nowBytes: contents.length };
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
  const result: LogRetentionResult = { trimmed: [], untouched: 0, skipped: 0, errors: [] };

  const rawMax = options.maxBytes ?? DEFAULT_MAX_BYTES;
  // A non-positive or NaN cap would trim every file to a marker and report
  // success. Not reachable from db-maintainer today, but the obvious next
  // change is an env-configurable cap, and this repo parses those with
  // parseInt — which yields NaN on a typo.
  if (!Number.isFinite(rawMax) || rawMax <= 0) {
    result.errors.push(`invalid maxBytes: ${rawMax}`);
    return result;
  }
  const maxBytes = rawMax;

  // Keeping as much as the cap would re-trim the same file forever, so the tail
  // is clamped to at most half of it. Half also leaves room for the marker,
  // keeping the result comfortably under the cap — i.e. retention converges
  // after one pass instead of rewriting the file every night.
  const keepTailBytes = Math.min(
    options.keepTailBytes ?? DEFAULT_KEEP_TAIL_BYTES,
    Math.max(1, Math.floor(maxBytes / 2)),
  );
  const trimFile = options.trimFile ?? trimToTail;

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
      if (stat.size <= maxBytes) {
        result.untouched += 1;
        continue;
      }
      const outcome = trimFile(filePath, stat.size, keepTailBytes, nowIso);
      if (outcome === null) result.skipped += 1;
      else result.trimmed.push({ file, ...outcome });
    } catch (err) {
      result.errors.push(`${file}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return result;
}

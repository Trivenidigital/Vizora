/**
 * Where health-guardian's consecutive-timeout streak actually lives.
 *
 * ─── Why this is not in ops-state.json ──────────────────────────────────────
 *
 * Making the restart decision stateful introduced a regression that the
 * stateless version could not have: if the state read fails, the streak
 * restarts, a genuinely hung service never reaches the threshold, and — because
 * `attempts` never increments either — it is never escalated. The old code
 * failed OPEN (restart every cycle, over-aggressive but recovering); the new one
 * failed CLOSED (never restart, never escalate).
 *
 * Three separate paths reset it, and all three are properties of the SHARED
 * file rather than of the streak itself:
 *
 *   1. `readOpsState()` throws `ops-state lock timeout` after 5s. Seven cron
 *      agents contend for that lock, and contention is worst exactly when the
 *      box is CPU-starved — i.e. the regime this whole feature exists for.
 *   2. An unreadable or unparseable state file yields `emptyState()`.
 *   3. `writeOpsState` trims to the most recent 200 incidents from the FRONT,
 *      while `recordAgentRun` upserts in place — so a long-lived open incident
 *      is the FIRST thing evicted.
 *
 * None of those are fixable by trying harder to write the shared file: without
 * the lock there is nothing safe to write, and forcing it reintroduces the
 * lost-update race the lock exists to prevent. So the streak moves instead.
 *
 * ─── Why it needs no lock ───────────────────────────────────────────────────
 *
 * `ecosystem.config.js` runs `ops-health-guardian` as `instances: 1`,
 * `exec_mode: 'fork'`, `autorestart: false`, `cron_restart: '*&#47;5 * * * *'`. It is
 * therefore a single, non-overlapping writer of its own streak. No other agent
 * reads or writes this file. All it needs is the same atomic
 * write-temp-then-rename primitive `writeOpsState` uses, so a crash mid-write
 * cannot leave a torn file.
 *
 * `Incident.consecutiveTimeouts` remains the operator-visible copy, so the
 * dashboard and incident text are unchanged. This file is what the DECISION
 * reads. One writer, one reader, and no second source of truth for anything a
 * human looks at.
 */
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How stale a streak may be before it is discarded.
 *
 * Three cron intervals. Without this, a streak left over from last week's
 * outage would make the first timeout of an unrelated blip restart
 * immediately — reintroducing the original bug through the back door. Runs are
 * ~5 min apart and one has been observed taking 61s, so three intervals is
 * generous without being meaningless.
 */
export const STREAK_MAX_AGE_MS = 15 * 60 * 1000;

const FILE_NAME = 'health-guardian-timeout-streaks.json';

interface StreakEntry {
  count: number;
  /** ISO timestamp of the observation that produced `count`. */
  at: string;
}

export interface StreakSnapshot {
  /** Service name → consecutive timeouts, with stale entries already dropped. */
  streaks: Record<string, number>;
  /**
   * True when the file EXISTED but could not be used.
   *
   * Distinguished from "absent" on purpose. Absent is the legitimate first run
   * and must read as a zero streak. Unreadable means the streak is unknown, and
   * an unknown streak has to fail toward remediation — otherwise this file
   * reproduces the exact closed-failure it was written to remove.
   */
  degraded: boolean;
  /** Why it was degraded, for the operator-facing log line. */
  reason?: string;
}

export function streakFilePath(stateDir: string): string {
  return join(stateDir, FILE_NAME);
}

/** Read the streaks, dropping any entry older than `STREAK_MAX_AGE_MS`. */
export function readTimeoutStreaks(stateDir: string, now: number = Date.now()): StreakSnapshot {
  const file = streakFilePath(stateDir);
  if (!existsSync(file)) return { streaks: {}, degraded: false };

  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    return {
      streaks: {},
      degraded: true,
      reason: `could not read ${FILE_NAME}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { streaks: {}, degraded: true, reason: `${FILE_NAME} is not valid JSON` };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { streaks: {}, degraded: true, reason: `${FILE_NAME} is not an object` };
  }

  const streaks: Record<string, number> = {};
  for (const [service, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue;
    const entry = value as Partial<StreakEntry>;
    if (typeof entry.count !== 'number' || !Number.isSafeInteger(entry.count) || entry.count < 1) {
      continue;
    }
    if (typeof entry.at !== 'string') continue;

    const at = Date.parse(entry.at);
    // An unparseable or future-dated stamp cannot establish freshness, so it is
    // treated as stale rather than trusted.
    if (!Number.isFinite(at) || at > now || now - at > STREAK_MAX_AGE_MS) continue;

    streaks[service] = entry.count;
  }

  return { streaks, degraded: false };
}

/**
 * Persist the streaks. Entries at zero are removed rather than stored, so a
 * recovered service leaves nothing behind and an absent key means zero.
 *
 * Atomic: temp file then rename, matching `writeOpsState`. Never throws —
 * losing a streak write must not take down a run that has already done its
 * probing; the caller logs the failure.
 */
export function writeTimeoutStreaks(
  stateDir: string,
  streaks: Record<string, number>,
  now: number = Date.now(),
): { ok: true } | { ok: false; error: string } {
  const file = streakFilePath(stateDir);
  const at = new Date(now).toISOString();

  const payload: Record<string, StreakEntry> = {};
  for (const [service, count] of Object.entries(streaks)) {
    if (Number.isSafeInteger(count) && count > 0) payload[service] = { count, at };
  }

  try {
    if (Object.keys(payload).length === 0) {
      // Nothing to remember. Remove the file so a later read cannot resurrect a
      // stale streak, and so "absent" keeps meaning "no streak".
      if (existsSync(file)) unlinkSync(file);
      return { ok: true };
    }

    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2));
    renameSync(tmp, file);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

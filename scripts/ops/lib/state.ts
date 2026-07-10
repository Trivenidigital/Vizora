/**
 * Vizora Autonomous Operations — State Management
 *
 * Persists ops state to `logs/ops-state.json`. All agents read/write through
 * these functions to maintain a single source of truth for incidents,
 * remediations, and system status.
 *
 * Uses Windows-safe path resolution (same pattern as validate-monitor.ts).
 *
 * Concurrency model (7 PM2 cron agents share one file):
 *   - `readOpsState()` acquires an exclusive advisory file lock and DOES NOT
 *     release it. The paired `writeOpsState()` releases it. Hold the lock for
 *     the shortest possible window — do detection I/O FIRST, then a brief
 *     locked read→merge→write with NO network/subprocess I/O in between.
 *   - `readOpsStateSnapshot()` is a lock-free read for the detection phase
 *     (e.g. looking up prior incidents to compute attempt counts). It MUST NOT
 *     be paired with `writeOpsState()`.
 *   - The lock is owner-stamped: `acquireLock()` writes a per-acquisition token
 *     into the lock file and `releaseLock()` only deletes the file when the
 *     on-disk token still matches ours. A lock reclaimed as stale by another
 *     agent is therefore never deleted out from under its new owner.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  openSync,
  closeSync,
  writeSync,
  unlinkSync,
  renameSync,
  statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { log } from './alerting.js';
import type {
  OpsState,
  AgentResult,
  RemediationAction,
  SystemStatus,
} from './types.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_INCIDENTS = 200;
const MAX_REMEDIATIONS = 100;
const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 50;
/** A lock file older than this is assumed abandoned (agent crashed) and reclaimed. */
const LOCK_STALE_MS = 30_000;

/**
 * State file path — resolves to `<project-root>/logs/ops-state.json`.
 * The regex handles Windows drive-letter paths from `import.meta.url`
 * (e.g., `/C:/projects/...` → `C:/projects/...`).
 *
 * Overridable via `OPS_STATE_FILE` — used by tests to point at a temp file and
 * available to operators running a non-default layout. Resolved per-call so a
 * test can vary it between cases.
 */
const DEFAULT_STATE_FILE = join(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..', '..', '..', 'logs', 'ops-state.json',
);

function getStateFile(): string {
  return process.env.OPS_STATE_FILE || DEFAULT_STATE_FILE;
}

function getLockFile(): string {
  return getStateFile() + '.lock';
}

function getLockTimeoutMs(): number {
  const override = Number(process.env.OPS_LOCK_TIMEOUT_MS);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_LOCK_TIMEOUT_MS;
}

// ─── File Locking ───────────────────────────────────────────────────────────

/**
 * Token identifying the lock WE currently hold, or null. Set on a successful
 * `acquireLock()`, cleared on `releaseLock()`. Because a single process runs
 * its read→modify→write cycle sequentially, one module-level slot is enough.
 */
let heldToken: string | null = null;

/** Monotonic per-process counter to make each acquisition's token unique. */
let lockCounter = 0;

/**
 * Unique-per-acquisition owner token. `pid` distinguishes processes, the
 * counter distinguishes acquisitions within a process, and hrtime adds
 * monotonic entropy. `Math.random` is intentionally avoided.
 */
function makeOwnerToken(): string {
  return `${process.pid}:${lockCounter++}:${process.hrtime.bigint()}`;
}

/**
 * Synchronous sleep that parks the thread (no busy-wait / CPU burn) via
 * `Atomics.wait`. `acquireLock` is synchronous — it cannot `await` — so this
 * is how we back off between lock-acquisition attempts.
 */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Acquire an exclusive file lock using the atomic `wx` open flag and stamp our
 * owner token inside it. Retries with a short back-off until acquisition
 * succeeds or the timeout expires; stale locks (> `LOCK_STALE_MS`) left by a
 * crashed agent are reclaimed.
 *
 * THROWS on timeout — the caller must NOT proceed lock-less (doing so would
 * allow concurrent read-modify-write races that silently lose updates).
 */
function acquireLock(): void {
  const lockFile = getLockFile();
  const token = makeOwnerToken();
  const deadline = Date.now() + getLockTimeoutMs();

  while (Date.now() < deadline) {
    try {
      const fd = openSync(lockFile, 'wx');
      try {
        writeSync(fd, token);
      } finally {
        closeSync(fd);
      }
      heldToken = token;
      return;
    } catch {
      // Lock is held by someone else. Reclaim it if it looks abandoned.
      try {
        if (existsSync(lockFile)) {
          const { mtimeMs } = statSync(lockFile);
          if (Date.now() - mtimeMs > LOCK_STALE_MS) {
            try { unlinkSync(lockFile); } catch { /* race with another reclaimer */ }
            continue; // retry immediately
          }
        }
      } catch { /* lock file vanished — the retry will succeed */ }

      // Back off before retrying. Small pid-derived jitter decorrelates
      // simultaneous agents without relying on Math.random.
      sleepSync(LOCK_RETRY_MS + (process.pid % 25));
    }
  }

  throw new Error(
    `ops-state lock timeout after ${getLockTimeoutMs()}ms (lock file: ${lockFile})`,
  );
}

/**
 * Release the lock we hold. Compare-then-delete: only unlink the lock file if
 * its on-disk token still matches ours. If it doesn't, another agent reclaimed
 * our lock as stale and now owns it — we must NOT delete their live lock. Warn
 * so the operator sees we ran long enough to be reclaimed.
 */
function releaseLock(): void {
  const token = heldToken;
  heldToken = null;
  if (token === null) return; // we never held it

  const lockFile = getLockFile();
  try {
    const onDisk = readFileSync(lockFile, 'utf-8');
    if (onDisk === token) {
      unlinkSync(lockFile);
    } else {
      log(
        'ops-state',
        `WARNING: lock reclaimed by another agent before release (held too long); not deleting ${lockFile}`,
      );
    }
  } catch {
    // Lock file already gone (reclaimed then released elsewhere) — nothing to do.
  }
}

// ─── Empty State ────────────────────────────────────────────────────────────

function emptyState(): OpsState {
  return {
    systemStatus: 'HEALTHY',
    lastUpdated: new Date().toISOString(),
    lastRun: {},
    incidents: [],
    recentRemediations: [],
    agentResults: {},
  };
}

// ─── Parsing (shared by locked and lock-free reads) ─────────────────────────

/** Monotonic counter so concurrent corrupt-file rescues get distinct names. */
let corruptCounter = 0;

/**
 * Read and parse the state file, normalising missing fields. Does NOT touch
 * the lock — callers own that.
 *
 * On unparseable JSON (e.g. a truncated file from a pre-atomic-write crash) the
 * corrupt file is PRESERVED — renamed to `<state>.corrupt-<pid>-<n>` and an
 * ERROR is logged — before returning empty state. This is the critical safety
 * property: without it, a subsequent write under the same lock would overwrite
 * the corrupt file and silently erase all incident/remediation history.
 */
function parseStateFile(): OpsState {
  const stateFile = getStateFile();
  if (!existsSync(stateFile)) return emptyState();

  let raw: string;
  try {
    raw = readFileSync(stateFile, 'utf-8');
  } catch {
    // Transient read error (or a concurrent corrupt-rescue removed the file).
    return emptyState();
  }

  try {
    const parsed = JSON.parse(raw) as OpsState;
    return {
      systemStatus: parsed.systemStatus ?? 'HEALTHY',
      lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
      lastRun: parsed.lastRun ?? {},
      incidents: parsed.incidents ?? [],
      recentRemediations: parsed.recentRemediations ?? [],
      agentResults: parsed.agentResults ?? {},
    };
  } catch {
    const corruptPath = `${stateFile}.corrupt-${process.pid}-${corruptCounter++}`;
    try {
      renameSync(stateFile, corruptPath);
      log('ops-state', `ERROR: corrupt ops-state file preserved at ${corruptPath} — starting from empty state`);
    } catch (err) {
      // Another agent may have already rescued/removed it. Still return empty.
      log('ops-state', `ERROR: corrupt ops-state file could not be preserved: ${err instanceof Error ? err.message : err}`);
    }
    return emptyState();
  }
}

// ─── Read / Write ───────────────────────────────────────────────────────────

/**
 * Acquire the lock and read the ops state. **DOES NOT RELEASE THE LOCK** — pair
 * every call with `writeOpsState()` to release it (use try/finally):
 *
 * ```ts
 * const state = readOpsState();
 * try {
 *   // mutate state ... (NO network / subprocess I/O here — keep it brief)
 * } finally {
 *   writeOpsState(state); // releases the lock, even if the block throws
 * }
 * ```
 *
 * THROWS `ops-state lock timeout` if the lock cannot be acquired within the
 * timeout. Callers that must not abort (e.g. ops-watchdog recording its own
 * run) should wrap this in try/catch. Never do slow I/O between this call and
 * the paired `writeOpsState()` — read prior state with `readOpsStateSnapshot()`
 * for that instead.
 */
export function readOpsState(): OpsState {
  acquireLock();
  try {
    return parseStateFile();
  } catch (err) {
    // parseStateFile is defensive and shouldn't throw, but if it does we must
    // release the lock rather than leak it, then propagate.
    releaseLock();
    throw err;
  }
}

/**
 * Lock-free snapshot read for the detection phase — e.g. looking up an agent's
 * prior incidents to compute attempt counts / preserve `detected` timestamps
 * while the agent is still doing network I/O. Does NOT acquire the lock and
 * MUST NOT be paired with `writeOpsState()`. Do the real locked
 * `readOpsState()`/`writeOpsState()` cycle at the very end, with no I/O in
 * between, so the lock is held only briefly.
 */
export function readOpsStateSnapshot(): OpsState {
  return parseStateFile();
}

/**
 * Write ops state to disk atomically and release the file lock. Trims incidents
 * to MAX_INCIDENTS and remediations to MAX_REMEDIATIONS (keeping most recent).
 *
 * The write is atomic: JSON is written to `<state>.tmp-<pid>` then `renameSync`d
 * over the real file (atomic on the same filesystem). A crash mid-write can
 * therefore never leave a truncated `ops-state.json` for the next reader.
 *
 * **Must be called after every `readOpsState()`**, including on the error path,
 * so the lock is always released — pair the two in try/finally.
 */
export function writeOpsState(state: OpsState): void {
  try {
    // Enforce size limits — keep most recent entries
    state.incidents = state.incidents.slice(-MAX_INCIDENTS);
    state.recentRemediations = state.recentRemediations.slice(-MAX_REMEDIATIONS);
    state.lastUpdated = new Date().toISOString();

    const stateFile = getStateFile();
    const dir = dirname(stateFile);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const tmpFile = `${stateFile}.tmp-${process.pid}`;
    writeFileSync(tmpFile, JSON.stringify(state, null, 2));
    renameSync(tmpFile, stateFile);
  } finally {
    releaseLock();
  }
}

// ─── State Mutations ────────────────────────────────────────────────────────

/**
 * Record an agent run into state. Updates lastRun timestamp, merges
 * agent result, and upserts incidents by ID (updates existing, inserts new).
 */
export function recordAgentRun(state: OpsState, result: AgentResult): void {
  // Update last-run timestamp
  state.lastRun[result.agent] = result.timestamp;

  // Store latest agent result
  state.agentResults[result.agent] = result;

  // Upsert incidents by ID
  const existingMap = new Map(state.incidents.map(i => [i.id, i]));
  for (const incident of result.incidents) {
    existingMap.set(incident.id, incident);
  }
  state.incidents = Array.from(existingMap.values());

  // Recalculate system status
  state.systemStatus = determineSystemStatus(state);
}

/**
 * Append a remediation action to the state.
 */
export function addRemediation(state: OpsState, action: RemediationAction): void {
  state.recentRemediations.push(action);
}

// ─── Status Calculation ─────────────────────────────────────────────────────

/**
 * Return true for incidents that still require operator/system attention.
 * Escalated incidents are active until an agent records a resolved copy.
 */
export function isActiveIncident(incident: Pick<Incident, 'status'>): boolean {
  return incident.status !== 'resolved';
}

/**
 * Determine overall system status based on active incidents:
 * - CRITICAL: any active incident with severity 'critical'
 * - DEGRADED: any active incident with severity 'warning'
 * - HEALTHY: no active critical or warning incidents
 */
export function determineSystemStatus(state: OpsState): SystemStatus {
  const active = state.incidents.filter(isActiveIncident);
  if (active.some(i => i.severity === 'critical')) return 'CRITICAL';
  if (active.some(i => i.severity === 'warning')) return 'DEGRADED';
  return 'HEALTHY';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic incident ID from agent name, type, and target ID.
 * This ensures the same issue produces the same ID across runs, enabling
 * deduplication and status tracking.
 */
export function makeIncidentId(agent: string, type: string, targetId: string): string {
  return `${agent}:${type}:${targetId}`;
}

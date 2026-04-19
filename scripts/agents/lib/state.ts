/**
 * Vizora Agent System — Per-family State Management
 *
 * Each agent family writes to its own state file under
 * `logs/agent-state/{family}.json` with its own lock file. Families:
 * `customer`, `content`, `fleet`, `billing`, `ops`.
 *
 * Inherits the atomic-lock pattern from scripts/ops/lib/state.ts.
 *
 * STATE_DIR resolution:
 *   Explicit `AGENT_STATE_DIR` env wins; else `<cwd>/logs/agent-state`.
 *   The middleware AgentStateService uses the same resolution so both
 *   processes read/write the same files regardless of whether the script
 *   runs from dist/ or src/ (R4-HIGH2).
 */

import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  openSync, closeSync, unlinkSync, statSync, renameSync,
} from 'node:fs';
import { join } from 'node:path';
import type { AgentFamilyState, AgentFamily } from './types.js';

const MAX_INCIDENTS = 200;
const MAX_REMEDIATIONS = 100;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 50;
const LOCK_STALE_MS = 30_000;

const STATE_DIR = process.env.AGENT_STATE_DIR
  ?? join(process.cwd(), 'logs', 'agent-state');

function stateFileFor(family: AgentFamily): string {
  return join(STATE_DIR, `${family}.json`);
}

function lockFileFor(family: AgentFamily): string {
  return stateFileFor(family) + '.lock';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function acquireLock(family: AgentFamily): Promise<void> {
  // Ensure STATE_DIR exists before attempting the lock; otherwise openSync throws
  // ENOENT (not EEXIST), existsSync(lockFile) stays false, and we retry for the
  // full LOCK_TIMEOUT_MS on every first run where the dir hasn't been created.
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  const lockFile = lockFileFor(family);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const fd = openSync(lockFile, 'wx');
      closeSync(fd);
      return;
    } catch {
      try {
        if (existsSync(lockFile)) {
          const { mtimeMs } = statSync(lockFile);
          if (Date.now() - mtimeMs > LOCK_STALE_MS) {
            try { unlinkSync(lockFile); } catch { /* race */ }
            continue;
          }
        }
      } catch { /* gone, retry */ }
      await sleep(LOCK_RETRY_MS + Math.random() * 50);
    }
  }
  // R4-MED4: escalate timeout instead of silently proceeding — caller loses data
  // guarantees if we write without the lock. Cron exits non-zero; operator sees.
  throw new Error(`acquireLock timeout for ${family} after ${LOCK_TIMEOUT_MS}ms`);
}

function releaseLock(family: AgentFamily): void {
  try { unlinkSync(lockFileFor(family)); } catch { /* ignore */ }
}

function emptyState(): AgentFamilyState {
  return {
    systemStatus: 'HEALTHY',
    lastUpdated: new Date().toISOString(),
    lastRun: {},
    incidents: [],
    recentRemediations: [],
    agentResults: {},
    emailsSentThisRun: 0,
    pendingManualRun: false,
  };
}

function loadState(family: AgentFamily): AgentFamilyState {
  const file = stateFileFor(family);
  if (!existsSync(file)) return emptyState();
  const raw = readFileSync(file, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as AgentFamilyState;
    return {
      systemStatus: parsed.systemStatus ?? 'HEALTHY',
      lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
      lastRun: parsed.lastRun ?? {},
      incidents: parsed.incidents ?? [],
      recentRemediations: parsed.recentRemediations ?? [],
      agentResults: parsed.agentResults ?? {},
      emailsSentThisRun: parsed.emailsSentThisRun ?? 0,
      pendingManualRun: parsed.pendingManualRun ?? false,
    };
  } catch (err) {
    // R4-MED7: preserve corrupt file instead of silently overwriting
    const backup = `${file}.corrupt.${Date.now()}.json`;
    try {
      renameSync(file, backup);
      process.stderr.write(
        `[agent-state] ${family}.json parse failed (${String(err)}); preserved as ${backup}\n`,
      );
    } catch { /* best-effort */ }
    return emptyState();
  }
}

/**
 * Read-modify-write: acquires the family lock. Caller MUST follow with
 * `writeAgentState(family, state)` to release the lock.
 *
 * R4-BLOCK4: previously swallowed errors and returned emptyState() while still
 * holding the lock; a subsequent parse error leaked the lock for 30s.
 */
export async function readAgentState(family: AgentFamily): Promise<AgentFamilyState> {
  await acquireLock(family);
  try {
    return loadState(family);
  } catch (err) {
    releaseLock(family);
    throw err;
  }
}

export function writeAgentState(family: AgentFamily, state: AgentFamilyState): void {
  try {
    state.incidents = state.incidents.slice(-MAX_INCIDENTS);
    state.recentRemediations = state.recentRemediations.slice(-MAX_REMEDIATIONS);
    state.lastUpdated = new Date().toISOString();
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(stateFileFor(family), JSON.stringify(state, null, 2));
  } finally {
    releaseLock(family);
  }
}

export function makeIncidentId(agent: string, type: string, targetId: string): string {
  return `${agent}:${type}:${targetId}`;
}

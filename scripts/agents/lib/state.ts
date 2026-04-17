/**
 * Vizora Agent System — Per-family State Management
 *
 * Each agent family writes to its own state file under
 * `logs/agent-state/{family}.json` with its own lock file. Families:
 * `customer`, `content`, `fleet`, `billing`, `ops`.
 *
 * Inherits the atomic-lock pattern from scripts/ops/lib/state.ts.
 */

import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  openSync, closeSync, unlinkSync, statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import type { AgentFamilyState, AgentFamily } from './types.js';

const MAX_INCIDENTS = 200;
const MAX_REMEDIATIONS = 100;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 50;

/** Project-root-relative path. Windows-safe `import.meta.url` parse. */
const STATE_DIR = join(
  dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..', '..', '..', 'logs', 'agent-state',
);

function stateFileFor(family: AgentFamily): string {
  return join(STATE_DIR, `${family}.json`);
}

function lockFileFor(family: AgentFamily): string {
  return stateFileFor(family) + '.lock';
}

function acquireLock(family: AgentFamily): void {
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
          if (Date.now() - mtimeMs > 30_000) {
            try { unlinkSync(lockFile); } catch { /* race */ }
            continue;
          }
        }
      } catch { /* gone, retry */ }
      const waitEnd = Date.now() + LOCK_RETRY_MS + Math.random() * 50;
      while (Date.now() < waitEnd) { /* spin */ }
    }
  }
  // Proceed without lock on timeout — better than crashing
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

/**
 * Read-modify-write: acquires the family lock. Caller MUST follow with
 * `writeAgentState(family, state)` to release the lock.
 */
export function readAgentState(family: AgentFamily): AgentFamilyState {
  acquireLock(family);
  try {
    const file = stateFileFor(family);
    if (!existsSync(file)) return emptyState();
    const raw = readFileSync(file, 'utf-8');
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
  } catch {
    return emptyState();
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

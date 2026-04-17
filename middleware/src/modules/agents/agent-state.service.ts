import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads and aggregates per-family agent state files from
 * `logs/agent-state/*.json`. All output passes through recursive
 * forbidden-key redaction before leaving the process (D9).
 *
 * Writes are limited to `enqueueManualRun()` — which sets a boolean flag
 * in the target family's state file that the cron script will pick up
 * on its next tick (D-arch-R2-2). No child_process. No shell.
 *
 * All I/O is async (fs/promises) to avoid blocking the event loop on the
 * status endpoint (D-nest-R3-2). `enqueueManualRun` acquires the same
 * `.lock` file convention used by cron workers so concurrent writes from
 * a manual trigger and an in-flight cron tick cannot corrupt state
 * (D-arch-R3-1).
 */
const AGENT_TO_FAMILY: Record<string, string> = {
  'customer-lifecycle': 'customer',
  'support-triage': 'ops',
  'screen-health-customer': 'fleet',
  'billing-revenue': 'billing',
  'content-intelligence': 'content',
  'agent-orchestrator': 'ops',
};

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 50;
const LOCK_STALE_MS = 30_000;

@Injectable()
export class AgentStateService {
  private readonly logger = new Logger(AgentStateService.name);
  private readonly stateDir: string;

  /** Expanded regex — blocks secrets, creds, auth, cookies, sessions (D9 + R2 nice). */
  private static readonly FORBIDDEN_KEY_REGEX =
    /token|secret|key|password|apiKey|webhook|jwt|credential|auth|cookie|session|private|access/i;

  constructor() {
    this.stateDir = join(__dirname, '..', '..', '..', '..', 'logs', 'agent-state');
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.sanitize(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (AgentStateService.FORBIDDEN_KEY_REGEX.test(k)) {
          out[k] = '[REDACTED]';
        } else {
          out[k] = this.sanitize(v);
        }
      }
      return out;
    }
    return value;
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async readFamilyFile(family: string): Promise<unknown> {
    const file = join(this.stateDir, `${family}.json`);
    try {
      const raw = await fs.readFile(file, 'utf-8');
      return JSON.parse(raw);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return null;
      this.logger.warn(
        `failed to parse ${file}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async aggregateStatus(page = 1, limit = 10) {
    let files: string[];
    try {
      files = (await fs.readdir(this.stateDir)).filter((f) => f.endsWith('.json'));
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return { families: [], page, limit, total: 0 };
      throw err;
    }
    const all = await Promise.all(
      files.map(async (f) => {
        const family = f.replace(/\.json$/, '');
        return { family, state: this.sanitize(await this.readFamilyFile(family)) };
      }),
    );
    const start = (page - 1) * limit;
    const slice = all.slice(start, start + limit);
    return { families: slice, page, limit, total: all.length };
  }

  /** Reads a single agent's family state, sanitized. */
  async read(name: string) {
    const family = AGENT_TO_FAMILY[name];
    if (!family) return null;
    return this.sanitize(await this.readFamilyFile(family));
  }

  /**
   * Write `pendingManualRun: true` into the agent's family state file,
   * holding the same `.lock` file the cron workers use.
   * The cron script clears the flag on next tick.
   */
  async enqueueManualRun(name: string) {
    const family = AGENT_TO_FAMILY[name];
    if (!family) throw new Error(`unknown agent family for ${name}`);
    await fs.mkdir(this.stateDir, { recursive: true });

    const file = join(this.stateDir, `${family}.json`);
    const lockFile = `${file}.lock`;

    await this.acquireLock(lockFile);
    try {
      let current: Record<string, unknown> = {};
      try {
        current = JSON.parse(await fs.readFile(file, 'utf-8'));
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code !== 'ENOENT') throw err;
      }
      current.pendingManualRun = true;
      current.pendingManualRunRequestedAt = new Date().toISOString();
      await fs.writeFile(file, JSON.stringify(current, null, 2));
      return { enqueued: name, family };
    } finally {
      await this.releaseLock(lockFile);
    }
  }

  private async acquireLock(lockFile: string): Promise<void> {
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const handle = await fs.open(lockFile, 'wx');
        await handle.close();
        return;
      } catch {
        try {
          const stat = await fs.stat(lockFile);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            try { await fs.unlink(lockFile); } catch { /* race */ }
            continue;
          }
        } catch { /* gone, retry */ }
        await new Promise((r) => setTimeout(r, LOCK_RETRY_MS + Math.random() * 50));
      }
    }
    // Proceed without lock on timeout — same degraded-but-alive policy as cron workers
    this.logger.warn(`lock acquisition timed out for ${lockFile}`);
  }

  private async releaseLock(lockFile: string): Promise<void> {
    try { await fs.unlink(lockFile); } catch { /* ignore */ }
  }
}

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { validateFamilyState } from './agent-state.schema';

/**
 * Reads and aggregates per-family agent state files from
 * `<AGENT_STATE_DIR or cwd/logs/agent-state>/*.json`. All output passes through
 * recursive forbidden-key redaction before leaving the process (D9).
 *
 * Writes are limited to `enqueueManualRun()` — which sets a boolean flag
 * in the target family's state file that the cron script will pick up
 * on its next tick (D-arch-R2-2). No child_process. No shell.
 *
 * All I/O is async (fs/promises) to avoid blocking the event loop on the
 * status endpoint (D-nest-R3-2). `enqueueManualRun` acquires the same
 * `.lock` file convention used by cron workers so concurrent writes from
 * a manual trigger and an in-flight cron tick cannot corrupt state
 * (D-arch-R3-1). On lock timeout we raise 503 rather than silently
 * proceed — losing the pendingManualRun flag under contention used to
 * be invisible (R4-MED4).
 */
const AGENT_TO_FAMILY: Record<string, string> = {
  'customer-lifecycle': 'customer',
  'support-triage': 'ops',
  'screen-health-customer': 'fleet',
  'billing-revenue': 'billing',
  'content-intelligence': 'content',
  'agent-orchestrator': 'ops',
};

// R4-MED5: only allow reads from known family files; an attacker or misconfigured
// agent dropping a file into the state dir cannot surface it via the API.
const KNOWN_FAMILIES = new Set<string>(['customer', 'content', 'fleet', 'billing', 'ops']);

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 50;
const LOCK_STALE_MS = 30_000;

@Injectable()
export class AgentStateService {
  private readonly logger = new Logger(AgentStateService.name);
  private readonly stateDir: string;

  /**
   * R4-HIGH1: anchored regex — redacts exact secret-family keys rather than any
   * substring match. `authorType` no longer matches `auth`; `monkey` no longer
   * matches `key`. Also covers PII (email, phone, address, recipient).
   */
  private static readonly FORBIDDEN_KEY_REGEX =
    /^(token|secret|password|passphrase|apiKey|api_key|webhook|webhookUrl|jwt|credential|cookie|sessionId|session_token|privateKey|private_key|accessToken|access_token|refreshToken|refresh_token|authHeader|authorization|email|emailAddress|recipient|phone|phoneNumber|address|fullName)$/i;

  constructor() {
    // R4-HIGH2: env-configurable, cwd-relative default. Matches
    // scripts/agents/lib/state.ts so middleware and cron read the same files
    // regardless of whether middleware runs from dist/ or src/.
    this.stateDir = process.env.AGENT_STATE_DIR
      ?? join(process.cwd(), 'logs', 'agent-state');
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

  private async readFamilyFile(family: string): Promise<unknown> {
    const file = join(this.stateDir, `${family}.json`);
    let parsed: unknown;
    try {
      const raw = await fs.readFile(file, 'utf-8');
      parsed = JSON.parse(raw);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return null;
      // R4-MED7: preserve corrupt file out-of-band; caller sees a sentinel.
      if (err instanceof SyntaxError) {
        const backup = `${file}.corrupt.${Date.now()}.json`;
        try {
          await fs.rename(file, backup);
          this.logger.error(
            `state file '${family}' parse failed; preserved as ${backup}`,
          );
        } catch (renameErr) {
          this.logger.error(
            `state file '${family}' parse failed and backup failed: ${String(renameErr)}`,
          );
        }
        return { __error: 'state file corrupt', family, preservedAs: backup };
      }
      this.logger.warn(
        `state file '${family}' read failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
    // Schema validation at the read boundary: ensures a malformed file
    // (e.g. an agent script crashed mid-write, a manual edit went wrong,
    // a future schema change rolled out one process behind another) does
    // not surface as a partially-correct payload to API/MCP consumers.
    // Fail-soft like ENOENT — log the issues and return null so the
    // calling endpoint sees "no state for this family yet" rather than a
    // payload with the wrong shape.
    const result = validateFamilyState(parsed);
    if (!result.ok) {
      this.logger.warn(
        `state file '${family}' failed schema validation: ${result.issues.join('; ')}`,
      );
      return null;
    }
    return result.value;
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
    // R4-MED5: allowlist
    const allowed = files
      .map((f) => f.replace(/\.json$/, ''))
      .filter((family) => KNOWN_FAMILIES.has(family));
    const all = await Promise.all(
      allowed.map(async (family) => ({
        family,
        state: this.sanitize(await this.readFamilyFile(family)),
      })),
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

    const token = await this.acquireLock(lockFile);
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
      await this.releaseLock(lockFile, token);
    }
  }

  /**
   * Acquire `<file>.json.lock` via `open(... 'wx')` — atomic on POSIX and NTFS,
   * so the O_EXCL primitive guarantees single-winner even when two callers
   * race to take over a stale lock (both may `unlink` the stale file, but only
   * one's subsequent `open('wx')` will succeed).
   *
   * Returns a per-acquisition token that's written into the lock file and
   * verified on release. This closes a subtler race: if process A gets
   * descheduled for &gt;30s (GC pause, oversubscribed CPU), process B can
   * legitimately steal A's stale lock. Without the token check, A's eventual
   * `releaseLock` would `unlink` B's active lock, letting a third caller C
   * acquire it concurrently. With the token check, A sees the token has
   * changed and leaves B's lock alone.
   */
  private async acquireLock(lockFile: string): Promise<string> {
    const token = `${process.pid}-${randomBytes(8).toString('hex')}`;
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const handle = await fs.open(lockFile, 'wx');
        try {
          await handle.writeFile(token);
        } finally {
          await handle.close();
        }
        return token;
      } catch {
        try {
          const stat = await fs.stat(lockFile);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            this.logger.warn(
              `stale lock detected at ${lockFile} (age=${Date.now() - stat.mtimeMs}ms); taking over`,
            );
            try { await fs.unlink(lockFile); } catch { /* race */ }
            continue;
          }
        } catch { /* gone, retry */ }
        await new Promise((r) => setTimeout(r, LOCK_RETRY_MS + Math.random() * 50));
      }
    }
    // R4-MED4: escalate lock timeout to 503 rather than silently proceed —
    // a concurrent cron tick can no longer lose pendingManualRun flags.
    throw new ServiceUnavailableException(
      `agent state busy, retry shortly (lock=${lockFile})`,
    );
  }

  private async releaseLock(lockFile: string, token: string): Promise<void> {
    try {
      const contents = await fs.readFile(lockFile, 'utf-8');
      if (contents !== token) {
        // Our lock was stolen (stale-takeover by another holder). Do NOT
        // unlink — we'd be destroying the new holder's active lock.
        this.logger.warn(
          `lock ${lockFile} no longer owned (token mismatch); skipping unlink`,
        );
        return;
      }
      await fs.unlink(lockFile);
    } catch {
      // Either the file was already removed or read failed; nothing to do.
    }
  }
}

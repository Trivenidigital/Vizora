import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads and aggregates per-family agent state files from
 * `logs/agent-state/*.json`. All output passes through recursive
 * forbidden-key redaction before leaving the process (D9).
 *
 * Writes are limited to `enqueueManualRun()` — which sets a boolean flag
 * in the target family's state file that the cron script will pick up
 * on its next tick (D-arch-R2-2). No child_process. No shell.
 */
const AGENT_TO_FAMILY: Record<string, string> = {
  'customer-lifecycle': 'customer',
  'support-triage': 'ops',
  'screen-health-customer': 'fleet',
  'billing-revenue': 'billing',
  'content-intelligence': 'content',
  'agent-orchestrator': 'ops',
};

@Injectable()
export class AgentStateService {
  private readonly logger = new Logger(AgentStateService.name);
  private readonly stateDir: string;

  /** Expanded regex — blocks secrets, creds, auth, cookies, sessions (D9 + R2 nice). */
  private static readonly FORBIDDEN_KEY_REGEX =
    /token|secret|key|password|apiKey|webhook|jwt|credential|auth|cookie|session|private|access/i;

  constructor() {
    // middleware/src/modules/agents/agent-state.service.ts
    // → ../../../../logs/agent-state
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

  private readFamilyFile(family: string): unknown {
    const file = join(this.stateDir, `${family}.json`);
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, 'utf-8'));
    } catch (err) {
      this.logger.warn(`failed to parse ${file}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  aggregateStatus(page = 1, limit = 10) {
    if (!existsSync(this.stateDir)) return { families: [], page, limit, total: 0 };
    const files = readdirSync(this.stateDir).filter((f) => f.endsWith('.json'));
    const all = files.map((f) => {
      const family = f.replace(/\.json$/, '');
      return { family, state: this.sanitize(this.readFamilyFile(family)) };
    });
    const start = (page - 1) * limit;
    const slice = all.slice(start, start + limit);
    return { families: slice, page, limit, total: all.length };
  }

  /** Reads a single agent's family state, sanitized. */
  read(name: string) {
    const family = AGENT_TO_FAMILY[name];
    if (!family) return null;
    return this.sanitize(this.readFamilyFile(family));
  }

  /**
   * Write `pendingManualRun: true` into the agent's family state file.
   * The cron script clears the flag on next tick. No shell, no child_process,
   * name is already allowlisted in the controller (D-arch-R2-2).
   */
  enqueueManualRun(name: string) {
    const family = AGENT_TO_FAMILY[name];
    if (!family) throw new Error(`unknown agent family for ${name}`);
    if (!existsSync(this.stateDir)) mkdirSync(this.stateDir, { recursive: true });
    const file = join(this.stateDir, `${family}.json`);
    const current = existsSync(file)
      ? JSON.parse(readFileSync(file, 'utf-8'))
      : {};
    current.pendingManualRun = true;
    current.pendingManualRunRequestedAt = new Date().toISOString();
    writeFileSync(file, JSON.stringify(current, null, 2));
    return { enqueued: name, family };
  }
}

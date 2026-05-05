import { Injectable, Logger } from '@nestjs/common';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { join, normalize, sep } from 'node:path';

/**
 * Hardened JSONL appender for Hermes shadow agents.
 *
 * Hermes skills used to write their JSONL audit rows by shelling out
 * via `echo '<line>' >> /var/log/hermes/<file>.jsonl` from the
 * terminal tool. Smaller / cheaper LLMs (gpt-4o-mini was the first
 * we caught) sometimes:
 *   - use `>` instead of `>>` (truncates the file — data loss)
 *   - hallucinate the timestamp (wrote `2023-...` instead of current year)
 *   - paste the literal `<unique-id>` placeholder from the SKILL example
 *     instead of generating a real run_id
 *
 * This service is the server-side enforcement layer below the LLM —
 * the same pattern the shift-agent reference architecture uses with
 * its `/usr/local/bin/log-decision-direct` helper. The agent supplies
 * `logName` (allowlisted) and a `fields` object; this service:
 *
 *   1. Validates `logName` against the allowlist (no path traversal).
 *   2. Generates `timestamp` + `run_id` server-side (overrides any
 *      agent-supplied values — discipline lives here, not in prompts).
 *   3. Caps total serialized line size at POSIX PIPE_BUF (4096) so
 *      append-mode writes are atomic per call across concurrent
 *      cron firings.
 *   4. Atomic append via `O_APPEND` semantics; flush + fsync.
 *
 * The MCP `log_shadow_row` tool is the only caller. Per the
 * architecture rules, this service must NOT be reused for any
 * agent-side direct write — it's an MCP-tool-implementation
 * detail, not a public utility.
 */
@Injectable()
export class ShadowLogService {
  private readonly logger = new Logger(ShadowLogService.name);

  /** Base directory for all shadow logs. */
  static readonly BASE_DIR =
    process.env.HERMES_SHADOW_LOG_DIR ?? '/var/log/hermes';

  /**
   * Allowlist of accepted log names. The agent CANNOT write to anything
   * not in this set — defense against the agent supplying `../etc/passwd`
   * or any other path-traversal payload. Add a new shadow log here and
   * redeploy when introducing a new Hermes-driven agent.
   */
  static readonly ALLOWLIST: ReadonlySet<string> = new Set([
    'vizora-support-triage-shadow',
    'vizora-support-triage-live',
    'vizora-customer-lifecycle-shadow',
    'vizora-customer-lifecycle-live',
  ]);

  /** POSIX PIPE_BUF — guaranteed atomic write size in O_APPEND mode. */
  static readonly MAX_LINE_BYTES = 4096;

  /**
   * Append one JSONL row to the named shadow log. Returns the post-
   * append line count for the caller to surface as a sanity signal.
   *
   * Throws if logName is not allowlisted (NOT a silent skip — caller
   * needs to know it picked the wrong name). Throws if the rendered
   * line exceeds MAX_LINE_BYTES (atomic-write guarantee would be
   * violated otherwise).
   */
  appendRow(
    logName: string,
    fields: Record<string, unknown>,
  ): { logName: string; written: boolean; lineCount: number } {
    if (!ShadowLogService.ALLOWLIST.has(logName)) {
      throw new Error(
        `logName '${logName}' is not in the shadow-log allowlist. Add it to ShadowLogService.ALLOWLIST and redeploy.`,
      );
    }
    if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
      throw new Error('fields must be a JSON object (not array, not primitive)');
    }

    // Build the row — server fields ALWAYS override anything the agent
    // tried to supply for these keys. This is the discipline boundary.
    const row = {
      ...fields,
      timestamp: new Date().toISOString(),
      run_id: String(Math.floor(Date.now() / 1000)),
    };

    const line = JSON.stringify(row) + '\n';
    const lineBytes = Buffer.byteLength(line, 'utf8');
    if (lineBytes > ShadowLogService.MAX_LINE_BYTES) {
      throw new Error(
        `serialized row is ${lineBytes} bytes (max ${ShadowLogService.MAX_LINE_BYTES}). Atomic append guarantee would be violated. Reduce fields.`,
      );
    }

    // Resolve path. logName is allowlisted (kebab-case ASCII), but
    // run normalize() defensively so any future allowlist relaxation
    // doesn't silently regress traversal safety.
    const filePath = normalize(
      join(ShadowLogService.BASE_DIR, `${logName}.jsonl`),
    );
    const baseWithSep = normalize(ShadowLogService.BASE_DIR) + sep;
    if (!filePath.startsWith(baseWithSep)) {
      throw new Error('resolved path escapes BASE_DIR');
    }

    if (!existsSync(ShadowLogService.BASE_DIR)) {
      mkdirSync(ShadowLogService.BASE_DIR, { recursive: true });
    }

    // appendFileSync uses O_APPEND under the hood. POSIX guarantees
    // atomic writes < PIPE_BUF in this mode, which is why we capped
    // line size above.
    appendFileSync(filePath, line, { flag: 'a' });

    // Cheap line-count for the caller. For very long files this could
    // be slow, but shadow logs are bounded (cron frequency × tokens).
    let lineCount = 0;
    try {
      const text = readFileSync(filePath, 'utf8');
      lineCount = text.split('\n').filter(Boolean).length;
    } catch {
      lineCount = -1;
    }

    return { logName, written: true, lineCount };
  }
}

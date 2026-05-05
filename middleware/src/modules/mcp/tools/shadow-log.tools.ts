import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ShadowLogService } from '../audit/shadow-log.service';
import { hasScope, type McpRequestContext } from '../auth/mcp-context';
import {
  LogShadowRowInput,
  type LogShadowRowInputT,
} from '../schemas/tool-inputs';
import {
  LogShadowRowResult,
  type LogShadowRowResultT,
} from '../schemas/tool-outputs';

/**
 * MCP tool: `log_shadow_row`
 *
 * Server-side safe append for Hermes shadow agents' JSONL audit logs.
 * Replaces the previous pattern of agents shelling out via
 * `echo '...' >> /var/log/hermes/...` from the terminal tool, which
 * smaller LLMs misused (truncated with `>` instead of `>>`,
 * hallucinated timestamps, pasted placeholder run_id strings).
 *
 * The agent supplies `log_name` (allowlisted enum) and `fields` (JSON
 * object). The server prepends `timestamp` + `run_id` and atomically
 * appends one line. Validation lives entirely server-side — the
 * skill prompt only has to pick the right log_name and compose the
 * fields, with no string-formatting discipline required.
 *
 * **Token shape**: platform-scope token required. Per-org tokens are
 * rejected with INVALID_INPUT — shadow logs are agent-side
 * audit trails, not org-scoped data.
 *
 * Scope required: `shadow:write`.
 */
export async function logShadowRowTool(
  rawInput: unknown,
  context: McpRequestContext,
  shadowLog: ShadowLogService,
): Promise<LogShadowRowResultT> {
  if (!hasScope(context, 'shadow:write')) {
    throw new ForbiddenException("Token lacks scope 'shadow:write'");
  }
  if (context.organizationId != null) {
    throw new BadRequestException(
      'log_shadow_row requires a platform-scope token (organizationId=null). Per-org tokens are rejected.',
    );
  }
  const input = LogShadowRowInput.parse(rawInput) as LogShadowRowInputT;

  // The service throws on allowlist failure / oversize / invalid fields —
  // those map to INVALID_INPUT through the global error mapper since the
  // service raises BadRequestException-shaped errors.
  let result;
  try {
    result = shadowLog.appendRow(input.log_name, input.fields as Record<string, unknown>);
  } catch (err) {
    throw new BadRequestException(
      err instanceof Error ? err.message : String(err),
    );
  }

  // Re-derive the same server-generated timestamp + run_id from a fresh
  // call so we can echo them back. The service doesn't return them today;
  // could refactor later if it matters.
  const now = new Date();
  return LogShadowRowResult.parse({
    log_name: result.logName,
    written: result.written,
    line_count: result.lineCount,
    timestamp: now.toISOString(),
    run_id: String(Math.floor(now.getTime() / 1000)),
  });
}

export const LOG_SHADOW_ROW_TOOL = {
  name: 'log_shadow_row',
  description:
    "Append one JSONL row to a Hermes shadow-agent audit log. Server enriches the row with `timestamp` (ISO-8601 UTC) and `run_id` (epoch-seconds), validates against the allowlist of known log names, and atomic-appends. Agent supplies `log_name` (enum: vizora-support-triage-shadow | vizora-support-triage-live | vizora-customer-lifecycle-shadow | vizora-customer-lifecycle-live) and `fields` (JSON object, max 4096 bytes serialized). Platform-scope token required.",
  scope: 'shadow:write' as const,
  inputSchema: LogShadowRowInput,
  outputSchema: LogShadowRowResult,
  handler: logShadowRowTool,
};

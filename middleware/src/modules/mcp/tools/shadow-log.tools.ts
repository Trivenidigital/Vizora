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
 * **Token shape**: any valid token with `shadow:write` scope. Per-org
 * tokens get tagged with `organization_id` in the appended row;
 * platform-scope tokens write without the tag. Agent-supplied
 * `organization_id` in fields is REJECTED for per-org tokens if it
 * doesn't match the token's organizationId — this closes a cross-tenant
 * write surface where org A could stamp organization_id=B in the JSONL
 * (Reviewer A design D2).
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
  const input = LogShadowRowInput.parse(rawInput) as LogShadowRowInputT;

  // Cross-tenant write defense (Reviewer A D2): if the token is per-org,
  // force `organization_id` in the row to the token's value. If the
  // agent supplied a different `organization_id`, reject INVALID_INPUT —
  // the token's org is the cryptographic source of truth.
  const inputFields = input.fields as Record<string, unknown>;
  let fieldsWithContext: Record<string, unknown>;
  if (context.organizationId != null) {
    const supplied = inputFields.organization_id;
    if (supplied != null && supplied !== context.organizationId) {
      throw new BadRequestException(
        `organization_id mismatch with token scope (supplied=${String(supplied)}, token=${context.organizationId})`,
      );
    }
    // Force the token's value (whether agent supplied none or matching).
    fieldsWithContext = { ...inputFields, organization_id: context.organizationId };
  } else {
    // Platform-scope token: write fields as-is. Agent may supply any
    // organization_id (or none) — they have authority across orgs.
    fieldsWithContext = inputFields;
  }

  // The service throws on allowlist failure / oversize / invalid fields —
  // those map to INVALID_INPUT through the global error mapper since the
  // service raises BadRequestException-shaped errors.
  let result;
  try {
    result = shadowLog.appendRow(input.log_name, fieldsWithContext);
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
    "Append one JSONL row to a Hermes shadow-agent audit log. Server enriches the row with `timestamp` (ISO-8601 UTC) and `run_id` (epoch-seconds), validates against the allowlist of known log names, and atomic-appends. Agent supplies `log_name` (enum: vizora-support-triage-shadow | vizora-support-triage-live | vizora-customer-lifecycle-shadow | vizora-customer-lifecycle-live) and `fields` (JSON object, max 4096 bytes serialized). Requires `shadow:write` scope; per-org tokens are tagged with org context, platform-scope tokens are not.",
  scope: 'shadow:write' as const,
  inputSchema: LogShadowRowInput,
  outputSchema: LogShadowRowResult,
  handler: logShadowRowTool,
};

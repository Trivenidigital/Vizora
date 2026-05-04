import { ForbiddenException } from '@nestjs/common';
import { SupportService } from '../../support/support.service';
import { hasScope, type McpRequestContext } from '../auth/mcp-context';
import {
  ListOpenSupportRequestsInput,
  type ListOpenSupportRequestsInputT,
} from '../schemas/tool-inputs';
import {
  ListOpenSupportRequestsOutput,
  type ListOpenSupportRequestsOutputT,
} from '../schemas/tool-outputs';

/**
 * MCP tool: `list_open_support_requests`
 *
 * Returns triage candidates for the calling token's organization as
 * STRUCTURAL SIGNALS ONLY — word count, has-attachment, message count,
 * age, org tier. No description body, no user PII. The LLM-driven
 * agent on the other side of this tool can safely consume the output
 * without risking D13 (no raw user data into LLM prompts).
 *
 * Default WHERE excludes already-triaged requests (D7 reply-loop
 * prevention) — pass `include_already_triaged: true` to override.
 *
 * Scope required: `support:read`. Scope failure throws
 * `ForbiddenException` which the error mapper translates to MCP
 * `FORBIDDEN`.
 */
export async function listOpenSupportRequestsTool(
  rawInput: unknown,
  context: McpRequestContext,
  supportService: SupportService,
): Promise<ListOpenSupportRequestsOutputT> {
  if (!hasScope(context, 'support:read')) {
    throw new ForbiddenException("Token lacks scope 'support:read'");
  }
  const input = ListOpenSupportRequestsInput.parse(
    rawInput,
  ) as ListOpenSupportRequestsInputT;

  const result = await supportService.listTriageCandidates(
    context.organizationId,
    {
      page: input.page,
      limit: input.limit,
      includeAlreadyTriaged: input.include_already_triaged,
    },
  );

  return ListOpenSupportRequestsOutput.parse({
    support_requests: result.data.map(toTriageShape),
    page: input.page,
    limit: input.limit,
    total: result.meta?.total ?? result.data.length,
  });
}

/**
 * Project a service-layer triage row into the MCP wire shape.
 * camelCase → snake_case is the only translation. The service layer
 * has already enforced the no-body / no-PII contract.
 */
function toTriageShape(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    organization_id: r.organizationId as string,
    status: r.status as string,
    priority: (r.priority as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    ai_category: (r.aiCategory as string | null) ?? null,
    created_at:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : (r.createdAt as string),
    age_minutes: r.ageMinutes as number,
    word_count: r.wordCount as number,
    has_attachment: Boolean(r.hasAttachment),
    message_count: r.messageCount as number,
    org_tier: r.orgTier as string,
  };
}

/**
 * Registry entry for MCP tool registration in McpService. Lives next
 * to the implementation so input/output schemas can't drift from the
 * handler.
 */
export const LIST_OPEN_SUPPORT_REQUESTS_TOOL = {
  name: 'list_open_support_requests',
  description:
    "List open support requests for the calling token's organization as triage candidates. Returns structural signals ONLY (word_count, has_attachment, message_count, age_minutes, priority, category, ai_category, org_tier) — NEVER the description body or any user PII. By default excludes already-triaged requests (those with an agent-authored message). Read-only. Paginated.",
  scope: 'support:read' as const,
  inputSchema: ListOpenSupportRequestsInput,
  outputSchema: ListOpenSupportRequestsOutput,
  handler: listOpenSupportRequestsTool,
};

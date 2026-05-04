import { ForbiddenException } from '@nestjs/common';
import { SupportService } from '../../support/support.service';
import { hasScope, type McpRequestContext } from '../auth/mcp-context';
import {
  CreateSupportMessageInput,
  type CreateSupportMessageInputT,
  ListOpenSupportRequestsInput,
  type ListOpenSupportRequestsInputT,
  UpdateSupportRequestAiCategoryInput,
  type UpdateSupportRequestAiCategoryInputT,
  UpdateSupportRequestPriorityInput,
  type UpdateSupportRequestPriorityInputT,
} from '../schemas/tool-inputs';
import {
  CreateSupportMessageResult,
  type CreateSupportMessageResultT,
  ListOpenSupportRequestsOutput,
  type ListOpenSupportRequestsOutputT,
  UpdateSupportRequestResult,
  type UpdateSupportRequestResultT,
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

// ── Write tools (require :write scope) ─────────────────────────────────────

/**
 * MCP tool: `update_support_request_priority`
 *
 * Sets the `priority` of one support request. Cross-org guard via the
 * service's compound where (id + organizationId).
 *
 * Scope required: `support:write`. Returns `{ updated: false }` (NOT an
 * error) when the row doesn't match — agents should treat that as
 * "stop, the request is gone or not yours" and not retry.
 */
export async function updateSupportRequestPriorityTool(
  rawInput: unknown,
  context: McpRequestContext,
  supportService: SupportService,
): Promise<UpdateSupportRequestResultT> {
  if (!hasScope(context, 'support:write')) {
    throw new ForbiddenException("Token lacks scope 'support:write'");
  }
  const input = UpdateSupportRequestPriorityInput.parse(
    rawInput,
  ) as UpdateSupportRequestPriorityInputT;
  const updated = await supportService.setRequestPriority(
    context.organizationId,
    input.request_id,
    input.priority,
  );
  return UpdateSupportRequestResult.parse({
    request_id: input.request_id,
    updated,
  });
}

export const UPDATE_SUPPORT_REQUEST_PRIORITY_TOOL = {
  name: 'update_support_request_priority',
  description:
    "Set the priority of one support request belonging to the calling token's organization. Returns { updated: false } if no row matched (cross-org guard or deleted) — DO NOT retry on false. Priority must be one of urgent | high | normal | low.",
  scope: 'support:write' as const,
  inputSchema: UpdateSupportRequestPriorityInput,
  outputSchema: UpdateSupportRequestResult,
  handler: updateSupportRequestPriorityTool,
};

/**
 * MCP tool: `update_support_request_ai_category`
 *
 * Sets the V2 taxonomy slug. The Zod input enum constrains to the
 * known V2 union — unknown slugs are rejected at the wire, never
 * reaching the DB.
 */
export async function updateSupportRequestAiCategoryTool(
  rawInput: unknown,
  context: McpRequestContext,
  supportService: SupportService,
): Promise<UpdateSupportRequestResultT> {
  if (!hasScope(context, 'support:write')) {
    throw new ForbiddenException("Token lacks scope 'support:write'");
  }
  const input = UpdateSupportRequestAiCategoryInput.parse(
    rawInput,
  ) as UpdateSupportRequestAiCategoryInputT;
  const updated = await supportService.setRequestAiCategory(
    context.organizationId,
    input.request_id,
    input.ai_category,
  );
  return UpdateSupportRequestResult.parse({
    request_id: input.request_id,
    updated,
  });
}

export const UPDATE_SUPPORT_REQUEST_AI_CATEGORY_TOOL = {
  name: 'update_support_request_ai_category',
  description:
    'Set the V2-taxonomy aiCategory slug on one support request. The slug is constrained to the V2 enum — unknown values are rejected at the wire. Returns { updated: false } if no row matched. Idempotent for the same value.',
  scope: 'support:write' as const,
  inputSchema: UpdateSupportRequestAiCategoryInput,
  outputSchema: UpdateSupportRequestResult,
  handler: updateSupportRequestAiCategoryTool,
};

/**
 * MCP tool: `create_support_message`
 *
 * Posts an agent-authored comment to a support thread. The agent name
 * comes from the bearer-token context (NOT user-controlled), the
 * authorType is hardcoded `'agent'`, and the userId is the original
 * submitter (looked up server-side, not trusted from input).
 *
 * Per the architecture rules, callers SHOULD send pre-templated
 * content here — never raw LLM output. The content cap (2000 chars)
 * is the hard wall; the discipline is on the agent prompt.
 */
export async function createSupportMessageTool(
  rawInput: unknown,
  context: McpRequestContext,
  supportService: SupportService,
): Promise<CreateSupportMessageResultT> {
  if (!hasScope(context, 'support:write')) {
    throw new ForbiddenException("Token lacks scope 'support:write'");
  }
  const input = CreateSupportMessageInput.parse(
    rawInput,
  ) as CreateSupportMessageInputT;
  const created = await supportService.createAgentMessage(
    context.organizationId,
    input.request_id,
    input.content,
  );
  return CreateSupportMessageResult.parse({
    request_id: input.request_id,
    message_id: created?.id ?? null,
    created_at: created ? created.createdAt.toISOString() : null,
    created: Boolean(created),
  });
}

export const CREATE_SUPPORT_MESSAGE_TOOL = {
  name: 'create_support_message',
  description:
    "Append an agent-authored message to one support request's thread. The author identity is taken from the bearer-token context (NOT user-controlled). Returns { created: false } if the request doesn't exist or belongs to another org. Content is capped at 2000 chars; callers SHOULD send pre-templated text, not raw LLM output.",
  scope: 'support:write' as const,
  inputSchema: CreateSupportMessageInput,
  outputSchema: CreateSupportMessageResult,
  handler: createSupportMessageTool,
};

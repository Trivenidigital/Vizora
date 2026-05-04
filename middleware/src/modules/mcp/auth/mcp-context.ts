import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * After `McpAuthGuard` validates a bearer, the resolved token context
 * is attached to the Express request as `mcpContext`. Tools and
 * audit code read it via this decorator (or directly off the request,
 * which is sometimes necessary inside the SDK callback).
 *
 * `organizationId` is **null** for platform-scope tokens (cross-org
 * agents like customer-lifecycle, agent-orchestrator). Per-org tools
 * MUST guard against null and reject (use `requireOrgScope` below).
 * Platform-only tools accept null and operate across all orgs.
 */
export interface McpRequestContext {
  tokenId: string;
  organizationId: string | null;
  agentName: string;
  scopes: string[];
}

/**
 * Internal symbol used to attach the context to the request. Exported
 * so the SDK callback path (which doesn't go through Nest's DI) can
 * read it.
 */
export const MCP_CONTEXT_KEY = '__mcpContext';

export const McpContext = createParamDecorator<McpRequestContext>(
  (_, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const value = req[MCP_CONTEXT_KEY];
    if (!value) {
      throw new Error(
        'McpContext used on a route that did not pass McpAuthGuard',
      );
    }
    return value as McpRequestContext;
  },
);

/**
 * Scope-check helper used by tools. Pure function — easy to unit test.
 * @returns true when the context's scopes include `required`.
 */
export function hasScope(
  context: McpRequestContext,
  required: string,
): boolean {
  return context.scopes.includes(required);
}

/**
 * Per-org tool guard. Throws BadRequest if a platform-scope (null org)
 * token tries to call a tool that needs to know which org's data to
 * read or mutate. Returns the non-null orgId on success — designed to
 * be used as `const orgId = requireOrgScope(context)` inline in tool
 * handlers.
 *
 * The error code maps to MCP `INVALID_INPUT` (not `FORBIDDEN`) because
 * the issue is the wrong KIND of token, not a scope-level deny.
 */
export function requireOrgScope(context: McpRequestContext): string {
  if (context.organizationId == null) {
    // Lazy-imported to avoid a circular dep with NestJS's BadRequestException
    // when this file is consumed from non-Nest contexts (the SDK callback).
    const { BadRequestException } = require('@nestjs/common');
    throw new BadRequestException(
      'This tool requires an org-scoped token. Issue a token with a specific organizationId.',
    );
  }
  return context.organizationId;
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * After `McpAuthGuard` validates a bearer, the resolved token context
 * is attached to the Express request as `mcpContext`. Tools and
 * audit code read it via this decorator (or directly off the request,
 * which is sometimes necessary inside the SDK callback).
 */
export interface McpRequestContext {
  tokenId: string;
  organizationId: string;
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

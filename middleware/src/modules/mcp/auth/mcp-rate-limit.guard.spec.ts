import { ThrottlerException } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';
import { McpRateLimitGuard, MCP_RATE_LIMIT_DEFAULTS } from './mcp-rate-limit.guard';
import { MCP_CONTEXT_KEY, type McpRequestContext } from './mcp-context';

function makeCtx(mcp?: McpRequestContext): ExecutionContext {
  const req = {} as Record<string, unknown>;
  if (mcp) req[MCP_CONTEXT_KEY] = mcp;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('McpRateLimitGuard', () => {
  let guard: McpRateLimitGuard;
  const ctx: McpRequestContext = {
    tokenId: 'tok_1',
    organizationId: 'org_1',
    agentName: 'support-triage',
    scopes: ['displays:read'],
  };

  beforeEach(() => {
    guard = new McpRateLimitGuard();
  });

  it('allows the first call', () => {
    expect(guard.canActivate(makeCtx(ctx))).toBe(true);
  });

  it('throws ThrottlerException after per-min limit', () => {
    for (let i = 0; i < MCP_RATE_LIMIT_DEFAULTS.perMin; i++) {
      guard.canActivate(makeCtx(ctx));
    }
    expect(() => guard.canActivate(makeCtx(ctx))).toThrow(ThrottlerException);
  });

  it('two distinct tokens have independent buckets', () => {
    const ctxB: McpRequestContext = { ...ctx, tokenId: 'tok_2' };
    for (let i = 0; i < MCP_RATE_LIMIT_DEFAULTS.perMin; i++) {
      guard.canActivate(makeCtx(ctx));
    }
    // tok_1 is now at the limit; tok_2 should still pass
    expect(() => guard.canActivate(makeCtx(ctx))).toThrow(ThrottlerException);
    expect(guard.canActivate(makeCtx(ctxB))).toBe(true);
  });

  it('throws when McpAuthGuard did not run first (defense-in-depth)', () => {
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(ThrottlerException);
  });
});

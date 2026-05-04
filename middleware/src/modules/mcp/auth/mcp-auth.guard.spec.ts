import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpTokenService } from './mcp-token.service';
import { MCP_CONTEXT_KEY } from './mcp-context';

function makeCtx(headers: Record<string, string | undefined> = {}) {
  const req: Record<string, unknown> = { headers };
  return {
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext,
    req,
  };
}

describe('McpAuthGuard', () => {
  let guard: McpAuthGuard;
  let tokens: jest.Mocked<Pick<McpTokenService, 'validate'>>;

  beforeEach(() => {
    tokens = { validate: jest.fn() } as never;
    guard = new McpAuthGuard(tokens as never);
  });

  it('rejects when Authorization header is missing', async () => {
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when Authorization header is not Bearer', async () => {
    const { ctx } = makeCtx({ authorization: 'Basic abc' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects with the GENERIC message when token validation fails (no info leak)', async () => {
    tokens.validate.mockResolvedValue(null);
    const { ctx } = makeCtx({ authorization: 'Bearer mcp_anything' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Invalid or expired/);
  });

  it('attaches mcpContext to the request on success', async () => {
    tokens.validate.mockResolvedValue({
      id: 'tok_1',
      organizationId: 'org_1',
      agentName: 'support-triage',
      scopes: ['displays:read'],
    });
    const { ctx, req } = makeCtx({ authorization: 'Bearer mcp_xyz' });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req[MCP_CONTEXT_KEY]).toEqual({
      tokenId: 'tok_1',
      organizationId: 'org_1',
      agentName: 'support-triage',
      scopes: ['displays:read'],
    });
  });
});

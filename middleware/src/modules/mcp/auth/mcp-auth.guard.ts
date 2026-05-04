import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { MCP_CONTEXT_KEY, type McpRequestContext } from './mcp-context';
import { McpTokenService } from './mcp-token.service';

/**
 * Bearer-token guard for the MCP transport endpoint. Extracts the
 * `Authorization: Bearer <token>` header, validates via
 * `McpTokenService.validate`, and on success attaches the resolved
 * context to `req[MCP_CONTEXT_KEY]` for downstream consumers (tool
 * handlers, audit interceptor).
 *
 * On any failure: throw `UnauthorizedException` with a generic message.
 * Don't leak which check failed (missing header vs expired vs revoked
 * vs unknown hash) — that's an info-disclosure invitation. The token
 * service logs the precise reason for ops.
 */
@Injectable()
export class McpAuthGuard implements CanActivate {
  private readonly logger = new Logger(McpAuthGuard.name);

  constructor(private readonly tokens: McpTokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const bearer = auth.slice('Bearer '.length).trim();
    const context = await this.tokens.validate(bearer);
    if (!context) {
      // Generic message — see class docstring
      throw new UnauthorizedException('Invalid or expired MCP token');
    }
    const ctxValue: McpRequestContext = {
      tokenId: context.id,
      organizationId: context.organizationId,
      agentName: context.agentName,
      scopes: context.scopes,
    };
    (req as Request & Record<string, unknown>)[MCP_CONTEXT_KEY] = ctxValue;
    return true;
  }
}

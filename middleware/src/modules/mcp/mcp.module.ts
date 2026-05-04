import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DisplaysModule } from '../displays/displays.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SupportModule } from '../support/support.module';
import { McpAuditService } from './audit/mcp-audit.service';
import { McpAuthGuard } from './auth/mcp-auth.guard';
import { McpRateLimitGuard } from './auth/mcp-rate-limit.guard';
import { McpTokenService } from './auth/mcp-token.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { McpTokensAdminController } from './admin/mcp-tokens.controller';

/**
 * Vizora MCP server module.
 *
 * Exposes:
 *   - POST /api/v1/mcp                     (MCP transport — auth required)
 *   - GET  /api/v1/mcp                     (MCP transport SSE leg)
 *   - POST /api/v1/admin/mcp-tokens        (issue, super-admin only)
 *   - GET  /api/v1/admin/mcp-tokens        (list)
 *   - DELETE /api/v1/admin/mcp-tokens/:id  (revoke)
 *
 * Tools registered:
 *   - `list_displays`                 (scope `displays:read`)
 *   - `list_open_support_requests`    (scope `support:read`, structural-only)
 *
 * Companion docs: `docs/agents-mcp-server-design.md`.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AdminModule,
    DisplaysModule,
    OrganizationsModule,
    SupportModule,
  ],
  controllers: [McpController, McpTokensAdminController],
  providers: [McpService, McpTokenService, McpAuthGuard, McpRateLimitGuard, McpAuditService],
  exports: [McpService, McpTokenService],
})
export class McpModule {}

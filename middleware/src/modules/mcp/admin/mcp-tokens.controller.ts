import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../admin/guards/super-admin.guard';
import { McpTokenService } from '../auth/mcp-token.service';

/**
 * Admin endpoints for issuing, listing, and revoking MCP tokens.
 *
 * Auth: super-admin only (Vizora platform admins, NOT org admins).
 * Issuing a token grants access to ALL data within the named org —
 * an org-admin should not be able to issue a bearer that bypasses
 * their own scope checks.
 *
 * The plaintext bearer is returned ONCE on issue and never
 * recoverable. Admin must copy it immediately.
 */
@ApiTags('admin', 'mcp')
@Controller('api/v1/admin/mcp-tokens')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@ApiBearerAuth()
export class McpTokensAdminController {
  constructor(private readonly tokens: McpTokenService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Issue a new MCP token. Plaintext returned ONCE.',
  })
  async issue(
    @Body()
    body: {
      name: string;
      organizationId: string;
      agentName: string;
      scopes: string[];
      expiresInDays?: number;
    },
  ) {
    return this.tokens.issue(body);
  }

  @Get()
  @ApiOperation({
    summary: 'List MCP tokens. Optional org filter via ?organizationId=',
  })
  async list(@Query('organizationId') organizationId?: string) {
    return this.tokens.list(organizationId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke an MCP token. Idempotent.' })
  async revoke(@Param('id') id: string): Promise<void> {
    await this.tokens.revoke(id);
  }
}

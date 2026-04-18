import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { SkipOutputSanitize } from '../common/interceptors/sanitize.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AgentStateService } from './agent-state.service';
import { CustomerIncidentService } from './customer-incident.service';
import { AgentStatusQueryDto } from './dto/agent-status-query.dto';
import { CreateCustomerIncidentDto } from './dto/create-customer-incident.dto';

/**
 * Admin-only agent status + manual-run endpoints.
 * - @UseGuards(JwtAuthGuard, SuperAdminGuard) at class level (D18).
 * - @SkipOutputSanitize is applied ONLY to the state-read endpoints — those
 *   payloads are already sanitized by AgentStateService. Incident creation
 *   returns a raw Prisma row and must still pass through the global
 *   SanitizeInterceptor.
 * - Manual-run names are allowlisted; no child_process (D-arch-R2-2).
 * - organizationId for incident writes is derived from the caller's JWT,
 *   never the request body (D-sec-R3-1).
 */
@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AgentsController {
  private static readonly RUNNABLE = new Set([
    'customer-lifecycle',
    'support-triage',
    'screen-health-customer',
    'billing-revenue',
    'content-intelligence',
    'agent-orchestrator',
  ]);

  constructor(
    private readonly state: AgentStateService,
    private readonly incidents: CustomerIncidentService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Aggregate status across all agent families (paginated)' })
  @SkipOutputSanitize()
  async status(@Query() q: AgentStatusQueryDto) {
    return this.state.aggregateStatus(q.page ?? 1, q.limit ?? 10);
  }

  @Get(':name/state')
  @ApiOperation({ summary: 'Read a single agent family state (sanitized)' })
  @SkipOutputSanitize()
  async agentState(@Param('name') name: string) {
    if (!AgentsController.RUNNABLE.has(name)) {
      throw new BadRequestException('unknown agent');
    }
    return this.state.read(name);
  }

  @Post(':name/run')
  @ApiOperation({ summary: 'Manually enqueue a run of the named agent (picked up on next cron tick)' })
  @HttpCode(202)
  async trigger(@Param('name') name: string) {
    if (!AgentsController.RUNNABLE.has(name)) {
      throw new BadRequestException('unknown agent');
    }
    return this.state.enqueueManualRun(name);
  }

  @Post('incidents')
  @ApiOperation({ summary: 'Create a customer incident for the caller organization' })
  @HttpCode(201)
  async createIncident(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateCustomerIncidentDto,
  ) {
    if (!organizationId) {
      throw new BadRequestException('missing organization context');
    }
    return this.incidents.create(organizationId, dto);
  }

  /**
   * R4-MED2: read/resolve endpoints so the dashboard can render and close
   * incidents. All queries are org-scoped from JWT (never the path/body).
   */
  @Get('incidents')
  @ApiOperation({ summary: 'List open customer incidents for the caller organization' })
  async listIncidents(@CurrentUser('organizationId') organizationId: string) {
    if (!organizationId) {
      throw new BadRequestException('missing organization context');
    }
    return this.incidents.listOpenForOrg(organizationId);
  }

  @Patch('incidents/:id/resolve')
  @ApiOperation({ summary: 'Mark a customer incident as resolved (org-scoped)' })
  async resolveIncident(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('missing organization context');
    }
    const res = await this.incidents.resolve(organizationId, id);
    // updateMany returns {count} — 0 means either the id doesn't exist or it
    // belongs to another org. Don't distinguish externally (prevents org-id
    // enumeration); 404 covers both.
    if (res.count === 0) {
      throw new NotFoundException('incident not found');
    }
    return { id, status: 'resolved' };
  }
}

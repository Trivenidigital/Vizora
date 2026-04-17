import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  @SkipOutputSanitize()
  async status(@Query() q: AgentStatusQueryDto) {
    return this.state.aggregateStatus(q.page ?? 1, q.limit ?? 10);
  }

  @Get(':name/state')
  @SkipOutputSanitize()
  async agentState(@Param('name') name: string) {
    if (!AgentsController.RUNNABLE.has(name)) {
      throw new BadRequestException('unknown agent');
    }
    return this.state.read(name);
  }

  @Post(':name/run')
  @HttpCode(202)
  async trigger(@Param('name') name: string) {
    if (!AgentsController.RUNNABLE.has(name)) {
      throw new BadRequestException('unknown agent');
    }
    return this.state.enqueueManualRun(name);
  }

  @Post('incidents')
  async createIncident(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateCustomerIncidentDto,
  ) {
    if (!organizationId) {
      throw new BadRequestException('missing organization context');
    }
    return this.incidents.create(organizationId, dto);
  }
}

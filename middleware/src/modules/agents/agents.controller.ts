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
import { AgentStateService } from './agent-state.service';
import { CustomerIncidentService } from './customer-incident.service';
import { AgentStatusQueryDto } from './dto/agent-status-query.dto';
import { CreateCustomerIncidentDto } from './dto/create-customer-incident.dto';

/**
 * Admin-only agent status + manual-run endpoints.
 * - @SkipOutputSanitize at class level — we return structured agent state
 *   verbatim (already sanitized via AgentStateService).
 * - @UseGuards(JwtAuthGuard, SuperAdminGuard) at class level (D18).
 * - Manual-run names are allowlisted; no child_process (D-arch-R2-2).
 */
@Controller('agents')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@SkipOutputSanitize()
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
  async status(@Query() q: AgentStatusQueryDto) {
    return this.state.aggregateStatus(q.page ?? 1, q.limit ?? 10);
  }

  @Get(':name/state')
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
  async createIncident(@Body() dto: CreateCustomerIncidentDto) {
    return this.incidents.create(dto);
  }
}

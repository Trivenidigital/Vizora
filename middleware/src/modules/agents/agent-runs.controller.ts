import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { AgentRunsService } from './agent-runs.service';
import {
  RecordRunInput,
  EnrichRunInput,
  type RecordRunInputT,
  type EnrichRunInputT,
} from './agent-runs.schemas';

/**
 * Internal endpoints for the runner script + insights-poller sidecar to
 * record per-firing metrics. Auth: x-internal-api-key + x-internal-caller
 * (see InternalSecretGuard).
 *
 * Bodies validated with Zod at the controller boundary (matches surrounding
 * MCP code style).
 *
 * Error codes (Reviewer A+B critical D1):
 *   - 400: body schema validation failed
 *   - 401: missing/wrong api-key OR missing/unknown caller
 *   - 404: agent_runs row id not found
 *   - 409: row past 5-minute freeze window
 *
 * See: docs/plans/2026-05-08-agent-platform-redesign-design.md §3.2
 */
@Controller('internal/agent-runs')
@UseGuards(InternalSecretGuard)
export class AgentRunsController {
  constructor(private readonly service: AgentRunsService) {}

  @Post()
  @HttpCode(201)
  async record(@Body() body: unknown): Promise<{ id: string }> {
    const parsed = this.parseOrBadRequest(RecordRunInput, body, 'RecordRunInput');
    return this.service.recordRun(parsed);
  }

  @Patch(':id')
  @HttpCode(200)
  async enrich(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<{ id: string; enriched: boolean }> {
    const parsed = this.parseOrBadRequest(EnrichRunInput, body, 'EnrichRunInput');
    // Service throws NotFoundException / ConflictException — Nest maps to 404 / 409.
    return this.service.enrichRun(id, parsed);
  }

  /**
   * Spend-aware pre-flight gate for the runner. Caller is responsible for
   * any client-side caching; server-side caching for stampede mitigation
   * is added by the cache interceptor (NOT in this commit — deferred to
   * P0.4 deploy when stampede actually matters; spec §3.2 captures intent).
   */
  @Get('today-spend')
  async todaySpend(): Promise<{ usd: number }> {
    const usd = await this.service.getTodaySpendUsd();
    return { usd };
  }

  private parseOrBadRequest<T>(
    schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } } },
    body: unknown,
    label: string,
  ): T {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: `${label} validation failed`,
        issues: result.error?.issues ?? [],
      });
    }
    return result.data as T;
  }
}

/**
 * Re-exports for any caller that wants the parsed types without dragging
 * in the schema module path.
 */
export type { RecordRunInputT, EnrichRunInputT };

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  MODEL_RATES,
  type RecordRunInputT,
  type EnrichRunInputT,
  type RunOutcomeT,
} from './agent-runs.schemas';

/**
 * Per-firing record-keeping for Hermes agent invocations.
 *
 * Two-stage write pattern (design ADL-2):
 *   1. recordRun()  — synchronous, called by the runner POST endpoint
 *   2. enrichRun()  — asynchronous, called by the insights-poller sidecar
 *                     ~5 min later with cost + token data
 *
 * Cost is FROZEN at write (ADL-7). When MODEL_RATES changes, historical
 * rows preserve their snapshotted rateInUsdPerMt / rateOutUsdPerMt.
 *
 * Frozen-row guard (ADL-2): PATCH refuses if server-side now() is more
 * than 5 min past finishedAt. Prevents late-arriving enrichments from
 * overwriting rows that downstream alerts may already have fired on.
 */
@Injectable()
export class AgentRunsService {
  private readonly logger = new Logger(AgentRunsService.name);

  /** Frozen-row threshold from finishedAt; matches sidecar poll cadence. */
  private static readonly FREEZE_WINDOW_MS = 5 * 60 * 1000;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Synchronous write from runner. Returns the new row's id so the
   * runner can correlate later enrichment via mcp_audit_log.agentRunId.
   */
  async recordRun(input: RecordRunInputT): Promise<{ id: string }> {
    const startedAt = new Date(input.startedAt);
    const finishedAt = new Date(input.finishedAt);
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const row = await this.db.agentRun.create({
      data: {
        skillName: input.skillName,
        organizationId: input.organizationId ?? null,
        pid: input.pid ?? null,
        startedAt,
        finishedAt,
        durationMs,
        exitCode: input.exitCode,
        outcome: input.outcome,
        errorExcerpt: input.errorExcerpt?.slice(0, 1024) ?? null,
        preflightBalanceUsd: input.preflightBalanceUsd ?? null,
        preflightTodaySpendUsd: input.preflightTodaySpendUsd ?? null,
      },
      select: { id: true },
    });
    return { id: row.id };
  }

  /**
   * Sidecar enrichment. Throws NotFoundException if id unknown, or
   * ConflictException if the row's freeze window has elapsed.
   *
   * Idempotent under MVCC via the `tokensIn IS NULL` predicate combined
   * with the RETURNING clause (Reviewer B D7). Concurrent sidecars both
   * execute UPDATE; only one matches the predicate; the other gets
   * zero rows back and treats it as a benign "already enriched."
   */
  async enrichRun(id: string, input: EnrichRunInputT): Promise<{ id: string; enriched: boolean }> {
    // Surface NotFound separately from "frozen" so callers can distinguish
    // a sidecar bug from a benign late-tick (Reviewer A+B).
    const existing = await this.db.agentRun.findUnique({
      where: { id },
      select: { id: true, finishedAt: true, tokensIn: true },
    });
    if (!existing) {
      throw new NotFoundException(`agent_runs row '${id}' not found`);
    }
    if (existing.finishedAt) {
      const elapsed = Date.now() - existing.finishedAt.getTime();
      if (elapsed > AgentRunsService.FREEZE_WINDOW_MS) {
        throw new ConflictException(
          `agent_runs row '${id}' is frozen (finishedAt + 5min < now)`,
        );
      }
    }

    // Compute cost using the rate AT this moment. Snapshot the rate into
    // the row alongside the cost so historical analysis stays accurate
    // when MODEL_RATES later changes (ADL-7).
    const rate = input.model ? MODEL_RATES[input.model] : undefined;
    const rateIn = input.rateInUsdPerMt ?? rate?.inUsdPerMt;
    const rateOut = input.rateOutUsdPerMt ?? rate?.outUsdPerMt;
    const costMicrodollars = computeCostMicrodollars(
      input.tokensIn,
      input.tokensOut,
      rateIn,
      rateOut,
    );

    // Idempotent UPDATE: only writes if tokensIn is still NULL. The
    // RETURNING-equivalent (updateMany returns count) lets us detect the
    // "another sidecar got it first" race and treat as benign.
    const result = await this.db.agentRun.updateMany({
      where: { id, tokensIn: null },
      data: {
        tokensIn: input.tokensIn ?? null,
        tokensOut: input.tokensOut ?? null,
        costMicrodollars,
        rateInUsdPerMt: rateIn ?? null,
        rateOutUsdPerMt: rateOut ?? null,
        model: input.model ?? null,
        outcome: input.outcomeRefinement ?? undefined,
      },
    });
    if (result.count === 0) {
      // Either already enriched (race with another sidecar) or row doesn't
      // exist (we already checked above so this is the race path).
      this.logger.log(`agent_runs '${id}' already enriched by another sidecar instance`);
      return { id, enriched: false };
    }
    return { id, enriched: true };
  }

  /**
   * Returns total agent spend for the current UTC day in USD.
   * Used by runner pre-flight check to enforce DAILY_BUDGET_USD.
   * Caller (controller) is responsible for any caching layer.
   */
  async getTodaySpendUsd(): Promise<number> {
    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);
    const result = await this.db.agentRun.aggregate({
      _sum: { costMicrodollars: true },
      where: { startedAt: { gte: startOfUtcDay } },
    });
    const micros = result._sum.costMicrodollars ?? 0;
    return micros / 1_000_000;
  }

  /**
   * Sidecar orphan-row sweep (design §4.3 race scenario + I7).
   * Marks rows as runner_crash if their tokensIn is still NULL more than
   * 10 minutes after creation. Called periodically by the sidecar.
   */
  async sweepOrphans(): Promise<{ marked: number }> {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const result = await this.db.agentRun.updateMany({
      where: {
        tokensIn: null,
        createdAt: { lt: cutoff },
        outcome: { notIn: ['runner_crash', 'budget_aborted'] satisfies RunOutcomeT[] },
      },
      data: {
        outcome: 'runner_crash' satisfies RunOutcomeT,
        errorExcerpt: 'orphan row — runner crashed before final write',
      },
    });
    return { marked: result.count };
  }
}

/**
 * Pure helper exported for unit testing.
 * Returns null if any required input is missing — never throws.
 */
export function computeCostMicrodollars(
  tokensIn: number | undefined,
  tokensOut: number | undefined,
  rateInUsdPerMt: number | undefined,
  rateOutUsdPerMt: number | undefined,
): number | null {
  if (
    tokensIn == null ||
    tokensOut == null ||
    rateInUsdPerMt == null ||
    rateOutUsdPerMt == null
  ) {
    return null;
  }
  // tokens × USD/MT = microdollars (1e-6 USD per token-rate-million unit).
  // Round to nearest microdollar for storage as Int.
  const inMicros = tokensIn * rateInUsdPerMt;
  const outMicros = tokensOut * rateOutUsdPerMt;
  return Math.round(inMicros + outMicros);
}

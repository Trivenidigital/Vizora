/**
 * Zod schemas + types for the agent-runs subsystem.
 *
 * See: docs/plans/2026-05-08-agent-platform-redesign-design.md §3.1
 *
 * The runner script POSTs RecordRunInput synchronously on firing exit.
 * The insights-poller sidecar PATCHes EnrichRunInput ~5 min later with
 * cost / token data extracted from `hermes insights`.
 *
 * Outcome taxonomy follows ADL-3 (mutually exclusive). The runner emits
 * only the 4-value subset it can detect from Hermes-visible signals; the
 * sidecar refines to the full 8-value enum using mcp_audit_log data.
 */

import { z } from 'zod';

/**
 * Full outcome enum stored in agent_runs.outcome. Stored as String for
 * forward-compatibility (avoids Postgres-enum migration friction).
 *
 * Mutual exclusivity rules (Reviewer A D10):
 *   - success      = Hermes RC=0, all MCP calls succeeded (or none made)
 *   - partial      = Hermes RC=0, ≥1 MCP success AND ≥1 MCP failure
 *   - tool_error   = Hermes RC=0, ALL MCP calls failed (no successes)
 *   - api_error    = Hermes RC≠0 OR HTTP 4xx/5xx in stdout (excluding timeout)
 *   - timeout      = Hermes RC=124 (timeout(1) signal)
 *   - budget_aborted = Pre-flight refused; Hermes never invoked
 *   - no_work      = Hermes RC=0, MCP calls succeeded, but list_* tools
 *                    returned 0 candidates (heuristic: no shadow_log row written)
 *   - runner_crash = Sidecar finds row with tokensIn=NULL AND createdAt > 10min ago
 */
export const RUN_OUTCOMES = [
  'success',
  'no_work',
  'partial',
  'tool_error',
  'api_error',
  'timeout',
  'budget_aborted',
  'runner_crash',
] as const;
export const RunOutcome = z.enum(RUN_OUTCOMES);
export type RunOutcomeT = z.infer<typeof RunOutcome>;

/**
 * Subset the runner can classify from Hermes stdout alone.
 * `success` here is provisional — the sidecar may downgrade later.
 */
export const RUNNER_OUTCOMES = [
  'success',
  'api_error',
  'timeout',
  'budget_aborted',
] as const;
export const RunnerOutcome = z.enum(RUNNER_OUTCOMES);
export type RunnerOutcomeT = z.infer<typeof RunnerOutcome>;

/**
 * Body of POST /api/v1/internal/agent-runs.
 * Dates are ISO-8601 strings on the wire; service-side they become Date.
 */
export const RecordRunInput = z.object({
  skillName: z.string().min(1).max(128),
  organizationId: z.string().nullable().optional(),
  pid: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  exitCode: z.number().int(),
  outcome: RunnerOutcome,
  errorExcerpt: z.string().max(1024).optional(),
  preflightBalanceUsd: z.number().optional(),
  preflightTodaySpendUsd: z.number().optional(),
});
export type RecordRunInputT = z.infer<typeof RecordRunInput>;

/**
 * Body of PATCH /api/v1/internal/agent-runs/:id.
 * Sidecar enrichment — captures rate snapshot AT write time (ADL-7).
 */
export const EnrichRunInput = z.object({
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  model: z.string().max(128).optional(),
  rateInUsdPerMt: z.number().nonnegative().optional(),
  rateOutUsdPerMt: z.number().nonnegative().optional(),
  outcomeRefinement: RunOutcome.optional(),
});
export type EnrichRunInputT = z.infer<typeof EnrichRunInput>;

/**
 * Per-million-token rates in USD. Snapshotted into agent_runs at
 * enrichment time (ADL-7). Update when adding new models.
 *
 * Source: https://openrouter.ai/models — verified 2026-05-08.
 */
export interface ModelRate {
  inUsdPerMt: number;
  outUsdPerMt: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'openai/gpt-4o-mini': { inUsdPerMt: 0.15, outUsdPerMt: 0.60 },
  'openai/gpt-4o-mini-2024-07-18': { inUsdPerMt: 0.15, outUsdPerMt: 0.60 },
  'openai/gpt-4o': { inUsdPerMt: 2.50, outUsdPerMt: 10.00 },
  'anthropic/claude-3.5-sonnet': { inUsdPerMt: 3.00, outUsdPerMt: 15.00 },
  'anthropic/claude-3.5-haiku': { inUsdPerMt: 0.80, outUsdPerMt: 4.00 },
};

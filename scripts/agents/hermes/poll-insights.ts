/**
 * insights-poller — sidecar that enriches agent_runs rows with cost data
 * from `hermes insights`.
 *
 * Architecture (design §3.1, ADL-2):
 *   1. Runner script POSTs synchronous metadata to /internal/agent-runs
 *      (no cost/token data — Hermes hasn't reported yet).
 *   2. This sidecar runs as PM2 cron every 5 min:
 *      - Calls `hermes insights --days 1 --source cli`
 *      - Parses the boxed-unicode-table output
 *      - For each unenriched agent_runs row in the last hour, PATCHes
 *        the matching insights row (joined by skillName + time-range +
 *        model presence). Cost is computed from MODEL_RATES at this
 *        moment and frozen onto the row (ADL-7).
 *      - Refines outcome via mcp_audit_log join on agentRunId.
 *      - Sweeps orphan rows (>10 min unenriched → runner_crash).
 *
 * Deploy as a PM2 cron entry:
 *   {
 *     name: 'hermes-insights-poller',
 *     script: 'npx',
 *     args: 'tsx scripts/agents/hermes/poll-insights.ts',
 *     cron_restart: '*\/5 * * * *',
 *     autorestart: false,
 *   }
 *
 * Hermes-first (design §1.5): we use `hermes insights` rather than
 * rolling our own cost-tracker — Hermes already does the math.
 */

// Loads /opt/vizora/app/.env so DATABASE_URL + INTERNAL_API_SECRET +
// MIDDLEWARE_URL are available to the PM2-spawned process (matches the
// pattern used by scripts/ops/*.ts).
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@vizora/database';
import { parseHermesInsightsTable, type InsightsRow } from './insights-parser';
import {
  classifyAuditOutcome,
  mcpAuditAgentNamesForSkill,
  type AuditStatusGroup,
} from './outcome-refinement';
// Single source of truth for model rates (PR-review R1 I2: was duplicated).
// The sidecar imports from middleware's schemas module by relative path —
// tsx resolves it via the standard node module algorithm at runtime.
import { MODEL_RATES } from '../../../middleware/src/modules/agents/agent-runs.schemas';

const PRISMA = new PrismaClient();
const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL ?? 'http://localhost:3000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_SECRET ?? '';
const AUDIT_FALLBACK_WINDOW_PADDING_MS = 5 * 1000;

async function main(): Promise<void> {
  const insightsOutput = runHermesInsights();
  const rows = parseHermesInsightsTable(insightsOutput);
  const enrichedCount = await enrichUnpolledRows(rows);
  const orphanCount = await sweepOrphans();
  const refinedCount = await refineOutcomesFromAuditLog();
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      insights_rows: rows.length,
      enriched: enrichedCount,
      orphans_marked: orphanCount,
      outcomes_refined: refinedCount,
    }),
  );
}

function runHermesInsights(): string {
  // Investigation 2026-05-09 (`docs/plans/2026-05-09-hermes-insights-investigation.md`):
  // `hermes -z` does NOT write to the SQLite session store. `hermes insights`
  // returns empty for our `cli` source AND for `cron` source (cron source only
  // had data from the deprecated `hermes cron` mechanism removed in PR #60).
  //
  // The sidecar's intended flow (parse insights → enrich agent_runs with cost)
  // is therefore dormant. We keep the call so when Hermes adds session
  // persistence to `-z` mode (or we wire a different insights source), this
  // path lights up automatically.
  //
  // For now: the empty result is EXPECTED, not an error.
  try {
    const out = execFileSync(
      '/usr/local/bin/hermes',
      ['insights', '--days', '1', '--source', 'cli'],
      { encoding: 'utf8', timeout: 15_000 },
    );
    return out;
  } catch (err) {
    // Genuinely unexpected: the hermes process itself errored.
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        message: 'hermes insights returned non-zero — likely empty session store for -z mode',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return '';
  }
}

async function enrichUnpolledRows(rows: InsightsRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  // Find unenriched rows in the last hour. Tighter window means we don't
  // re-attempt enrichment for rows we already gave up on.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const unenriched = await PRISMA.agentRun.findMany({
    where: {
      tokensIn: null,
      finishedAt: { not: null, gte: oneHourAgo },
      outcome: { notIn: ['budget_aborted', 'runner_crash'] },
    },
    select: { id: true, skillName: true, startedAt: true, finishedAt: true },
  });
  let enriched = 0;
  for (const row of unenriched) {
    // Match by skillName + time-range overlap with the insights row.
    // Insights gives session-level data; we approximate by picking the
    // row whose timestamp is closest to the firing's startedAt.
    const candidate = pickClosestRow(rows, row.skillName, row.startedAt);
    if (!candidate) continue;
    const rate = MODEL_RATES[candidate.model];
    const ok = await patchRun(row.id, {
      tokensIn: candidate.tokensIn,
      tokensOut: candidate.tokensOut,
      model: candidate.model,
      rateInUsdPerMt: rate?.inUsdPerMt,
      rateOutUsdPerMt: rate?.outUsdPerMt,
    });
    if (ok) enriched++;
  }
  return enriched;
}

function pickClosestRow(
  rows: InsightsRow[],
  skillName: string,
  startedAt: Date,
): InsightsRow | undefined {
  // Insights doesn't tag rows by skill name in a structured way (the
  // session id is the closest thing). For now we naively take the row
  // whose timestamp falls within the firing's wall-clock window. If
  // ambiguous (multiple matches), we pick the closest to startedAt.
  const targetMs = startedAt.getTime();
  let best: InsightsRow | undefined;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    if (r.skillNameHint && r.skillNameHint !== skillName) continue;
    const delta = Math.abs(r.timestamp.getTime() - targetMs);
    if (delta < bestDelta) {
      best = r;
      bestDelta = delta;
    }
  }
  // Reject matches more than 5 minutes away — likely a different firing.
  if (bestDelta > 5 * 60 * 1000) return undefined;
  return best;
}

async function patchRun(id: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${MIDDLEWARE_URL}/api/v1/internal/agent-runs/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': INTERNAL_API_KEY,
        'x-internal-caller': 'sidecar',
      },
      body: JSON.stringify(body),
    });
    // Middleware wraps responses in {success, data, meta}. PATCH returns
    // 200 + envelope on success. We only need the status code here.
    if (res.status === 200) return true;
    if (res.status === 409) {
      // Frozen-row — expected for late ticks. INFO-level, not an error.
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: 'info',
          message: 'frozen-row PATCH attempted',
          id,
        }),
      );
      return false;
    }
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        message: 'PATCH failed',
        id,
        status: res.status,
      }),
    );
    return false;
  } catch (err) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        message: 'PATCH exception',
        id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}

/**
 * Marks rows older than 10 minutes with no enrichment as runner_crash.
 *
 * PR-review R1 I2 fix: previously duplicated AgentRunsService.sweepOrphans
 * logic byte-for-byte. Now POSTs to the middleware's sweep endpoint —
 * single source of truth for the cutoff window + outcome semantics.
 *
 * (The middleware endpoint is added in this PR review pass — see
 * agent-runs.controller.ts.)
 */
async function sweepOrphans(): Promise<number> {
  try {
    const res = await fetch(`${MIDDLEWARE_URL}/api/v1/internal/agent-runs/sweep-orphans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': INTERNAL_API_KEY,
        'x-internal-caller': 'sidecar',
      },
    });
    if (!res.ok) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        message: 'sweep-orphans HTTP failed',
        status: res.status,
      }));
      return 0;
    }
    // Response envelope: {success, data: {marked: N}, meta}
    const json = (await res.json()) as { data?: { marked?: number }; marked?: number };
    return json.data?.marked ?? json.marked ?? 0;
  } catch (err) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      message: 'sweep-orphans exception',
      error: err instanceof Error ? err.message : String(err),
    }));
    return 0;
  }
}

/**
 * Joins agent_runs to mcp_audit_log. Exact `agentRunId` rows win. Hermes
 * 0.12.0 cannot yet propagate per-run headers, so current MCP audit rows can
 * have null `agentRunId`; in that case we fall back to agentName + firing
 * window and only refine when audit evidence exists.
 *
 * Mutually exclusive (Reviewer A D10):
 *   - success      = all calls succeeded
 *   - partial      = ≥1 success AND ≥1 failure
 *   - tool_error   = 0 successes AND ≥1 failure
 *   - no_work      = not inferred from absent audit rows until precise
 *                    per-run MCP headers exist.
 */
async function refineOutcomesFromAuditLog(): Promise<number> {
  // Look at agent_runs with provisional `success` from the last hour
  // that haven't been refined yet (we skip if already refined to a
  // non-success state — outcome is otherwise immutable).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const candidates = await PRISMA.agentRun.findMany({
    where: {
      outcome: 'success',
      enrichedAt: null,
      startedAt: { gte: oneHourAgo },
    },
    select: { id: true, skillName: true, startedAt: true, finishedAt: true },
  });
  let refined = 0;
  for (const row of candidates) {
    const { groups } = await loadAuditStatusGroupsForRun(row);
    const { outcome } = classifyAuditOutcome(groups);

    // Patch confirmed `success` too: the middleware sets enrichedAt on PATCH,
    // which prevents the orphan sweep from later misclassifying valid runs.
    if (outcome) {
      const ok = await patchRun(row.id, { outcomeRefinement: outcome });
      if (ok) refined++;
    }
  }
  return refined;
}

async function loadAuditStatusGroupsForRun(row: {
  id: string;
  skillName: string;
  startedAt: Date;
  finishedAt: Date | null;
}): Promise<{
  groups: AuditStatusGroup[];
  source: 'agentRunId' | 'timeRange' | 'none';
}> {
  const exactGroups = await groupAuditStatuses({ agentRunId: row.id });
  if (exactGroups.length > 0) {
    return { groups: exactGroups, source: 'agentRunId' };
  }

  const fallbackStart = new Date(
    row.startedAt.getTime() - AUDIT_FALLBACK_WINDOW_PADDING_MS,
  );
  const fallbackEndBase = row.finishedAt ?? row.startedAt;
  const fallbackEnd = new Date(
    fallbackEndBase.getTime() + AUDIT_FALLBACK_WINDOW_PADDING_MS,
  );
  const fallbackGroups = await groupAuditStatuses({
    agentRunId: null,
    agentName: { in: mcpAuditAgentNamesForSkill(row.skillName) },
    createdAt: { gte: fallbackStart, lte: fallbackEnd },
  });

  if (fallbackGroups.length > 0) {
    return { groups: fallbackGroups, source: 'timeRange' };
  }
  return { groups: [], source: 'none' };
}

async function groupAuditStatuses(
  where: Prisma.McpAuditLogWhereInput,
): Promise<AuditStatusGroup[]> {
  const groups = await PRISMA.mcpAuditLog.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });

  return groups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));
}

main()
  .catch((err) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'fatal',
        message: 'poll-insights fatal',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => PRISMA.$disconnect());

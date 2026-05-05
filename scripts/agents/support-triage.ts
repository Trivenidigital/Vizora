#!/usr/bin/env npx tsx
/**
 * Vizora Agent System — Support Triage Agent
 *
 * Runs every 5 minutes via PM2 cron. For each open SupportRequest the agent
 * has not yet touched, it computes a TicketSignal (structural only — no
 * message body, to avoid PII in future LLM prompts), asks the AgentAI to
 * rerank them, and writes a SupportMessage with authorType='agent' carrying
 * the summary + suggested internal note. Priority is adjusted when the
 * rerank score diverges significantly from the stored priority.
 *
 * Safeguards:
 *   - Reply-loop prevention (D7): query excludes requests that already have
 *     any authorType='agent' message in the thread
 *   - Cross-org guard (D8): every query names organizationId explicitly
 *   - No PII in signal: wordCount/hasAttachment/ageMinutes only
 *
 * Exit codes:
 *   0 — cycle complete
 *   2 — fatal (DB unreachable)
 */

import 'dotenv/config';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { prisma, classifyCategoryV2 } from '@vizora/database';
import type { SupportRequest, SupportMessage } from '@vizora/database';
import { readAgentState, writeAgentState } from './lib/state.js';
import { log as opsLog } from './lib/alerting.js';
import { createAgentAI } from './lib/ai.js';
import type {
  TicketSignal,
  TicketCategory,
  TicketCategoryV2,
  TicketPriority,
  OrgTier,
  Incident,
  AgentResult,
} from './lib/types.js';

const AGENT = 'support-triage';
// Parallel JSONL for shadow comparison against the Hermes-driven
// vizora-support-triage skill. Sibling file to
// /var/log/hermes/vizora-support-triage-shadow.jsonl so
// scripts/agents/compare-hermes-vs-heuristic.ts can join by
// (ticket_id, run_id) for true score-vs-score head-to-head.
const HEURISTIC_LOG_PATH =
  process.env.SUPPORT_TRIAGE_HEURISTIC_LOG ??
  '/var/log/hermes/vizora-support-triage-heuristic.jsonl';
// Must match middleware/src/modules/agents/agent-state.service.ts AGENT_TO_FAMILY
const FAMILY = 'ops' as const;
const BATCH_LIMIT = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  opsLog(AGENT, msg);
}

// Existing SupportRequest.category uses free-form strings like 'bug_report';
// collapse them into the constrained TicketCategory union for the AI signal.
function coerceCategory(c: string | null | undefined): TicketCategory {
  const v = (c ?? '').toLowerCase();
  if (v.includes('bill') || v.includes('pay')) return 'billing';
  if (v.includes('display') || v.includes('screen') || v.includes('device')) return 'display';
  if (v.includes('content') || v.includes('template') || v.includes('playlist')) return 'content';
  if (v.includes('account') || v.includes('login') || v.includes('auth')) return 'account';
  if (v.includes('bug') || v.includes('tech') || v.includes('error')) return 'technical';
  return 'other';
}

function coercePriority(p: string | null | undefined): TicketPriority {
  const v = (p ?? '').toLowerCase();
  if (v === 'critical' || v === 'urgent') return 'urgent';
  if (v === 'high') return 'high';
  if (v === 'low') return 'low';
  return 'normal';
}

function coerceTier(t: string | null | undefined): OrgTier {
  const v = (t ?? '').toLowerCase();
  if (v === 'starter' || v === 'pro' || v === 'enterprise') return v;
  return 'free';
}

// classifyCategoryV2 lives in @vizora/database (packages/database/src/lib/
// classify-ticket-v2.ts) so it can be reused by future pre-persistence
// Path B consumers and exercised by a dedicated Jest fixture corpus.

function minutesSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 60_000);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

type TicketRow = SupportRequest & {
  organization: { id: string; subscriptionTier: string };
  _count: { messages: number };
};

async function fetchOpenOrgs(): Promise<string[]> {
  const rows = await prisma.supportRequest.groupBy({
    by: ['organizationId'],
    where: {
      status: 'open',
      messages: { none: { authorType: 'agent' } },
    },
  });
  return rows.map(r => r.organizationId);
}

async function fetchTicketsForOrg(orgId: string): Promise<TicketRow[]> {
  return prisma.supportRequest.findMany({
    where: {
      organizationId: orgId,
      status: 'open',
      messages: { none: { authorType: 'agent' } },
    },
    include: {
      organization: { select: { id: true, subscriptionTier: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: BATCH_LIMIT,
  });
}

async function countDisplaysForOrg(orgId: string): Promise<number> {
  return prisma.display.count({ where: { organizationId: orgId } });
}

async function buildSignals(tickets: TicketRow[], deviceCount: number): Promise<TicketSignal[]> {
  return tickets.map(t => ({
    id: t.id,
    category: coerceCategory(t.category),
    priority: coercePriority(t.priority),
    orgTier: coerceTier(t.organization.subscriptionTier),
    deviceCount,
    wordCount: (t.description ?? '').trim().split(/\s+/).filter(Boolean).length,
    hasAttachment: Boolean(t.consoleErrors && t.consoleErrors.length > 0),
    ageMinutes: minutesSince(t.createdAt),
  }));
}

// ─── Triage action ───────────────────────────────────────────────────────────

async function writeAgentMessage(
  ticket: TicketRow,
  score: number,
  reason: string,
): Promise<SupportMessage | null> {
  const summary = `Agent triage: score=${score.toFixed(2)} — ${reason}`.slice(0, 500);
  try {
    return await prisma.supportMessage.create({
      data: {
        requestId: ticket.id,
        organizationId: ticket.organizationId, // explicit cross-org guard (D8)
        userId: ticket.userId, // attribute to original submitter account
        role: 'assistant',
        authorType: 'agent',
        content: summary,
      },
    });
  } catch (err) {
    log(`writeAgentMessage failed for ticket=${ticket.id}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function scoreToPriority(score: number): TicketPriority {
  if (score >= 0.85) return 'urgent';
  if (score >= 0.65) return 'high';
  if (score >= 0.35) return 'normal';
  return 'low';
}

/**
 * Append one JSONL row per ticket reflecting what the heuristic
 * classifier suggested THIS cycle. Sibling to the Hermes shadow log so
 * `compare-hermes-vs-heuristic.ts` can join by (ticket_id, run_id) for
 * a true score-vs-score comparison.
 *
 * Failures here are non-fatal — the cron's primary job is the DB
 * mutation, not the comparison log.
 */
function logHeuristicSuggestion(
  runId: string,
  ticket: TicketRow,
  score: number,
  reason: string,
  signal: TicketSignal,
): void {
  try {
    mkdirSync(dirname(HEURISTIC_LOG_PATH), { recursive: true });
    const row = {
      timestamp: new Date().toISOString(),
      run_id: runId,
      ticket_id: ticket.id,
      organization_id: ticket.organizationId,
      heuristic_score: Number(score.toFixed(4)),
      heuristic_priority: scoreToPriority(score),
      heuristic_reason: reason,
      input_signals: {
        priority: signal.priority,
        category: signal.category,
        ai_category: ticket.aiCategory ?? null,
        age_minutes: signal.ageMinutes,
        word_count: signal.wordCount,
        has_attachment: signal.hasAttachment,
        message_count: ticket._count.messages,
        org_tier: signal.orgTier,
      },
    };
    appendFileSync(HEURISTIC_LOG_PATH, JSON.stringify(row) + '\n');
  } catch (err) {
    log(`heuristic log append failed for ticket=${ticket.id}: ${err instanceof Error ? err.message : err}`);
  }
}

async function writeAiCategory(
  ticket: TicketRow,
  category: TicketCategoryV2,
): Promise<boolean> {
  try {
    const res = await prisma.supportRequest.updateMany({
      where: { id: ticket.id, organizationId: ticket.organizationId }, // cross-org guard (D8)
      data: { aiCategory: category },
    });
    return res.count === 1;
  } catch (err) {
    log(`aiCategory write failed for ticket=${ticket.id}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function maybeUpdatePriority(
  ticket: TicketRow,
  score: number,
): Promise<boolean> {
  const current = coercePriority(ticket.priority);
  const suggested = scoreToPriority(score);
  if (current === suggested) return false;

  // Rank numerically to detect meaningful divergence
  const rank = (p: TicketPriority): number =>
    p === 'urgent' ? 3 : p === 'high' ? 2 : p === 'normal' ? 1 : 0;
  if (Math.abs(rank(current) - rank(suggested)) < 2) return false;

  try {
    const res = await prisma.supportRequest.updateMany({
      where: { id: ticket.id, organizationId: ticket.organizationId },
      data: { priority: suggested },
    });
    return res.count === 1;
  } catch (err) {
    log(`priority update failed for ticket=${ticket.id}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const started = Date.now();
  // run_id matches the Hermes shadow's epoch-seconds shape so the
  // comparison script can join rows that were emitted by the same
  // cron cadence (Hermes also fires every 5 min via hermes cron).
  const runId = String(Math.floor(started / 1000));
  log('Starting support-triage cycle');

  let orgIds: string[];
  try {
    orgIds = await fetchOpenOrgs();
  } catch (err) {
    log(`FATAL: fetchOpenOrgs — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }
  log(`Found ${orgIds.length} org(s) with open, un-triaged tickets`);

  const ai = createAgentAI(process.env.AGENT_AI_PROVIDER || 'heuristic');
  const incidents: Incident[] = [];
  let triaged = 0;
  let priorityChanged = 0;
  let aiCategorized = 0;

  for (const orgId of orgIds) {
    let tickets: TicketRow[];
    try {
      tickets = await fetchTicketsForOrg(orgId);
    } catch (err) {
      log(`fetchTicketsForOrg(${orgId}) failed: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (tickets.length === 0) continue;

    const deviceCount = await countDisplaysForOrg(orgId).catch((err) => {
      log(`countDisplays failed org=${orgId}: ${err instanceof Error ? err.message : err}`);
      return 0;
    });
    const signals = await buildSignals(tickets, deviceCount);

    let ranked;
    try {
      ranked = await ai.rerank(signals);
    } catch (err) {
      log(`AI rerank failed for org=${orgId}: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    // Index tickets and signals by id for quick lookup
    const byId = new Map(tickets.map(t => [t.id, t]));
    const signalById = new Map(signals.map(s => [s.id, s]));

    for (const r of ranked) {
      const ticket = byId.get(r.id);
      if (!ticket) continue;
      const signal = signalById.get(r.id);

      // Log the heuristic's suggestion BEFORE we mutate. Captures one
      // JSONL row per ticket per cron firing, regardless of whether
      // the subsequent writes succeed — keeps the comparison dataset
      // complete even if writeAgentMessage / maybeUpdatePriority race
      // with another writer.
      if (signal) {
        logHeuristicSuggestion(runId, ticket, r.score, r.reason, signal);
      }

      const msg = await writeAgentMessage(ticket, r.score, r.reason);
      if (msg) triaged++;

      if (await maybeUpdatePriority(ticket, r.score)) priorityChanged++;

      // Idempotency guard: classify each ticket exactly once. D7 reply-loop
      // prevention already excludes triaged tickets from the fetch, but if
      // writeAgentMessage fails mid-cycle, this guard keeps aiCategory stable
      // on retry. Downstream measurement stays a static snapshot, not a
      // rolling backfill — any future classifier tweak won't silently rewrite
      // historical rows.
      if (ticket.aiCategory == null) {
        const v2 = classifyCategoryV2(ticket.title, ticket.description, ticket.category);
        if (await writeAiCategory(ticket, v2)) aiCategorized++;
      }
    }
  }

  const durationMs = Date.now() - started;
  const result: AgentResult = {
    agent: AGENT,
    timestamp: new Date().toISOString(),
    durationMs,
    issuesFound: triaged,
    issuesFixed: triaged,
    issuesEscalated: priorityChanged,
    incidents,
  };

  const state = await readAgentState(FAMILY);
  state.agentResults = { ...state.agentResults, [AGENT]: result };
  state.lastRun = { ...state.lastRun, [AGENT]: new Date().toISOString() };
  writeAgentState(FAMILY, state);

  log(`Cycle complete in ${durationMs}ms — triaged=${triaged}, priorityChanged=${priorityChanged}, aiCategorized=${aiCategorized}`);
  process.exitCode = 0;
}

main()
  .catch(err => {
    log(`FATAL: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

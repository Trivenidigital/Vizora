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
import { prisma } from '@vizora/database';
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

// Heuristic TicketCategoryV2 classifier — no LLM cost, no PII leak.
// Taxonomy: docs/hermes/ticket-categories-2026-04-24.md. Order matters —
// most-specific patterns first so 'device pairing' wins over 'device'.
// Mis-classifications fall to 'other', which is the signal we want to see
// during the 30-day measurement gate.
//
// Input notes:
//   - Curly apostrophes (U+2019) from Word/macOS autocorrect are normalized
//     to ASCII up front so patterns like /won'?t/ match both 'won't' and
//     'won\u2019t'. Without this, a visible-but-different character silently
//     skips every contraction-based rule.
//   - 'ad' is word-bounded via \b because unbounded /ad/ matches 'address',
//     'admin', 'advice', 'added' and pulls unrelated tickets into content/
//     device buckets.
//   - 'member' alone is too loose — 'add a team member to my plan' is a
//     billing concern, not a permissions one. Narrowed to team member /
//     seat / user access phrasing.
//   - 'charge'/'charged' alone collides with device-power tickets ('screen
//     won\u2019t charge'). Removed from the billing trunk regex; strong
//     billing tokens (invoice/refund/payment/credit card/subscription/
//     plan change) carry the category on their own.
function classifyCategoryV2(
  title: string | null,
  description: string | null,
  legacyCategory: string | null,
): TicketCategoryV2 {
  const raw = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  const text = raw.replace(/[\u2018\u2019]/g, "'");
  const cat = (legacyCategory ?? '').toLowerCase();

  // Device family
  if (/pair(ing)?\s*(code|fail|error|expired|won'?t|not work)/.test(text)) return 'device_pairing_failed';
  if (/(screen|display|device|tv)[^.]*(offline|disconnect(ed)?|not (connect|reach|online))/.test(text)) return 'device_offline';
  if (/(wrong|old|stuck on|showing.*instead).*(content|playlist|video|image|\b(?:ad|ads|advert)\b)/.test(text)) return 'device_wrong_content';
  if (/(video|audio|playback|mp4|stream)[^.]*(error|fail|broken|black screen|blank|frozen|stutter)/.test(text)) return 'device_playback_error';
  if (/(resolution|rotation|orientation|portrait|landscape|upside down|timezone|clock)/.test(text)) return 'device_display_config';

  // Content family
  if (/upload[^.]*(fail|error|stuck|rejected|timeout)|can'?t upload|won'?t upload/.test(text)) return 'content_upload_failed';
  if (/(not showing|didn'?t show|isn'?t showing|never appeared|missing from)/.test(text) && /(content|image|video|\b(?:ad|ads|advert)\b|playlist)/.test(text)) return 'content_not_showing';
  if (/(expir|disappeared|gone missing|ran out|end date)/.test(text) && /(content|\b(?:ad|ads|advert)\b|image|video)/.test(text)) return 'content_expired';
  if (/template[^.]*(broken|blank|wrong|render|error|missing|variable)/.test(text)) return 'content_template_broken';
  if (/(storage|quota|limit|too large|size limit|too big|over.*limit)/.test(text)) return 'content_storage_limit';

  // Schedule family
  if (/schedul[^.]*(not play|didn'?t play|not trigger|not work|not start|not run)/.test(text)) return 'schedule_not_playing';
  if (/(timezone|time zone|dst|daylight saving|hours? off|off by.*hour|wrong time)/.test(text)) return 'schedule_timezone_issue';
  if (/(overlap|conflict|two schedules|both schedules|collision)/.test(text) && text.includes('schedul')) return 'schedule_conflict';
  if (/(gap|dead air|nothing showing|blank between|coverage)/.test(text) && text.includes('schedul')) return 'schedule_coverage_gap';

  // Analytics family
  if (/(analytics|metrics|stats|dashboard|report)[^.]*(missing|no data|empty|blank|not showing)/.test(text)) return 'analytics_missing_data';
  if (/(impression|view count|play count|count)[^.]*(wrong|off|incorrect|doesn'?t match|discrepan)/.test(text)) return 'analytics_wrong_count';
  if (/export[^.]*(fail|error|blank|empty|corrupt)/.test(text) && /(report|analytics|csv|pdf)/.test(text)) return 'analytics_export_failed';

  // Account / Billing — seat/member-management verbs checked before the
  // narrower billing/permissions trunk. Adding a team member changes seat
  // count → billing is the material decision; the permissions grant is
  // downstream of the subscription change.
  if (/\b(add|invite|remove|grant|revoke)\b[^.]{0,40}\b(team member|seat)\b/.test(text)) return 'billing_invoice_question';
  if (/\b(team member|seat)\b[^.]{0,40}\b(plan|subscription)\b/.test(text)) return 'billing_invoice_question';
  if (/(invoice|billing|refund|subscription|plan change|payment|credit card)/.test(text)) return 'billing_invoice_question';
  if (/(login|log in|sign in|password|forgot|can'?t access|mfa|2fa|locked out|reset link)/.test(text)) return 'account_access_lost';
  if (/(permission|role|access denied|not authorized|admin rights|cannot edit|\buser access\b)/.test(text)) return 'account_permissions';

  // Legacy-category fallbacks when description text is sparse
  if (cat.includes('bill') || cat.includes('pay')) return 'billing_invoice_question';
  if (cat.includes('account') || cat.includes('login') || cat.includes('auth')) return 'account_access_lost';

  return 'other';
}

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

    // Index tickets by id for quick lookup
    const byId = new Map(tickets.map(t => [t.id, t]));

    for (const r of ranked) {
      const ticket = byId.get(r.id);
      if (!ticket) continue;

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

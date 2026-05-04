#!/usr/bin/env npx tsx
/**
 * Compare Hermes shadow-mode classifications against the existing
 * heuristic classifier's DB writes.
 *
 * Reads `/var/log/hermes/vizora-support-triage-shadow.jsonl` (one JSONL
 * row per Hermes cron tick), joins to `support_requests` by id, and
 * reports:
 *   - cron firing rate (heartbeat lines per period)
 *   - per-ticket priority agreement between Hermes-suggested and the
 *     DB-stored priority
 *   - sample disagreements
 *
 * **What this can and cannot tell us**
 *
 * The DB `priority` field reflects the user's original submission
 * unless the heuristic PM2 cron decided the score diverged enough to
 * write back (rank-distance ≥ 2 in scripts/agents/support-triage.ts).
 * Most rows are the user's submission, NOT the heuristic's score-to-
 * priority output. So this script answers:
 *
 *   "Would Hermes have proposed a different priority than what the
 *    user submitted (or what the heuristic occasionally overrode)?"
 *
 * It does NOT answer "Hermes score vs heuristic score" head-to-head.
 * For that we'd need the heuristic cron to also log its score to a
 * parallel file. That's a tracked follow-up — see backlog.md.
 *
 * Run from the VPS (where both the shadow log and the DB live):
 *
 *   ssh root@89.167.55.176 'cd /opt/vizora/app && export $(grep DATABASE_URL .env | xargs) && npx tsx scripts/agents/compare-hermes-vs-heuristic.ts'
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { prisma } from '@vizora/database';

const SHADOW_LOG =
  process.env.HERMES_SHADOW_LOG ??
  '/var/log/hermes/vizora-support-triage-shadow.jsonl';

interface HermesRow {
  timestamp: string;
  run_id: string;
  ticket_id: string | null;
  organization_id: string | null;
  hermes_score: number | null;
  hermes_priority: 'urgent' | 'high' | 'normal' | 'low' | null;
  hermes_reasoning: string | null;
  input_signals: Record<string, unknown> | null;
}

interface DisagreementSample {
  ticket: string;
  hermes: string;
  db: string;
  reason: string | null;
}

function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${Math.round((100 * n) / d)}%`;
}

function priorityRank(p: string): number {
  switch (p.toLowerCase()) {
    case 'urgent':
    case 'critical':
      return 3;
    case 'high':
      return 2;
    case 'normal':
    case 'medium':
      return 1;
    case 'low':
      return 0;
    default:
      return -1; // unknown / null
  }
}

async function main(): Promise<void> {
  if (!existsSync(SHADOW_LOG)) {
    console.error(`No shadow log at ${SHADOW_LOG}`);
    console.error(`Set HERMES_SHADOW_LOG to override the path.`);
    process.exitCode = 2;
    return;
  }

  const text = readFileSync(SHADOW_LOG, 'utf8');
  const lines = text.split('\n').filter(Boolean);
  const rows: HermesRow[] = [];
  let malformed = 0;
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line) as HermesRow);
    } catch {
      malformed++;
    }
  }

  const heartbeats = rows.filter((r) => r.ticket_id == null);
  const scored = rows.filter((r) => r.ticket_id != null);

  // Cron-firing-rate signal: time span / heartbeat count → expected ~5 min between
  let firingRateNote = '';
  if (heartbeats.length >= 2) {
    const first = new Date(heartbeats[0].timestamp).getTime();
    const last = new Date(heartbeats[heartbeats.length - 1].timestamp).getTime();
    const spanMin = (last - first) / 60_000;
    const ticksPerHour =
      spanMin > 0 ? (heartbeats.length / spanMin) * 60 : NaN;
    firingRateNote = ` — ~${ticksPerHour.toFixed(1)} ticks/hr (cron is */5 → expected ~12)`;
  }

  console.log('Hermes shadow-mode comparison');
  console.log('=============================');
  console.log(`Shadow log:                   ${SHADOW_LOG}`);
  console.log(`Total log lines:              ${lines.length}`);
  console.log(`Malformed (skipped):          ${malformed}`);
  console.log(`Heartbeat rows (cron fires):  ${heartbeats.length}${firingRateNote}`);
  console.log(`Ticket-scoring rows:          ${scored.length}`);

  if (scored.length === 0) {
    console.log(
      '\nNo ticket scorings yet. The Hermes cron is firing but the token-scoped org has no open tickets.',
    );
    console.log(
      'Either seed a request in the E2E Test Org, or expand the token to cover an org with traffic.',
    );
    return;
  }

  const ticketIds = [...new Set(scored.map((r) => r.ticket_id!))];
  const dbTickets = await prisma.supportRequest.findMany({
    where: { id: { in: ticketIds } },
    select: { id: true, priority: true, status: true, aiCategory: true },
  });
  const byId = new Map(dbTickets.map((t) => [t.id, t]));

  let agree = 0;
  let disagree = 0;
  let unmatched = 0;
  let rankDiffSum = 0;
  const samples: DisagreementSample[] = [];

  for (const r of scored) {
    const t = byId.get(r.ticket_id!);
    if (!t) {
      unmatched++;
      continue;
    }
    const dbP = (t.priority ?? '').toLowerCase();
    const hP = (r.hermes_priority ?? '').toLowerCase();
    if (dbP === hP) {
      agree++;
    } else {
      disagree++;
      const rDb = priorityRank(dbP);
      const rH = priorityRank(hP);
      if (rDb >= 0 && rH >= 0) rankDiffSum += Math.abs(rDb - rH);
      if (samples.length < 10) {
        samples.push({
          ticket: r.ticket_id!,
          hermes: hP || '<null>',
          db: dbP || '<null>',
          reason: r.hermes_reasoning,
        });
      }
    }
  }

  const matched = agree + disagree;

  console.log(`\nTickets joined to DB:         ${matched}`);
  console.log(`Unmatched (deleted/missing):  ${unmatched}`);
  console.log(`Priority agreement:           ${agree} (${pct(agree, matched)})`);
  console.log(`Priority disagreement:        ${disagree} (${pct(disagree, matched)})`);
  if (disagree > 0) {
    console.log(
      `Avg disagreement rank-distance: ${(rankDiffSum / disagree).toFixed(2)} (1 = adjacent tier, 3 = max)`,
    );
  }

  if (samples.length > 0) {
    console.log('\nSample disagreements (first 10):');
    for (const s of samples) {
      console.log(
        `  ${s.ticket.slice(0, 8)}  hermes=${s.hermes.padEnd(7)}  db=${s.db.padEnd(7)}  | ${
          s.reason ?? '<no reason>'
        }`,
      );
    }
  }

  console.log('\nReminder: DB priority is mostly the user-submitted priority.');
  console.log('To compare Hermes vs heuristic head-to-head, the existing PM2');
  console.log('support-triage cron also needs to log its score per cycle to a');
  console.log("parallel file. Tracked in backlog.md as a follow-up.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

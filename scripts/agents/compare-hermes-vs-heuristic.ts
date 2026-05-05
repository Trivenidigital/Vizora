#!/usr/bin/env npx tsx
/**
 * Compare Hermes shadow-mode classifications against the existing
 * heuristic classifier's per-ticket suggestions.
 *
 * Reads two parallel JSONL files:
 *   - HERMES_SHADOW_LOG     (default /var/log/hermes/vizora-support-
 *                            triage-shadow.jsonl) — one row per ticket
 *                            per Hermes cron tick
 *   - HEURISTIC_LOG         (default /var/log/hermes/vizora-support-
 *                            triage-heuristic.jsonl) — one row per ticket
 *                            per PM2 cron tick, written by
 *                            scripts/agents/support-triage.ts
 *
 * Joins by (ticket_id, run_id) and reports:
 *   - cron firing rate (heartbeats per period)
 *   - per-ticket priority agreement (Hermes priority vs heuristic priority)
 *   - per-ticket score divergence (Hermes score vs heuristic score)
 *   - sample disagreements
 *
 * The earlier version of this script joined to the DB `priority` field,
 * which mostly reflected the user's submission (not the heuristic's
 * score). The new heuristic JSONL gives us a true score-vs-score
 * head-to-head — same input signals, same scoring window, two scoring
 * implementations.
 *
 * Run from the VPS:
 *
 *   ssh root@89.167.55.176 'cd /opt/vizora/app && export $(grep DATABASE_URL .env | xargs) && npx tsx scripts/agents/compare-hermes-vs-heuristic.ts'
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { prisma } from '@vizora/database';

const SHADOW_LOG =
  process.env.HERMES_SHADOW_LOG ??
  '/var/log/hermes/vizora-support-triage-shadow.jsonl';
const HEURISTIC_LOG =
  process.env.SUPPORT_TRIAGE_HEURISTIC_LOG ??
  '/var/log/hermes/vizora-support-triage-heuristic.jsonl';

type Priority = 'urgent' | 'high' | 'normal' | 'low';

interface HermesRow {
  timestamp: string;
  run_id: string;
  ticket_id: string | null;
  organization_id: string | null;
  hermes_score: number | null;
  hermes_priority: Priority | null;
  hermes_reasoning: string | null;
  input_signals: Record<string, unknown> | null;
}

interface HeuristicRow {
  timestamp: string;
  run_id: string;
  ticket_id: string;
  organization_id: string;
  heuristic_score: number;
  heuristic_priority: Priority;
  heuristic_reason: string;
  input_signals: Record<string, unknown>;
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
      return -1;
  }
}

function readJsonl<T>(path: string): { rows: T[]; malformed: number } {
  if (!existsSync(path)) return { rows: [], malformed: 0 };
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n').filter(Boolean);
  const rows: T[] = [];
  let malformed = 0;
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line) as T);
    } catch {
      malformed++;
    }
  }
  return { rows, malformed };
}

async function main(): Promise<void> {
  const { rows: hermesRows, malformed: hermesBad } = readJsonl<HermesRow>(SHADOW_LOG);
  const { rows: heuristicRows, malformed: heuristicBad } =
    readJsonl<HeuristicRow>(HEURISTIC_LOG);

  if (hermesRows.length === 0 && heuristicRows.length === 0) {
    console.error(`Neither log exists or both empty:\n  ${SHADOW_LOG}\n  ${HEURISTIC_LOG}`);
    process.exitCode = 2;
    return;
  }

  const heartbeats = hermesRows.filter((r) => r.ticket_id == null);
  const hermesScored = hermesRows.filter((r) => r.ticket_id != null);

  let firingRateNote = '';
  if (heartbeats.length >= 2) {
    const first = new Date(heartbeats[0].timestamp).getTime();
    const last = new Date(heartbeats[heartbeats.length - 1].timestamp).getTime();
    const spanMin = (last - first) / 60_000;
    const ticksPerHour = spanMin > 0 ? (heartbeats.length / spanMin) * 60 : NaN;
    firingRateNote = ` — ~${ticksPerHour.toFixed(1)} ticks/hr (cron is */5 → expected ~12)`;
  }

  console.log('Hermes vs Heuristic shadow comparison (support-triage)');
  console.log('======================================================');
  console.log(`Hermes log:                    ${SHADOW_LOG}`);
  console.log(`  rows: ${hermesRows.length} (heartbeats: ${heartbeats.length}, scored: ${hermesScored.length}, malformed: ${hermesBad})${firingRateNote}`);
  console.log(`Heuristic log:                 ${HEURISTIC_LOG}`);
  console.log(`  rows: ${heuristicRows.length} (malformed: ${heuristicBad})`);

  if (hermesScored.length === 0 && heuristicRows.length === 0) {
    console.log('\nNo per-ticket decisions yet from either side. Likely the test orgs have no open tickets.');
    return;
  }

  // Index heuristic rows by composite key. Hermes and heuristic crons
  // both fire every 5 min; their run_ids may not match exactly (each
  // computes its own epoch-seconds), but ticket_id alone is a reasonable
  // join key — most tickets are scored once per cron firing per side.
  const heuristicByTicket = new Map<string, HeuristicRow[]>();
  for (const r of heuristicRows) {
    const arr = heuristicByTicket.get(r.ticket_id) ?? [];
    arr.push(r);
    heuristicByTicket.set(r.ticket_id, arr);
  }

  let agreePri = 0;
  let disagreePri = 0;
  let unmatched = 0;
  let scoreDiffSum = 0;
  let scoreDiffCount = 0;
  const samples: Array<{
    ticket: string;
    hermesP: string;
    heuristicP: string;
    hermesS: number;
    heuristicS: number;
    reason: string | null;
  }> = [];

  for (const h of hermesScored) {
    const hCandidates = heuristicByTicket.get(h.ticket_id!) ?? [];
    if (hCandidates.length === 0) {
      unmatched++;
      continue;
    }
    // Pick the closest-in-time heuristic row (paired by run cadence)
    const closest = hCandidates.reduce((best, r) =>
      Math.abs(new Date(r.timestamp).getTime() - new Date(h.timestamp).getTime()) <
      Math.abs(new Date(best.timestamp).getTime() - new Date(h.timestamp).getTime())
        ? r
        : best,
    );

    const hP = h.hermes_priority ?? '';
    const cP = closest.heuristic_priority;
    if (hP === cP) {
      agreePri++;
    } else {
      disagreePri++;
      if (samples.length < 10) {
        samples.push({
          ticket: h.ticket_id!,
          hermesP: hP || '<null>',
          heuristicP: cP,
          hermesS: h.hermes_score ?? NaN,
          heuristicS: closest.heuristic_score,
          reason: h.hermes_reasoning,
        });
      }
    }

    if (h.hermes_score != null) {
      scoreDiffSum += Math.abs(h.hermes_score - closest.heuristic_score);
      scoreDiffCount++;
    }
  }

  const matched = agreePri + disagreePri;
  console.log(`\nMatched (Hermes ticket joined to heuristic row): ${matched}`);
  console.log(`Unmatched (heuristic never scored this ticket):  ${unmatched}`);
  console.log(`Priority agreement:                              ${agreePri} (${pct(agreePri, matched)})`);
  console.log(`Priority disagreement:                           ${disagreePri} (${pct(disagreePri, matched)})`);
  if (scoreDiffCount > 0) {
    console.log(`Mean |Hermes score − heuristic score|:           ${(scoreDiffSum / scoreDiffCount).toFixed(3)}`);
  }

  if (samples.length > 0) {
    console.log('\nSample disagreements (first 10):');
    for (const s of samples) {
      const diff = Math.abs(s.hermesS - s.heuristicS).toFixed(2);
      console.log(
        `  ${s.ticket.slice(0, 8)}  hermes=${s.hermesP.padEnd(7)}(${s.hermesS.toFixed(2)})  heuristic=${s.heuristicP.padEnd(7)}(${s.heuristicS.toFixed(2)})  Δ=${diff}  | ${s.reason ?? '<no reason>'}`,
      );
    }
  }

  // Cutover gate readout
  console.log('\n— Cutover gate readout —');
  console.log(`  ≥7 days shadow:               ${heartbeats.length >= 2 ? `${heartbeats.length} heartbeats` : '<2 heartbeats'}`);
  console.log(`  ≥50 tickets scored:           ${hermesScored.length >= 50 ? '✓ MET' : `✗ have ${hermesScored.length}`}`);
  console.log(`  ≥80% priority agreement:      ${matched > 0 && agreePri / matched >= 0.8 ? '✓ MET' : `✗ have ${pct(agreePri, matched)}`}`);
  console.log(`  Sri sign-off:                 (out of band)`);

  // Disconnect even though the script doesn't read the DB anymore — keep
  // the import for future expansion (e.g., joining to live DB state).
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 2;
});

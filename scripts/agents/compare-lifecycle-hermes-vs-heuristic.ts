#!/usr/bin/env npx tsx
/**
 * Compare Hermes shadow-mode customer-lifecycle decisions against the
 * existing heuristic's per-org suggestions.
 *
 * Reads two parallel JSONL files:
 *   - HERMES_LIFECYCLE_SHADOW_LOG  (default /var/log/hermes/vizora-
 *                                   customer-lifecycle-shadow.jsonl)
 *   - CUSTOMER_LIFECYCLE_HEURISTIC_LOG (default /var/log/hermes/
 *                                       vizora-customer-lifecycle-
 *                                       heuristic.jsonl) — written by
 *                                       scripts/agents/customer-lifecycle.ts
 *
 * Joins by organization_id (closest-in-time match per org) and reports:
 *   - cron firing rate
 *   - per-org template agreement (Hermes template vs heuristic template)
 *   - sample disagreements
 *
 * The earlier version joined to organization_onboarding's mark-sent
 * timestamps, which conflated SUGGEST with SENT — SMTP failures showed
 * up as Hermes-disagreements. The new heuristic JSONL gives us true
 * suggest-vs-suggest comparison: same input signals, two scoring
 * implementations, no wire-side noise.
 *
 * Run from the VPS:
 *
 *   ssh root@89.167.55.176 'cd /opt/vizora/app && export $(grep DATABASE_URL .env | xargs) && npx tsx scripts/agents/compare-lifecycle-hermes-vs-heuristic.ts'
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { prisma } from '@vizora/database';

const SHADOW_LOG =
  process.env.HERMES_LIFECYCLE_SHADOW_LOG ??
  '/var/log/hermes/vizora-customer-lifecycle-shadow.jsonl';
const HEURISTIC_LOG =
  process.env.CUSTOMER_LIFECYCLE_HEURISTIC_LOG ??
  '/var/log/hermes/vizora-customer-lifecycle-heuristic.jsonl';

type Template =
  | 'day1-pair-screen'
  | 'day3-upload-content'
  | 'day7-create-schedule'
  | 'none';

interface HermesRow {
  timestamp: string;
  run_id: string;
  organization_id: string | null;
  tier?: string;
  days_since_signup?: number;
  hermes_template: Template | null;
  hermes_reasoning: string | null;
  input_signals: Record<string, unknown> | null;
}

interface HeuristicRow {
  timestamp: string;
  run_id: string;
  organization_id: string;
  tier: string;
  days_since_signup: number;
  heuristic_template: string;
  heuristic_action: 'send_nudge' | 'auto_complete' | 'none';
  heuristic_reason: string;
  input_signals: Record<string, unknown>;
}

function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${Math.round((100 * n) / d)}%`;
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

  const heartbeats = hermesRows.filter((r) => r.organization_id == null);
  const hermesDecisions = hermesRows.filter((r) => r.organization_id != null);

  let firingRateNote = '';
  if (heartbeats.length >= 2) {
    const first = new Date(heartbeats[0].timestamp).getTime();
    const last = new Date(heartbeats[heartbeats.length - 1].timestamp).getTime();
    const spanMin = (last - first) / 60_000;
    const ticksPerHour = spanMin > 0 ? (heartbeats.length / spanMin) * 60 : NaN;
    firingRateNote = ` — ~${ticksPerHour.toFixed(1)} ticks/hr (cron is */30 → expected ~2)`;
  }

  console.log('Hermes vs Heuristic shadow comparison (customer-lifecycle)');
  console.log('==========================================================');
  console.log(`Hermes log:                   ${SHADOW_LOG}`);
  console.log(`  rows: ${hermesRows.length} (heartbeats: ${heartbeats.length}, decisions: ${hermesDecisions.length}, malformed: ${hermesBad})${firingRateNote}`);
  console.log(`Heuristic log:                ${HEURISTIC_LOG}`);
  console.log(`  rows: ${heuristicRows.length} (malformed: ${heuristicBad})`);

  if (hermesDecisions.length === 0 && heuristicRows.length === 0) {
    console.log('\nNo per-org decisions yet from either side.');
    return;
  }

  // Build heuristic index by org_id
  const heuristicByOrg = new Map<string, HeuristicRow[]>();
  for (const r of heuristicRows) {
    const arr = heuristicByOrg.get(r.organization_id) ?? [];
    arr.push(r);
    heuristicByOrg.set(r.organization_id, arr);
  }

  let agreeTpl = 0;
  let disagreeTpl = 0;
  let unmatched = 0;
  const samples: Array<{
    org: string;
    hermes: string;
    heuristic: string;
    days: number;
    reason: string | null;
  }> = [];

  for (const h of hermesDecisions) {
    const hCandidates = heuristicByOrg.get(h.organization_id!) ?? [];
    if (hCandidates.length === 0) {
      unmatched++;
      continue;
    }
    // Pick the closest-in-time heuristic row
    const closest = hCandidates.reduce((best, r) =>
      Math.abs(new Date(r.timestamp).getTime() - new Date(h.timestamp).getTime()) <
      Math.abs(new Date(best.timestamp).getTime() - new Date(h.timestamp).getTime())
        ? r
        : best,
    );

    const hermesT = (h.hermes_template ?? 'none') as Template;
    const heuristicT = closest.heuristic_template;

    if (hermesT === heuristicT) {
      agreeTpl++;
    } else {
      disagreeTpl++;
      if (samples.length < 10) {
        samples.push({
          org: h.organization_id!.slice(0, 8),
          hermes: hermesT,
          heuristic: heuristicT,
          days: closest.days_since_signup,
          reason: h.hermes_reasoning,
        });
      }
    }
  }

  const matched = agreeTpl + disagreeTpl;
  console.log(`\nMatched (Hermes org joined to heuristic row):    ${matched}`);
  console.log(`Unmatched (heuristic never scored this org):     ${unmatched}`);
  console.log(`Template agreement:                              ${agreeTpl} (${pct(agreeTpl, matched)})`);
  console.log(`Template disagreement:                           ${disagreeTpl} (${pct(disagreeTpl, matched)})`);

  if (samples.length > 0) {
    console.log('\nSample disagreements (first 10):');
    for (const s of samples) {
      console.log(
        `  ${s.org}  age=${String(s.days).padStart(3)}d  hermes=${s.hermes.padEnd(22)}  heuristic=${s.heuristic.padEnd(22)}  | ${s.reason ?? '<no reason>'}`,
      );
    }
  }

  console.log('\n— Cutover gate readout —');
  console.log(`  ≥7 days shadow:               ${heartbeats.length >= 2 ? `${heartbeats.length} heartbeats` : '<2 heartbeats'}`);
  console.log(`  ≥50 per-org decisions:        ${hermesDecisions.length >= 50 ? '✓ MET' : `✗ have ${hermesDecisions.length}`}`);
  console.log(`  ≥80% template agreement:      ${matched > 0 && agreeTpl / matched >= 0.8 ? '✓ MET' : `✗ have ${pct(agreeTpl, matched)}`}`);
  console.log(`  Sri sign-off:                 (out of band)`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 2;
});

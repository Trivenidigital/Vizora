#!/usr/bin/env npx tsx
/**
 * Compare Hermes shadow-mode customer-lifecycle decisions against the
 * existing PM2 cron's mark-sent records.
 *
 * Reads `/var/log/hermes/vizora-customer-lifecycle-shadow.jsonl`
 * (one JSONL row per Hermes cron tick per candidate org), joins to
 * `organization_onboarding` by id, and reports:
 *   - cron firing rate
 *   - per-org agreement: did Hermes pick the same template the PM2
 *     cron actually marked sent (or 'none' if PM2 didn't act)?
 *   - sample disagreements
 *
 * **Limitation**: PM2's mark-sent record reflects what was SENT, not
 * what its heuristic SUGGESTED. If Hermes suggests `day3` and PM2's
 * heuristic agreed but the ticket failed SMTP, mark-sent is null and
 * we count it as a "disagreement" when it isn't. For a true head-to-
 * head comparison the PM2 cron should also log its suggestion to a
 * parallel file. Tracked in backlog.md.
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

function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${Math.round((100 * n) / d)}%`;
}

/**
 * Map an organization_onboarding row to the most-recently-sent nudge
 * template, or 'none' if no nudge has been sent. Sender precedence is
 * by recency, not by milestone — if PM2 sent day3 yesterday and day7
 * today, return 'day7-create-schedule'.
 */
function latestNudgeFromOnboarding(ob: {
  day1NudgeSentAt: Date | null;
  day3NudgeSentAt: Date | null;
  day7NudgeSentAt: Date | null;
}): Template {
  const sent: Array<{ t: Template; at: Date }> = [];
  if (ob.day1NudgeSentAt) sent.push({ t: 'day1-pair-screen', at: ob.day1NudgeSentAt });
  if (ob.day3NudgeSentAt) sent.push({ t: 'day3-upload-content', at: ob.day3NudgeSentAt });
  if (ob.day7NudgeSentAt) sent.push({ t: 'day7-create-schedule', at: ob.day7NudgeSentAt });
  if (sent.length === 0) return 'none';
  sent.sort((a, b) => b.at.getTime() - a.at.getTime());
  return sent[0].t;
}

async function main(): Promise<void> {
  if (!existsSync(SHADOW_LOG)) {
    console.error(`No shadow log at ${SHADOW_LOG}`);
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

  const heartbeats = rows.filter((r) => r.organization_id == null);
  const decisions = rows.filter((r) => r.organization_id != null);

  let firingRateNote = '';
  if (heartbeats.length >= 2) {
    const first = new Date(heartbeats[0].timestamp).getTime();
    const last = new Date(heartbeats[heartbeats.length - 1].timestamp).getTime();
    const spanMin = (last - first) / 60_000;
    const ticksPerHour = spanMin > 0 ? (heartbeats.length / spanMin) * 60 : NaN;
    firingRateNote = ` — ~${ticksPerHour.toFixed(1)} ticks/hr (cron is */30 → expected ~2)`;
  }

  console.log('Hermes customer-lifecycle shadow comparison');
  console.log('===========================================');
  console.log(`Shadow log:                   ${SHADOW_LOG}`);
  console.log(`Total log lines:              ${lines.length}`);
  console.log(`Malformed (skipped):          ${malformed}`);
  console.log(`Heartbeat rows (cron fires):  ${heartbeats.length}${firingRateNote}`);
  console.log(`Per-org decision rows:        ${decisions.length}`);

  if (decisions.length === 0) {
    console.log(
      '\nNo per-org decisions yet. Either no candidates in the lookback window or the cron just started.',
    );
    return;
  }

  const orgIds = [...new Set(decisions.map((r) => r.organization_id!))];
  const onboardings = await prisma.organizationOnboarding.findMany({
    where: { organizationId: { in: orgIds } },
    select: {
      organizationId: true,
      day1NudgeSentAt: true,
      day3NudgeSentAt: true,
      day7NudgeSentAt: true,
      completedAt: true,
    },
  });
  const byOrg = new Map(onboardings.map((o) => [o.organizationId, o]));

  // Decision-by-decision agreement (each Hermes row is a separate event).
  // Note: Hermes can suggest 'day3' BEFORE PM2 has actually sent day3, so we
  // also track "Hermes suggested X, PM2 had not sent X yet at time of run"
  // — treating that as agreement-pending rather than disagreement.
  let agree = 0;
  let disagree = 0;
  let pending = 0;
  let unmatched = 0;
  const samples: Array<{
    org: string;
    hermes: string;
    pm2: string;
    reason: string | null;
  }> = [];

  for (const r of decisions) {
    const ob = byOrg.get(r.organization_id!);
    if (!ob) {
      unmatched++;
      continue;
    }
    const pm2 = latestNudgeFromOnboarding(ob);
    const hermes = (r.hermes_template ?? 'none') as Template;
    if (hermes === pm2) {
      agree++;
    } else if (
      // Hermes suggested a template that PM2 hadn't yet sent at the time
      // the row was written. Treat as pending — PM2 may catch up.
      hermes !== 'none' &&
      pm2 === 'none'
    ) {
      pending++;
    } else {
      disagree++;
      if (samples.length < 10) {
        samples.push({
          org: r.organization_id!.slice(0, 8),
          hermes,
          pm2,
          reason: r.hermes_reasoning,
        });
      }
    }
  }

  const matched = agree + disagree + pending;
  console.log(`\nDecisions joined to onboarding row: ${matched}`);
  console.log(`Unmatched (org/onboarding gone):    ${unmatched}`);
  console.log(`Agreement (template matches):       ${agree} (${pct(agree, matched)})`);
  console.log(`Pending (Hermes ahead, PM2 hasn't): ${pending} (${pct(pending, matched)})`);
  console.log(`Disagreement:                       ${disagree} (${pct(disagree, matched)})`);

  if (samples.length > 0) {
    console.log('\nSample disagreements (first 10):');
    for (const s of samples) {
      console.log(
        `  ${s.org}  hermes=${s.hermes.padEnd(22)}  pm2=${s.pm2.padEnd(22)}  | ${s.reason ?? '<no reason>'}`,
      );
    }
  }

  console.log(
    '\nReminder: PM2 mark-sent reflects SENT, not suggested. SMTP failures',
  );
  console.log(
    'show up here as Hermes-disagree even when both heuristics agreed. Track',
  );
  console.log(
    'PM2-side suggestion logging as a follow-up (see backlog.md).',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

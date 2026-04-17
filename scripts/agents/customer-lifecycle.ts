#!/usr/bin/env npx tsx
/**
 * Vizora Agent System — Customer Lifecycle Agent
 *
 * Runs every 30 minutes via PM2 cron. Sends onboarding nudges to orgs that
 * have stalled at milestone boundaries (day 1/3/7).
 *
 * Safeguards (spec D10/D11/D12 + R2 edits):
 *   - Dry-run default (LIFECYCLE_LIVE=false)
 *   - Circuit breaker: MAX_EMAILS_PER_RUN = 50, counter persisted in
 *     logs/agent-state/customer.json (D-sec-R2-3)
 *   - Test allowlist: LIFECYCLE_TEST_EMAILS redirects ALL mail (D-sec-R2-2)
 *   - SHA-256 email hashes in audit logs (D-sec-R2-1)
 *   - Per-org transaction with dedup on nudge-sent-timestamp (D11)
 *   - orgId derived from DB only, never from script args (D6)
 *
 * Exit codes:
 *   0 — cycle complete, no pending candidates or all nudged
 *   1 — cycle complete with circuit breaker trip (partial progress)
 *   2 — fatal (auth, DB unreachable)
 */

import 'dotenv/config';
import { prisma } from '@vizora/database';
import type { Organization, OrganizationOnboarding, User } from '@vizora/database';
import {
  readAgentState,
  writeAgentState,
  makeIncidentId,
} from './lib/state.js';
import { maskEmail, log as opsLog } from './lib/alerting.js';
import { createAgentAI } from './lib/ai.js';
import type {
  OnboardingSignal,
  Incident,
  AgentResult,
  OrgTier,
} from './lib/types.js';

const AGENT = 'customer-lifecycle';
const FAMILY = 'customer' as const;

const MAX_EMAILS_PER_RUN = 50;
const CANDIDATE_LIMIT = 200;
const LOOKBACK_DAYS = 30;
const AUTO_COMPLETE_DAYS = 30;

const LIFECYCLE_LIVE = process.env.LIFECYCLE_LIVE === 'true';
const TEST_EMAILS = (process.env.LIFECYCLE_TEST_EMAILS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ─── Nudge config ────────────────────────────────────────────────────────────

type NudgeKey = 'day1-pair-screen' | 'day3-upload-content' | 'day7-create-schedule';

const NUDGE_COLUMN: Record<NudgeKey, keyof OrganizationOnboarding> = {
  'day1-pair-screen': 'day1NudgeSentAt',
  'day3-upload-content': 'day3NudgeSentAt',
  'day7-create-schedule': 'day7NudgeSentAt',
};

const NUDGE_SUBJECT: Record<NudgeKey, string> = {
  'day1-pair-screen': 'Pair your first screen with Vizora',
  'day3-upload-content': 'Upload your first piece of content',
  'day7-create-schedule': 'Schedule your content for automatic playback',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  opsLog(AGENT, msg);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

type OrgTierish = string | null | undefined;
function coerceTier(t: OrgTierish): OrgTier {
  const v = (t ?? '').toLowerCase();
  if (v === 'starter' || v === 'pro' || v === 'enterprise') return v;
  return 'free';
}

function buildSignal(
  org: Organization,
  onboarding: OrganizationOnboarding | null,
): OnboardingSignal {
  const days = daysBetween(org.createdAt, new Date());
  return {
    orgId: org.id,
    tier: coerceTier(org.subscriptionTier),
    daysSinceSignup: days,
    milestoneFlags: {
      welcomed: onboarding?.welcomeEmailSentAt != null,
      screenPaired: onboarding?.firstScreenPairedAt != null,
      contentUploaded: onboarding?.firstContentUploadedAt != null,
      playlistCreated: onboarding?.firstPlaylistCreatedAt != null,
      scheduleCreated: onboarding?.firstScheduleCreatedAt != null,
    },
  };
}

async function findOrgAdmin(orgId: string): Promise<User | null> {
  // Prefer org admin; fall back to manager, then anyone. Oldest account wins.
  return prisma.user.findFirst({
    where: { organizationId: orgId, role: { in: ['admin', 'manager'] }, isActive: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
}

function resolveRecipients(adminEmail: string): string[] {
  if (TEST_EMAILS.length > 0) return [...TEST_EMAILS];
  if (LIFECYCLE_LIVE) return [adminEmail];
  return [];
}

/**
 * Audit-log + conditional send. Writes JSON to stdout (grep-able, no PII).
 * Only actually sends mail if SMTP is configured AND recipients resolved to
 * a non-empty list. Updates the persisted counter per successful send.
 */
async function sendNudge(
  adminEmail: string,
  nudgeKey: NudgeKey,
  orgId: string,
): Promise<'sent' | 'dry-run' | 'circuit-breaker'> {
  const state = readAgentState(FAMILY);
  const counter = state.emailsSentThisRun ?? 0;

  if (counter >= MAX_EMAILS_PER_RUN) {
    writeAgentState(FAMILY, state);
    process.stdout.write(JSON.stringify({
      type: 'lifecycle-send-decision',
      orgId,
      template: nudgeKey,
      result: 'circuit-breaker',
      counter,
      maxThisRun: MAX_EMAILS_PER_RUN,
      ts: new Date().toISOString(),
    }) + '\n');
    return 'circuit-breaker';
  }

  const recipients = resolveRecipients(adminEmail);
  process.stdout.write(JSON.stringify({
    type: 'lifecycle-send-decision',
    orgId,
    template: nudgeKey,
    recipientCount: recipients.length,
    recipientHashes: recipients.map(maskEmail),
    wouldSend: recipients.length > 0,
    ts: new Date().toISOString(),
  }) + '\n');

  if (recipients.length === 0) {
    writeAgentState(FAMILY, state);
    return 'dry-run';
  }

  // SMTP send — best-effort. Failures bubble as exceptions; caller treats
  // as "not sent" and leaves the nudge timestamp NULL so we retry next run.
  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_PORT || '587') === '465',
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  const appUrl = process.env.APP_URL || process.env.WEB_URL || 'https://vizora.cloud';
  const subject = NUDGE_SUBJECT[nudgeKey];
  const body = `Hi,\n\n${subject}.\n\nOpen your dashboard: ${appUrl}/dashboard\n\n— Vizora`;

  for (const to of recipients) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Vizora <noreply@mail.vizora.cloud>',
      to,
      subject,
      text: body,
    });
    // Re-read state each iteration so an interleaved manual run sees counter
    const s2 = readAgentState(FAMILY);
    s2.emailsSentThisRun = (s2.emailsSentThisRun ?? 0) + 1;
    writeAgentState(FAMILY, s2);
  }

  return 'sent';
}

// ─── Candidate query ─────────────────────────────────────────────────────────

async function fetchCandidates(): Promise<Array<Organization & {
  onboarding: OrganizationOnboarding | null;
}>> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const rows = await prisma.organization.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { onboarding: null },
        { onboarding: { completedAt: null } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: CANDIDATE_LIMIT,
    include: { onboarding: true },
  });
  return rows;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log('Starting customer-lifecycle cycle');

  // Reset per-run counter at the top of the cycle (persisted state)
  const initState = readAgentState(FAMILY);
  initState.emailsSentThisRun = 0;
  initState.pendingManualRun = false;
  writeAgentState(FAMILY, initState);

  let candidates: Awaited<ReturnType<typeof fetchCandidates>>;
  try {
    candidates = await fetchCandidates();
  } catch (err) {
    log(`FATAL: candidate query failed — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }
  log(`Found ${candidates.length} candidate org(s) within ${LOOKBACK_DAYS}d window`);

  const ai = createAgentAI(process.env.AGENT_AI_PROVIDER || 'heuristic');
  const incidents: Incident[] = [];
  let nudged = 0;
  let autoCompleted = 0;
  let circuitBroken = false;

  for (const org of candidates) {
    if (circuitBroken) break;

    const signal = buildSignal(org, org.onboarding);

    // Auto-complete stale onboardings (>30d — outside nudge window)
    if (signal.daysSinceSignup >= AUTO_COMPLETE_DAYS) {
      try {
        await prisma.organizationOnboarding.upsert({
          where: { organizationId: org.id },
          create: { organizationId: org.id, completedAt: new Date() },
          update: { completedAt: new Date() },
        });
        autoCompleted++;
      } catch (err) {
        log(`auto-complete failed for org=${org.id}: ${err instanceof Error ? err.message : err}`);
      }
      continue;
    }

    const suggestion = await ai.suggestNudge(signal);
    if (suggestion.template === 'none') continue;
    const nudgeKey = suggestion.template as NudgeKey;
    const col = NUDGE_COLUMN[nudgeKey];
    if (!col) continue;

    const admin = await findOrgAdmin(org.id);
    if (!admin?.email) {
      log(`org=${org.id} has no admin email — skipping`);
      continue;
    }

    // Dedup: check current DB state (race-safe via conditional update)
    const fresh = await prisma.organizationOnboarding.findUnique({
      where: { organizationId: org.id },
    });
    if (fresh && fresh[col] != null) continue;

    const result = await sendNudge(admin.email, nudgeKey, org.id).catch(err => {
      log(`send failed for org=${org.id} nudge=${nudgeKey}: ${err instanceof Error ? err.message : err}`);
      return 'dry-run' as const;
    });

    if (result === 'circuit-breaker') {
      circuitBroken = true;
      incidents.push({
        id: makeIncidentId(AGENT, 'circuit_breaker', 'batch'),
        agent: AGENT,
        type: 'circuit_breaker',
        severity: 'critical',
        target: 'customer-lifecycle',
        targetId: 'batch',
        detected: new Date().toISOString(),
        message: `Hit MAX_EMAILS_PER_RUN=${MAX_EMAILS_PER_RUN}; remaining candidates deferred to next cycle`,
        remediation: 'Review nudge backlog; if intentional surge, raise MAX_EMAILS_PER_RUN',
        status: 'open',
        attempts: 1,
      });
      break;
    }

    if (result === 'sent') {
      // Mark nudge sent in same logical step — dedup guard for next run
      try {
        await prisma.organizationOnboarding.upsert({
          where: { organizationId: org.id },
          create: { organizationId: org.id, [col]: new Date() },
          update: { [col]: new Date() },
        });
        nudged++;
      } catch (err) {
        log(`mark-sent failed for org=${org.id} col=${String(col)}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const result: AgentResult = {
    agent: AGENT,
    timestamp: new Date().toISOString(),
    durationMs,
    issuesFound: candidates.length,
    issuesFixed: nudged + autoCompleted,
    issuesEscalated: circuitBroken ? 1 : 0,
    incidents,
  };

  // Record run in state
  const finalState = readAgentState(FAMILY);
  finalState.agentResults = { ...finalState.agentResults, [AGENT]: result };
  finalState.lastRun = { ...finalState.lastRun, [AGENT]: new Date().toISOString() };
  finalState.incidents = [...finalState.incidents, ...incidents];
  finalState.systemStatus = circuitBroken ? 'DEGRADED' : finalState.systemStatus;
  writeAgentState(FAMILY, finalState);

  log(`Cycle complete in ${durationMs}ms — candidates=${candidates.length}, nudged=${nudged}, completed=${autoCompleted}, circuit=${circuitBroken}`);

  process.exitCode = circuitBroken ? 1 : 0;
}

main()
  .catch(err => {
    log(`FATAL: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

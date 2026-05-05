#!/usr/bin/env npx tsx
/**
 * Vizora Agent System — Customer Lifecycle Agent
 *
 * Runs every 30 minutes via PM2 cron. Sends onboarding nudges to orgs that
 * have stalled at milestone boundaries (day 1/3/7).
 *
 * Safeguards (spec D10/D11/D12 + R2 edits + R4):
 *   - Dry-run default (LIFECYCLE_LIVE=false)
 *   - Circuit breaker: MAX_EMAILS_PER_RUN = 50, counter persisted in
 *     logs/agent-state/customer.json (D-sec-R2-3)
 *   - Test allowlist: LIFECYCLE_TEST_EMAILS redirects ALL mail (D-sec-R2-2)
 *   - SHA-256 email hashes in audit logs (D-sec-R2-1)
 *   - SMTP error messages NEVER include raw recipient address (R4-HIGH6)
 *   - AI suggestNudge failures isolated per-org (R4-HIGH5)
 *   - Mark-sent failure raises a `high` severity incident (R4-MED6 —
 *     duplicate-email risk)
 *   - SMTP_PASS (not SMTP_PASSWORD) for parity with ops alerting (R4-HIGH4)
 *   - orgId derived from DB only, never from script args (D6)
 *
 * Exit codes:
 *   0 — cycle complete, no pending candidates or all nudged
 *   1 — cycle complete with circuit breaker trip (partial progress)
 *   2 — fatal (auth, DB unreachable)
 */

import 'dotenv/config';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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
// Parallel JSONL for shadow comparison against the Hermes-driven
// vizora-customer-lifecycle skill. Sibling to
// /var/log/hermes/vizora-customer-lifecycle-shadow.jsonl so
// scripts/agents/compare-lifecycle-hermes-vs-heuristic.ts can join
// per-org for true template-vs-template head-to-head.
const HEURISTIC_LOG_PATH =
  process.env.CUSTOMER_LIFECYCLE_HEURISTIC_LOG ??
  '/var/log/hermes/vizora-customer-lifecycle-heuristic.jsonl';

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

/**
 * Append one JSONL row per org reflecting what the heuristic suggested
 * THIS cycle. Sibling to the Hermes shadow log so
 * `compare-lifecycle-hermes-vs-heuristic.ts` can join per-org for
 * template-vs-template head-to-head.
 *
 * Logs every candidate (including 'none' suggestions and stale-org
 * auto-complete decisions) so the comparison dataset is complete.
 *
 * Failures here are non-fatal — the cron's primary job is the email
 * decision pipeline, not the comparison log.
 */
function logHeuristicSuggestion(
  runId: string,
  orgId: string,
  signal: OnboardingSignal,
  template: string,
  action: 'send_nudge' | 'auto_complete' | 'none',
  reason: string,
): void {
  try {
    mkdirSync(dirname(HEURISTIC_LOG_PATH), { recursive: true });
    const row = {
      timestamp: new Date().toISOString(),
      run_id: runId,
      organization_id: orgId,
      tier: signal.tier,
      days_since_signup: signal.daysSinceSignup,
      heuristic_template: template,
      heuristic_action: action,
      heuristic_reason: reason,
      input_signals: {
        milestone_flags: {
          welcomed: signal.milestoneFlags.welcomed,
          screen_paired: signal.milestoneFlags.screenPaired,
          content_uploaded: signal.milestoneFlags.contentUploaded,
          playlist_created: signal.milestoneFlags.playlistCreated,
          schedule_created: signal.milestoneFlags.scheduleCreated,
        },
      },
    };
    appendFileSync(HEURISTIC_LOG_PATH, JSON.stringify(row) + '\n');
  } catch (err) {
    log(`heuristic log append failed for org=${orgId}: ${err instanceof Error ? err.message : err}`);
  }
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

// ─── Transporter (built once per run; R4-LOW hoist) ──────────────────────────

type Transporter = { sendMail: (opts: Record<string, unknown>) => Promise<unknown> };

async function buildTransporter(): Promise<Transporter> {
  const { default: nodemailer } = await import('nodemailer');
  const smtpUser = process.env.SMTP_USER;
  // R4-HIGH4: standardize on SMTP_PASS (ops alerting convention). SMTP_PASSWORD
  // kept as fallback so existing deploys don't break mid-rollout.
  const smtpPass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  if (smtpUser && !smtpPass) {
    throw new Error('SMTP_USER set without SMTP_PASS — refusing to send unauthenticated');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_PORT || '587') === '465',
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });
}

/**
 * Audit-log + conditional send. Writes JSON to stdout (grep-able, no PII).
 * Only actually sends mail if SMTP is configured AND recipients resolved to
 * a non-empty list. Updates the persisted counter per successful send.
 */
async function sendNudge(
  transporter: Transporter,
  adminEmail: string,
  nudgeKey: NudgeKey,
  orgId: string,
): Promise<'sent' | 'dry-run' | 'circuit-breaker' | 'error'> {
  const state = await readAgentState(FAMILY);
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

  // Release the read lock before the outbound I/O — SMTP latency mustn't pin the lock
  writeAgentState(FAMILY, state);

  const appUrl = process.env.APP_URL || process.env.WEB_URL || 'https://vizora.cloud';
  const subject = NUDGE_SUBJECT[nudgeKey];
  const body = `Hi,\n\n${subject}.\n\nOpen your dashboard: ${appUrl}/dashboard\n\n— Vizora`;

  let sentCount = 0;
  let lastError: unknown;
  for (const to of recipients) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Vizora <noreply@mail.vizora.cloud>',
        to,
        subject,
        text: body,
      });
      const s2 = await readAgentState(FAMILY);
      s2.emailsSentThisRun = (s2.emailsSentThisRun ?? 0) + 1;
      writeAgentState(FAMILY, s2);
      sentCount++;
    } catch (err) {
      lastError = err;
      // R4-HIGH6: never log raw `to` or raw err.message — nodemailer DSN payloads
      // frequently embed the recipient address.
      const code = (err as { code?: string })?.code ?? 'UNKNOWN';
      log(`send failed org=${orgId} recipient=${maskEmail(to)} code=${code}`);
    }
  }

  if (sentCount === 0 && lastError) return 'error';
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
  // run_id matches the Hermes shadow's epoch-seconds shape.
  const runId = String(Math.floor(startTime / 1000));
  log('Starting customer-lifecycle cycle');

  // Reset per-run counter at the top of the cycle (persisted state)
  const initState = await readAgentState(FAMILY);
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

  let transporter: Transporter | null = null;
  // Only build transporter if we'll actually be sending. An invalid SMTP config
  // must throw here (fail-fast) rather than per-recipient.
  if (TEST_EMAILS.length > 0 || LIFECYCLE_LIVE) {
    try {
      transporter = await buildTransporter();
    } catch (err) {
      log(`FATAL: SMTP transporter build failed — ${err instanceof Error ? err.message : err}`);
      process.exitCode = 2;
      return;
    }
  }

  for (const org of candidates) {
    if (circuitBroken) break;

    const signal = buildSignal(org, org.onboarding);

    // Auto-complete stale onboardings (>30d — outside nudge window)
    if (signal.daysSinceSignup >= AUTO_COMPLETE_DAYS) {
      logHeuristicSuggestion(
        runId,
        org.id,
        signal,
        'none',
        'auto_complete',
        `age=${signal.daysSinceSignup}d >= ${AUTO_COMPLETE_DAYS}d, auto-closing`,
      );
      try {
        await prisma.organizationOnboarding.upsert({
          where: { organizationId: org.id },
          create: { organizationId: org.id, completedAt: new Date() },
          update: { completedAt: new Date() },
        });
        autoCompleted++;
      } catch (err) {
        // R4-MED6: auto-complete failures now surface as warning incidents.
        log(`auto-complete failed for org=${org.id}: ${err instanceof Error ? err.message : err}`);
        incidents.push({
          id: makeIncidentId(AGENT, 'auto_complete_failed', org.id),
          agent: AGENT,
          type: 'auto_complete_failed',
          severity: 'warning',
          target: 'organization',
          targetId: org.id,
          detected: new Date().toISOString(),
          message: `auto-complete failed: ${err instanceof Error ? err.message : String(err)}`,
          remediation: 'Inspect organization_onboarding row; run cycle again',
          status: 'open',
          attempts: 1,
        });
      }
      continue;
    }

    // R4-HIGH5: isolate AI failure per-org — otherwise one flaky provider
    // response kills the entire cycle.
    let suggestion;
    try {
      suggestion = await ai.suggestNudge(signal);
    } catch (err) {
      log(`suggestNudge failed for org=${org.id}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (suggestion.template === 'none') {
      logHeuristicSuggestion(
        runId,
        org.id,
        signal,
        'none',
        'none',
        `suggestNudge returned 'none' (age=${signal.daysSinceSignup}d, milestones=${JSON.stringify(signal.milestoneFlags)})`,
      );
      continue;
    }
    const nudgeKey = suggestion.template as NudgeKey;
    const col = NUDGE_COLUMN[nudgeKey];
    if (!col) {
      logHeuristicSuggestion(
        runId,
        org.id,
        signal,
        suggestion.template,
        'none',
        `unknown nudge key: ${suggestion.template}`,
      );
      continue;
    }
    logHeuristicSuggestion(
      runId,
      org.id,
      signal,
      nudgeKey,
      'send_nudge',
      `suggestNudge picked ${nudgeKey} (age=${signal.daysSinceSignup}d)`,
    );

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

    if (!transporter) {
      // Dry-run mode (no transporter built)
      process.stdout.write(JSON.stringify({
        type: 'lifecycle-send-decision',
        orgId: org.id,
        template: nudgeKey,
        recipientCount: 0,
        wouldSend: false,
        result: 'dry-run',
        ts: new Date().toISOString(),
      }) + '\n');
      continue;
    }

    const result = await sendNudge(transporter, admin.email, nudgeKey, org.id);

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

    if (result === 'error') {
      // R4-HIGH6 + MED6: log (already masked inside sendNudge) and surface
      // a warning incident. We do NOT write the nudge timestamp — the next
      // cycle will retry.
      incidents.push({
        id: makeIncidentId(AGENT, 'nudge_send_failed', org.id),
        agent: AGENT,
        type: 'nudge_send_failed',
        severity: 'warning',
        target: 'organization',
        targetId: org.id,
        detected: new Date().toISOString(),
        message: `SMTP send failed for ${nudgeKey}`,
        remediation: 'Check SMTP provider status; next cycle will retry',
        status: 'open',
        attempts: 1,
      });
      continue;
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
        // R4-MED6: mark-sent failure after a successful send = duplicate risk
        // on the next cycle. Raise a HIGH severity incident so support can
        // suppress manually before the next tick.
        log(`mark-sent failed for org=${org.id} col=${String(col)}: ${err instanceof Error ? err.message : err}`);
        incidents.push({
          id: makeIncidentId(AGENT, 'mark_sent_failed', org.id),
          agent: AGENT,
          type: 'mark_sent_failed',
          severity: 'critical',
          target: 'organization',
          targetId: org.id,
          detected: new Date().toISOString(),
          message: `Sent ${nudgeKey} to admin (maskEmail=${maskEmail(admin.email)}) but persisting sent-timestamp failed — next cycle may resend`,
          remediation: `Manually set ${String(col)}=NOW() on organization_onboarding row for org=${org.id}`,
          status: 'open',
          attempts: 1,
        });
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
  const finalState = await readAgentState(FAMILY);
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

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from '../../organizations/organizations.service';
import { hasScope, type McpRequestContext } from '../auth/mcp-context';
import {
  AutoCompleteOrgOnboardingInput,
  type AutoCompleteOrgOnboardingInputT,
  ListOnboardingCandidatesInput,
  type ListOnboardingCandidatesInputT,
  MarkOnboardingNudgeSentInput,
  type MarkOnboardingNudgeSentInputT,
  SendLifecycleNudgeEmailInput,
  type SendLifecycleNudgeEmailInputT,
} from '../schemas/tool-inputs';
import {
  AutoCompleteOrgOnboardingResult,
  type AutoCompleteOrgOnboardingResultT,
  ListOnboardingCandidatesOutput,
  type ListOnboardingCandidatesOutputT,
  MarkOnboardingNudgeSentResult,
  type MarkOnboardingNudgeSentResultT,
  SendLifecycleNudgeEmailResult,
  type SendLifecycleNudgeEmailResultT,
} from '../schemas/tool-outputs';

/**
 * Helper: every customer-lifecycle WRITE tool requires (a) the
 * `customer:write` scope and (b) a platform-scope token (organizationId
 * IS NULL). Per-org tokens are rejected because cross-org write is the
 * whole point of these tools.
 */
function assertPlatformWriteContext(context: McpRequestContext): void {
  if (!hasScope(context, 'customer:write')) {
    throw new ForbiddenException("Token lacks scope 'customer:write'");
  }
  if (context.organizationId != null) {
    throw new BadRequestException(
      'This tool requires a platform-scope token (organizationId=null). Per-org tokens are rejected.',
    );
  }
}

/**
 * MCP tool: `list_onboarding_candidates`
 *
 * Platform-scope read tool — returns onboarding candidates across ALL
 * orgs as structural signals only. Used by the customer-lifecycle
 * Hermes skill (shadow + future live mode).
 *
 * **Token shape**: this tool requires a PLATFORM-SCOPE token (i.e.
 * `organizationId IS NULL` in `mcp_tokens`). A per-org token is the
 * wrong shape and is rejected with `INVALID_INPUT`. Per-org tokens
 * never see other orgs' data — this is the security boundary.
 *
 * **D13 contract**: returns NO org name, NO admin email, NO billing
 * detail. Structural signals only. The wire-shape Zod schema strips
 * unknown keys, so a future buggy service that leaks PII can't push
 * it past this boundary.
 *
 * Scope required: `customer:read`.
 */
export async function listOnboardingCandidatesTool(
  rawInput: unknown,
  context: McpRequestContext,
  organizationsService: OrganizationsService,
): Promise<ListOnboardingCandidatesOutputT> {
  if (!hasScope(context, 'customer:read')) {
    throw new ForbiddenException("Token lacks scope 'customer:read'");
  }
  // The opposite of `requireOrgScope` — this tool is platform-only
  // and rejects per-org tokens.
  if (context.organizationId != null) {
    throw new BadRequestException(
      'list_onboarding_candidates requires a platform-scope token (organizationId=null). Per-org tokens are rejected.',
    );
  }
  const input = ListOnboardingCandidatesInput.parse(
    rawInput,
  ) as ListOnboardingCandidatesInputT;

  const candidates = await organizationsService.listOnboardingCandidates({
    lookbackDays: input.lookback_days,
    limit: input.limit,
  });

  return ListOnboardingCandidatesOutput.parse({
    candidates: candidates.map(toCandidateShape),
    total: candidates.length,
  });
}

function toCandidateShape(c: Record<string, unknown>) {
  const flags = c.milestoneFlags as Record<string, boolean>;
  const nudges = c.nudgesSent as Record<string, boolean>;
  return {
    organization_id: c.organizationId as string,
    tier: c.tier as 'free' | 'starter' | 'pro' | 'enterprise',
    days_since_signup: c.daysSinceSignup as number,
    milestone_flags: {
      welcomed: Boolean(flags.welcomed),
      screen_paired: Boolean(flags.screenPaired),
      content_uploaded: Boolean(flags.contentUploaded),
      playlist_created: Boolean(flags.playlistCreated),
      schedule_created: Boolean(flags.scheduleCreated),
    },
    nudges_sent: {
      day1: Boolean(nudges.day1),
      day3: Boolean(nudges.day3),
      day7: Boolean(nudges.day7),
    },
  };
}

export const LIST_ONBOARDING_CANDIDATES_TOOL = {
  name: 'list_onboarding_candidates',
  description:
    "Platform-scope read tool. Returns onboarding candidates across ALL orgs as structural signals only — tier, days since signup, milestone flags, nudge-sent flags. NEVER returns org name, admin email, or billing detail. REQUIRES a platform-scope token (organizationId=null) — per-org tokens are rejected with INVALID_INPUT. Used by the customer-lifecycle Hermes skill.",
  scope: 'customer:read' as const,
  inputSchema: ListOnboardingCandidatesInput,
  outputSchema: ListOnboardingCandidatesOutput,
  handler: listOnboardingCandidatesTool,
};

// ── Customer-lifecycle WRITE tools (platform-scope, customer:write) ───────

/**
 * MCP tool: `mark_onboarding_nudge_sent`
 *
 * Sets `dayN_NudgeSentAt` on an org's onboarding row. Used when the
 * agent has already sent the nudge through some external path and just
 * needs to record the fact (or for manual override).
 *
 * Most agents will NOT call this directly — they should use
 * `send_lifecycle_nudge_email` which marks-sent automatically on a
 * successful SMTP send. This tool exists for cases where the send
 * happened outside the MCP path.
 */
export async function markOnboardingNudgeSentTool(
  rawInput: unknown,
  context: McpRequestContext,
  organizationsService: OrganizationsService,
): Promise<MarkOnboardingNudgeSentResultT> {
  assertPlatformWriteContext(context);
  const input = MarkOnboardingNudgeSentInput.parse(
    rawInput,
  ) as MarkOnboardingNudgeSentInputT;
  const marked = await organizationsService.setOnboardingNudgeSent(
    input.organization_id,
    input.nudge_key,
  );
  return MarkOnboardingNudgeSentResult.parse({
    organization_id: input.organization_id,
    nudge_key: input.nudge_key,
    marked,
  });
}

export const MARK_ONBOARDING_NUDGE_SENT_TOOL = {
  name: 'mark_onboarding_nudge_sent',
  description:
    "Set the dayN_NudgeSentAt column for one org. Use this only if the nudge was sent through some path other than send_lifecycle_nudge_email (which already marks-sent on success). Platform-scope token required (organizationId=null).",
  scope: 'customer:write' as const,
  inputSchema: MarkOnboardingNudgeSentInput,
  outputSchema: MarkOnboardingNudgeSentResult,
  handler: markOnboardingNudgeSentTool,
};

/**
 * MCP tool: `auto_complete_org_onboarding`
 *
 * Marks an org's onboarding as completed (sets `completedAt = NOW()`).
 * Used by the customer-lifecycle agent for stale (>30 days) signups
 * that never finished their onboarding flow — past that point the
 * agent stops nudging and instead closes the loop.
 *
 * Idempotent — re-calling on an already-completed row updates the
 * timestamp, which is fine.
 */
export async function autoCompleteOrgOnboardingTool(
  rawInput: unknown,
  context: McpRequestContext,
  organizationsService: OrganizationsService,
): Promise<AutoCompleteOrgOnboardingResultT> {
  assertPlatformWriteContext(context);
  const input = AutoCompleteOrgOnboardingInput.parse(
    rawInput,
  ) as AutoCompleteOrgOnboardingInputT;
  const completed = await organizationsService.setOnboardingCompleted(
    input.organization_id,
  );
  return AutoCompleteOrgOnboardingResult.parse({
    organization_id: input.organization_id,
    completed,
  });
}

export const AUTO_COMPLETE_ORG_ONBOARDING_TOOL = {
  name: 'auto_complete_org_onboarding',
  description:
    'Mark one org\'s onboarding as completed (closes the lifecycle nudge loop for stale signups). Idempotent. Platform-scope token required.',
  scope: 'customer:write' as const,
  inputSchema: AutoCompleteOrgOnboardingInput,
  outputSchema: AutoCompleteOrgOnboardingResult,
  handler: autoCompleteOrgOnboardingTool,
};

/**
 * MCP tool: `send_lifecycle_nudge_email`
 *
 * Sends a templated onboarding nudge email to one org's admin. The
 * agent picks a `nudge_key` (`day1-pair-screen` / `day3-upload-content`
 * / `day7-create-schedule`); the SERVER picks the actual subject and
 * body from a hardcoded table — agent input never reaches the wire as
 * email content (D6 hardened-outbound).
 *
 * Server-side gating (mirrors scripts/agents/customer-lifecycle.ts):
 * - LIFECYCLE_TEST_EMAILS set → mail goes to those addresses only
 * - LIFECYCLE_LIVE=true (and TEST_EMAILS empty) → real admin email
 * - Otherwise → dry-run, no SMTP call (returns reason: 'dry_run')
 *
 * Dedup: pre-checks dayN_NudgeSentAt. If already set, returns
 * `{ sent: false, reason: 'already_sent' }` WITHOUT firing SMTP.
 * On a successful send, marks-sent in the same logical step.
 *
 * The recipient address NEVER appears in the response or audit log
 * in plaintext — only sha256-hashes via `recipient_hashes`.
 */
export async function sendLifecycleNudgeEmailTool(
  rawInput: unknown,
  context: McpRequestContext,
  organizationsService: OrganizationsService,
): Promise<SendLifecycleNudgeEmailResultT> {
  assertPlatformWriteContext(context);
  const input = SendLifecycleNudgeEmailInput.parse(
    rawInput,
  ) as SendLifecycleNudgeEmailInputT;
  const result = await organizationsService.sendOnboardingNudge(
    input.organization_id,
    input.nudge_key,
  );
  return SendLifecycleNudgeEmailResult.parse({
    organization_id: input.organization_id,
    nudge_key: input.nudge_key,
    sent: result.sent,
    recipient_count: result.recipientCount,
    recipient_hashes: result.recipientHashes,
    reason: result.reason,
  });
}

export const SEND_LIFECYCLE_NUDGE_EMAIL_TOOL = {
  name: 'send_lifecycle_nudge_email',
  description:
    "Send a templated onboarding nudge email to one org's admin. Agent picks `nudge_key` (day1-pair-screen | day3-upload-content | day7-create-schedule); server picks subject + body. Server-gated by LIFECYCLE_LIVE / LIFECYCLE_TEST_EMAILS — defaults to dry-run. Dedup-checks dayN_NudgeSentAt before sending; marks-sent on success. Recipient addresses are NEVER returned in plaintext (only sha256 hashes). Platform-scope token required.",
  scope: 'customer:write' as const,
  inputSchema: SendLifecycleNudgeEmailInput,
  outputSchema: SendLifecycleNudgeEmailResult,
  handler: sendLifecycleNudgeEmailTool,
};

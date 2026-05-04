import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from '../../organizations/organizations.service';
import { hasScope, type McpRequestContext } from '../auth/mcp-context';
import {
  ListOnboardingCandidatesInput,
  type ListOnboardingCandidatesInputT,
} from '../schemas/tool-inputs';
import {
  ListOnboardingCandidatesOutput,
  type ListOnboardingCandidatesOutputT,
} from '../schemas/tool-outputs';

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

import { z } from 'zod';

/**
 * Output schemas for MCP tools. The MCP SDK validates output against
 * these before sending — a tool that returns a shape that fails
 * validation surfaces as an INTERNAL error to the caller (and a loud
 * server-side log), which is what we want.
 *
 * Field naming: snake_case for the wire (consistent with MCP convention),
 * regardless of Vizora's internal camelCase Prisma fields. Translation
 * happens at the projection step in each tool.
 */

export const DisplayShape = z.object({
  id: z.string(),
  organization_id: z.string(),
  device_identifier: z.string(),
  nickname: z.string().nullable(),
  location: z.string().nullable(),
  status: z.enum(['online', 'offline', 'pairing', 'error']),
  orientation: z.enum(['landscape', 'portrait']),
  resolution: z.string().nullable(),
  last_heartbeat: z.string().datetime().nullable(),
  current_playlist_id: z.string().nullable(),
  is_disabled: z.boolean(),
  created_at: z.string().datetime(),
});

export const ListDisplaysOutput = z.object({
  displays: z.array(DisplayShape),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

export type ListDisplaysOutputT = z.infer<typeof ListDisplaysOutput>;

/**
 * Triage-candidate shape — the output of `list_open_support_requests`.
 *
 * **Hard contract**: this shape NEVER carries `description`,
 * `consoleErrors`, or any user-PII (name/email). It is structural
 * signals only, computed server-side, so an LLM-driven agent can
 * safely consume it without violating D13 (no raw user data in LLM
 * prompts). Adding any free-text body field here is a security-sensitive
 * change — call it out in review.
 */
export const TriageCandidateShape = z.object({
  id: z.string(),
  organization_id: z.string(),
  status: z.string(),
  priority: z.string().nullable(),
  category: z.string().nullable(),
  ai_category: z.string().nullable(),
  created_at: z.string().datetime(),
  age_minutes: z.number().int().nonnegative(),
  word_count: z.number().int().nonnegative(),
  has_attachment: z.boolean(),
  message_count: z.number().int().nonnegative(),
  org_tier: z.string(),
});

export const ListOpenSupportRequestsOutput = z.object({
  support_requests: z.array(TriageCandidateShape),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

export type ListOpenSupportRequestsOutputT = z.infer<typeof ListOpenSupportRequestsOutput>;

// ── Write tool outputs ─────────────────────────────────────────────────────

/**
 * Generic OK/skipped result for the priority + ai_category writers.
 * `updated=false` means the cross-org guard fired (or the row was
 * deleted) — agents should NOT retry blindly.
 */
export const UpdateSupportRequestResult = z.object({
  request_id: z.string(),
  updated: z.boolean(),
});
export type UpdateSupportRequestResultT = z.infer<typeof UpdateSupportRequestResult>;

export const CreateSupportMessageResult = z.object({
  request_id: z.string(),
  message_id: z.string().nullable(),
  created_at: z.string().datetime().nullable(),
  created: z.boolean(),
});
export type CreateSupportMessageResultT = z.infer<typeof CreateSupportMessageResult>;

// ── Customer-lifecycle (platform-scope read tool) ──────────────────────────

/**
 * Onboarding-candidate shape for the customer-lifecycle Hermes skill.
 *
 * **Hard contract**: this shape carries NO org name, NO admin email,
 * NO billing detail. Just structural signals (tier, age, milestone
 * flags, nudge-sent flags). Adding any free-text field or any
 * email/name/billing field is a security-sensitive change — call it
 * out in review.
 */
export const OnboardingCandidateShape = z.object({
  organization_id: z.string(),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']),
  days_since_signup: z.number().int().nonnegative(),
  milestone_flags: z.object({
    welcomed: z.boolean(),
    screen_paired: z.boolean(),
    content_uploaded: z.boolean(),
    playlist_created: z.boolean(),
    schedule_created: z.boolean(),
  }),
  nudges_sent: z.object({
    day1: z.boolean(),
    day3: z.boolean(),
    day7: z.boolean(),
  }),
});

export const ListOnboardingCandidatesOutput = z.object({
  candidates: z.array(OnboardingCandidateShape),
  total: z.number().int().nonnegative(),
});

export type ListOnboardingCandidatesOutputT = z.infer<typeof ListOnboardingCandidatesOutput>;

// ── Customer-lifecycle write tool outputs ─────────────────────────────────

export const MarkOnboardingNudgeSentResult = z.object({
  organization_id: z.string(),
  nudge_key: z.string(),
  marked: z.boolean(),
});
export type MarkOnboardingNudgeSentResultT = z.infer<typeof MarkOnboardingNudgeSentResult>;

export const AutoCompleteOrgOnboardingResult = z.object({
  organization_id: z.string(),
  completed: z.boolean(),
});
export type AutoCompleteOrgOnboardingResultT = z.infer<typeof AutoCompleteOrgOnboardingResult>;

/**
 * Result of a `send_lifecycle_nudge_email` call. The recipient address
 * NEVER appears here in plaintext — only the sha256-hash. The `reason`
 * lets the agent reason about what happened without seeing the address.
 */
export const SendLifecycleNudgeEmailResult = z.object({
  organization_id: z.string(),
  nudge_key: z.string(),
  sent: z.boolean(),
  recipient_count: z.number().int().nonnegative(),
  recipient_hashes: z.array(z.string()),
  reason: z.enum([
    'sent',
    'dry_run',
    'already_sent',
    'no_admin',
    'no_smtp_configured',
    'smtp_error',
  ]),
});
export type SendLifecycleNudgeEmailResultT = z.infer<typeof SendLifecycleNudgeEmailResult>;

// ── Shadow log writer ─────────────────────────────────────────────────────

export const LogShadowRowResult = z.object({
  log_name: z.string(),
  written: z.boolean(),
  line_count: z.number().int(),
  /** Echoed-back server-generated values so the agent can include them
   * in any subsequent reasoning / chained writes if useful. */
  timestamp: z.string().datetime(),
  run_id: z.string(),
});
export type LogShadowRowResultT = z.infer<typeof LogShadowRowResult>;

import { z } from 'zod';

/**
 * Input schemas for MCP tools. One per tool. Re-exported through
 * `tools/tool-registry.ts` so handlers can `parse()` once.
 */

export const ListDisplaysInput = z.object({
  status: z.enum(['online', 'offline', 'pairing', 'error', 'all'])
    .optional()
    .default('all')
    .describe('Filter by display status. "all" returns every status.'),
  limit: z.number().int().min(1).max(100).optional().default(20)
    .describe('Page size, 1-100.'),
  page: z.number().int().min(1).optional().default(1)
    .describe('1-indexed page number.'),
});

export type ListDisplaysInputT = z.infer<typeof ListDisplaysInput>;

export const ListOpenSupportRequestsInput = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20)
    .describe('Page size, 1-100.'),
  page: z.number().int().min(1).optional().default(1)
    .describe('1-indexed page number.'),
  include_already_triaged: z.boolean().optional().default(false)
    .describe(
      'When false (default), excludes any request that already has an agent-authored message in its thread (D7 reply-loop prevention). Set true to see every open request regardless of triage state.',
    ),
});

export type ListOpenSupportRequestsInputT = z.infer<typeof ListOpenSupportRequestsInput>;

// ── Write tools (require :write scope) ─────────────────────────────────────

const TICKET_PRIORITY = z.enum(['urgent', 'high', 'normal', 'low']);

// Mirrors the V2_SLUGS list in @vizora/database. Kept inline to avoid a
// runtime import from the data-package; the union is small and stable.
const TICKET_CATEGORY_V2 = z.enum([
  'device_pairing_failed',
  'device_offline',
  'device_wrong_content',
  'device_playback_error',
  'device_display_config',
  'content_upload_failed',
  'content_not_showing',
  'content_expired',
  'content_template_broken',
  'content_storage_limit',
  'schedule_not_playing',
  'schedule_timezone_issue',
  'schedule_conflict',
  'schedule_coverage_gap',
  'analytics_missing_data',
  'analytics_wrong_count',
  'analytics_export_failed',
  'account_access_lost',
  'account_permissions',
  'billing_invoice_question',
  'other',
]);

export const UpdateSupportRequestPriorityInput = z.object({
  request_id: z.string().min(1).describe('Support request id (cuid).'),
  priority: TICKET_PRIORITY.describe('New priority. One of urgent | high | normal | low.'),
});
export type UpdateSupportRequestPriorityInputT = z.infer<typeof UpdateSupportRequestPriorityInput>;

export const UpdateSupportRequestAiCategoryInput = z.object({
  request_id: z.string().min(1).describe('Support request id (cuid).'),
  ai_category: TICKET_CATEGORY_V2.describe(
    'V2 taxonomy slug. Constrained to the union — unknown slugs are rejected at the wire.',
  ),
});
export type UpdateSupportRequestAiCategoryInputT = z.infer<typeof UpdateSupportRequestAiCategoryInput>;

export const CreateSupportMessageInput = z.object({
  request_id: z.string().min(1).describe('Support request id (cuid).'),
  content: z
    .string()
    .min(1)
    .max(2000)
    .describe('Message body. Templates only — never raw LLM output. Max 2000 chars.'),
});
export type CreateSupportMessageInputT = z.infer<typeof CreateSupportMessageInput>;

// ── Customer-lifecycle (platform-scope read tool) ──────────────────────────

export const ListOnboardingCandidatesInput = z.object({
  lookback_days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .optional()
    .default(30)
    .describe(
      'Window for "recently created" orgs whose onboarding may still be in progress. Default 30, matches the existing PM2 cron.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .default(200)
    .describe(
      'Max candidates returned. Default 200, matches the existing PM2 cron CANDIDATE_LIMIT.',
    ),
});
export type ListOnboardingCandidatesInputT = z.infer<typeof ListOnboardingCandidatesInput>;

// ── Customer-lifecycle write tools (platform-scope, customer:write) ────────

const NUDGE_KEY = z.enum([
  'day1-pair-screen',
  'day3-upload-content',
  'day7-create-schedule',
]);

export const MarkOnboardingNudgeSentInput = z.object({
  organization_id: z.string().min(1),
  nudge_key: NUDGE_KEY,
});
export type MarkOnboardingNudgeSentInputT = z.infer<typeof MarkOnboardingNudgeSentInput>;

export const AutoCompleteOrgOnboardingInput = z.object({
  organization_id: z.string().min(1),
});
export type AutoCompleteOrgOnboardingInputT = z.infer<typeof AutoCompleteOrgOnboardingInput>;

export const SendLifecycleNudgeEmailInput = z.object({
  organization_id: z.string().min(1),
  nudge_key: NUDGE_KEY.describe(
    'Template selector — server-side picks the actual subject and body from a hardcoded table. The agent does NOT supply email content.',
  ),
});
export type SendLifecycleNudgeEmailInputT = z.infer<typeof SendLifecycleNudgeEmailInput>;

// ── Shadow log writer (platform-scope, shadow:write) ──────────────────────

export const LogShadowRowInput = z.object({
  log_name: z
    .enum([
      'vizora-support-triage-shadow',
      'vizora-support-triage-live',
      'vizora-customer-lifecycle-shadow',
      'vizora-customer-lifecycle-live',
    ])
    .describe(
      'Allowlisted shadow-log file name (no path, no .jsonl extension). Server resolves to /var/log/hermes/<name>.jsonl.',
    ),
  fields: z
    .record(z.unknown())
    .describe(
      "JSON object of fields to log. Server prepends `timestamp` (ISO-8601 UTC) and `run_id` (epoch-seconds) — DO NOT supply these; server overrides them. Total row size capped at 4096 bytes (PIPE_BUF, atomic-append guarantee).",
    ),
});
export type LogShadowRowInputT = z.infer<typeof LogShadowRowInput>;

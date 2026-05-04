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

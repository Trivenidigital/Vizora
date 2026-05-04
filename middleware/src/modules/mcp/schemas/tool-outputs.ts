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

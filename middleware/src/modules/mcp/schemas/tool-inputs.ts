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

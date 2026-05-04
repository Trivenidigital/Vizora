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

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

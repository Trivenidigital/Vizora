/**
 * Support-request priority vocabulary mapping.
 *
 * Two vocabularies exist for ticket priority:
 *   - **Canonical (internal / DB ladder)**: critical | high | medium | low.
 *     This is the single source of truth — the `support_requests.priority`
 *     column, `SupportService`, the admin dashboard, and `getStats` all
 *     speak it (see schema.prisma: `priority String @default("medium")`).
 *   - **MCP wire vocabulary**: urgent | high | normal | low. The historical
 *     terms the MCP tool surface exposes to agents.
 *
 * These helpers are the ONE place the two vocabularies are translated.
 * The MCP boundary maps inbound priority (agent → DB) with
 * `mcpPriorityToCanonical` before it reaches the service, and maps
 * outbound priority (DB → agent) with `canonicalPriorityToMcp` before it
 * crosses the wire. Internally, only the canonical ladder is ever stored
 * or compared.
 */

export type CanonicalPriority = 'critical' | 'high' | 'medium' | 'low';
export type McpPriority = 'urgent' | 'high' | 'normal' | 'low';

const MCP_TO_CANONICAL: Record<McpPriority, CanonicalPriority> = {
  urgent: 'critical',
  high: 'high',
  normal: 'medium',
  low: 'low',
};

const CANONICAL_TO_MCP: Record<CanonicalPriority, McpPriority> = {
  critical: 'urgent',
  high: 'high',
  medium: 'normal',
  low: 'low',
};

/**
 * Map an MCP-wire priority term to the canonical DB ladder. Used on the
 * inbound edge of `update_support_request_priority` so the service only
 * ever writes canonical values.
 */
export function mcpPriorityToCanonical(priority: McpPriority): CanonicalPriority {
  return MCP_TO_CANONICAL[priority];
}

/**
 * Map a stored priority to the MCP-wire vocabulary. Used on the outbound
 * edge of `list_open_support_requests`.
 *
 * Tolerant of values that are already in the MCP vocabulary (legacy rows
 * written before this mapping existed) and of unknown/empty values —
 * anything unrecognized is passed through unchanged rather than throwing,
 * because this runs inside the read path and must never fail a list call.
 */
export function canonicalPriorityToMcp(
  priority: string | null | undefined,
): string | null {
  if (priority == null) return null;
  if (priority in CANONICAL_TO_MCP) {
    return CANONICAL_TO_MCP[priority as CanonicalPriority];
  }
  return priority;
}

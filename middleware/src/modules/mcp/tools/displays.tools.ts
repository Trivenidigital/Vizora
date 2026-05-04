import { ForbiddenException } from '@nestjs/common';
import { DisplaysService } from '../../displays/displays.service';
import { hasScope, type McpRequestContext } from '../auth/mcp-context';
import {
  ListDisplaysInput,
  type ListDisplaysInputT,
} from '../schemas/tool-inputs';
import {
  ListDisplaysOutput,
  type ListDisplaysOutputT,
} from '../schemas/tool-outputs';

/**
 * MCP tool: `list_displays`
 *
 * Read-only listing of displays for the calling token's organization.
 * Wraps `DisplaysService.findAll` and projects each Prisma row into
 * the wire-shape declared in `ListDisplaysOutput`. No new business
 * logic.
 *
 * Scope required: `displays:read`. Scope failure throws
 * `ForbiddenException` which the error mapper translates to MCP
 * `FORBIDDEN`.
 */
export async function listDisplaysTool(
  rawInput: unknown,
  context: McpRequestContext,
  displaysService: DisplaysService,
): Promise<ListDisplaysOutputT> {
  if (!hasScope(context, 'displays:read')) {
    throw new ForbiddenException(
      "Token lacks scope 'displays:read'",
    );
  }
  const input = ListDisplaysInput.parse(rawInput) as ListDisplaysInputT;

  const result = await displaysService.findAll(context.organizationId, {
    page: input.page,
    limit: input.limit,
  });

  // Filter by status client-side — DisplaysService.findAll doesn't
  // accept a status filter today and we don't want to widen its
  // signature for an MCP-only concern. At ≤100 rows per page the cost
  // is negligible.
  const filtered = (result.data as Array<Record<string, unknown>>).filter(
    (d) => input.status === 'all' || d.status === input.status,
  );

  return ListDisplaysOutput.parse({
    displays: filtered.map(toDisplayShape),
    page: input.page,
    limit: input.limit,
    total: result.meta?.total ?? filtered.length,
  });
}

function toDisplayShape(d: Record<string, unknown>) {
  return {
    id: d.id as string,
    organization_id: d.organizationId as string,
    device_identifier: d.deviceIdentifier as string,
    nickname: (d.nickname as string | null) ?? null,
    location: (d.location as string | null) ?? null,
    status: d.status as 'online' | 'offline' | 'pairing' | 'error',
    orientation: d.orientation as 'landscape' | 'portrait',
    resolution: (d.resolution as string | null) ?? null,
    last_heartbeat: d.lastHeartbeat instanceof Date
      ? d.lastHeartbeat.toISOString()
      : (d.lastHeartbeat as string | null) ?? null,
    current_playlist_id: (d.currentPlaylistId as string | null) ?? null,
    is_disabled: Boolean(d.isDisabled),
    created_at: d.createdAt instanceof Date
      ? d.createdAt.toISOString()
      : (d.createdAt as string),
  };
}

/**
 * Registry entry shape for MCP tool registration. Lives next to the
 * implementation so we can't lose track of the input/output schemas
 * vs the handler.
 */
export const LIST_DISPLAYS_TOOL = {
  name: 'list_displays',
  description:
    'List displays for the calling token\'s organization. Read-only. Paginated. Optional status filter (online | offline | pairing | error | all).',
  scope: 'displays:read' as const,
  inputSchema: ListDisplaysInput,
  outputSchema: ListDisplaysOutput,
  handler: listDisplaysTool,
};

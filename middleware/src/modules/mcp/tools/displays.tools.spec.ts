import { ForbiddenException } from '@nestjs/common';
import { listDisplaysTool } from './displays.tools';
import type { McpRequestContext } from '../auth/mcp-context';

function ctx(scopes: string[]): McpRequestContext {
  return {
    tokenId: 'tok_1',
    organizationId: 'org_1',
    agentName: 'support-triage',
    scopes,
  };
}

function makeDisplays(rows: Array<Partial<{ id: string; status: string; nickname: string | null; isDisabled: boolean; lastHeartbeat: Date | null }>>) {
  return {
    findAll: jest.fn().mockResolvedValue({
      data: rows.map((r) => ({
        id: r.id,
        organizationId: 'org_1',
        deviceIdentifier: `dev-${r.id}`,
        nickname: r.nickname ?? null,
        location: null,
        status: r.status ?? 'online',
        orientation: 'landscape',
        resolution: null,
        lastHeartbeat: r.lastHeartbeat ?? null,
        currentPlaylistId: null,
        isDisabled: r.isDisabled ?? false,
        createdAt: new Date('2026-05-01T00:00:00Z'),
      })),
      meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
    }),
  };
}

describe('listDisplaysTool', () => {
  it('throws ForbiddenException when scope missing', async () => {
    await expect(
      listDisplaysTool({}, ctx([]), makeDisplays([]) as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns wire-shape (snake_case) when scope present', async () => {
    const out = await listDisplaysTool(
      {},
      ctx(['displays:read']),
      makeDisplays([{ id: 'd1' }, { id: 'd2' }]) as never,
    );
    expect(out.displays).toHaveLength(2);
    expect(out.displays[0]).toMatchObject({
      id: 'd1',
      organization_id: 'org_1',
      device_identifier: 'dev-d1',
      status: 'online',
      orientation: 'landscape',
      is_disabled: false,
    });
    expect(out.displays[0].created_at).toBe('2026-05-01T00:00:00.000Z');
    expect(out.total).toBe(2);
  });

  it('client-side filters by status when not "all"', async () => {
    const displaysSvc = makeDisplays([
      { id: 'd1', status: 'online' },
      { id: 'd2', status: 'offline' },
      { id: 'd3', status: 'online' },
    ]);
    const out = await listDisplaysTool(
      { status: 'online' },
      ctx(['displays:read']),
      displaysSvc as never,
    );
    expect(out.displays.map((d) => d.id)).toEqual(['d1', 'd3']);
  });

  it('rejects invalid limit via Zod (>100)', async () => {
    await expect(
      listDisplaysTool(
        { limit: 999 },
        ctx(['displays:read']),
        makeDisplays([]) as never,
      ),
    ).rejects.toThrow(/100/);
  });

  it('passes the calling token org to DisplaysService.findAll (not user-controlled)', async () => {
    const displaysSvc = makeDisplays([]);
    await listDisplaysTool({}, ctx(['displays:read']), displaysSvc as never);
    expect(displaysSvc.findAll).toHaveBeenCalledWith('org_1', { page: 1, limit: 20 });
  });

  it('lastHeartbeat as Date is serialized to ISO string', async () => {
    const ts = new Date('2026-05-04T12:34:56Z');
    const out = await listDisplaysTool(
      {},
      ctx(['displays:read']),
      makeDisplays([{ id: 'd1', lastHeartbeat: ts }]) as never,
    );
    expect(out.displays[0].last_heartbeat).toBe('2026-05-04T12:34:56.000Z');
  });
});

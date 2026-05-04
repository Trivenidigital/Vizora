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

  it('passes the status filter through to DisplaysService.findAll (DB-side, not client-side)', async () => {
    const displaysSvc = makeDisplays([
      { id: 'd1', status: 'online' },
      { id: 'd2', status: 'online' },
    ]);
    const out = await listDisplaysTool(
      { status: 'online' },
      ctx(['displays:read']),
      displaysSvc as never,
    );
    expect(displaysSvc.findAll).toHaveBeenCalledWith(
      'org_1',
      { page: 1, limit: 20 },
      { status: 'online' },
    );
    expect(out.displays.map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it("does NOT pass a filter when status='all'", async () => {
    const displaysSvc = makeDisplays([{ id: 'd1' }]);
    await listDisplaysTool({}, ctx(['displays:read']), displaysSvc as never);
    expect(displaysSvc.findAll).toHaveBeenCalledWith(
      'org_1',
      { page: 1, limit: 20 },
      undefined,
    );
  });

  it('reports the DB-filtered total — pagination ratios match (REGRESSION: was previously the unfiltered count)', async () => {
    // Simulate DisplaysService.findAll with status filter applied:
    // total reflects the FILTERED count, not the org-wide count.
    const displaysSvc = {
      findAll: jest.fn().mockResolvedValue({
        data: [
          { id: 'd1', organizationId: 'org_1', deviceIdentifier: 'a', nickname: null, location: null, status: 'offline', orientation: 'landscape', resolution: null, lastHeartbeat: null, currentPlaylistId: null, isDisabled: false, createdAt: new Date('2026-05-01T00:00:00Z') },
          { id: 'd2', organizationId: 'org_1', deviceIdentifier: 'b', nickname: null, location: null, status: 'offline', orientation: 'landscape', resolution: null, lastHeartbeat: null, currentPlaylistId: null, isDisabled: false, createdAt: new Date('2026-05-01T00:00:00Z') },
        ],
        // 7 offline displays exist across all pages, 100 total in the org
        meta: { page: 1, limit: 20, total: 7, totalPages: 1 },
      }),
    };
    const out = await listDisplaysTool(
      { status: 'offline' },
      ctx(['displays:read']),
      displaysSvc as never,
    );
    expect(out.total).toBe(7);
    expect(out.displays).toHaveLength(2);
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
    expect(displaysSvc.findAll).toHaveBeenCalledWith(
      'org_1',
      { page: 1, limit: 20 },
      undefined,
    );
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

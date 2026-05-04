import { ForbiddenException } from '@nestjs/common';
import { listOpenSupportRequestsTool } from './support.tools';
import type { McpRequestContext } from '../auth/mcp-context';

function ctx(scopes: string[]): McpRequestContext {
  return {
    tokenId: 'tok_1',
    organizationId: 'org_1',
    agentName: 'hermes-support-triage',
    scopes,
  };
}

function makeSupport(
  rows: Array<Partial<{
    id: string;
    status: string;
    priority: string | null;
    category: string | null;
    aiCategory: string | null;
    createdAt: Date;
    ageMinutes: number;
    wordCount: number;
    hasAttachment: boolean;
    messageCount: number;
    orgTier: string;
  }>>,
) {
  return {
    listTriageCandidates: jest.fn().mockResolvedValue({
      data: rows.map((r) => ({
        id: r.id,
        organizationId: 'org_1',
        status: r.status ?? 'open',
        priority: r.priority ?? 'normal',
        category: r.category ?? 'bug_report',
        aiCategory: r.aiCategory ?? null,
        createdAt: r.createdAt ?? new Date('2026-05-01T00:00:00Z'),
        ageMinutes: r.ageMinutes ?? 30,
        wordCount: r.wordCount ?? 12,
        hasAttachment: r.hasAttachment ?? false,
        messageCount: r.messageCount ?? 1,
        orgTier: r.orgTier ?? 'free',
      })),
      meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
    }),
  };
}

describe('listOpenSupportRequestsTool', () => {
  it('throws ForbiddenException when scope missing', async () => {
    await expect(
      listOpenSupportRequestsTool({}, ctx([]), makeSupport([]) as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns wire-shape (snake_case) when scope present', async () => {
    const out = await listOpenSupportRequestsTool(
      {},
      ctx(['support:read']),
      makeSupport([{ id: 'r1' }, { id: 'r2' }]) as never,
    );
    expect(out.support_requests).toHaveLength(2);
    expect(out.support_requests[0]).toMatchObject({
      id: 'r1',
      organization_id: 'org_1',
      status: 'open',
      priority: 'normal',
      category: 'bug_report',
      ai_category: null,
      age_minutes: 30,
      word_count: 12,
      has_attachment: false,
      message_count: 1,
      org_tier: 'free',
    });
    expect(out.support_requests[0].created_at).toBe('2026-05-01T00:00:00.000Z');
    expect(out.total).toBe(2);
  });

  it('NEVER returns description, consoleErrors, or user fields — D13 contract enforced at the wire shape', async () => {
    // Simulate a misbehaving service that leaks the body. The Zod
    // outputSchema MUST strip-or-reject — we don't trust the service
    // to never leak. (zod .parse strips unknown keys by default.)
    const leaky = {
      listTriageCandidates: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'r1',
            organizationId: 'org_1',
            status: 'open',
            priority: 'normal',
            category: 'bug_report',
            aiCategory: null,
            createdAt: new Date('2026-05-01T00:00:00Z'),
            ageMinutes: 30,
            wordCount: 12,
            hasAttachment: false,
            messageCount: 1,
            orgTier: 'free',
            // fields a buggy service might accidentally leak
            description: 'CUSTOMER PII LEAKED — phone 555-1234',
            consoleErrors: 'private stack trace',
            user: { email: 'leak@example.com', firstName: 'Leak' },
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    };
    const out = await listOpenSupportRequestsTool(
      {},
      ctx(['support:read']),
      leaky as never,
    );
    const row = out.support_requests[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('description');
    expect(row).not.toHaveProperty('consoleErrors');
    expect(row).not.toHaveProperty('user');
    // Be paranoid — also verify the leaked PII isn't anywhere in the wire payload
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('phone 555-1234');
    expect(serialized).not.toContain('leak@example.com');
    expect(serialized).not.toContain('private stack trace');
  });

  it('passes the calling token org to listTriageCandidates (NOT user-controlled)', async () => {
    const svc = makeSupport([]);
    await listOpenSupportRequestsTool({}, ctx(['support:read']), svc as never);
    expect(svc.listTriageCandidates).toHaveBeenCalledWith(
      'org_1',
      { page: 1, limit: 20, includeAlreadyTriaged: false },
    );
  });

  it('forwards include_already_triaged through to the service', async () => {
    const svc = makeSupport([]);
    await listOpenSupportRequestsTool(
      { include_already_triaged: true },
      ctx(['support:read']),
      svc as never,
    );
    expect(svc.listTriageCandidates).toHaveBeenCalledWith(
      'org_1',
      { page: 1, limit: 20, includeAlreadyTriaged: true },
    );
  });

  it('rejects invalid limit via Zod (>100)', async () => {
    await expect(
      listOpenSupportRequestsTool(
        { limit: 999 },
        ctx(['support:read']),
        makeSupport([]) as never,
      ),
    ).rejects.toThrow(/100/);
  });

  it('serializes Date createdAt as ISO string on the wire', async () => {
    const ts = new Date('2026-05-04T12:34:56Z');
    const out = await listOpenSupportRequestsTool(
      {},
      ctx(['support:read']),
      makeSupport([{ id: 'r1', createdAt: ts }]) as never,
    );
    expect(out.support_requests[0].created_at).toBe('2026-05-04T12:34:56.000Z');
  });
});

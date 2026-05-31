import { McpTokenService } from './mcp-token.service';
import { createHash } from 'node:crypto';

interface TokenRow {
  id: string;
  tokenHash: string;
  name: string;
  organizationId: string;
  agentName: string;
  scopes: string[];
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

/**
 * In-memory fake DatabaseService. Avoids a real Prisma client in
 * unit tests but still exercises the service end-to-end.
 */
function makeFakeDb() {
  const rows = new Map<string, TokenRow>();
  let idCounter = 0;
  return {
    rows,
    mcpToken: {
      async create({ data, select }: { data: Partial<TokenRow>; select?: Partial<Record<keyof TokenRow, true>> }) {
        const id = `tok_${++idCounter}`;
        const row: TokenRow = {
          id,
          tokenHash: data.tokenHash!,
          name: data.name!,
          organizationId: data.organizationId!,
          agentName: data.agentName!,
          scopes: data.scopes ?? [],
          createdAt: new Date(),
          expiresAt: data.expiresAt ?? null,
          revokedAt: null,
          lastUsedAt: null,
        };
        rows.set(id, row);
        return project(row, select);
      },
      async findUnique({ where, select }: { where: { tokenHash?: string; id?: string }; select?: Partial<Record<keyof TokenRow, true>> }) {
        for (const row of rows.values()) {
          if (where.tokenHash && row.tokenHash === where.tokenHash) return project(row, select);
          if (where.id && row.id === where.id) return project(row, select);
        }
        return null;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<TokenRow> }) {
        const row = rows.get(where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      },
      async updateMany({ where, data }: { where: { id: string; revokedAt: null }; data: Partial<TokenRow> }) {
        const row = rows.get(where.id);
        if (!row || row.revokedAt !== null) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      async findMany({ where, select }: { where?: { organizationId?: string }; select?: Partial<Record<keyof TokenRow, true>>; orderBy?: unknown }) {
        const all = Array.from(rows.values());
        const filtered = where?.organizationId
          ? all.filter((r) => r.organizationId === where.organizationId)
          : all;
        return filtered.map((r) => project(r, select));
      },
    },
  };
}

function project(row: TokenRow, select?: Partial<Record<keyof TokenRow, true>>): unknown {
  if (!select) return row;
  const out: Partial<TokenRow> = {};
  for (const key of Object.keys(select) as (keyof TokenRow)[]) {
    (out as Record<string, unknown>)[key] = row[key];
  }
  return out;
}

describe('McpTokenService', () => {
  let svc: McpTokenService;
  let db: ReturnType<typeof makeFakeDb>;

  beforeEach(() => {
    db = makeFakeDb();
    svc = new McpTokenService(db as never);
  });

  describe('issue', () => {
    it('returns plaintext bearer + record without hash field', async () => {
      const out = await svc.issue({
        name: 'test',
        organizationId: 'org_1',
        agentName: 'support-triage',
        scopes: ['displays:read'],
      });
      expect(out.bearer).toMatch(/^mcp_[A-Za-z0-9_-]{43}$/);
      expect(out.record).toHaveProperty('id');
      expect(out.record).not.toHaveProperty('tokenHash');
    });

    it('persists sha256(bearer) — never plaintext', async () => {
      const out = await svc.issue({
        name: 'test',
        organizationId: 'org_1',
        agentName: 'support-triage',
        scopes: ['displays:read'],
      });
      const stored = Array.from(db.rows.values())[0];
      const expectedHash = createHash('sha256').update(out.bearer).digest('hex');
      expect(stored.tokenHash).toBe(expectedHash);
      // Confirm plaintext is NOT in the stored row
      expect(JSON.stringify(stored)).not.toContain(out.bearer);
    });

    it('accepts :read scopes', async () => {
      await expect(
        svc.issue({
          name: 't', organizationId: 'o', agentName: 'a',
          scopes: ['displays:read'],
        }),
      ).resolves.toMatchObject({ bearer: expect.stringMatching(/^mcp_/) });
    });

    it('accepts :write scopes (added when support-triage migration needed write tools)', async () => {
      await expect(
        svc.issue({
          name: 't', organizationId: 'o', agentName: 'a',
          scopes: ['support:write'],
        }),
      ).resolves.toMatchObject({ bearer: expect.stringMatching(/^mcp_/) });
    });

    it('rejects scopes lacking a :read or :write suffix (typo guard)', async () => {
      await expect(
        svc.issue({
          name: 't', organizationId: 'o', agentName: 'a',
          scopes: ['displays'],
        }),
      ).rejects.toThrow(/:read.*:write/);
      await expect(
        svc.issue({
          name: 't', organizationId: 'o', agentName: 'a',
          scopes: ['displays:admin'],
        }),
      ).rejects.toThrow(/:read.*:write/);
    });

    it('rejects empty scope list', async () => {
      await expect(
        svc.issue({ name: 't', organizationId: 'o', agentName: 'a', scopes: [] }),
      ).rejects.toThrow(/at least one scope/);
    });

    it('caps TTL at MCP_TOKEN_TTL_DAYS even when caller asks for more', async () => {
      const original = process.env.MCP_TOKEN_TTL_DAYS;
      process.env.MCP_TOKEN_TTL_DAYS = '7';
      try {
        const svc2 = new McpTokenService(db as never);
        const out = await svc2.issue({
          name: 't', organizationId: 'o', agentName: 'a',
          scopes: ['displays:read'],
          expiresInDays: 9999,
        });
        const ms = out.record.expiresAt!.getTime() - out.record.createdAt.getTime();
        expect(ms).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 5_000);
      } finally {
        if (original) process.env.MCP_TOKEN_TTL_DAYS = original;
        else delete process.env.MCP_TOKEN_TTL_DAYS;
      }
    });
  });

  describe('validate', () => {
    it('returns context for a valid live bearer', async () => {
      const issued = await svc.issue({
        name: 't', organizationId: 'org_X', agentName: 'support-triage',
        scopes: ['displays:read'],
      });
      const ctx = await svc.validate(issued.bearer);
      expect(ctx).toEqual({
        id: issued.record.id,
        organizationId: 'org_X',
        agentName: 'support-triage',
        scopes: ['displays:read'],
      });
    });

    it('returns null for a fabricated bearer that has the right prefix', async () => {
      const ctx = await svc.validate('mcp_' + 'A'.repeat(43));
      expect(ctx).toBeNull();
    });

    it('returns null for missing/empty/wrong-shape bearer', async () => {
      expect(await svc.validate('')).toBeNull();
      expect(await svc.validate('Bearer foo')).toBeNull();
      expect(await svc.validate('foo')).toBeNull();
    });

    it('returns null for a revoked token', async () => {
      const issued = await svc.issue({
        name: 't', organizationId: 'o', agentName: 'a',
        scopes: ['displays:read'],
      });
      await svc.revoke(issued.record.id);
      expect(await svc.validate(issued.bearer)).toBeNull();
    });

    it('returns null for an expired token', async () => {
      const issued = await svc.issue({
        name: 't', organizationId: 'o', agentName: 'a',
        scopes: ['displays:read'],
      });
      const stored = Array.from(db.rows.values()).find((r) => r.id === issued.record.id)!;
      stored.expiresAt = new Date(Date.now() - 1_000);
      expect(await svc.validate(issued.bearer)).toBeNull();
    });
  });

  describe('revoke', () => {
    it('is idempotent — second revoke of the same id is a no-op', async () => {
      const issued = await svc.issue({
        name: 't', organizationId: 'o', agentName: 'a',
        scopes: ['displays:read'],
      });
      await svc.revoke(issued.record.id);
      await expect(svc.revoke(issued.record.id)).resolves.toBeUndefined();
    });

    it('revoking an unknown id is a no-op (not an error)', async () => {
      await expect(svc.revoke('nonexistent')).resolves.toBeUndefined();
    });
  });
});

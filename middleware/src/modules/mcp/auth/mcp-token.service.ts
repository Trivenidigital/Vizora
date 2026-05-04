import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../../database/database.service';

/**
 * Issue, validate, and revoke MCP bearer tokens.
 *
 * **Plaintext is shown to admin once at issuance and never persisted.**
 * The DB stores only `tokenHash` (sha256 hex). Lookup hashes the
 * incoming bearer and compares. Never compare plaintext to plaintext.
 *
 * This avoids the entire class of "leaked DB row → working token"
 * vulnerabilities — a stolen `mcp_tokens` row gives the attacker a
 * hash, not a usable bearer.
 */
@Injectable()
export class McpTokenService {
  private readonly logger = new Logger(McpTokenService.name);

  /** Configurable max issuance TTL (default 90 days). */
  private readonly maxTtlDays = Number(process.env.MCP_TOKEN_TTL_DAYS ?? 90);

  constructor(private readonly db: DatabaseService) {}

  private hash(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }

  /**
   * Generate a new bearer token. Returns the plaintext bearer ONCE +
   * the persisted record (without `tokenHash` for safety).
   *
   * The bearer format is `mcp_<43 base64url chars>` — recognizable
   * prefix for log redaction tools, ~256 bits of entropy.
   */
  async issue(input: {
    name: string;
    organizationId: string;
    agentName: string;
    scopes: string[];
    expiresInDays?: number;
  }): Promise<{
    bearer: string;
    record: {
      id: string;
      name: string;
      organizationId: string;
      agentName: string;
      scopes: string[];
      createdAt: Date;
      expiresAt: Date | null;
    };
  }> {
    const ttlDays = Math.min(
      input.expiresInDays ?? this.maxTtlDays,
      this.maxTtlDays,
    );
    if (ttlDays < 1) {
      throw new Error('MCP token TTL must be at least 1 day');
    }
    if (input.scopes.length === 0) {
      throw new Error('MCP token must have at least one scope');
    }
    // Reject any non-read scope until v2 (writes) ships.
    for (const s of input.scopes) {
      if (!s.endsWith(':read')) {
        throw new Error(
          `MCP v1 issues read-only tokens; rejected scope '${s}'`,
        );
      }
    }

    // 32 bytes → 43 base64url chars without padding
    const bearer = `mcp_${randomBytes(32).toString('base64url')}`;
    const tokenHash = this.hash(bearer);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const created = await this.db.mcpToken.create({
      data: {
        tokenHash,
        name: input.name,
        organizationId: input.organizationId,
        agentName: input.agentName,
        scopes: input.scopes,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        agentName: true,
        scopes: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    this.logger.log(
      `Issued MCP token id=${created.id} agent=${input.agentName} org=${input.organizationId} scopes=${input.scopes.join(',')} expiresAt=${expiresAt.toISOString()}`,
    );

    return { bearer, record: created };
  }

  /**
   * Validate an incoming bearer. Returns the token row on success or
   * null on any failure (missing/expired/revoked). On success, also
   * touches `lastUsedAt` (best-effort — failure to update is logged
   * but doesn't fail validation).
   */
  async validate(bearer: string): Promise<{
    id: string;
    organizationId: string;
    agentName: string;
    scopes: string[];
  } | null> {
    if (!bearer || typeof bearer !== 'string' || !bearer.startsWith('mcp_')) {
      return null;
    }
    const tokenHash = this.hash(bearer);
    const row = await this.db.mcpToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        organizationId: true,
        agentName: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    if (!row) return null;
    if (row.revokedAt) return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

    // Best-effort lastUsedAt update — fire and forget.
    this.db.mcpToken
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Failed to update lastUsedAt for token ${row.id}: ${err instanceof Error ? err.message : err}`,
        );
      });

    return {
      id: row.id,
      organizationId: row.organizationId,
      agentName: row.agentName,
      scopes: row.scopes,
    };
  }

  /** Mark a token as revoked. Idempotent. */
  async revoke(id: string): Promise<void> {
    const updated = await this.db.mcpToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) {
      // Either not found or already revoked — log and continue
      this.logger.log(`Revoke no-op for token id=${id} (not found or already revoked)`);
    } else {
      this.logger.log(`Revoked MCP token id=${id}`);
    }
  }

  /** Admin listing — never returns the hash. */
  async list(organizationId?: string) {
    return this.db.mcpToken.findMany({
      where: organizationId ? { organizationId } : undefined,
      select: {
        id: true,
        name: true,
        organizationId: true,
        agentName: true,
        scopes: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

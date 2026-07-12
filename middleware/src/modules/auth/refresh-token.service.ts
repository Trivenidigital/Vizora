import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { AUTH_CONSTANTS } from './constants/auth.constants';

/** Session metadata captured at issuance / rotation time. */
export interface RefreshTokenContext {
  ip?: string;
  userAgent?: string;
}

/** Result of issuing or rotating a refresh token — the raw token is returned ONCE. */
export interface IssuedRefreshToken {
  /** Plaintext token, to be placed in the httpOnly cookie. Never persisted. */
  rawToken: string;
  expiresAt: Date;
}

/** Session inventory row — deliberately free of any token material. */
export interface RefreshSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  current: boolean;
}

/**
 * Refresh-token infrastructure (PR-17a).
 *
 * Opaque 256-bit random tokens (NOT JWTs — no signing secret needed, same
 * shape as password-reset tokens). Only the SHA-256 hash is stored; the
 * plaintext lives solely in the httpOnly `vizora_refresh_token` cookie.
 *
 * Rotation-on-use with reuse detection: every redemption revokes the presented
 * token and issues a successor in the same `familyId`. Presenting an
 * already-rotated (revoked) token is treated as theft and revokes the entire
 * family. A short grace window absorbs benign concurrent refreshes (a browser
 * firing two refreshes at once) so they don't trip the theft response.
 *
 * This is ADDITIVE to the existing access-token flow — nothing here changes how
 * the access JWT is issued or validated.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  /**
   * Grace window (ms) during which re-presenting a just-rotated token is
   * treated as a benign concurrent refresh rather than token theft. Without
   * it, a browser that fires two refreshes simultaneously would revoke the
   * whole family and log the user out. Kept deliberately short: the successor
   * hash is now linked atomically with the revoke (see rotate), so genuine
   * sibling refreshes resolve in milliseconds and don't need a wide window.
   */
  private static readonly REUSE_GRACE_MS = 5_000;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  private hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private ttlMs(): number {
    const raw = process.env.REFRESH_TOKEN_TTL_DAYS;
    let days = AUTH_CONSTANTS.REFRESH_TOKEN_DEFAULT_TTL_DAYS;
    if (raw !== undefined && raw.trim() !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        days = Math.min(
          Math.max(Math.floor(parsed), AUTH_CONSTANTS.REFRESH_TOKEN_TTL_MIN_DAYS),
          AUTH_CONSTANTS.REFRESH_TOKEN_TTL_MAX_DAYS,
        );
      } else {
        this.logger.warn(
          `REFRESH_TOKEN_TTL_DAYS="${raw}" is not a positive number; using ${days}d default.`,
        );
      }
    }
    return days * 24 * 60 * 60 * 1000;
  }

  /** Resolved refresh-token lifetime in seconds — used for the cookie maxAge. */
  getTtlSeconds(): number {
    return Math.floor(this.ttlMs() / 1000);
  }

  /**
   * Start a brand-new session lineage (called on login/register/google, and as
   * a fallback when a legacy session with no refresh cookie refreshes).
   */
  async issueForUser(userId: string, ctx: RefreshTokenContext = {}): Promise<IssuedRefreshToken> {
    return this.create(userId, crypto.randomUUID(), ctx);
  }

  /**
   * Validate + rotate a presented refresh token.
   *
   *  - unknown / wrong-user / expired token  → 401 (no family action)
   *  - already-revoked within grace          → 401 (benign concurrent refresh; family preserved)
   *  - already-revoked outside grace          → REUSE: revoke the whole family, then 401
   *  - active token                           → atomically claim + issue a successor in the same family
   *
   * `expectedUserId` is the authenticated caller's id (defense in depth: a
   * refresh token can only be rotated by the user it belongs to).
   */
  async rotate(
    rawToken: string,
    expectedUserId: string,
    ctx: RefreshTokenContext = {},
  ): Promise<IssuedRefreshToken> {
    const tokenHash = this.hash(rawToken);
    const existing = await this.databaseService.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.userId !== expectedUserId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = Date.now();

    if (existing.expiresAt.getTime() <= now) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (existing.revokedAt) {
      const rotatedRecently =
        existing.replacedByTokenHash !== null &&
        now - existing.revokedAt.getTime() <= RefreshTokenService.REUSE_GRACE_MS;
      if (rotatedRecently) {
        // Benign concurrent refresh — a sibling request already rotated this
        // token and set a fresh cookie. Reject this one WITHOUT killing the
        // family so the user stays logged in. Logged (S4) so an anomalous rate
        // of grace hits is observable; no token material, only user + family.
        this.logger.warn(
          `refresh_token.grace_hit user=${existing.userId} family=${existing.familyId}`,
        );
        throw new UnauthorizedException('Refresh token already rotated');
      }
      // Genuine reuse of a long-revoked token → token theft. Kill the lineage.
      await this.databaseService.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Distinct tag from grace_hit (S4) so genuine theft can be alerted on
      // separately from benign concurrency. No token material.
      this.logger.warn(
        `refresh_token.reuse_detected user=${existing.userId} family=${existing.familyId}`,
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    // S1: re-verify the user's live state before minting a successor. A refresh
    // token far outlives the 60s access-token cache, so a long-running refresh
    // lineage must re-check that the account wasn't deactivated, revoked, or
    // password-changed out from under it. Mirrors JwtStrategy.validate — same
    // Redis keys, same strict-`<` pwd_changed semantics — and fails closed on
    // the isActive check (a missing user is rejected).
    const user = await this.databaseService.user.findUnique({
      where: { id: existing.userId },
      select: { isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    if (await this.redisService.exists(`user_revoked:${existing.userId}`)) {
      throw new UnauthorizedException('User account is no longer active');
    }
    const pwdChangedAt = await this.redisService.get(`pwd_changed:${existing.userId}`);
    if (pwdChangedAt && Math.floor(existing.createdAt.getTime() / 1000) < Number(pwdChangedAt)) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    // S2: generate the successor token up-front so its hash is written as part
    // of the SAME atomic claim that revokes the presented token. This closes
    // the self-lockout window — a lagging concurrent reader can no longer
    // observe revokedAt!=null && replacedByTokenHash===null and wrongly hit the
    // reuse branch; replacedByTokenHash is never transiently null for a
    // revoked-by-rotation token.
    const successorRawToken = crypto.randomBytes(32).toString('hex');
    const successorHash = this.hash(successorRawToken);

    // Atomically claim the rotation AND link the successor in one update: only
    // ONE concurrent caller can flip revokedAt from null. A losing racer gets
    // count 0 → benign concurrent refresh (family preserved).
    const claimed = await this.databaseService.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        replacedByTokenHash: successorHash,
      },
    });
    if (claimed.count === 0) {
      this.logger.warn(
        `refresh_token.grace_hit user=${existing.userId} family=${existing.familyId}`,
      );
      throw new UnauthorizedException('Refresh token already rotated');
    }

    return this.persist(existing.userId, existing.familyId, successorRawToken, ctx);
  }

  /** Revoke a single token by its raw value (logout). Best-effort, never throws. */
  async revokeByRawToken(rawToken: string): Promise<void> {
    try {
      const tokenHash = this.hash(rawToken);
      await this.databaseService.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to revoke refresh token on logout: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  /**
   * List the caller's own active sessions. Token hashes are NEVER returned.
   * `currentRawToken` (if supplied) flags the session backing this request.
   */
  async listSessions(userId: string, currentRawToken?: string): Promise<RefreshSession[]> {
    const currentHash = currentRawToken ? this.hash(currentRawToken) : null;
    const rows = await this.databaseService.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tokenHash: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      ip: r.ip,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
      current: currentHash !== null && r.tokenHash === currentHash,
    }));
  }

  /**
   * Revoke one session by id, scoped to the caller. The lookup + mutation are a
   * single `userId`-scoped `updateMany`, so a missing id and an id owned by
   * another user are handled identically — no 404-vs-403 branch that would leak
   * whether a session id exists in some OTHER user's account (cross-user
   * existence oracle). Idempotent: an already-revoked or non-matching id is a
   * silent no-op.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.databaseService.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all of the caller's OTHER active sessions, keeping the current one
   * (identified by its raw token). Returns the number revoked.
   */
  async revokeOtherSessions(userId: string, currentRawToken?: string): Promise<number> {
    const where: {
      userId: string;
      revokedAt: null;
      tokenHash?: { not: string };
    } = { userId, revokedAt: null };
    if (currentRawToken) {
      where.tokenHash = { not: this.hash(currentRawToken) };
    }
    const result = await this.databaseService.refreshToken.updateMany({
      where,
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /** Persist a fresh token row (random raw token) and return its value once. */
  private async create(
    userId: string,
    familyId: string,
    ctx: RefreshTokenContext,
  ): Promise<IssuedRefreshToken> {
    return this.persist(userId, familyId, crypto.randomBytes(32).toString('hex'), ctx);
  }

  /**
   * Persist a token row for an ALREADY-GENERATED raw token and return it once.
   * Rotation generates the successor token before the atomic claim (so its hash
   * can be linked in that same update, see rotate/S2), then hands the
   * pre-generated token here to insert the successor row.
   */
  private async persist(
    userId: string,
    familyId: string,
    rawToken: string,
    ctx: RefreshTokenContext,
  ): Promise<IssuedRefreshToken> {
    const expiresAt = new Date(Date.now() + this.ttlMs());
    await this.databaseService.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(rawToken),
        familyId,
        expiresAt,
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
        lastUsedAt: new Date(),
      },
    });
    return { rawToken, expiresAt };
  }
}

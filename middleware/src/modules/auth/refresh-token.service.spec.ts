import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { RefreshTokenService } from './refresh-token.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let db: {
    refreshToken: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let redis: {
    exists: jest.Mock;
    get: jest.Mock;
  };

  beforeEach(async () => {
    db = {
      refreshToken: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        // S1: rotate() re-checks the user's live state before minting a
        // successor. Default to an active user; individual tests override.
        findUnique: jest.fn().mockResolvedValue({ isActive: true }),
      },
    };
    redis = {
      // S1 markers: default to "no marker set" (benign concurrent-safe path).
      exists: jest.fn().mockResolvedValue(false),
      get: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: DatabaseService, useValue: db },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
  });

  afterEach(() => {
    delete process.env.REFRESH_TOKEN_TTL_DAYS;
    jest.clearAllMocks();
  });

  describe('issueForUser', () => {
    it('stores only the SHA-256 hash and returns the raw token once', async () => {
      const issued = await service.issueForUser('user-1', { ip: '1.2.3.4', userAgent: 'UA' });

      expect(issued.rawToken).toEqual(expect.any(String));
      expect(db.refreshToken.create).toHaveBeenCalledTimes(1);
      const data = db.refreshToken.create.mock.calls[0][0].data;
      // The persisted hash matches the returned raw token; plaintext is never stored.
      expect(data.tokenHash).toBe(sha256(issued.rawToken));
      expect(data.tokenHash).not.toBe(issued.rawToken);
      expect(data.userId).toBe('user-1');
      expect(data.familyId).toEqual(expect.any(String));
      expect(data.ip).toBe('1.2.3.4');
      expect(data.userAgent).toBe('UA');
    });

    it('starts a new family per login', async () => {
      const a = await service.issueForUser('user-1');
      const b = await service.issueForUser('user-1');
      const famA = db.refreshToken.create.mock.calls[0][0].data.familyId;
      const famB = db.refreshToken.create.mock.calls[1][0].data.familyId;
      expect(famA).not.toBe(famB);
      expect(a.rawToken).not.toBe(b.rawToken);
    });
  });

  describe('rotate', () => {
    const raw = 'presented-raw-token';
    const base = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: sha256(raw),
      familyId: 'fam-1',
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null as Date | null,
      replacedByTokenHash: null as string | null,
    };

    it('rotates an active token: atomically revokes+links the old, issues a successor in the same family', async () => {
      db.refreshToken.findUnique.mockResolvedValue({ ...base });

      const issued = await service.rotate(raw, 'user-1', { ip: '9.9.9.9', userAgent: 'UA2' });

      // S2: the atomic claim revokes the old token AND links the successor hash
      // in the SAME update — replacedByTokenHash is never transiently null.
      expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt-1', revokedAt: null },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          lastUsedAt: expect.any(Date),
          replacedByTokenHash: sha256(issued.rawToken),
        }),
      });
      // Successor created in the same family, matching the linked hash.
      const created = db.refreshToken.create.mock.calls[0][0].data;
      expect(created.familyId).toBe('fam-1');
      expect(created.tokenHash).toBe(sha256(issued.rawToken));
      // No separate post-hoc update() — the successor link is part of the claim.
      expect(db.refreshToken.update).not.toHaveBeenCalled();
      expect(issued.rawToken).not.toBe(raw);
    });

    it('rejects an unknown token', async () => {
      db.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(UnauthorizedException);
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a token belonging to another user (cross-user)', async () => {
      db.refreshToken.findUnique.mockResolvedValue({ ...base, userId: 'someone-else' });
      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(UnauthorizedException);
      expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      db.refreshToken.findUnique.mockResolvedValue({ ...base, expiresAt: new Date(Date.now() - 1000) });
      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(UnauthorizedException);
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    it('REUSE: revokes the entire family when a long-revoked token is presented', async () => {
      db.refreshToken.findUnique.mockResolvedValue({
        ...base,
        revokedAt: new Date(Date.now() - 5 * 60_000), // revoked 5 min ago (outside grace)
        replacedByTokenHash: sha256('successor'),
      });

      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(/reuse/i);
      expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    it('does NOT kill the family for a benign concurrent refresh (revoked within grace)', async () => {
      db.refreshToken.findUnique.mockResolvedValue({
        ...base,
        revokedAt: new Date(Date.now() - 1000), // just rotated, within grace
        replacedByTokenHash: sha256('successor'),
      });

      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(/already rotated/i);
      // Family untouched — the user stays logged in.
      expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    it('treats a lost claim race as a benign concurrent refresh (no family kill)', async () => {
      db.refreshToken.findUnique.mockResolvedValue({ ...base });
      db.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 }); // another racer already claimed it

      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(/already rotated/i);
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    // --- S2: atomic successor linkage defeats the self-lockout interleaving ---
    it('S2: a lagging reader of a just-claimed token (replacedByTokenHash already set) gets a benign 401, family NOT revoked', async () => {
      // Interleaving: a sibling rotate committed the atomic claim (revokedAt +
      // replacedByTokenHash set together). This lagging reader observes the row
      // AFTER the claim. Because replacedByTokenHash is already set and the
      // revoke is within the grace window, it is a benign concurrent refresh —
      // NOT reuse — so the family must be preserved.
      db.refreshToken.findUnique.mockResolvedValue({
        ...base,
        revokedAt: new Date(Date.now() - 100), // just claimed, within grace
        replacedByTokenHash: sha256('successor'),
      });

      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(/already rotated/i);
      // Benign: no family-kill updateMany, no successor minted.
      expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    // --- S1: re-check user state before minting a successor ---
    it('S1: rejects rotation when the user is no longer active (fail-closed)', async () => {
      db.refreshToken.findUnique.mockResolvedValue({ ...base });
      db.user.findUnique.mockResolvedValue({ isActive: false });

      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(UnauthorizedException);
      // No successor minted, family untouched.
      expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    it('S1: rejects rotation when a user_revoked marker is set', async () => {
      db.refreshToken.findUnique.mockResolvedValue({ ...base });
      redis.exists.mockImplementation((key: string) =>
        Promise.resolve(key === 'user_revoked:user-1'),
      );

      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(UnauthorizedException);
      expect(redis.exists).toHaveBeenCalledWith('user_revoked:user-1');
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    it('S1: rejects rotation when pwd_changed is NEWER than the token createdAt (strict <)', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      db.refreshToken.findUnique.mockResolvedValue({ ...base, createdAt });
      const newerEpoch = Math.floor(createdAt.getTime() / 1000) + 60;
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'pwd_changed:user-1' ? String(newerEpoch) : null),
      );

      await expect(service.rotate(raw, 'user-1')).rejects.toThrow(UnauthorizedException);
      expect(redis.get).toHaveBeenCalledWith('pwd_changed:user-1');
      expect(db.refreshToken.create).not.toHaveBeenCalled();
    });

    it('S1: allows rotation when pwd_changed is OLDER than the token createdAt (fresh post-change session)', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      db.refreshToken.findUnique.mockResolvedValue({ ...base, createdAt });
      const olderEpoch = Math.floor(createdAt.getTime() / 1000) - 60;
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'pwd_changed:user-1' ? String(olderEpoch) : null),
      );

      const issued = await service.rotate(raw, 'user-1');
      expect(issued.rawToken).toEqual(expect.any(String));
      expect(db.refreshToken.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('revokeByRawToken', () => {
    it('revokes the matching non-revoked token and never throws', async () => {
      await service.revokeByRawToken('some-raw');
      expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('some-raw'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('swallows DB errors', async () => {
      db.refreshToken.updateMany.mockRejectedValueOnce(new Error('db down'));
      await expect(service.revokeByRawToken('x')).resolves.toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('only queries the caller own non-revoked, unexpired tokens and never returns hashes', async () => {
      const now = new Date();
      db.refreshToken.findMany.mockResolvedValue([
        { id: 's1', tokenHash: sha256('cur'), userAgent: 'UA1', ip: '1.1.1.1', createdAt: now, lastUsedAt: now },
        { id: 's2', tokenHash: sha256('other'), userAgent: 'UA2', ip: '2.2.2.2', createdAt: now, lastUsedAt: null },
      ]);

      const sessions = await service.listSessions('user-1', 'cur');

      const where = db.refreshToken.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ userId: 'user-1', revokedAt: null });
      expect(where.expiresAt).toEqual({ gt: expect.any(Date) });

      expect(sessions).toEqual([
        { id: 's1', userAgent: 'UA1', ip: '1.1.1.1', createdAt: now, lastUsedAt: now, current: true },
        { id: 's2', userAgent: 'UA2', ip: '2.2.2.2', createdAt: now, lastUsedAt: null, current: false },
      ]);
      // Defense in depth: no token material leaks.
      expect(JSON.stringify(sessions)).not.toMatch(/tokenHash/);
      for (const s of sessions) {
        expect(s).not.toHaveProperty('tokenHash');
      }
    });
  });

  describe('revokeSession', () => {
    it('revokes an owned session via a single userId-scoped updateMany (no findUnique lookup)', async () => {
      await service.revokeSession('user-1', 'sess-1');
      // No pre-lookup — the scoped updateMany is the only DB touch, so there is
      // no cross-user existence oracle.
      expect(db.refreshToken.findUnique).not.toHaveBeenCalled();
      expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'sess-1', userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('is a scoped no-op for a missing OR cross-user id (identical response, no 404-vs-403 oracle)', async () => {
      // A missing id and another user's id are indistinguishable: both resolve
      // to a userId-scoped updateMany that matches nothing and returns quietly.
      db.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeSession('user-1', 'missing-or-foreign')).resolves.toBeUndefined();
      expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'missing-or-foreign', userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('is idempotent for an already-revoked own session', async () => {
      db.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.revokeSession('user-1', 'already-revoked')).resolves.toBeUndefined();
    });
  });

  describe('revokeOtherSessions', () => {
    it('revokes all the caller other sessions, keeping the current one', async () => {
      db.refreshToken.updateMany.mockResolvedValue({ count: 4 });
      const count = await service.revokeOtherSessions('user-1', 'current-raw');
      expect(count).toBe(4);
      expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null, tokenHash: { not: sha256('current-raw') } },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokes every session when no current token is supplied', async () => {
      db.refreshToken.updateMany.mockResolvedValue({ count: 2 });
      await service.revokeOtherSessions('user-1');
      expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('getTtlSeconds', () => {
    it('defaults to 30 days', () => {
      expect(service.getTtlSeconds()).toBe(30 * 24 * 60 * 60);
    });

    it('honors REFRESH_TOKEN_TTL_DAYS within bounds', () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '7';
      expect(service.getTtlSeconds()).toBe(7 * 24 * 60 * 60);
    });

    it('clamps out-of-range values', () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = '9999';
      expect(service.getTtlSeconds()).toBe(365 * 24 * 60 * 60);
    });

    it('falls back to the default on garbage', () => {
      process.env.REFRESH_TOKEN_TTL_DAYS = 'abc';
      expect(service.getTtlSeconds()).toBe(30 * 24 * 60 * 60);
    });
  });
});

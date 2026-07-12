import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { generate, generateSecret } from 'otplib';
import { MfaService } from './mfa.service';
import { MFA_CONSTANTS } from './mfa.constants';
import { encryptSecret } from './mfa-crypto';

describe('MfaService', () => {
  let service: MfaService;
  let mockDb: any;
  let mockRedis: any;
  let jwt: JwtService;
  let secret: string;
  let validCode: string;

  const WRONG_CODE = 'wrongcode'; // not 6 digits + no backup match => always invalid

  beforeAll(() => {
    process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.JWT_SECRET = 'b'.repeat(64);
  });

  beforeEach(async () => {
    mockDb = {
      user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      mfaBackupCode: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 10 }),
        count: jest.fn().mockResolvedValue(10),
      },
      $transaction: jest.fn((arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(mockDb),
      ),
    };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      exists: jest.fn().mockResolvedValue(0),
      incr: jest.fn().mockResolvedValue(1),
      incrementWithTtl: jest.fn().mockResolvedValue(1),
      setIfNotExists: jest.fn().mockResolvedValue(true),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };
    jwt = new JwtService({});
    service = new MfaService(mockDb, jwt, mockRedis);

    secret = generateSecret();
    validCode = await generate({ secret });
  });

  describe('enroll', () => {
    it('stores a PENDING encrypted secret and returns an otpauth URL + QR (does not enable)', async () => {
      mockDb.user.findUnique.mockResolvedValue({ mfaEnabled: false, email: 'u@e.com' });

      const result = await service.enroll('u1');

      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      const update = mockDb.user.update.mock.calls[0][0];
      expect(update.data.mfaEnabled).toBe(false);
      expect(update.data.mfaSecret).toEqual(expect.stringMatching(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/));
      // The stored value is ciphertext, never the raw base32 secret.
      expect(update.data.mfaSecret).not.toContain(':undefined');
    });

    it('rejects enrollment when MFA is already enabled', async () => {
      mockDb.user.findUnique.mockResolvedValue({ mfaEnabled: true, email: 'u@e.com' });
      await expect(service.enroll('u1')).rejects.toThrow(BadRequestException);
    });

    it('FAIL-CLOSED: refuses when MFA_ENCRYPTION_KEY is unset', async () => {
      const saved = process.env.MFA_ENCRYPTION_KEY;
      delete process.env.MFA_ENCRYPTION_KEY;
      await expect(service.enroll('u1')).rejects.toThrow(ServiceUnavailableException);
      process.env.MFA_ENCRYPTION_KEY = saved;
    });
  });

  describe('enable', () => {
    beforeEach(() => {
      mockDb.user.findUnique.mockResolvedValue({
        mfaEnabled: false,
        mfaSecret: encryptSecret(secret),
      });
    });

    it('enables MFA on a valid code and returns 10 one-time backup codes', async () => {
      const result = await service.enable('u1', validCode);
      expect(result.backupCodes).toHaveLength(MFA_CONSTANTS.BACKUP_CODE_COUNT);
      expect(mockDb.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ mfaEnabled: true }) }),
      );
      expect(mockDb.mfaBackupCode.createMany).toHaveBeenCalled();
      // Backup codes are returned in plaintext but stored as sha256 hashes.
      const rows = mockDb.mfaBackupCode.createMany.mock.calls[0][0].data;
      expect(rows[0].codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0]).not.toHaveProperty('code');
    });

    it('rejects an invalid code and records a verify failure', async () => {
      await expect(service.enable('u1', WRONG_CODE)).rejects.toThrow(UnauthorizedException);
      expect(mockRedis.incr).toHaveBeenCalledWith('mfa_verify_fail:u1');
      expect(mockDb.user.update).not.toHaveBeenCalled();
    });

    it('rejects when there is no pending secret', async () => {
      mockDb.user.findUnique.mockResolvedValue({ mfaEnabled: false, mfaSecret: null });
      await expect(service.enable('u1', validCode)).rejects.toThrow(BadRequestException);
    });

    it('locks out after too many failed verify attempts', async () => {
      mockRedis.get.mockResolvedValue(String(MFA_CONSTANTS.MAX_VERIFY_ATTEMPTS));
      await expect(service.enable('u1', validCode)).rejects.toThrow(HttpException);
    });
  });

  describe('disable', () => {
    beforeEach(() => {
      mockDb.user.findUnique.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: encryptSecret(secret),
      });
    });

    it('disables on a valid TOTP and clears secret + backup codes', async () => {
      await service.disable('u1', validCode);
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('disables on a valid unused backup code', async () => {
      mockDb.mfaBackupCode.findFirst.mockResolvedValue({ id: 'bc1' });
      mockDb.mfaBackupCode.updateMany.mockResolvedValue({ count: 1 });
      await service.disable('u1', 'abcde-12345');
      expect(mockDb.mfaBackupCode.updateMany).toHaveBeenCalled();
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('rejects an invalid code', async () => {
      await expect(service.disable('u1', WRONG_CODE)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when MFA is not enabled', async () => {
      mockDb.user.findUnique.mockResolvedValue({ mfaEnabled: false, mfaSecret: null });
      await expect(service.disable('u1', validCode)).rejects.toThrow(BadRequestException);
    });
  });

  describe('status', () => {
    it('returns enabled + remaining backup codes', async () => {
      mockDb.user.findUnique.mockResolvedValue({ mfaEnabled: true });
      mockDb.mfaBackupCode.count.mockResolvedValue(7);
      expect(await service.status('u1')).toEqual({ enabled: true, backupCodesRemaining: 7 });
    });

    it('reports 0 remaining when disabled', async () => {
      mockDb.user.findUnique.mockResolvedValue({ mfaEnabled: false });
      expect(await service.status('u1')).toEqual({ enabled: false, backupCodesRemaining: 0 });
    });
  });

  describe('regenerateBackupCodes', () => {
    it('requires a valid TOTP and issues a fresh set', async () => {
      mockDb.user.findUnique.mockResolvedValue({ mfaEnabled: true, mfaSecret: encryptSecret(secret) });
      const result = await service.regenerateBackupCodes('u1', validCode);
      expect(result.backupCodes).toHaveLength(MFA_CONSTANTS.BACKUP_CODE_COUNT);
      expect(mockDb.mfaBackupCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('rejects an invalid TOTP', async () => {
      mockDb.user.findUnique.mockResolvedValue({ mfaEnabled: true, mfaSecret: encryptSecret(secret) });
      await expect(service.regenerateBackupCodes('u1', WRONG_CODE)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('challenge tokens', () => {
    beforeEach(() => {
      mockDb.user.findUnique.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: encryptSecret(secret),
        isActive: true,
      });
    });

    it('verifies a valid TOTP and atomically claims the single-use marker', async () => {
      const token = service.issueChallengeToken('u1');
      const result = await service.verifyChallenge(token, validCode);
      expect(result).toEqual({ userId: 'u1' });
      // Single-use is an atomic SET NX claim (not a plain set), so there is no
      // exists-then-set TOCTOU window.
      expect(mockRedis.setIfNotExists).toHaveBeenCalledWith(
        expect.stringMatching(/^mfa_chal_used:/),
        '1',
        MFA_CONSTANTS.CHALLENGE_TOKEN_TTL_SECONDS,
      );
      // Success clears the per-USER failure counter (not the per-jti one).
      expect(mockRedis.del).toHaveBeenCalledWith('mfa_chal_user_fail:u1');
    });

    it('consumes an unused backup code as the second factor', async () => {
      mockDb.mfaBackupCode.findFirst.mockResolvedValue({ id: 'bc1' });
      mockDb.mfaBackupCode.updateMany.mockResolvedValue({ count: 1 });
      const token = service.issueChallengeToken('u1');
      const result = await service.verifyChallenge(token, 'abcde-12345');
      expect(result).toEqual({ userId: 'u1' });
      expect(mockDb.mfaBackupCode.updateMany).toHaveBeenCalled();
    });

    it('rejects a wrong code and atomically increments BOTH the per-user and per-jti counters', async () => {
      const token = service.issueChallengeToken('u1');
      await expect(service.verifyChallenge(token, WRONG_CODE)).rejects.toThrow(UnauthorizedException);
      // Per-USER counter (the real bound) — keyed on userId, atomic INCR+TTL.
      expect(mockRedis.incrementWithTtl).toHaveBeenCalledWith(
        'mfa_chal_user_fail:u1',
        MFA_CONSTANTS.CHALLENGE_LOCKOUT_SECONDS,
      );
      // Per-jti counter (defence in depth).
      expect(mockRedis.incrementWithTtl).toHaveBeenCalledWith(
        expect.stringMatching(/^mfa_chal_fail:/),
        MFA_CONSTANTS.CHALLENGE_TOKEN_TTL_SECONDS,
      );
    });

    it('rejects a replayed challenge via the atomic NX claim (setIfNotExists=false)', async () => {
      // The code is correct, but the used-marker is already claimed → the
      // atomic SET NX loses → this is a replay, reject with 401. No reliance on
      // a separate exists() pre-check.
      mockRedis.setIfNotExists.mockResolvedValue(false);
      const token = service.issueChallengeToken('u1');
      await expect(service.verifyChallenge(token, validCode)).rejects.toThrow(/already been used/);
      expect(mockRedis.setIfNotExists).toHaveBeenCalledWith(
        expect.stringMatching(/^mfa_chal_used:/),
        '1',
        MFA_CONSTANTS.CHALLENGE_TOKEN_TTL_SECONDS,
      );
    });

    it('is per-USER keyed: a fresh challenge token does NOT reset the lockout', async () => {
      // The per-user counter is already at the cap. A brand-new challenge token
      // (different jti, per-jti counter empty) must STILL be locked — proving
      // the bound survives minting a fresh token.
      mockRedis.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === 'mfa_chal_user_fail:u1'
            ? String(MFA_CONSTANTS.MAX_CHALLENGE_ATTEMPTS_PER_USER)
            : null,
        ),
      );
      const freshToken = service.issueChallengeToken('u1');
      await expect(service.verifyChallenge(freshToken, validCode)).rejects.toThrow(HttpException);
      // Rejected at the per-user gate — the code was never even verified.
      expect(mockRedis.setIfNotExists).not.toHaveBeenCalled();
    });

    it('locks the challenge after too many failed attempts', async () => {
      mockRedis.get.mockResolvedValue(String(MFA_CONSTANTS.MAX_CHALLENGE_ATTEMPTS));
      const token = service.issueChallengeToken('u1');
      await expect(service.verifyChallenge(token, validCode)).rejects.toThrow(HttpException);
    });

    it('rejects a forged / wrong-secret challenge token', async () => {
      const forged = jwt.sign(
        { sub: 'u1', type: MFA_CONSTANTS.CHALLENGE_TOKEN_TYPE, jti: 'x' },
        { secret: 'not-the-derived-mfa-secret-000000000000', expiresIn: 60 },
      );
      await expect(service.verifyChallenge(forged, validCode)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('token typing (challenge vs enrollment cannot be swapped)', () => {
    it('verifyEnrollmentToken accepts an enrollment token and rejects a challenge token', () => {
      const enroll = service.issueEnrollmentToken('u1');
      expect(service.verifyEnrollmentToken(enroll)).toEqual({ userId: 'u1' });

      const challenge = service.issueChallengeToken('u1');
      expect(() => service.verifyEnrollmentToken(challenge)).toThrow(UnauthorizedException);
    });

    it('verifyChallenge rejects an enrollment token used as a challenge token', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: encryptSecret(secret),
        isActive: true,
      });
      const enroll = service.issueEnrollmentToken('u1');
      await expect(service.verifyChallenge(enroll, validCode)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resolveLoginBranch', () => {
    it('returns none for a non-MFA user in a non-requiring org', () => {
      expect(
        service.resolveLoginBranch({ id: 'u1', mfaEnabled: false, organization: { mfaRequired: false } }),
      ).toEqual({ kind: 'none' });
    });

    it('returns a challenge for an enrolled user', () => {
      const branch = service.resolveLoginBranch({
        id: 'u1',
        mfaEnabled: true,
        organization: { mfaRequired: false },
      });
      expect(branch.kind).toBe('challenge');
    });

    it('returns enroll when the org requires MFA and the user is not enrolled', () => {
      const branch = service.resolveLoginBranch({
        id: 'u1',
        mfaEnabled: false,
        organization: { mfaRequired: true },
      });
      expect(branch.kind).toBe('enroll');
    });
  });
});

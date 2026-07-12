import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { generateSecret, generateURI, verify as verifyTotpCode } from 'otplib';
import * as QRCode from 'qrcode';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../redis/redis.service';
import { MFA_CONSTANTS } from './mfa.constants';
import {
  decryptSecret,
  encryptSecret,
  getMfaTokenSecret,
  hashBackupCode,
  isMfaEncryptionConfigured,
} from './mfa-crypto';

/** Payload of the MFA challenge / enrollment JWTs (signed with a derived key). */
interface MfaTokenPayload {
  sub: string;
  type: string;
  jti: string;
  iat?: number;
  exp?: number;
}

/**
 * MFA (auth #2) domain service — TOTP enroll/enable/disable/status, single-use
 * backup codes, login-challenge verification, and the short-lived challenge /
 * enrollment tokens.
 *
 * SECURITY POSTURE:
 *  - The TOTP secret is AES-256-GCM encrypted at rest (mfa-crypto). Plaintext
 *    exists only transiently in memory during enroll/verify. Fail-closed: if
 *    MFA_ENCRYPTION_KEY is missing, every MFA operation refuses to run.
 *  - Backup codes are sha256-hashed, single-use (usedAt), never stored plaintext.
 *  - Challenge/enrollment tokens are typed JWTs signed with a key DERIVED from
 *    JWT_SECRET (getMfaTokenSecret), so they cannot authenticate as access
 *    tokens. Challenge tokens are strictly single-use (Redis jti marker) and
 *    lock after K failed attempts.
 *  - No secret or code material is ever logged or returned except the one-time
 *    backup-code display and the enroll QR/secret.
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  // ---------------------------------------------------------------------------
  // Fail-closed guard
  // ---------------------------------------------------------------------------

  private assertConfigured(): void {
    if (!isMfaEncryptionConfigured()) {
      // 503, not 500: this is a server-config gap, not a client error. Never
      // proceed — refusing is the fail-closed behavior (no plaintext secrets).
      throw new ServiceUnavailableException('MFA is not configured on this server');
    }
  }

  // ---------------------------------------------------------------------------
  // TOTP helpers
  // ---------------------------------------------------------------------------

  /** Verify a 6-digit TOTP against a plaintext base32 secret (window +/-1 step). */
  private async verifyTotp(secretPlaintext: string, token: string): Promise<boolean> {
    // Constant-time comparison is handled inside otplib's verify.
    const cleaned = token.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) return false;
    try {
      const result = await verifyTotpCode({
        secret: secretPlaintext,
        token: cleaned,
        algorithm: 'sha1',
        digits: MFA_CONSTANTS.TOTP_DIGITS,
        period: MFA_CONSTANTS.TOTP_STEP_SECONDS,
        // epochTolerance is in SECONDS; one step (30s) each side == window +/-1.
        epochTolerance: MFA_CONSTANTS.TOTP_STEP_SECONDS,
      });
      return result.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Consume a single-use backup code for a user. Atomic: only the first caller
   * to flip usedAt from null wins, so a code can never be redeemed twice.
   * Returns true if a matching unused code was consumed.
   */
  private async consumeBackupCode(userId: string, code: string): Promise<boolean> {
    const codeHash = hashBackupCode(code);
    const match = await this.databaseService.mfaBackupCode.findFirst({
      where: { userId, codeHash, usedAt: null },
      select: { id: true },
    });
    if (!match) return false;
    const claimed = await this.databaseService.mfaBackupCode.updateMany({
      where: { id: match.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return claimed.count === 1;
  }

  /** Generate + persist a fresh set of backup codes, returning the plaintext once. */
  private async generateBackupCodes(userId: string): Promise<string[]> {
    // Replace any existing codes (regeneration / re-enable).
    await this.databaseService.mfaBackupCode.deleteMany({ where: { userId } });

    const plaintextCodes: string[] = [];
    const rows: { userId: string; codeHash: string }[] = [];
    for (let i = 0; i < MFA_CONSTANTS.BACKUP_CODE_COUNT; i++) {
      // 10 hex chars, displayed grouped as xxxxx-xxxxx for readability. Hashing
      // normalizes (strips the dash) so the display format is not significant.
      const raw = crypto.randomBytes(5).toString('hex');
      const display = `${raw.slice(0, 5)}-${raw.slice(5)}`;
      plaintextCodes.push(display);
      rows.push({ userId, codeHash: hashBackupCode(display) });
    }
    await this.databaseService.mfaBackupCode.createMany({ data: rows });
    return plaintextCodes;
  }

  // ---------------------------------------------------------------------------
  // Verify-attempt lockout (enable / disable / regenerate)
  // ---------------------------------------------------------------------------

  private async assertNotVerifyLocked(userId: string): Promise<void> {
    const key = `mfa_verify_fail:${userId}`;
    let fails = 0;
    try {
      const raw = await this.redisService.get(key);
      fails = raw ? parseInt(raw, 10) : 0;
    } catch {
      // Redis down — fail OPEN on the lockout read so the user can still verify;
      // the @Throttle on the endpoint remains the outer brute-force cap.
      return;
    }
    if (fails >= MFA_CONSTANTS.MAX_VERIFY_ATTEMPTS) {
      throw new HttpException(
        'Too many incorrect codes. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async bumpVerifyFailure(userId: string): Promise<void> {
    const key = `mfa_verify_fail:${userId}`;
    try {
      const count = await this.redisService.incr(key);
      if (count === 1) {
        await this.redisService.expire(key, MFA_CONSTANTS.VERIFY_LOCKOUT_SECONDS);
      }
    } catch {
      // best-effort
    }
  }

  private async clearVerifyFailures(userId: string): Promise<void> {
    try {
      await this.redisService.del(`mfa_verify_fail:${userId}`);
    } catch {
      // best-effort
    }
  }

  // ---------------------------------------------------------------------------
  // Login-challenge lockout (per USER, not per token)
  // ---------------------------------------------------------------------------
  //
  // The per-jti counter in verifyChallenge is defence-in-depth only: every
  // /auth/login mints a NEW challenge token (new jti), so a per-token budget
  // resets at will. These helpers add the REAL bound, keyed on userId, so
  // re-logging-in cannot reset the counter. Mirrors the mfa_verify_fail pattern.

  private async assertNotChallengeLocked(userId: string): Promise<void> {
    const key = `mfa_chal_user_fail:${userId}`;
    let fails = 0;
    try {
      const raw = await this.redisService.get(key);
      fails = raw ? parseInt(raw, 10) : 0;
    } catch {
      // Redis down — fail OPEN on the lockout read so a genuine user can still
      // complete MFA; the @Throttle on /auth/mfa/challenge remains the outer cap.
      return;
    }
    if (fails >= MFA_CONSTANTS.MAX_CHALLENGE_ATTEMPTS_PER_USER) {
      throw new HttpException(
        'Too many incorrect codes. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordChallengeFailure(userId: string): Promise<void> {
    // Atomic INCR (+ TTL on first hit): N concurrent wrong attempts are each
    // counted, so a burst of parallel requests cannot all slip under the cap by
    // racing a read-of-0.
    try {
      await this.redisService.incrementWithTtl(
        `mfa_chal_user_fail:${userId}`,
        MFA_CONSTANTS.CHALLENGE_LOCKOUT_SECONDS,
      );
    } catch {
      // best-effort
    }
  }

  private async clearChallengeFailures(userId: string): Promise<void> {
    try {
      await this.redisService.del(`mfa_chal_user_fail:${userId}`);
    } catch {
      // best-effort
    }
  }

  // ---------------------------------------------------------------------------
  // Enrollment / management
  // ---------------------------------------------------------------------------

  /**
   * Begin enrollment: generate a secret, store it as a PENDING (encrypted,
   * not-yet-enabled) secret, and return the otpauth URL + QR data URL. Does NOT
   * enable MFA. Blocked if MFA is already enabled (disable first to re-enroll).
   */
  async enroll(userId: string): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    this.assertConfigured();
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, email: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled. Disable it first to re-enroll.');
    }

    const secret = generateSecret({ length: 20 });
    const otpauthUrl = generateURI({
      strategy: 'totp',
      issuer: MFA_CONSTANTS.TOTP_ISSUER,
      label: user.email,
      secret,
      algorithm: 'sha1',
      digits: MFA_CONSTANTS.TOTP_DIGITS,
      period: MFA_CONSTANTS.TOTP_STEP_SECONDS,
    });

    // Persist the PENDING secret (encrypted). mfaEnabled stays false, so this is
    // not yet an active factor — `enable` promotes it after code verification.
    await this.databaseService.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptSecret(secret), mfaEnabled: false, mfaEnrolledAt: null },
    });

    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl };
  }

  /**
   * Complete enrollment: verify a TOTP against the pending secret, flip
   * mfaEnabled, and issue a fresh set of backup codes (returned ONCE).
   */
  async enable(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    this.assertConfigured();
    await this.assertNotVerifyLocked(userId);

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');
    if (!user.mfaSecret) {
      throw new BadRequestException('No pending enrollment. Call /auth/mfa/enroll first.');
    }

    const secret = decryptSecret(user.mfaSecret);
    const valid = await this.verifyTotp(secret, code);
    if (!valid) {
      await this.bumpVerifyFailure(userId);
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.clearVerifyFailures(userId);
    await this.databaseService.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaEnrolledAt: new Date() },
    });

    const backupCodes = await this.generateBackupCodes(userId);
    return { backupCodes };
  }

  /**
   * Disable MFA. Requires a valid current TOTP OR an unused backup code. Clears
   * the secret, backup codes, and mfaEnabled.
   */
  async disable(userId: string, code: string): Promise<void> {
    this.assertConfigured();
    await this.assertNotVerifyLocked(userId);

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const secret = decryptSecret(user.mfaSecret);
    const totpValid = await this.verifyTotp(secret, code);
    const ok = totpValid || (await this.consumeBackupCode(userId, code));
    if (!ok) {
      await this.bumpVerifyFailure(userId);
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.clearVerifyFailures(userId);
    await this.databaseService.$transaction([
      this.databaseService.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecret: null, mfaEnrolledAt: null },
      }),
      this.databaseService.mfaBackupCode.deleteMany({ where: { userId } }),
    ]);
  }

  /** { enabled, backupCodesRemaining } for the current user. */
  async status(userId: string): Promise<{ enabled: boolean; backupCodesRemaining: number }> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const backupCodesRemaining = user.mfaEnabled
      ? await this.databaseService.mfaBackupCode.count({ where: { userId, usedAt: null } })
      : 0;
    return { enabled: user.mfaEnabled, backupCodesRemaining };
  }

  /** Regenerate backup codes. Requires a valid current TOTP (not a backup code). */
  async regenerateBackupCodes(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    this.assertConfigured();
    await this.assertNotVerifyLocked(userId);

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    const secret = decryptSecret(user.mfaSecret);
    const valid = await this.verifyTotp(secret, code);
    if (!valid) {
      await this.bumpVerifyFailure(userId);
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.clearVerifyFailures(userId);
    const backupCodes = await this.generateBackupCodes(userId);
    return { backupCodes };
  }

  // ---------------------------------------------------------------------------
  // Challenge / enrollment tokens
  // ---------------------------------------------------------------------------

  private signMfaToken(userId: string, type: string, ttlSeconds: number): string {
    return this.jwtService.sign(
      { sub: userId, type, jti: crypto.randomUUID() },
      { secret: getMfaTokenSecret(), expiresIn: ttlSeconds, algorithm: 'HS256' },
    );
  }

  private verifyMfaToken(token: string, expectedType: string): MfaTokenPayload {
    let payload: MfaTokenPayload;
    try {
      payload = this.jwtService.verify<MfaTokenPayload>(token, {
        secret: getMfaTokenSecret(),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!payload || payload.type !== expectedType || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid token');
    }
    return payload;
  }

  /** Issue a single-use, short-lived login-challenge token for an enrolled user. */
  issueChallengeToken(userId: string): string {
    return this.signMfaToken(
      userId,
      MFA_CONSTANTS.CHALLENGE_TOKEN_TYPE,
      MFA_CONSTANTS.CHALLENGE_TOKEN_TTL_SECONDS,
    );
  }

  /** Issue a short-lived enrollment token that authorizes ONLY enroll + enable. */
  issueEnrollmentToken(userId: string): string {
    return this.signMfaToken(
      userId,
      MFA_CONSTANTS.ENROLLMENT_TOKEN_TYPE,
      MFA_CONSTANTS.ENROLLMENT_TOKEN_TTL_SECONDS,
    );
  }

  /**
   * Verify an enrollment token and return the bound userId. Used by the guard
   * on the enroll/enable endpoints in the forced-enrollment flow.
   */
  verifyEnrollmentToken(token: string): { userId: string } {
    const payload = this.verifyMfaToken(token, MFA_CONSTANTS.ENROLLMENT_TOKEN_TYPE);
    return { userId: payload.sub };
  }

  /**
   * Complete an MFA login challenge: verify the challenge token, enforce
   * single-use + per-challenge lockout, and verify the code as EITHER a TOTP or
   * an unused backup code (consuming the backup code on use). Returns the userId
   * on success; the caller then issues the normal session exactly as login does.
   */
  async verifyChallenge(challengeToken: string, code: string): Promise<{ userId: string }> {
    this.assertConfigured();
    const payload = this.verifyMfaToken(challengeToken, MFA_CONSTANTS.CHALLENGE_TOKEN_TYPE);
    const { sub: userId, jti } = payload;

    const usedKey = `mfa_chal_used:${jti}`;
    const failKey = `mfa_chal_fail:${jti}`;

    // Per-USER brute-force lockout (the REAL bound — keyed on userId so a fresh
    // challenge token cannot reset the budget). Checked first.
    await this.assertNotChallengeLocked(userId);

    // Per-challenge brute-force lockout (defence in depth — bounds one token).
    const failRaw = await this.redisService.get(failKey);
    const fails = failRaw ? parseInt(failRaw, 10) : 0;
    if (fails >= MFA_CONSTANTS.MAX_CHALLENGE_ATTEMPTS) {
      throw new HttpException(
        'Too many incorrect codes for this login. Please log in again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true, isActive: true },
    });
    if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecret) {
      // The user disabled MFA or was deactivated after the challenge was issued.
      throw new UnauthorizedException('MFA is not available for this account');
    }

    const secret = decryptSecret(user.mfaSecret);
    const totpValid = await this.verifyTotp(secret, code);
    const ok = totpValid || (await this.consumeBackupCode(userId, code));

    if (!ok) {
      // Count the failure against BOTH the per-user bound (real cap) and the
      // per-jti counter (defence in depth). Both increments are atomic.
      await this.recordChallengeFailure(userId);
      await this.redisService.incrementWithTtl(
        failKey,
        MFA_CONSTANTS.CHALLENGE_TOKEN_TTL_SECONDS,
      );
      throw new UnauthorizedException('Invalid verification code');
    }

    // Single-use: atomically CLAIM the used-marker (SET NX). The claim happens
    // AFTER the code is verified (a mistyped code never burns the token) but
    // BEFORE the session is issued. `setIfNotExists` returns false when the
    // marker already exists — the token was already consumed → reject as a
    // replay. Atomic (no exists-then-set TOCTOU) and fail-CLOSED (a Redis error
    // returns false, so a replay is never allowed through). TTL matches the
    // token lifetime; by expiry the token is dead anyway, so the marker
    // self-cleans.
    const claimed = await this.redisService.setIfNotExists(
      usedKey,
      '1',
      MFA_CONSTANTS.CHALLENGE_TOKEN_TTL_SECONDS,
    );
    if (!claimed) {
      throw new UnauthorizedException('This login challenge has already been used');
    }

    // Second factor satisfied — clear the per-user challenge failure counter.
    await this.clearChallengeFailures(userId);
    return { userId };
  }

  /**
   * Decide the MFA branch at login time (called by AuthService.login after the
   * password + isActive checks pass). Returns:
   *   - { kind: 'challenge', challengeToken } for an enrolled user, or
   *   - { kind: 'enroll', enrollmentToken } when the org requires MFA and the
   *     user is not enrolled, or
   *   - { kind: 'none' } for a normal (unchanged) login.
   * Never throws for a normal login — a missing MFA config only matters once a
   * user is actually enrolled/required.
   */
  resolveLoginBranch(user: {
    id: string;
    mfaEnabled: boolean;
    organization: { mfaRequired: boolean };
  }):
    | { kind: 'none' }
    | { kind: 'challenge'; challengeToken: string }
    | { kind: 'enroll'; enrollmentToken: string } {
    if (user.mfaEnabled) {
      return { kind: 'challenge', challengeToken: this.issueChallengeToken(user.id) };
    }
    if (user.organization?.mfaRequired) {
      return { kind: 'enroll', enrollmentToken: this.issueEnrollmentToken(user.id) };
    }
    return { kind: 'none' };
  }
}

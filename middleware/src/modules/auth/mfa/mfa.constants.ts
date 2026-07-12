/**
 * MFA (auth #2) constants. Centralized so token lifetimes, lockout thresholds,
 * and the TOTP config are a single source of truth across the service, guard,
 * and tests.
 */
export const MFA_CONSTANTS = {
  /** Login-challenge token lifetime. Short-lived (spec: <= 5 min). */
  CHALLENGE_TOKEN_TTL_SECONDS: 5 * 60,

  /**
   * Forced-enrollment token lifetime. Slightly longer than the challenge —
   * enrollment is a two-step flow (enroll -> scan QR in an authenticator app ->
   * enable), which takes longer than typing one code.
   */
  ENROLLMENT_TOKEN_TTL_SECONDS: 15 * 60,

  /** JWT `type` claim values for the two MFA token kinds. */
  CHALLENGE_TOKEN_TYPE: 'mfa_challenge',
  ENROLLMENT_TOKEN_TYPE: 'mfa_enrollment',

  /** Number of single-use backup codes issued when MFA is enabled. */
  BACKUP_CODE_COUNT: 10,

  /**
   * Max failed code attempts against a single challenge token before it locks.
   * Combined with the endpoint @Throttle, this caps brute force of the 10^6 TOTP
   * space per challenge. Defence-in-depth ONLY — a fresh /auth/login mints a new
   * jti, so this per-token counter alone does not bound a determined attacker.
   */
  MAX_CHALLENGE_ATTEMPTS: 5,

  /**
   * Max failed login-challenge attempts per USER per window — the REAL
   * brute-force bound. Keyed on userId (NOT the token jti), so re-logging-in to
   * mint a fresh challenge token cannot reset the budget. Cleared on a
   * successful challenge.
   */
  MAX_CHALLENGE_ATTEMPTS_PER_USER: 10,
  CHALLENGE_LOCKOUT_SECONDS: 15 * 60,

  /** Max failed verify attempts (enable/disable/regenerate) per user per window. */
  MAX_VERIFY_ATTEMPTS: 10,
  VERIFY_LOCKOUT_SECONDS: 15 * 60,

  /**
   * TOTP config — standard RFC 6238: SHA1, 6 digits, 30s step, window +/-1 (one
   * step of clock skew tolerance each side; NOT a wide window).
   */
  TOTP_DIGITS: 6,
  TOTP_STEP_SECONDS: 30,
  TOTP_WINDOW: 1,

  /** Issuer label shown in the authenticator app (otpauth `issuer`). */
  TOTP_ISSUER: 'Vizora',
} as const;

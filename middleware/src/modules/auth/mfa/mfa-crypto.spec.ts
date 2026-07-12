import {
  decryptSecret,
  encryptSecret,
  getMfaTokenSecret,
  hashBackupCode,
  isMfaEncryptionConfigured,
  normalizeBackupCode,
} from './mfa-crypto';

describe('mfa-crypto', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.JWT_SECRET = 'b'.repeat(64);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('AES-256-GCM secret encryption', () => {
    it('round-trips a secret through encrypt -> decrypt', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP';
      const ciphertext = encryptSecret(plaintext);
      expect(ciphertext).not.toContain(plaintext);
      expect(decryptSecret(ciphertext)).toBe(plaintext);
    });

    it('produces the iv:tag:ciphertext hex format with a random IV each time', () => {
      const a = encryptSecret('same-secret');
      const b = encryptSecret('same-secret');
      expect(a.split(':')).toHaveLength(3);
      expect(a.split(':').every((p) => /^[0-9a-f]+$/.test(p))).toBe(true);
      // Random IV => two encryptions of the same plaintext differ.
      expect(a).not.toBe(b);
    });

    it('rejects a tampered ciphertext (GCM auth tag)', () => {
      const ciphertext = encryptSecret('tamper-me');
      const [iv, tag, data] = ciphertext.split(':');
      // Flip a byte in the data.
      const flipped = (parseInt(data.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0');
      const tampered = `${iv}:${tag}:${flipped}${data.slice(2)}`;
      expect(() => decryptSecret(tampered)).toThrow();
    });

    it('FAIL-CLOSED: encrypt throws when MFA_ENCRYPTION_KEY is missing/short', () => {
      delete process.env.MFA_ENCRYPTION_KEY;
      expect(isMfaEncryptionConfigured()).toBe(false);
      expect(() => encryptSecret('x')).toThrow(/MFA_ENCRYPTION_KEY/);

      process.env.MFA_ENCRYPTION_KEY = 'too-short';
      expect(isMfaEncryptionConfigured()).toBe(false);
      expect(() => encryptSecret('x')).toThrow(/MFA_ENCRYPTION_KEY/);
    });
  });

  describe('MFA token signing secret', () => {
    it('derives deterministically from JWT_SECRET but is NOT equal to it', () => {
      const s1 = getMfaTokenSecret();
      const s2 = getMfaTokenSecret();
      expect(s1).toBe(s2);
      expect(s1).not.toBe(process.env.JWT_SECRET);
    });

    it('changes when JWT_SECRET changes (bound to the access-token key)', () => {
      const s1 = getMfaTokenSecret();
      process.env.JWT_SECRET = 'c'.repeat(64);
      expect(getMfaTokenSecret()).not.toBe(s1);
    });
  });

  describe('backup code hashing', () => {
    it('normalizes formatting + case before hashing', () => {
      expect(normalizeBackupCode('ABcde-12345')).toBe('abcde12345');
      expect(hashBackupCode('ABcde-12345')).toBe(hashBackupCode('abcde 12345'));
    });

    it('produces a 64-char sha256 hex that is not the plaintext', () => {
      const h = hashBackupCode('abcde-12345');
      expect(h).toMatch(/^[0-9a-f]{64}$/);
      expect(h).not.toContain('abcde');
    });
  });
});

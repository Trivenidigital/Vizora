import { coerceJwtExpiry } from './auth.module';

/**
 * Regression for the JWT_EXPIRES_IN unit-parsing footgun: jsonwebtoken reads a
 * unitless string as milliseconds, so a bare "3600" meant as seconds becomes
 * 3.6s tokens. coerceJwtExpiry must turn bare integers into Numbers (seconds)
 * while leaving unit strings alone.
 */
describe('coerceJwtExpiry', () => {
  it('coerces a bare-integer string to a Number (seconds, not ms)', () => {
    // The bug: "3600" as a string → jsonwebtoken treats as 3600ms. As a Number →
    // 3600 seconds. So the coerced value MUST be the number 3600.
    expect(coerceJwtExpiry('3600')).toBe(3600);
    expect(typeof coerceJwtExpiry('3600')).toBe('number');
    expect(coerceJwtExpiry('604800')).toBe(604800);
  });

  it('passes unit strings through unchanged', () => {
    expect(coerceJwtExpiry('7d')).toBe('7d');
    expect(coerceJwtExpiry('1h')).toBe('1h');
    expect(coerceJwtExpiry('30m')).toBe('30m');
  });

  it('returns undefined for empty/unset (caller applies its default)', () => {
    expect(coerceJwtExpiry(undefined)).toBeUndefined();
    expect(coerceJwtExpiry('')).toBeUndefined();
    expect(coerceJwtExpiry('   ')).toBeUndefined();
  });

  it('trims whitespace before classifying', () => {
    expect(coerceJwtExpiry('  3600  ')).toBe(3600);
    expect(coerceJwtExpiry('  7d  ')).toBe('7d');
  });
});

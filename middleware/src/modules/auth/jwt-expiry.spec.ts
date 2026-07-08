import {
  parseExpiryToSeconds,
  resolveAccessTokenTtlSeconds,
  ACCESS_TOKEN_TTL_MIN_S,
  ACCESS_TOKEN_TTL_MAX_S,
  ACCESS_TOKEN_TTL_DEFAULT_S,
} from './jwt-expiry';

/**
 * Regression for the JWT_EXPIRES_IN footgun and the adversarial-review findings:
 * bare integers are seconds (not ms), decimals/negatives/garbage fail SAFE to the
 * 7d default, and out-of-range values clamp into [MIN, MAX] (never longer than the
 * revocation-marker TTL, never near-instant).
 */
describe('parseExpiryToSeconds', () => {
  it('bare integer → seconds (the core footgun: "3600" must be 3600s, not 3600ms)', () => {
    expect(parseExpiryToSeconds('3600')).toBe(3600);
    expect(parseExpiryToSeconds('604800')).toBe(604800);
  });

  it('unit strings → seconds', () => {
    expect(parseExpiryToSeconds('1h')).toBe(3600);
    expect(parseExpiryToSeconds('7d')).toBe(604800);
    expect(parseExpiryToSeconds('30m')).toBe(1800);
    expect(parseExpiryToSeconds('2w')).toBe(1209600);
    expect(parseExpiryToSeconds('45s')).toBe(45);
    expect(parseExpiryToSeconds('  1h  ')).toBe(3600);
  });

  it('unset/empty → 7d default', () => {
    expect(parseExpiryToSeconds(undefined)).toBe(ACCESS_TOKEN_TTL_DEFAULT_S);
    expect(parseExpiryToSeconds('')).toBe(ACCESS_TOKEN_TTL_DEFAULT_S);
  });

  it('decimals / negatives / garbage → null (unparseable — the review #3/#5 gap)', () => {
    expect(parseExpiryToSeconds('3600.5')).toBeNull(); // would be 3.6s under ms-parsing
    expect(parseExpiryToSeconds('-1')).toBeNull();
    expect(parseExpiryToSeconds('1e10')).toBeNull();
    expect(parseExpiryToSeconds('+3600')).toBeNull();
    expect(parseExpiryToSeconds('7 days')).toBeNull(); // only single-letter units supported
    expect(parseExpiryToSeconds('abc')).toBeNull();
  });
});

describe('resolveAccessTokenTtlSeconds (bounded, fail-safe)', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  afterEach(() => warn.mockClear());

  it('valid in-range values pass through', () => {
    expect(resolveAccessTokenTtlSeconds('3600')).toBe(3600);
    expect(resolveAccessTokenTtlSeconds('1h')).toBe(3600);
    expect(resolveAccessTokenTtlSeconds('7d')).toBe(604800);
  });

  it('review #4: a huge fat-finger value clamps DOWN to MAX (no ~19-year token)', () => {
    // 604800000 ("ms" by habit) as seconds ≈ 19 years — must clamp to the 7d cap.
    expect(resolveAccessTokenTtlSeconds('604800000')).toBe(ACCESS_TOKEN_TTL_MAX_S);
    expect(resolveAccessTokenTtlSeconds('30d')).toBe(ACCESS_TOKEN_TTL_MAX_S); // > 7d cap
    expect(warn).toHaveBeenCalled();
  });

  it('review #5: near-instant / zero clamps UP to MIN', () => {
    expect(resolveAccessTokenTtlSeconds('0')).toBe(ACCESS_TOKEN_TTL_MIN_S);
    expect(resolveAccessTokenTtlSeconds('5')).toBe(ACCESS_TOKEN_TTL_MIN_S);
    expect(warn).toHaveBeenCalled();
  });

  it('review #3: unparseable (decimal/garbage) fails SAFE to the 7d default', () => {
    expect(resolveAccessTokenTtlSeconds('3600.5')).toBe(ACCESS_TOKEN_TTL_DEFAULT_S);
    expect(resolveAccessTokenTtlSeconds('nonsense')).toBe(ACCESS_TOKEN_TTL_DEFAULT_S);
    expect(warn).toHaveBeenCalled();
  });

  it('the resolved TTL never exceeds the revocation-marker TTL (closes review #2)', () => {
    for (const v of ['3600', '7d', '30d', '604800000', '9999999999', '1e10', '-5', '0']) {
      expect(resolveAccessTokenTtlSeconds(v)).toBeLessThanOrEqual(ACCESS_TOKEN_TTL_MAX_S);
      expect(resolveAccessTokenTtlSeconds(v)).toBeGreaterThanOrEqual(ACCESS_TOKEN_TTL_MIN_S);
    }
  });
});

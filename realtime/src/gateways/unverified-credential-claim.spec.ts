import {
  extractUnverifiedDeviceClaim,
  shouldEmitClaimTelemetry,
  takeClaimSuppressionNotice,
  resetClaimTelemetryState,
  claimTelemetryTrackedCount,
  CLAIM_TELEMETRY_WINDOW_MS,
  CLAIM_TELEMETRY_MAX_TRACKED,
  CLAIM_TELEMETRY_MAX_PER_WINDOW,
} from './unverified-credential-claim';

/**
 * Diagnostics-only claim extraction. The value handled here comes from a token
 * that FAILED verification, so every test below is a negative control on one of
 * two properties: it can never throw (it runs on the auth path), and it can never
 * put anything into a log line whose shape an attacker chose.
 */
describe('extractUnverifiedDeviceClaim', () => {
  const b64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const tokenWith = (payload: unknown) =>
    `eyJhbGciOiJIUzI1NiJ9.${b64url(payload)}.not-a-real-signature`;

  it('returns the sub of an unverifiable token', () => {
    expect(
      extractUnverifiedDeviceClaim(tokenWith({ sub: 'display-1', type: 'device' })),
    ).toBe('display-1');
  });

  it('does not require the signature to be valid, or present at all', () => {
    const token = `eyJhbGciOiJIUzI1NiJ9.${b64url({ sub: 'display-2' })}.`;
    expect(extractUnverifiedDeviceClaim(token)).toBe('display-2');
  });

  // ---- never throws, for anything ----

  const adversarial: Array<[string, string | undefined]> = [
    ['undefined', undefined],
    ['empty string', ''],
    ['single char', 'a'],
    ['two segments', 'a.b'],
    ['four segments', 'a.b.c.d'],
    ['empty payload segment', 'a..c'],
    ['non-base64 payload', 'a.!!!!!!.c'],
    [
      'valid base64, not JSON',
      `a.${Buffer.from('not json at all').toString('base64url')}.c`,
    ],
    ['JSON array payload', `a.${b64url([1, 2, 3])}.c`],
    ['JSON null payload', `a.${b64url(null)}.c`],
    ['JSON string payload', `a.${b64url('display-1')}.c`],
    ['JSON number payload', `a.${b64url(42)}.c`],
    ['payload with no sub', `a.${b64url({ type: 'device' })}.c`],
    ['sub is a number', `a.${b64url({ sub: 12345 })}.c`],
    ['sub is an object', `a.${b64url({ sub: { id: 'x' } })}.c`],
    ['sub is null', `a.${b64url({ sub: null })}.c`],
    ['sub is empty string', `a.${b64url({ sub: '' })}.c`],
    ['sub is only disallowed chars', `a.${b64url({ sub: '<<<>>> \n\t' })}.c`],
    ['huge input', `a.${'A'.repeat(200000)}.c`],
    [
      'deeply nested payload',
      `a.${b64url(JSON.parse('['.repeat(400) + ']'.repeat(400)))}.c`,
    ],
    ['whitespace only', '   '],
    ['dots only', '..'],
  ];

  it.each(adversarial)('never throws and returns null for %s', (_label, input) => {
    let result: string | null = 'unset';
    expect(() => {
      result = extractUnverifiedDeviceClaim(input);
    }).not.toThrow();
    expect(result).toBeNull();
  });

  // ---- log-injection defence ----

  it('strips CR/LF so a forged second log line is impossible', () => {
    const forged =
      'display-1\r\nunverified_credential_claim deviceClaim=admin reason=AUTH_INVALID';
    const claim = extractUnverifiedDeviceClaim(tokenWith({ sub: forged }));
    expect(claim).not.toBeNull();
    expect(claim).not.toContain('\n');
    expect(claim).not.toContain('\r');
    expect(claim).not.toContain(' ');
    expect(claim as string).toMatch(/^display-1unverified_credential_claim/);
    expect(claim as string).toMatch(/^[A-Za-z0-9_.:-]+$/);
  });

  it.each([
    ['line feed', 'a\nb'],
    ['carriage return', 'a\rb'],
    ['tab', 'a\tb'],
    ['NUL', 'a\u0000b'],
    ['escape', 'a\u001bb'],
    ['space', 'a b'],
    ['ANSI colour sequence', 'a\u001b[31mb'],
    ['unicode line separator', 'a\u2028b'],
    ['backspace', 'a\u0008b'],
  ])('sanitises %s out of the claim', (_label, sub) => {
    const claim = extractUnverifiedDeviceClaim(tokenWith({ sub }));
    expect(claim).not.toBeNull();
    expect(claim as string).toMatch(/^[A-Za-z0-9_.:-]+$/);
  });

  it('truncates to 64 characters', () => {
    const claim = extractUnverifiedDeviceClaim(tokenWith({ sub: 'x'.repeat(500) }));
    expect(claim).toHaveLength(64);
  });

  it('keeps the characters a real display id uses', () => {
    const claim = extractUnverifiedDeviceClaim(tokenWith({ sub: 'cm3a_bc-12.34:56' }));
    expect(claim).toBe('cm3a_bc-12.34:56');
  });
});

describe('shouldEmitClaimTelemetry', () => {
  const T0 = 1_700_000_000_000;

  beforeEach(() => resetClaimTelemetryState());
  afterEach(() => resetClaimTelemetryState());

  it('emits the first sighting of a claim', () => {
    expect(shouldEmitClaimTelemetry('display-1', T0)).toBe(true);
  });

  it('deduplicates the same claim inside the window', () => {
    expect(shouldEmitClaimTelemetry('display-1', T0)).toBe(true);
    expect(shouldEmitClaimTelemetry('display-1', T0 + 1)).toBe(false);
    expect(
      shouldEmitClaimTelemetry('display-1', T0 + CLAIM_TELEMETRY_WINDOW_MS - 1),
    ).toBe(false);
  });

  it('emits the same claim again in a later window', () => {
    expect(shouldEmitClaimTelemetry('display-1', T0)).toBe(true);
    expect(shouldEmitClaimTelemetry('display-1', T0 + CLAIM_TELEMETRY_WINDOW_MS)).toBe(
      true,
    );
  });

  it('stops emitting past the global per-window ceiling, whatever the claim', () => {
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW; i++) {
      expect(shouldEmitClaimTelemetry(`display-${i}`, T0 + i)).toBe(true);
    }
    for (let i = 0; i < 500; i++) {
      expect(shouldEmitClaimTelemetry(`flood-${i}`, T0 + 100 + i)).toBe(false);
    }
  });

  it('reopens the budget in the next window', () => {
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW; i++) {
      shouldEmitClaimTelemetry(`display-${i}`, T0);
    }
    expect(shouldEmitClaimTelemetry('display-new', T0)).toBe(false);
    expect(shouldEmitClaimTelemetry('display-new', T0 + CLAIM_TELEMETRY_WINDOW_MS)).toBe(
      true,
    );
  });

  it('a deduplicated repeat does not consume the global budget', () => {
    for (let i = 0; i < 50; i++) {
      shouldEmitClaimTelemetry('display-1', T0 + i);
    }
    // One emission spent; the remaining budget must be intact.
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW - 1; i++) {
      expect(shouldEmitClaimTelemetry(`other-${i}`, T0 + 100 + i)).toBe(true);
    }
    expect(shouldEmitClaimTelemetry('one-too-many', T0 + 999)).toBe(false);
  });

  it('never grows the tracking map past the cap under 5000 distinct claims', () => {
    // Advance a full window per claim so every one is genuinely emitted and
    // recorded — otherwise the global ceiling would cap the map at 20 and the
    // eviction path would never run.
    for (let i = 0; i < 5000; i++) {
      expect(
        shouldEmitClaimTelemetry(`claim-${i}`, T0 + i * CLAIM_TELEMETRY_WINDOW_MS),
      ).toBe(true);
      expect(claimTelemetryTrackedCount()).toBeLessThanOrEqual(
        CLAIM_TELEMETRY_MAX_TRACKED,
      );
    }
    expect(claimTelemetryTrackedCount()).toBe(CLAIM_TELEMETRY_MAX_TRACKED);
  });

  it('rejects an empty claim', () => {
    expect(shouldEmitClaimTelemetry('', T0)).toBe(false);
  });
});

describe('takeClaimSuppressionNotice', () => {
  const T0 = 1_700_000_000_000;

  beforeEach(() => resetClaimTelemetryState());
  afterEach(() => resetClaimTelemetryState());

  it('is false while nothing has been suppressed by the ceiling', () => {
    shouldEmitClaimTelemetry('display-1', T0);
    expect(takeClaimSuppressionNotice(T0)).toBe(false);
  });

  it('is false for a plain deduplicated repeat', () => {
    shouldEmitClaimTelemetry('display-1', T0);
    expect(shouldEmitClaimTelemetry('display-1', T0 + 1)).toBe(false);
    expect(takeClaimSuppressionNotice(T0 + 1)).toBe(false);
  });

  it('fires exactly once per window once the ceiling suppresses', () => {
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW + 5; i++) {
      shouldEmitClaimTelemetry(`display-${i}`, T0);
    }
    expect(takeClaimSuppressionNotice(T0)).toBe(true);
    expect(takeClaimSuppressionNotice(T0)).toBe(false);
    expect(takeClaimSuppressionNotice(T0 + 1000)).toBe(false);
  });

  it('re-arms in the next window only if the ceiling is hit again', () => {
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW + 1; i++) {
      shouldEmitClaimTelemetry(`display-${i}`, T0);
    }
    expect(takeClaimSuppressionNotice(T0)).toBe(true);
    const next = T0 + CLAIM_TELEMETRY_WINDOW_MS;
    expect(takeClaimSuppressionNotice(next)).toBe(false);
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW + 1; i++) {
      shouldEmitClaimTelemetry(`next-${i}`, next);
    }
    expect(takeClaimSuppressionNotice(next)).toBe(true);
  });
});

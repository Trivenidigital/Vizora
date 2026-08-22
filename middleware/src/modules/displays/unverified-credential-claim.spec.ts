import { isIP } from 'net';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractUnverifiedDeviceClaim,
  sanitiseUnverifiedPeer,
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


  // The table above cannot discriminate these: its 2- and 4-segment rows carry a
  // single-character payload segment that fails JSON.parse either way, so they return
  // null for the wrong reason and a `!== 3` → `< 2` mutation survives them.

  it('rejects a 2-segment token whose payload segment WOULD decode', () => {
    const payload = b64url({ sub: 'display-real-1' });
    expect(extractUnverifiedDeviceClaim(`eyJhbGciOiJIUzI1NiJ9.${payload}`)).toBeNull();
    // Non-vacuous: the same payload in a 3-segment token does decode.
    expect(extractUnverifiedDeviceClaim(`eyJhbGciOiJIUzI1NiJ9.${payload}.sig`)).toBe(
      'display-real-1',
    );
  });

  it('rejects a 4-segment token whose second segment WOULD decode', () => {
    // A JWE has five segments and a valid-looking second one; nothing here should
    // treat a non-JWS shape as though position 1 were a JWS payload.
    const payload = b64url({ sub: 'display-real-1' });
    expect(
      extractUnverifiedDeviceClaim(`eyJhbGciOiJIUzI1NiJ9.${payload}.sig.extra`),
    ).toBeNull();
  });

  it('rejects an over-long token whose payload WOULD decode', () => {
    // Pads a real payload past MAX_TOKEN_LENGTH with a huge signature segment, so the
    // only reason to reject is the length cap — the 200k-`A`s row above would fail
    // JSON.parse anyway and leaves the cap unproven.
    const payload = b64url({ sub: 'display-real-1' });
    const short = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
    expect(extractUnverifiedDeviceClaim(short)).toBe('display-real-1');
    const long = `eyJhbGciOiJIUzI1NiJ9.${payload}.${'A'.repeat(9000)}`;
    expect(long.length).toBeGreaterThan(8192);
    expect(extractUnverifiedDeviceClaim(long)).toBeNull();
  });

  // `device.gateway.ts` CASTS an attacker-controlled handshake value
  // (`socket.handshake.auth?.token as string | undefined`), so a non-string reaches
  // this function in production despite the signature. The typed table above cannot
  // express these.
  const throwingToString = {
    toString() {
      throw new Error('nope');
    },
  };
  it.each([
    ['a number', 42],
    ['zero', 0],
    ['a boolean', true],
    ['null', null],
    ['a plain object', { sub: 'display-real-1' }],
    ['an array', ['a.b.c']],
    ['an array of three parts', ['a', 'b', 'c']],
    ['a function', () => 'a.b.c'],
    ['a Symbol', Symbol('a.b.c')],
    ['a BigInt', BigInt(10)],
    ['an object whose toString throws', throwingToString],
    ['a Date', new Date()],
  ])('never throws and returns null for %s (reachable via the gateway cast)', (_l, input) => {
    let out: string | null = 'unset';
    expect(() => {
      out = extractUnverifiedDeviceClaim(input as unknown as string);
    }).not.toThrow();
    expect(out).toBeNull();
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
    expect(claim as string).toMatch(/^[A-Za-z0-9_:-]+$/);
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
    expect(claim as string).toMatch(/^[A-Za-z0-9_:-]+$/);
  });

  it('truncates to 64 characters', () => {
    const claim = extractUnverifiedDeviceClaim(tokenWith({ sub: 'x'.repeat(500) }));
    expect(claim).toHaveLength(64);
  });

  it('keeps the characters a real display id uses', () => {
    // cuids/UUIDs: letters, digits, `_`, `-`. No dots — see the next test.
    const claim = extractUnverifiedDeviceClaim(
      tokenWith({ sub: 'cm3a_bc-1234-5678-90ab' }),
    );
    expect(claim).toBe('cm3a_bc-1234-5678-90ab');
  });

  it('strips dots so a claim can never render JWT-shaped', () => {
    // A dotted value reads as a token in a log stream: it trips secret scanners and
    // teaches operators to skim past JWT-shaped strings. Device ids have no dots.
    // Built at runtime, never written as a literal: a hardcoded JWT-shaped string
    // trips `pnpm security:no-hardcoded-jwts`, which is the same instinct this test
    // exists to protect (a JWT-shaped value in a log stream is a false positive
    // waiting to happen). Generating it keeps the gate honest and the test faithful.
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const jwtShaped = `${b64({ alg: 'HS256' })}.${b64({ sub: 'a' })}.SflKxwRJSMeKKF2QT4`;
    const claim = extractUnverifiedDeviceClaim(tokenWith({ sub: jwtShaped }));
    expect(claim).not.toBeNull();
    expect(claim).not.toContain('.');
    expect(claim as string).toMatch(/^[A-Za-z0-9_:-]+$/);
    expect(claim as string).not.toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('strips dots from an IP-shaped claim too — the claim charset is not the peer one', () => {
    expect(extractUnverifiedDeviceClaim(tokenWith({ sub: '10.0.0.7' }))).toBe('10007');
  });
});

describe('sanitiseUnverifiedPeer', () => {
  it('accepts a real IPv4 and a real IPv6, including the IPv4-mapped form', () => {
    expect(sanitiseUnverifiedPeer('10.0.0.7')).toBe('10.0.0.7');
    expect(sanitiseUnverifiedPeer('2001:db8::1')).toBe('2001:db8::1');
    expect(sanitiseUnverifiedPeer('::ffff:127.0.0.1')).toBe('::ffff:127.0.0.1');
  });

  it('keeps an IPv6 zone id rather than silently mangling it', () => {
    // A charset strip turned `fe80::1%eth0` into `fe80::1eth0` — a different, wrong
    // address presented as fact.
    expect(sanitiseUnverifiedPeer('fe80::1ff:fe23:4567:890a%eth0')).toBe(
      'fe80::1ff:fe23:4567:890a%eth0',
    );
    expect(sanitiseUnverifiedPeer('fe80::1%bad zone')).toBeNull();
    expect(sanitiseUnverifiedPeer('fe80::1%a%b')).toBeNull();
  });

  it('takes the LAST element of a joined header, never fabricating one', () => {
    // Node joins repeated same-name headers with `, ` (only set-cookie arrays), so a
    // duplicated X-Real-IP arrives as one string. A strip rendered it as the
    // fabricated address `1.1.1.12.2.2.2`.
    expect(sanitiseUnverifiedPeer('1.1.1.1, 2.2.2.2')).toBe('2.2.2.2');
    expect(sanitiseUnverifiedPeer('1.1.1.1,2.2.2.2')).toBe('2.2.2.2');
  });

  it('rejects a JWT-shaped value instead of rendering it', () => {
    // Keeping `.` for IPv4 would otherwise reopen on this field exactly the
    // JWT-rendering the claim alphabet removes.
    expect(
      sanitiseUnverifiedPeer('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.SflKxwRJSMeKKF2QT4'),
    ).toBeNull();
  });

  it('rejects anything that is not an address, rather than laundering it', () => {
    expect(sanitiseUnverifiedPeer('1.2.3.4 attribution=verified')).toBeNull();
    expect(sanitiseUnverifiedPeer('not-an-ip')).toBeNull();
    expect(sanitiseUnverifiedPeer('999.999.999.999')).toBeNull();
    expect(sanitiseUnverifiedPeer('1.2.3.4/24')).toBeNull();
    expect(sanitiseUnverifiedPeer('example.com')).toBeNull();
    expect(sanitiseUnverifiedPeer('9'.repeat(4000))).toBeNull();
  });

  it('cannot emit a space, an `=`, or a newline whatever it is given', () => {
    const hostile = [
      '1.2.3.4 claimedDeviceId=victim',
      '1.2.3.4\r\nhandshake_reject device=victim',
      '1.2.3.4=x',
      '1.2.3.4, 5.6.7.8 attribution=verified',
    ];
    for (const input of hostile) {
      const out = sanitiseUnverifiedPeer(input);
      if (out === null) continue;
      expect(out).not.toMatch(/[\s=]/);
      expect(isIP(out.split('%')[0])).not.toBe(0);
    }
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['only disallowed chars', '<<< >>>'],
    ['a lone comma', ','],
    ['a number', 42],
    ['an object', { ip: '1.2.3.4' }],
  ])('returns null and never throws for %s', (_label, input) => {
    let out: string | null = 'unset';
    expect(() => {
      out = sanitiseUnverifiedPeer(input as string | undefined);
    }).not.toThrow();
    expect(out).toBeNull();
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


  it('evicts the OLDEST tracked claim, never the one just recorded', () => {
    // The count alone does not pin eviction ORDER: dropping the newest keeps the map
    // at exactly the cap too. What it breaks is dedupe for the claim that was just
    // recorded — so fill to the cap, then prove a repeat inside one window is still
    // deduplicated. Under newest-first eviction the probe evicts itself and repeats.
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_TRACKED; i++) {
      expect(
        shouldEmitClaimTelemetry(`fill-${i}`, T0 + i * CLAIM_TELEMETRY_WINDOW_MS),
      ).toBe(true);
    }
    expect(claimTelemetryTrackedCount()).toBe(CLAIM_TELEMETRY_MAX_TRACKED);

    // A fresh window so the ceiling is clear; the map is full, so recording the probe
    // must evict something.
    const now = T0 + CLAIM_TELEMETRY_MAX_TRACKED * CLAIM_TELEMETRY_WINDOW_MS;
    expect(shouldEmitClaimTelemetry('probe', now)).toBe(true);
    expect(claimTelemetryTrackedCount()).toBe(CLAIM_TELEMETRY_MAX_TRACKED);
    expect(shouldEmitClaimTelemetry('probe', now + 1)).toBe(false);
    expect(shouldEmitClaimTelemetry('probe', now + 2)).toBe(false);
  });

  it('rejects an empty claim', () => {
    expect(shouldEmitClaimTelemetry('', T0)).toBe(false);
  });
});

describe('takeClaimSuppressionNotice', () => {
  const T0 = 1_700_000_000_000;

  beforeEach(() => resetClaimTelemetryState());
  afterEach(() => resetClaimTelemetryState());

  /** Spend the window's whole budget so the next claim is suppressed. */
  const exhaustBudget = (now: number) => {
    for (let i = 0; i < CLAIM_TELEMETRY_MAX_PER_WINDOW; i++) {
      expect(shouldEmitClaimTelemetry(`budget-${i}`, now)).toBe(true);
    }
  };

  it('is null while nothing has been suppressed by the ceiling', () => {
    shouldEmitClaimTelemetry('display-1', T0);
    expect(takeClaimSuppressionNotice(T0)).toBeNull();
  });

  it('is null for a plain deduplicated repeat', () => {
    shouldEmitClaimTelemetry('display-1', T0);
    expect(shouldEmitClaimTelemetry('display-1', T0 + 1)).toBe(false);
    expect(takeClaimSuppressionNotice(T0 + 1)).toBeNull();
  });

  it('reports the running count at escalating thresholds, and nothing between them', () => {
    // A bare "suppression occurred" cannot separate two claims lost to incidental
    // budget exhaustion from fifty thousand lost to a flood, and that distinction is
    // the entire reason the over-budget residual is tolerable.
    exhaustBudget(T0);
    const notices: number[] = [];
    for (let i = 0; i < 1000; i++) {
      expect(shouldEmitClaimTelemetry(`flood-${i}`, T0)).toBe(false);
      const notice = takeClaimSuppressionNotice(T0);
      if (notice !== null) notices.push(notice);
    }
    expect(notices).toEqual([1, 10, 100, 1000]);
  });

  it('is bounded to five notices per window however large the flood', () => {
    exhaustBudget(T0);
    let count = 0;
    for (let i = 0; i < 20000; i++) {
      shouldEmitClaimTelemetry(`flood-${i}`, T0);
      if (takeClaimSuppressionNotice(T0) !== null) count += 1;
    }
    expect(count).toBe(5);
  });

  it('re-arms in the next window, and only if suppression happens again', () => {
    exhaustBudget(T0);
    shouldEmitClaimTelemetry('over', T0);
    expect(takeClaimSuppressionNotice(T0)).toBe(1);

    const next = T0 + CLAIM_TELEMETRY_WINDOW_MS;
    expect(takeClaimSuppressionNotice(next)).toBeNull(); // fresh window, nothing lost yet
    exhaustBudget(next);
    shouldEmitClaimTelemetry('over-again', next);
    expect(takeClaimSuppressionNotice(next)).toBe(1);
  });

  it('counts only what the ceiling actually dropped', () => {
    exhaustBudget(T0);
    shouldEmitClaimTelemetry('over-1', T0);
    shouldEmitClaimTelemetry('over-2', T0);
    // Two suppressed, so the first threshold has been crossed once — the notice
    // reports the running total, not one per drop.
    expect(takeClaimSuppressionNotice(T0)).toBe(2);
    expect(takeClaimSuppressionNotice(T0)).toBeNull();
  });
});

describe('the two package copies of this module', () => {
  // The docblock says "keep them in sync by hand" and nothing enforced it. A silent
  // divergence would leave two green suites and one weaker log path, which is exactly
  // the failure this repo already guards against elsewhere with source scans (see
  // middleware/src/modules/common/services/cluster-cron-policy.spec.ts).
  const REALTIME_REL = ['realtime', 'src', 'gateways', 'unverified-credential-claim.ts'];
  const MIDDLEWARE_REL = [
    'middleware', 'src', 'modules', 'displays', 'unverified-credential-claim.ts',
  ];

  const repoRoot = (): string => {
    let dir = __dirname;
    for (let i = 0; i < 12; i++) {
      if (
        fs.existsSync(path.join(dir, ...REALTIME_REL)) &&
        fs.existsSync(path.join(dir, ...MIDDLEWARE_REL))
      ) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    throw new Error(`could not locate the repo root from ${__dirname}`);
  };

  /** Everything after the leading docblock, which legitimately differs per package. */
  const body = (file: string): string => {
    const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    expect(source.startsWith('/**')).toBe(true);
    const end = source.indexOf('*/');
    expect(end).toBeGreaterThan(0);
    return source.slice(end + 2).trim();
  };

  it('are byte-identical below the header docblock', () => {
    const root = repoRoot();
    const realtime = body(path.join(root, ...REALTIME_REL));
    const middleware = body(path.join(root, ...MIDDLEWARE_REL));
    // Non-vacuous: both bodies are real code, not empty strings.
    expect(realtime).toContain('export function extractUnverifiedDeviceClaim');
    expect(realtime.length).toBeGreaterThan(2000);
    expect(middleware).toBe(realtime);
  });
});

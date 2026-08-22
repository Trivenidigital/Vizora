/**
 * Credential generation / handoff state machine.
 *
 * The server rotates a device's 90-day JWT within 14 days of expiry, but it can only
 * ever store a HASH of that credential and it pushes the replacement fire-and-forget —
 * there is no delivery or persistence acknowledgement. So at any moment the generation
 * the DB considers authoritative may NOT be the one the device physically holds. The
 * single Redis grace record is the only bridge across that gap.
 *
 * The defect this suite exists to prevent: `grace.prev` used to be written from the
 * socket's AUTHORITATIVE hash. After a failed handoff the device reconnects on its old
 * credential through the bridge, and a subsequent rotation then overwrote `prev` with a
 * generation the device had never installed — leaving the device matching neither the
 * stored hash nor the bridge. Its next handshake returned DEVICE_REVOKED and `auth/check`
 * returned 410, which makes the player purge its pairing state. Two lost deliveries
 * silently unpaired a healthy screen.
 *
 * The rule under test: bridge from the credential the connection actually AUTHENTICATED
 * with. Retiring the bridge on a normal handshake was designed, reviewed and REJECTED:
 * presenting a credential proves volatile possession, not durable possession, and the
 * Electron player adopts a rotated token into memory before persisting it and swallows a
 * persist failure — so retirement would have converted a survivable failed write into a
 * permanent unpair. See the PR for the full argument.
 *
 * These tests drive the real handshake and the real rotation path against an in-memory
 * DB/Redis so the hashes, grace records and verdicts are the production ones.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DeviceGateway } from './device.gateway';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';
import { NotificationService } from '../services/notification.service';
import { MetricsService } from '../metrics/metrics.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { authenticateDeviceHandshake } from './device-handshake-auth';
import { hashDeviceToken, deviceTokenGraceKey } from './device-token-hash';
import { WsDeviceGuard } from './guards/ws-auth.guard';

describe('credential handoff state machine', () => {
  const DEVICE = 'device-1';
  const ORG = 'org-1';
  const T1 = 'tok-1', T2 = 'tok-2', T3 = 'tok-3', T4 = 'tok-4';
  const h = hashDeviceToken;
  const GRACE_KEY = deviceTokenGraceKey(DEVICE);
  const COOLDOWN_KEY = `device:token:refresh-cooldown:${DEVICE}`;

  const NOW = () => Math.floor(Date.now() / 1000);
  /** Short synthetic lifetimes keep the expiry tests deterministic. */
  const NEAR = () => NOW() + 3600;            // 1h of life left — well above the 60s TTL floor,
                                              // so a floor-derived TTL cannot satisfy the bound below
  const NEARER = () => NOW() + 10 * 86400;    // inside the window, far more life than NEAR

  let gateway: DeviceGateway;
  let store: { jwtToken: string | null; isDisabled: boolean; organizationId: string; missing: boolean };
  let kv: Map<string, string>;
  let graceTtls: number[];
  let redis: any;
  let db: any;
  let expiredTokens: Set<string>;
  let tokenExp: Map<string, number>;
  let mintedPayloads: any[];
  let socketSeq: number;
  let redisFailures: { get?: boolean; set?: boolean; del?: boolean };
  let dbFailures: { find?: boolean; rotate?: boolean };

  beforeEach(async () => {
    process.env.DEVICE_JWT_SECRET = 'd'.repeat(48);
    store = { jwtToken: h(T1), isDisabled: false, organizationId: ORG, missing: false };
    kv = new Map();
    graceTtls = [];
    expiredTokens = new Set();
    tokenExp = new Map();
    mintedPayloads = [];
    socketSeq = 1;
    redisFailures = {};
    dbFailures = {};

    redis = {
      setNx: jest.fn(async (k: string) => (kv.has(k) ? false : (kv.set(k, '1'), true))),
      set: jest.fn(async (k: string, v: string, ttl?: number) => {
        if (redisFailures.set) throw new Error('redis set failed');
        if (k === GRACE_KEY) graceTtls.push(ttl as number);
        kv.set(k, v);
      }),
      get: jest.fn(async (k: string) => {
        if (redisFailures.get) throw new Error('redis get failed');
        return kv.get(k) ?? null;
      }),
      delete: jest.fn(async (k: string) => {
        if (redisFailures.del) throw new Error('redis del failed');
        kv.delete(k);
      }),
      exists: jest.fn(async () => false),
      setDeviceStatus: jest.fn(),
    };

    db = {
      display: {
        findUnique: jest.fn(async () => {
          if (dbFailures.find) throw new Error('db find failed');
          if (store.missing) return null;
          return {
            organizationId: store.organizationId,
            isDisabled: store.isDisabled,
            jwtToken: store.jwtToken,
            organization: { subscriptionStatus: 'active' },
          };
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (dbFailures.rotate) throw new Error('db rotate failed');
          if (where.jwtToken && where.jwtToken !== store.jwtToken) return { count: 0 };
          store.jwtToken = data.jwtToken;
          return { count: 1 };
        }),
      },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceGateway,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn((payload: any) => { mintedPayloads.push(payload); return nextMint; }),
            verify: jest.fn((token: string) => {
              if (expiredTokens.has(token)) {
                const e: any = new Error('jwt expired');
                e.name = 'TokenExpiredError';
                throw e;
              }
              return {
                sub: DEVICE, type: 'device', organizationId: ORG, deviceIdentifier: 'i',
                exp: tokenExp.get(token) ?? NEARER(),
              };
            }),
          },
        },
        { provide: RedisService, useValue: redis },
        { provide: HeartbeatService, useValue: { processHeartbeat: jest.fn(), forgetDevice: jest.fn() } },
        { provide: PlaylistService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        { provide: MetricsService, useValue: { recordHeartbeat: jest.fn(), updateDeviceMetrics: jest.fn() } },
        { provide: DatabaseService, useValue: db },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    gateway = mod.get(DeviceGateway);
    (gateway as any).server = { emit: jest.fn(), sockets: { sockets: new Map() } };
  });

  afterEach(() => ((gateway as any).cleanupIntervals || []).forEach(clearInterval));

  // ── harness ────────────────────────────────────────────────────────────────────
  // Everything below drives the PRODUCTION construction path. Earlier revisions of this
  // suite hand-built `client.data` from the handshake result, which meant the two
  // statements that actually carry the presented credential onto the socket
  // (the handshake middleware, and authenticateConnection) were never executed —
  // deleting either left the whole suite green while production reverted to the bug.
  // `runDeviceHandshake` is the middleware body registered in afterInit.
  let nextMint = 'unset';

  const rawSocket = (id: string, token: string) => ({
    id,
    handshake: { auth: { token }, address: '127.0.0.1' },
    data: {} as Record<string, any>,
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
  });

  /** Full real path: handshake middleware -> authenticateConnection. */
  const connect = async (token: string, exp: number, id = `socket-${socketSeq++}`) => {
    tokenExp.set(token, exp);
    const socket = rawSocket(id, token);
    let rejected: any = null;
    await (gateway as any).runDeviceHandshake(socket, (err?: Error) => { rejected = err ?? null; });
    if (rejected) {
      return { rejected: { code: (rejected as any).data?.code, message: rejected.message }, socket: null as any };
    }
    const auth = await (gateway as any).authenticateConnection(socket);
    return { rejected: null, socket, auth, accepted: socket.data };
  };

  /** Handshake only — for verdict assertions that must not mutate socket registration. */
  const handshake = (token: string, exp: number) => {
    tokenExp.set(token, exp);
    return authenticateDeviceHandshake(token, {
      jwtService: (gateway as any).jwtService,
      databaseService: db,
      deviceSecret: 'd'.repeat(48),
      userSecret: 'u'.repeat(48),
      redis,
    });
  };

  const rotate = async (socket: any, next: string) => {
    nextMint = next;
    kv.delete(COOLDOWN_KEY);
    delete socket.data.tokenRefreshIssued;
    await (gateway as any).maybeRefreshDeviceToken(socket);
  };

  const grace = () => {
    const raw = kv.get(GRACE_KEY);
    return raw ? JSON.parse(raw) : null;
  };
  const received = (socket: any, token: string) =>
    socket.emit.mock.calls.some((c: any[]) => c[0] === 'token:refresh' && c[1]?.token === token);

  // ── legitimate paths ───────────────────────────────────────────────────────────
  describe('legitimate handoff paths', () => {
    it('T1 -> T2 successful handoff: device installs T2 and reconnects normally', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);

      expect(store.jwtToken).toBe(h(T2));
      expect(grace()).toEqual({ prev: h(T1), next: h(T2) });
      expect(received(a.socket, T2)).toBe(true);

      const b = await connect(T2, NEARER());
      expect(b.accepted.authenticatedViaGrace).toBe(false);
      expect(b.accepted.deviceTokenHash).toBe(h(T2));
    });

    it('failed handoff: the device recovers on T1 through the bridge', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);                    // T2 never installed

      const b = await connect(T1, e);
      expect(b.rejected).toBeNull();
      expect(b.accepted.authenticatedViaGrace).toBe(true);
      expect(b.accepted.deviceTokenHash).toBe(h(T2));            // authority is still T2
      expect(b.accepted.presentedDeviceTokenHash).toBe(h(T1));   // proof is T1
    });

    it('TWO consecutive failed handoffs no longer unpair the device', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);                    // handoff 1 lost
      const b = await connect(T1, e);
      await rotate(b.socket, T3);                    // handoff 2 lost

      expect(store.jwtToken).toBe(h(T3));
      expect(grace()).toEqual({ prev: h(T1), next: h(T3) });   // bridge still points at T1

      const c = await connect(T1, e);
      expect(c.rejected).toBeNull();                 // the regression this suite exists for
      expect(c.accepted.deviceTokenHash).toBe(h(T3));
    });

    it('failed then successful handoff: the anchor advances, no stale T1 remains', async () => {
      const e1 = NEAR();
      const a = await connect(T1, e1);
      await rotate(a.socket, T2);                    // lost
      const b = await connect(T1, e1);
      await rotate(b.socket, T3);                    // delivered this time

      const e3 = NEARER();
      const c = await connect(T3, e3);               // device now holds T3
      expect(c.accepted.authenticatedViaGrace).toBe(false);   // anchor advanced

      // At this point presented == authoritative == T3, so this alone does not
      // discriminate the rule; it pins that the anchor ADVANCED rather than staying
      // pinned to T1. The discriminating case is the two-failed-handoffs test above.
      await rotate(c.socket, T4);
      expect(grace()).toEqual({ prev: h(T3), next: h(T4) });
    });

    it('a later T3 -> T4 failed handoff still leaves T3 recoverable', async () => {
      const e3 = NEARER();
      store.jwtToken = h(T3);
      const c = await connect(T3, e3);
      await rotate(c.socket, T4);                    // T4 lost

      const d = await connect(T3, e3);
      expect(d.rejected).toBeNull();
      expect(d.accepted.deviceTokenHash).toBe(h(T4));
    });


  });

  // ── adversarial coexistence ────────────────────────────────────────────────────
  describe('adversarial coexistence: superseded credential replayed', () => {
    /** T1 -> T2 handoff SUCCEEDS; A durably holds T2 but is offline; B replays T1. */
    const coexist = async (exp: number) => {
      const a = await connect(T1, exp);
      await rotate(a.socket, T2);
      expect(grace()).toEqual({ prev: h(T1), next: h(T2) });
      return a;
    };

    // NOTE: being online does NOT protect the legitimate device — B's connect
    // dedup-disconnects A before rotating (authenticateConnection), so the attacker
    // creates the precondition. Recorded explicitly rather than left implied.
    it('a replay-driven rotation preserves the replayed credential and cuts off the newer one (accepted trade-off)', async () => {
      const e = NEARER();
      await coexist(e);
      const b = await connect(T1, e);                // attacker replays T1
      await rotate(b.socket, T3);

      expect(grace()).toEqual({ prev: h(T1), next: h(T3) });
      expect((await handshake(T1, e) as any).action).toBe('accept');
      expect((await handshake(T2, e) as any).code).toBe('DEVICE_REVOKED');
      // Documented consequence of pure bearer credentials: the server cannot tell a
      // legitimate T1 recovery from a T1 replay. Recorded, not silently accepted.
    });

    it('B obtains T3 — a capability that already exists today, unchanged by this rule', async () => {
      const e = NEARER();
      await coexist(e);
      const b = await connect(T1, e);
      await rotate(b.socket, T3);
      expect(received(b.socket, T3)).toBe(true);
    });

  });

  // ── authority changes ──────────────────────────────────────────────────────────
  describe('authority changes are evaluated before grace', () => {
    const setupBridge = async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      return e;
    };

    it('re-pair (stored authority moves) invalidates the bridge', async () => {
      const e = await setupBridge();
      store.jwtToken = h('repaired');
      expect((await handshake(T1, e) as any).code).toBe('DEVICE_REVOKED');
    });

    it('delete is rejected before grace', async () => {
      const e = await setupBridge();
      store.missing = true;
      expect((await handshake(T1, e) as any).code).toBe('DEVICE_REVOKED');
    });

    it('disable is rejected before grace', async () => {
      const e = await setupBridge();
      store.isDisabled = true;
      expect((await handshake(T1, e) as any).code).toBe('DEVICE_REVOKED');
    });

    it('org reassignment is rejected before grace', async () => {
      const e = await setupBridge();
      store.organizationId = 'org-2';
      expect((await handshake(T1, e) as any).code).toBe('DEVICE_REVOKED');
    });

    it('an unrelated hash matches nothing', async () => {
      const e = await setupBridge();
      expect((await handshake('never-issued', e) as any).code).toBe('DEVICE_REVOKED');
    });
  });

  // ── expiry boundaries ──────────────────────────────────────────────────────────
  describe('expiry boundaries', () => {
    it('the bridge TTL derives from the PRESENTED credential, not the newer one', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      graceTtls = [];
      const b = await connect(T1, e);                // grace-authenticated
      await rotate(b.socket, T3);

      // Must be T1's actual remaining life (~3600s), not the 60s floor and not the
      // newer credential's 10-day life. Both wrong sources are outside this band.
      const ttl = graceTtls[graceTtls.length - 1];
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it('just BEFORE its exp the bridged credential still authenticates', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      expect((await handshake(T1, e) as any).action).toBe('accept');
    });

    it('at/after its exp it is rejected AUTH_EXPIRED even with a perfect bridge', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      const b = await connect(T1, e);
      await rotate(b.socket, T3);
      expect(grace()).toEqual({ prev: h(T1), next: h(T3) });   // a perfect bridge exists

      expiredTokens.add(T1);
      redis.get.mockClear();
      expect(await handshake(T1, e)).toEqual({
        action: 'reject', message: 'auth_expired', code: 'AUTH_EXPIRED',
      });
      expect(redis.get).not.toHaveBeenCalled();      // grace was never even consulted
    });

    it('no number of later rotations can resurrect the expired credential', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      expiredTokens.add(T1);
      store.jwtToken = h(T3);
      kv.set(GRACE_KEY, JSON.stringify({ prev: h(T1), next: h(T3) }));
      expect((await handshake(T1, e) as any).code).toBe('AUTH_EXPIRED');
    });

    it('the newer authoritative credential remains valid far longer', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      expiredTokens.add(T1);
      expect((await handshake(T2, NEARER()) as any).action).toBe('accept');
    });
  });

  // ── infrastructure failures ────────────────────────────────────────────────────
  describe('infrastructure failures never strand or falsely revoke', () => {
    it('a Redis grace-lookup failure fails CLOSED at the socket (retried, not purged)', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      redisFailures.get = true;
      expect((await handshake(T1, e) as any).code).toBe('DEVICE_REVOKED');
      // auth/check has the OPPOSITE posture (5xx, never 410) — asserted middleware-side.
    });

    it('a failed grace WRITE aborts the rotation, leaving the device on its old credential', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      redisFailures.set = true;
      await rotate(a.socket, T2);

      expect(store.jwtToken).toBe(h(T1));            // authority never moved
      expect(received(a.socket, T2)).toBe(false);
      expect((await handshake(T1, e) as any).action).toBe('accept');
    });


    it('a DB rotation failure leaves authority and the bridge consistent', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      dbFailures.rotate = true;
      await rotate(a.socket, T2);

      expect(store.jwtToken).toBe(h(T1));
      // The title claims the BRIDGE stays consistent, so actually read it: an uncertain
      // commit must retain the record rather than assume the write did not land.
      expect(grace()).toEqual({ prev: h(T1), next: h(T2) });
      expect((await handshake(T1, e) as any).action).toBe('accept');
    });

    it('a DB lookup failure is transport-layer, never a terminal revocation code', async () => {
      dbFailures.find = true;
      const r: any = await handshake(T1, NEAR());
      expect(r.action).toBe('pass');                 // no DEVICE_REVOKED
      expect(r.code).toBeUndefined();
    });

    it('a restart between rotation and delivery still leaves the device recoverable', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);                    // DB moved; delivery "lost" to a restart
      // Redis survives the restart; in-memory socket state does not.
      const b = await connect(T1, e);
      expect(b.rejected).toBeNull();
      expect(b.accepted.deviceTokenHash).toBe(h(T2));
    });

    it('cooldown contention does not corrupt the bridge', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      kv.set(COOLDOWN_KEY, '1');                     // another connection holds it
      (gateway as any).jwtService.sign.mockReturnValue(T2);
      await (gateway as any).maybeRefreshDeviceToken(a.socket);

      expect(store.jwtToken).toBe(h(T1));
      expect(grace()).toBeNull();
      expect(a.socket.data.tokenRefreshIssued).toBeUndefined();
    });
  });

  // ── the authority / evidence split ─────────────────────────────────────────────
  describe('presented-credential state is evidence, never authority', () => {
    it('WsDeviceGuard rejects a socket whose AUTHORITATIVE hash is stale, even when the presented one matches', async () => {
      // The PR puts a second, weaker hash on client.data. Nothing else pins that
      // authorization must not read it — swapping the guard to the presented hash would
      // otherwise be silently green, and would let a superseded credential keep a live
      // socket alive after its generation stopped being authoritative.
      store.jwtToken = h(T2);
      const client = {
        id: 'socket-guard',
        data: {
          deviceId: DEVICE,
          organizationId: ORG,
          deviceTokenHash: h(T1),                  // stale authority
          presentedDeviceTokenHash: h(T2),         // matches storage
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      const ctx = { switchToWs: () => ({ getClient: () => client }) } as any;

      await expect(new WsDeviceGuard(db as any).canActivate(ctx)).rejects.toThrow();
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('a grace-authenticated socket still passes the guard on the authoritative hash', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      const b = await connect(T1, e);              // grace accept
      expect(b.accepted.authenticatedViaGrace).toBe(true);

      const ctx = { switchToWs: () => ({ getClient: () => b.socket }) } as any;
      await expect(new WsDeviceGuard(db as any).canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('rotation identity and superseded sockets', () => {
    it('two rotations mint distinguishable credentials (jti), so cleanup cannot cross wires', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);
      const b = await connect(T2, NEARER());
      await rotate(b.socket, T3);

      const jtis = mintedPayloads.map((p) => p.jti);
      expect(jtis).toHaveLength(2);
      expect(jtis[0]).toBeTruthy();
      expect(jtis[0]).not.toBe(jtis[1]);            // the uniqueness the claim exists for
    });

    it('a SUPERSEDED socket does not rotate, and leaves the incumbent bridge intact', async () => {
      const e = NEAR();
      const a = await connect(T1, e);
      await rotate(a.socket, T2);                   // bridge {T1 -> T2} now live
      const before = grace();

      await connect(T1, e);                         // a NEW socket supersedes `a`
      await rotate(a.socket, T3);                   // the old socket tries to rotate

      expect(store.jwtToken).toBe(h(T2));           // authority did not move
      expect(grace()).toEqual(before);              // incumbent bridge untouched
      expect(a.socket.emit).not.toHaveBeenCalledWith('token:refresh', { token: T3 });
    });
  });

  // ── model invariants over generated sequences ──────────────────────────────────
  describe('invariants hold over arbitrary rotation/delivery/reconnect sequences', () => {
    /**
     * Model check rather than a hand-picked path: drive many pseudo-random sequences of
     * rotate / lose-delivery / reconnect and assert the two load-bearing properties after
     * every step. Deterministic — the seed is fixed, so a failure is reproducible.
     */
    it('an accepted bridge was presented, is unexpired, and bridges only to current authority', async () => {
      let seed = 20260822;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

      for (let run = 0; run < 40; run += 1) {
        // fresh world per run
        store = { jwtToken: h(T1), isDisabled: false, organizationId: ORG, missing: false };
        kv.clear();
        expiredTokens.clear();

        let held = T1;                       // what the device physically holds
        const exp = NEARER();
        let gen = 1;
        const presentedEver = new Set<string>([h(T1)]);

        for (let step = 0; step < 6; step += 1) {
          const c = await connect(held, exp);
          if (c.rejected) break;
          presentedEver.add(c.accepted.presentedDeviceTokenHash);
          const socket = c.socket;

          if (rnd() < 0.7) {
            gen += 1;
            const next = `gen-${gen}`;
            await rotate(socket, next);
            if (rnd() < 0.5) held = next;    // delivery succeeded …or was lost
          }

          const g = grace();
          if (g) {
            // property 1: a live bridge only ever points at the CURRENT authority
            expect(g.next).toBe(store.jwtToken);
            // property 2: its source is a credential that was actually presented
            expect(presentedEver.has(g.prev)).toBe(true);
            // property 3: exactly one bridge, never a chain
            expect(Object.keys(g).sort()).toEqual(['next', 'prev']);
            expect([...kv.keys()].filter((k) => k === GRACE_KEY).length).toBe(1);
          }
        }

        // property 4: whatever the device still holds must remain able to authenticate
        const final: any = await handshake(held, exp);
        expect(final.action).toBe('accept');
      }
    });

  });
});

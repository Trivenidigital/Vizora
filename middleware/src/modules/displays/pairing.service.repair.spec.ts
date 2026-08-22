import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PairingService } from './pairing.service';
import { DisplaysService } from './displays.service';
import { DeviceAuthCheckService } from './device-auth-check.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { deviceTokenGraceKey } from '../common/device-token-auth.util';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQRCode'),
}));

/**
 * REPAIR — re-pair an EXISTING display (rebind, don't create).
 *
 * These tests deliberately run against stateful in-memory fakes rather than
 * per-call `jest.fn()` returns: the guarantees under test are about what
 * SURVIVES a write and who wins a race, neither of which a stand-in that
 * replays a canned row can prove. The fakes model the two things the guards
 * actually lean on — Redis `SET NX` and a transaction that rolls back — and
 * the JWT is signed and verified for real, so "the old token is dead" is
 * asserted through `DeviceAuthCheckService`, the same authority the fleet uses.
 */

const DEVICE_SECRET = 'test-device-secret-at-least-32-characters-long';

interface DisplayRow {
  id: string;
  organizationId: string;
  deviceIdentifier: string;
  nickname: string | null;
  description: string | null;
  location: string | null;
  jwtToken: string | null;
  socketId: string | null;
  status: string;
  orientation: string;
  timezone: string;
  metadata: Record<string, unknown> | null;
  isDisabled: boolean;
  currentPlaylistId: string | null;
  lastHeartbeat: Date | null;
  pairedAt: Date | null;
  unpairedAt: Date | null;
}

interface AuditRow {
  organizationId: string;
  userId: string | null;
  displayId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown>;
}

interface OrgRow {
  id: string;
  screenQuota: number;
  subscriptionStatus: string;
}

function prismaError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function displayRow(overrides: Partial<DisplayRow> & { id: string }): DisplayRow {
  return {
    organizationId: 'org-1',
    deviceIdentifier: `dev-${overrides.id}`,
    nickname: null,
    description: null,
    location: null,
    jwtToken: null,
    socketId: null,
    status: 'offline',
    orientation: 'landscape',
    timezone: 'UTC',
    metadata: null,
    isDisabled: false,
    currentPlaylistId: null,
    lastHeartbeat: null,
    pairedAt: null,
    unpairedAt: null,
    ...overrides,
  };
}

describe('PairingService — repair an existing display', () => {
  let displays: Map<string, DisplayRow>;
  let organizations: Map<string, OrgRow>;
  let auditLogs: AuditRow[];
  let redisStore: Map<string, string>;
  let sortedSets: Map<string, Map<string, number>>;

  let db: DatabaseService;
  let redis: RedisService;
  let jwtService: JwtService;
  let displaysService: { sendDeviceRevoked: jest.Mock };
  let provisioningTemplates: { resolveForPairing: jest.Mock };
  let events: { emit: jest.Mock };
  let service: PairingService;
  let authCheck: DeviceAuthCheckService;

  /** Hook that lets a test make the very next display write blow up. */
  let failNextDisplayWrite: string | null;
  /**
   * Every create/update/updateMany against the display table bumps this. It is
   * what makes "the refusal writes to NOTHING" a real assertion instead of a
   * vacuous one — the control test below proves the counter does move on a
   * successful rebind, so a zero here means no write was attempted, not that
   * the probe is broken.
   */
  let displayWrites: number;

  const ORG = 'org-1';
  const OTHER_ORG = 'org-2';
  const ADMIN = 'user-admin-1';

  // ---------------------------------------------------------------- fakes --

  const matches = (row: DisplayRow, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(
      ([key, value]) => (row as unknown as Record<string, unknown>)[key] === value,
    );

  const project = <T extends object>(
    row: T,
    select?: Record<string, boolean | object>,
  ): Record<string, unknown> => {
    if (!select) return { ...row };
    const out: Record<string, unknown> = {};
    for (const [key, want] of Object.entries(select)) {
      if (want) out[key] = (row as unknown as Record<string, unknown>)[key];
    }
    return out;
  };

  const displayDelegate = () => ({
    findUnique: async ({
      where,
      select,
    }: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => {
      const row = [...displays.values()].find((d) => matches(d, where));
      return row ? project(row, select) : null;
    },
    findUniqueOrThrow: async ({
      where,
      select,
    }: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => {
      const row = [...displays.values()].find((d) => matches(d, where));
      if (!row) throw prismaError('P2025', 'Record to query not found');
      return project(row, select);
    },
    findFirst: async ({
      where,
      select,
    }: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => {
      const row = [...displays.values()].find((d) => matches(d, where));
      return row ? project(row, select) : null;
    },
    findMany: async ({ select }: { select?: Record<string, boolean> } = {}) =>
      [...displays.values()].map((row) => project(row, select)),
    create: async ({
      data,
      select,
    }: {
      data: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => {
      displayWrites++;
      if (failNextDisplayWrite) {
        const code = failNextDisplayWrite;
        failNextDisplayWrite = null;
        throw prismaError(code, 'injected failure');
      }
      const row = displayRow({
        ...(data as Partial<DisplayRow>),
        id: data.id as string,
      });
      if ([...displays.values()].some((d) => d.deviceIdentifier === row.deviceIdentifier)) {
        throw prismaError('P2002', 'Unique constraint failed on deviceIdentifier');
      }
      displays.set(row.id, row);
      return project(row, select);
    },
    update: async ({
      where,
      data,
      select,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => {
      displayWrites++;
      if (failNextDisplayWrite) {
        const code = failNextDisplayWrite;
        failNextDisplayWrite = null;
        throw prismaError(code, 'injected failure');
      }
      const row = [...displays.values()].find((d) => matches(d, where));
      if (!row) throw prismaError('P2025', 'Record to update not found');
      const next = { ...row, ...(data as Partial<DisplayRow>) };
      if (
        [...displays.values()].some(
          (d) => d.id !== next.id && d.deviceIdentifier === next.deviceIdentifier,
        )
      ) {
        throw prismaError('P2002', 'Unique constraint failed on deviceIdentifier');
      }
      displays.set(next.id, next);
      return project(next, select);
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      displayWrites++;
      if (failNextDisplayWrite) {
        const code = failNextDisplayWrite;
        failNextDisplayWrite = null;
        throw prismaError(code, 'injected failure');
      }
      const rows = [...displays.values()].filter((d) => matches(d, where));
      for (const row of rows) {
        const next = { ...row, ...(data as Partial<DisplayRow>) };
        if (
          [...displays.values()].some(
            (d) => d.id !== next.id && d.deviceIdentifier === next.deviceIdentifier,
          )
        ) {
          throw prismaError('P2002', 'Unique constraint failed on deviceIdentifier');
        }
        displays.set(next.id, next);
      }
      return { count: rows.length };
    },
  });

  const organizationDelegate = () => ({
    findUnique: async ({
      where,
      select,
    }: {
      where: { id: string };
      select?: Record<string, unknown>;
    }) => {
      const org = organizations.get(where.id);
      if (!org) return null;
      const enabled = [...displays.values()].filter(
        (d) => d.organizationId === org.id && !d.isDisabled,
      ).length;
      const out: Record<string, unknown> = {};
      if (select?.screenQuota) out.screenQuota = org.screenQuota;
      if (select?._count) out._count = { displays: enabled };
      if (select?.subscriptionStatus) out.subscriptionStatus = org.subscriptionStatus;
      return out;
    },
  });

  const auditLogDelegate = () => ({
    create: async ({ data }: { data: AuditRow }) => {
      auditLogs.push(data);
      return data;
    },
  });

  const snapshot = () => ({
    displays: new Map([...displays.entries()].map(([k, v]) => [k, { ...v }])),
    auditLogs: [...auditLogs],
  });

  // ------------------------------------------------------------------ setup --

  beforeEach(() => {
    process.env.DEVICE_JWT_SECRET = DEVICE_SECRET;

    displays = new Map();
    organizations = new Map([
      [ORG, { id: ORG, screenQuota: 100, subscriptionStatus: 'active' }],
      [OTHER_ORG, { id: OTHER_ORG, screenQuota: 100, subscriptionStatus: 'active' }],
    ]);
    auditLogs = [];
    redisStore = new Map();
    sortedSets = new Map();
    failNextDisplayWrite = null;
    displayWrites = 0;

    const txClient = {
      display: displayDelegate(),
      organization: organizationDelegate(),
      auditLog: auditLogDelegate(),
    };

    db = {
      display: displayDelegate(),
      organization: organizationDelegate(),
      auditLog: auditLogDelegate(),
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        const before = snapshot();
        try {
          return await cb(txClient);
        } catch (error) {
          // Roll back — the whole point of test "DB failure leaves the original
          // display usable and creates no ghost row".
          displays = before.displays;
          auditLogs = before.auditLogs;
          throw error;
        }
      },
    } as unknown as DatabaseService;

    const redisClient = {
      set: async (
        key: string,
        value: string,
        _ex: string,
        _ttl: number,
        nx?: string,
      ) => {
        if (nx === 'NX' && redisStore.has(key)) return null;
        redisStore.set(key, value);
        return 'OK';
      },
      eval: async (_script: string, _n: number, key: string, token: string) => {
        if (redisStore.get(key) === token) {
          redisStore.delete(key);
          return 1;
        }
        return 0;
      },
      zadd: async (key: string, score: number, member: string) => {
        const set = sortedSets.get(key) ?? new Map<string, number>();
        set.set(member, score);
        sortedSets.set(key, set);
        return 1;
      },
      zrem: async (key: string, ...members: string[]) => {
        const set = sortedSets.get(key);
        members.forEach((m) => set?.delete(m));
        return members.length;
      },
      zrangebyscore: async (key: string) => [...(sortedSets.get(key)?.keys() ?? [])],
      zremrangebyscore: async () => 0,
      expire: async () => 1,
      scan: async () => ['0', []],
      mget: async (...keys: string[]) => keys.map((k) => redisStore.get(k) ?? null),
    };

    redis = {
      get: async (key: string) => redisStore.get(key) ?? null,
      getOrThrow: async (key: string) => redisStore.get(key) ?? null,
      set: async (key: string, value: string) => {
        redisStore.set(key, value);
        return true;
      },
      del: async (key: string) => redisStore.delete(key),
      exists: async (key: string) => redisStore.has(key),
      getClient: () => redisClient,
    } as unknown as RedisService;

    jwtService = new JwtService({});
    displaysService = { sendDeviceRevoked: jest.fn().mockResolvedValue(undefined) };
    provisioningTemplates = { resolveForPairing: jest.fn() };
    events = { emit: jest.fn() };

    service = new PairingService(
      db,
      jwtService,
      redis,
      events as never,
      provisioningTemplates as never,
      displaysService as unknown as DisplaysService,
    );

    authCheck = new DeviceAuthCheckService(jwtService, db, redis);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------- utilities --

  const startPairing = async (deviceIdentifier: string, nickname = 'TV says hi') => {
    const { code } = await service.requestPairingCode({
      deviceIdentifier,
      nickname,
      metadata: { hostname: 'living-room-tv', os: 'android' },
    });
    return code;
  };

  /** Timestamps/session state left behind by the client that just died. */
  const STALE_PAIRED_AT = new Date('2026-01-01T00:00:00.000Z');
  const STALE_HEARTBEAT = new Date('2026-02-02T00:00:00.000Z');
  const STALE_UNPAIRED_AT = new Date('2026-03-03T00:00:00.000Z');

  const seedBrokenDisplay = (overrides: Partial<DisplayRow> = {}) => {
    const row = displayRow({
      id: 'display-lobby',
      organizationId: ORG,
      deviceIdentifier: 'old-hardware-id',
      nickname: 'Lobby Screen',
      description: 'Front of house',
      location: 'Lobby',
      currentPlaylistId: 'playlist-lunch-menu',
      orientation: 'portrait',
      timezone: 'Asia/Kolkata',
      jwtToken: null,
      status: 'offline',
      // Seeded NON-null on purpose. These are the fields the rebind is
      // documented to REPLACE, and every one of them defaults to null/absent
      // in the fixture — so asserting "it is null afterwards" against a
      // default proves nothing and the write could be deleted unnoticed.
      socketId: 'socket-of-the-dead-client',
      metadata: { os: 'the-old-box', appVersion: '0.9.0' },
      pairedAt: STALE_PAIRED_AT,
      lastHeartbeat: STALE_HEARTBEAT,
      unpairedAt: STALE_UNPAIRED_AT,
      ...overrides,
    });
    displays.set(row.id, row);
    return row;
  };

  /** Give the seeded display a real, currently-valid device credential. */
  const issueLiveCredential = (row: DisplayRow): string => {
    const token = jwtService.sign(
      {
        sub: row.id,
        deviceIdentifier: row.deviceIdentifier,
        organizationId: row.organizationId,
        type: 'device',
      },
      { secret: DEVICE_SECRET, algorithm: 'HS256', expiresIn: '90d' },
    );
    displays.set(row.id, {
      ...displays.get(row.id)!,
      jwtToken: require('node:crypto')
        .createHash('sha256')
        .update(token)
        .digest('hex'),
    });
    return token;
  };

  // ------------------------------------------------------------------ tests --

  describe('1 — the untouched path', () => {
    it('pairs a brand-new device exactly as before when no targetDisplayId is given', async () => {
      const code = await startPairing('brand-new-tv');

      const result = await service.completePairing(ORG, ADMIN, { code });

      expect(result.success).toBe(true);
      expect(displays.size).toBe(1);
      const created = [...displays.values()][0];
      expect(created.deviceIdentifier).toBe('brand-new-tv');
      expect(created.nickname).toBe('TV says hi');
      expect(created.status).toBe('pairing');
      // No rebind happened, so no repair audit row and no revocation dispatch.
      expect(auditLogs).toHaveLength(0);
      expect(displaysService.sendDeviceRevoked).not.toHaveBeenCalled();
    });

    it('still re-pairs a returning device by deviceIdentifier without a targetDisplayId', async () => {
      const existing = seedBrokenDisplay({ deviceIdentifier: 'same-hardware' });
      const code = await startPairing('same-hardware');

      const result = await service.completePairing(ORG, ADMIN, { code });

      expect(result.display.id).toBe(existing.id);
      expect(displays.size).toBe(1);
      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('2, 3, 5 — identity and tenant configuration survive the rebind', () => {
    it('rebinds onto the existing row: same id, new physical identifier', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-1755000000000');

      const result = await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      // 2 — the row id is preserved.
      expect(result.display.id).toBe(target.id);
      expect(displays.size).toBe(1);
      // 5 — the physical identifier moved to the new client.
      expect(displays.get(target.id)!.deviceIdentifier).toBe(
        'fresh-identifier-1755000000000',
      );
      expect(displays.get(target.id)!.status).toBe('pairing');
    });

    it('REPLACES every field that describes the physical client', async () => {
      const target = seedBrokenDisplay();
      expect(target.socketId).toBe('socket-of-the-dead-client');
      const code = await startPairing('fresh-identifier-replaced');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      const after = displays.get(target.id)!;
      // Stale session state from the client that is being replaced. A leftover
      // socketId points at a dead connection; a leftover unpairedAt is read by
      // the dashboard through display-response.select.ts, so a repaired screen
      // would keep reporting that it had been unpaired.
      expect(after.socketId).toBeNull();
      expect(after.unpairedAt).toBeNull();
      // The new box's own description of itself.
      expect(after.metadata).toEqual({ hostname: 'living-room-tv', os: 'android' });
      // Freshly stamped, not the dead client's timestamps.
      expect(after.pairedAt).not.toEqual(STALE_PAIRED_AT);
      expect(after.pairedAt!.getTime()).toBeGreaterThan(STALE_PAIRED_AT.getTime());
      expect(after.lastHeartbeat).not.toEqual(STALE_HEARTBEAT);
      expect(after.lastHeartbeat!.getTime()).toBeGreaterThan(
        STALE_HEARTBEAT.getTime(),
      );
    });

    it('releases the per-target rebind claim so an immediate retry is not a 409', async () => {
      // The claim carries a 300s TTL, so a leaked one turns the operator's very
      // next attempt — the retry after a partial failure — into a conflict for
      // five minutes.
      const target = seedBrokenDisplay();
      const first = await startPairing('fresh-identifier-retry-1');

      await service.completePairing(ORG, ADMIN, {
        code: first,
        targetDisplayId: target.id,
      });

      expect(redisStore.has(`pairing-rebind-claim:${target.id}`)).toBe(false);

      const second = await startPairing('fresh-identifier-retry-2');
      const result = await service.completePairing(ORG, ADMIN, {
        code: second,
        targetDisplayId: target.id,
      });
      expect(result.display.id).toBe(target.id);
      expect(displays.get(target.id)!.deviceIdentifier).toBe(
        'fresh-identifier-retry-2',
      );
    });

    it('PRESERVES the playlist assignment across the rebind', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-a');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(displays.get(target.id)!.currentPlaylistId).toBe('playlist-lunch-menu');
    });

    it('PRESERVES every other tenant-configuration field on the logical screen', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-b', 'Some TV Default Name');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      const after = displays.get(target.id)!;
      expect(after.organizationId).toBe(ORG);
      // The DEVICE-supplied nickname must never overwrite the operator's name.
      expect(after.nickname).toBe('Lobby Screen');
      expect(after.location).toBe('Lobby');
      expect(after.description).toBe('Front of house');
      expect(after.orientation).toBe('portrait');
      expect(after.timezone).toBe('Asia/Kolkata');
    });

    it('accepts an explicit nickname/location from the admin', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-c');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
        nickname: 'Lobby Screen (replacement box)',
        location: 'Lobby North',
      });

      const after = displays.get(target.id)!;
      expect(after.nickname).toBe('Lobby Screen (replacement box)');
      expect(after.location).toBe('Lobby North');
      expect(after.currentPlaylistId).toBe('playlist-lunch-menu');
    });

    it('refuses a provisioning template on the rebind path (it would overwrite the preserved config)', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-d');

      await expect(
        service.completePairing(ORG, ADMIN, {
          code,
          targetDisplayId: target.id,
          provisioningTemplateId: 'tpl-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(provisioningTemplates.resolveForPairing).not.toHaveBeenCalled();
      expect(displays.get(target.id)!.currentPlaylistId).toBe('playlist-lunch-menu');
    });
  });

  describe('4 — quota: a rebind is not a new screen', () => {
    const fillToQuota = () => {
      organizations.set(ORG, { id: ORG, screenQuota: 5, subscriptionStatus: 'active' });
      for (let i = 0; i < 5; i++) {
        displays.set(
          `display-${i}`,
          displayRow({
            id: `display-${i}`,
            organizationId: ORG,
            deviceIdentifier: `hw-${i}`,
            nickname: `Screen ${i}`,
            currentPlaylistId: `playlist-${i}`,
          }),
        );
      }
    };

    const enabledCount = () =>
      [...displays.values()].filter((d) => d.organizationId === ORG && !d.isDisabled)
        .length;

    it('quota=5, existing=5, one broken → rebind SUCCEEDS and the org still has 5', async () => {
      fillToQuota();
      expect(enabledCount()).toBe(5);
      const code = await startPairing('replacement-box-hw');

      const result = await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: 'display-3',
      });

      expect(result.display.id).toBe('display-3');
      expect(enabledCount()).toBe(5);
      expect(displays.get('display-3')!.currentPlaylistId).toBe('playlist-3');
    });

    it('quota=5, existing=5 → genuinely adding a 6th display still FAILS', async () => {
      fillToQuota();
      const code = await startPairing('a-genuinely-sixth-screen');

      await expect(service.completePairing(ORG, ADMIN, { code })).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(enabledCount()).toBe(5);
    });

    it('a DISABLED row is not a rebind target — it would be a quota bypass', async () => {
      fillToQuota();
      displays.set('display-4', { ...displays.get('display-4')!, isDisabled: true });
      expect(enabledCount()).toBe(4);
      const code = await startPairing('sneaky-box');

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: 'display-4' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(displays.get('display-4')!.jwtToken).toBeNull();
    });
  });

  describe('6, 7 — credential handover', () => {
    it('the minted credential belongs to the TARGET row', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-e');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      const status = await service.checkPairingStatus(code);
      const payload = jwtService.verify(status.deviceToken as string, {
        secret: DEVICE_SECRET,
      });
      expect(payload.sub).toBe(target.id);
      expect(payload.organizationId).toBe(ORG);
      expect(payload.deviceIdentifier).toBe('fresh-identifier-e');
    });

    it('the OLD token is dead the moment the rebind commits, and the new one works', async () => {
      const target = seedBrokenDisplay();
      const oldToken = issueLiveCredential(target);
      expect(await authCheck.evaluate(oldToken)).toEqual({
        httpStatus: 200,
        body: { status: 'ok' },
      });

      const code = await startPairing('fresh-identifier-f');
      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(await authCheck.evaluate(oldToken)).toEqual({
        httpStatus: 410,
        body: { code: 'DEVICE_REVOKED' },
      });

      const status = await service.checkPairingStatus(code);
      expect(await authCheck.evaluate(status.deviceToken as string)).toEqual({
        httpStatus: 200,
        body: { status: 'ok' },
      });
    });

    it('a stale rotation grace record cannot keep the old credential alive', async () => {
      const target = seedBrokenDisplay();
      const oldToken = issueLiveCredential(target);
      const crypto = require('node:crypto');
      const oldHash = displays.get(target.id)!.jwtToken as string;
      // Realtime had just rotated: prev=old, next=stored. Alive before the rebind.
      redisStore.set(
        deviceTokenGraceKey(target.id),
        JSON.stringify({ prev: oldHash, next: oldHash }),
      );

      const code = await startPairing('fresh-identifier-g');
      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(redisStore.has(deviceTokenGraceKey(target.id))).toBe(false);
      expect(await authCheck.evaluate(oldToken)).toEqual({
        httpStatus: 410,
        body: { code: 'DEVICE_REVOKED' },
      });
      expect(
        crypto.createHash('sha256').update(oldToken).digest('hex'),
      ).not.toBe(displays.get(target.id)!.jwtToken);
    });

    it('terminates any surviving socket through the EXISTING revocation path', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-h');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(displaysService.sendDeviceRevoked).toHaveBeenCalledWith(
        target.id,
        'repaired',
      );
    });

    it('the poller receives the credential for the preserved display, not a new row', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-i');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      const status = await service.checkPairingStatus(code);
      expect(status.status).toBe('paired');
      expect(status.deviceId).toBe(target.id);
      expect(status.organizationId).toBe(ORG);
      expect(status.deviceToken).toBeTruthy();
    });
  });

  describe('deviceIdentifier collision — REFUSE, never take the identifier over', () => {
    /**
     * An earlier draft retired the colliding row automatically (rename +
     * disable + clear credential). That was removed: `POST /displays/:id/disable`
     * is `@Roles('admin')` while `pairing/complete` is `@Roles('admin','manager')`,
     * so it let a manager perform an admin-only disable on a row they never
     * named; it could not reach the clear-and-pair ghost it was written for
     * (a PAIRED holder makes `requestPairingCode` refuse outright, so no
     * session ever exists); and the rows it COULD reach were operator-created
     * tokenless placeholders from `POST /displays`. These tests pin the refusal
     * and, crucially, that NOTHING is written on the way to it.
     */

    const snapshotDisplays = () =>
      new Map([...displays.entries()].map(([k, v]) => [k, { ...v }]));

    it('CONTROL: the write probe really moves on a successful rebind', async () => {
      // Without this, `expect(displayWrites).toBe(0)` below proves nothing.
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-control');
      displayWrites = 0;

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(displayWrites).toBeGreaterThan(0);
    });

    it('same-org holder → 409 naming the conflicting row, and NOTHING is written', async () => {
      const target = seedBrokenDisplay();
      // Seeded after the code request only because `requestPairingCode` refuses
      // when a PAIRED row owns the identifier; the refusal path is the same.
      const code = await startPairing('stable-hardware-id');
      displays.set(
        'display-ghost',
        displayRow({
          id: 'display-ghost',
          organizationId: ORG,
          deviceIdentifier: 'stable-hardware-id',
          nickname: 'Unnamed Display',
          jwtToken: 'a'.repeat(64),
          socketId: 'socket-abc',
        }),
      );
      const before = snapshotDisplays();
      displayWrites = 0;

      const error = await service
        .completePairing(ORG, ADMIN, { code, targetDisplayId: target.id })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toContain('display-ghost');

      expect(displayWrites).toBe(0);
      expect(snapshotDisplays()).toEqual(before);
      expect(auditLogs).toHaveLength(0);
      expect(displaysService.sendDeviceRevoked).not.toHaveBeenCalled();
      // The session was not consumed either — the operator can free the row
      // and retry on the same code.
      const request = JSON.parse(redisStore.get(`pairing:${code}`) as string);
      expect(request.plaintextToken).toBeUndefined();
    });

    it('an operator-created tokenless placeholder is refused, not silently disabled', async () => {
      // The only population the removed takeover could actually reach:
      // enabled + jwtToken null, created through POST /displays.
      const target = seedBrokenDisplay();
      const placeholder = displayRow({
        id: 'display-placeholder',
        organizationId: ORG,
        deviceIdentifier: 'preassigned-hardware-id',
        nickname: 'Meeting Room B (awaiting install)',
        jwtToken: null,
      });
      displays.set(placeholder.id, placeholder);
      const code = await startPairing('preassigned-hardware-id');
      displayWrites = 0;

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(displayWrites).toBe(0);
      expect(displays.get(placeholder.id)).toEqual(placeholder);
      expect(displays.get(placeholder.id)!.isDisabled).toBe(false);
      expect(displays.get(placeholder.id)!.deviceIdentifier).toBe(
        'preassigned-hardware-id',
      );
    });

    it("another tenant's holder → the opaque refusal, and NOTHING is written", async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('contested-hardware-id');
      const other = displayRow({
        id: 'display-other-tenant',
        organizationId: OTHER_ORG,
        deviceIdentifier: 'contested-hardware-id',
        jwtToken: 'b'.repeat(64),
      });
      displays.set(other.id, other);
      const before = snapshotDisplays();
      displayWrites = 0;

      const error = await service
        .completePairing(ORG, ADMIN, { code, targetDisplayId: target.id })
        .catch((e: unknown) => e);

      // Opaque on purpose — a cross-tenant collision must not confirm that the
      // identifier exists, so it does NOT get the naming 409.
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).not.toContain(other.id);

      expect(displayWrites).toBe(0);
      expect(snapshotDisplays()).toEqual(before);
      expect(auditLogs).toHaveLength(0);
    });

    it('a rebind onto the row that already holds the identifier is a plain re-pair', async () => {
      const target = seedBrokenDisplay({ deviceIdentifier: 'unchanged-hardware' });
      const code = await startPairing('unchanged-hardware');

      const result = await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(result.display.id).toBe(target.id);
      expect(displays.size).toBe(1);
      expect(auditLogs).toHaveLength(1);
    });

    it('maps a unique-constraint loss to a 409, never a raw P2002', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-j');
      failNextDisplayWrite = 'P2002';

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('8, 9, 13 — rejections', () => {
    it('8 — refuses a target display belonging to another org', async () => {
      const foreign = displayRow({
        id: 'display-foreign',
        organizationId: OTHER_ORG,
        deviceIdentifier: 'foreign-hw',
        currentPlaylistId: 'their-playlist',
      });
      displays.set(foreign.id, foreign);
      const code = await startPairing('fresh-identifier-k');

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: foreign.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(displays.get(foreign.id)).toEqual(foreign);
      expect(auditLogs).toHaveLength(0);
    });

    it('8 — refuses a target display that does not exist', async () => {
      const code = await startPairing('fresh-identifier-l');

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: 'nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('9 — refuses an already-consumed pairing code', async () => {
      const target = seedBrokenDisplay();
      const second = displayRow({
        id: 'display-second',
        organizationId: ORG,
        deviceIdentifier: 'other-hw',
        currentPlaylistId: 'playlist-second',
      });
      displays.set(second.id, second);
      const code = await startPairing('fresh-identifier-m');

      await service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id });

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: second.id }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(displays.get(second.id)!.jwtToken).toBeNull();
    });

    it('9 — refuses an expired pairing code', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-n');
      const raw = JSON.parse(redisStore.get(`pairing:${code}`) as string);
      raw.expiresAt = new Date(Date.now() - 1000).toISOString();
      redisStore.set(`pairing:${code}`, JSON.stringify(raw));

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(displays.get(target.id)!.jwtToken).toBeNull();
    });

    it('13 — the client disappeared before completion: nothing mutates', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-o');
      // TV gave up / code TTL'd out of Redis.
      redisStore.delete(`pairing:${code}`);

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(displays.get(target.id)).toEqual(target);
      expect(auditLogs).toHaveLength(0);
      expect(displaysService.sendDeviceRevoked).not.toHaveBeenCalled();
    });

    it('there is no rebind without a live pairing session', async () => {
      const target = seedBrokenDisplay();

      await expect(
        service.completePairing(ORG, ADMIN, {
          code: 'ZZZZZZ',
          targetDisplayId: target.id,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(displays.get(target.id)!.jwtToken).toBeNull();
    });
  });

  describe('10, 11 — concurrency, resolved by the real claim machinery', () => {
    it('10 — two admins racing two codes onto ONE display: exactly one wins', async () => {
      const target = seedBrokenDisplay();
      const codeA = await startPairing('tv-a-identifier');
      const codeB = await startPairing('tv-b-identifier');

      const settled = await Promise.allSettled([
        service.completePairing(ORG, ADMIN, {
          code: codeA,
          targetDisplayId: target.id,
        }),
        service.completePairing(ORG, 'user-admin-2', {
          code: codeB,
          targetDisplayId: target.id,
        }),
      ]);

      const winners = settled.filter((s) => s.status === 'fulfilled');
      const losers = settled.filter((s) => s.status === 'rejected');
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect((losers[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );

      // Exactly one authoritative credential, and it is the winner's.
      expect(displays.size).toBe(1);
      const winningIdentifier = displays.get(target.id)!.deviceIdentifier;
      expect(['tv-a-identifier', 'tv-b-identifier']).toContain(winningIdentifier);
      const loserCode = winningIdentifier === 'tv-a-identifier' ? codeB : codeA;
      const loserRequest = JSON.parse(redisStore.get(`pairing:${loserCode}`) as string);
      expect(loserRequest.plaintextToken).toBeUndefined();
      expect(auditLogs).toHaveLength(1);
    });

    it('11 — one pairing code aimed at two different displays: exactly one wins', async () => {
      const first = seedBrokenDisplay();
      const second = displayRow({
        id: 'display-kitchen',
        organizationId: ORG,
        deviceIdentifier: 'kitchen-hw',
        nickname: 'Kitchen',
        currentPlaylistId: 'playlist-kitchen',
      });
      displays.set(second.id, second);
      const code = await startPairing('one-tv-identifier');

      const settled = await Promise.allSettled([
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: first.id }),
        service.completePairing(ORG, 'user-admin-2', {
          code,
          targetDisplayId: second.id,
        }),
      ]);

      expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
      const losers = settled.filter((s) => s.status === 'rejected');
      expect(losers).toHaveLength(1);
      // Pin WHY it lost. Without this the test passes on any rejection at all —
      // including one thrown for an unrelated reason that happens to leave the
      // counts looking right. The per-CODE completion claim is the guard here.
      const reason = (losers[0] as PromiseRejectedResult).reason as Error;
      expect(reason).toBeInstanceOf(BadRequestException);
      expect(reason.message).toBe('Pairing code is already being completed');

      const rebound = [...displays.values()].filter(
        (d) => d.deviceIdentifier === 'one-tv-identifier',
      );
      expect(rebound).toHaveLength(1);
      expect(auditLogs).toHaveLength(1);
      // Neither logical screen lost its playlist.
      expect(displays.get(first.id)!.currentPlaylistId).toBe('playlist-lunch-menu');
      expect(displays.get(second.id)!.currentPlaylistId).toBe('playlist-kitchen');
    });
  });

  describe('12, 14 — failure and interference leave a deterministic, safe state', () => {
    it('12 — a DB failure mid-transaction leaves the original display usable and no ghost row', async () => {
      const target = seedBrokenDisplay();
      const before = { ...target };
      const code = await startPairing('fresh-identifier-p');
      failNextDisplayWrite = 'P1001';

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toThrow();

      expect(displays.size).toBe(1);
      expect(displays.get(target.id)).toEqual(before);
      expect(auditLogs).toHaveLength(0);
      expect(displaysService.sendDeviceRevoked).not.toHaveBeenCalled();
      // The session was NOT handed a credential.
      const request = JSON.parse(redisStore.get(`pairing:${code}`) as string);
      expect(request.plaintextToken).toBeUndefined();
    });

    it('12 — the display write is rolled back when the LAST write (audit) fails', async () => {
      const target = seedBrokenDisplay();
      const before = { ...target };
      const code = await startPairing('fresh-identifier-p2');

      // The display update lands first and the audit insert fails after it, so
      // this is the ordering where a missing rollback would be visible.
      const originalTx = db.$transaction.bind(db);
      (db as unknown as { $transaction: unknown }).$transaction = async (
        cb: (tx: never) => Promise<unknown>,
      ) =>
        originalTx(async (tx: never) => {
          const txAudit = (tx as unknown as { auditLog: Record<string, unknown> })
            .auditLog;
          const origCreate = txAudit.create as (a: unknown) => Promise<unknown>;
          txAudit.create = async () => {
            // The display row really was updated by this point...
            expect(displays.get(target.id)!.deviceIdentifier).toBe(
              'fresh-identifier-p2',
            );
            throw prismaError('P1001', 'connection lost');
          };
          try {
            return await cb(tx);
          } finally {
            txAudit.create = origCreate;
          }
        });

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toThrow();

      // ...and is gone again after the rollback.
      expect(displays.get(target.id)).toEqual(before);
      expect(auditLogs).toHaveLength(0);
      expect(displaysService.sendDeviceRevoked).not.toHaveBeenCalled();
    });

    it('14 — a delete that lands first wins; the rebind fails and creates no row', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-q');
      displays.delete(target.id);

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(displays.size).toBe(0);
      expect(auditLogs).toHaveLength(0);
    });

    it('14 — a disable that lands first wins; the rebind is refused', async () => {
      const target = seedBrokenDisplay();
      displays.set(target.id, { ...target, isDisabled: true });
      const code = await startPairing('fresh-identifier-r');

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(displays.get(target.id)!.jwtToken).toBeNull();
      expect(displays.get(target.id)!.deviceIdentifier).toBe('old-hardware-id');
    });

    it('14 — a disable racing INSIDE the transaction loses the compare-and-set', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-s2');

      const originalTx = db.$transaction.bind(db);
      (db as unknown as { $transaction: unknown }).$transaction = async (
        cb: (tx: never) => Promise<unknown>,
      ) =>
        originalTx(async (tx: never) => {
          const txDisplay = (tx as unknown as { display: Record<string, unknown> })
            .display;
          const origFindFirst = txDisplay.findFirst as (a: unknown) => Promise<unknown>;
          txDisplay.findFirst = async (a: unknown) => {
            const row = await origFindFirst(a);
            // Operator disables the screen between the read and the CAS write.
            displays.set(target.id, { ...displays.get(target.id)!, isDisabled: true });
            return row;
          };
          try {
            return await cb(tx);
          } finally {
            txDisplay.findFirst = origFindFirst;
          }
        });

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(displays.get(target.id)!.deviceIdentifier).toBe('old-hardware-id');
      expect(displays.get(target.id)!.jwtToken).toBeNull();
      expect(auditLogs).toHaveLength(0);
    });

    it('14 — a delete racing INSIDE the transaction loses the compare-and-set', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('fresh-identifier-s');

      const originalTx = db.$transaction.bind(db);
      (db as unknown as { $transaction: unknown }).$transaction = async (
        cb: (tx: never) => Promise<unknown>,
      ) =>
        originalTx(async (tx: never) => {
          const txDisplay = (tx as unknown as { display: Record<string, unknown> })
            .display;
          const origFindFirst = txDisplay.findFirst as (a: unknown) => Promise<unknown>;
          txDisplay.findFirst = async (a: unknown) => {
            const row = await origFindFirst(a);
            // Concurrent delete slips in between the read and the CAS write.
            displays.delete(target.id);
            return row;
          };
          try {
            return await cb(tx);
          } finally {
            txDisplay.findFirst = origFindFirst;
          }
        });

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      // The row read at the top of the transaction no longer satisfies the CAS
      // predicate, so nothing was written: no identifier move, no credential.
      // (The in-memory fake restores the row on rollback; Postgres would leave
      // the concurrent delete standing. Either way the rebind did not happen.)
      expect(displays.get(target.id)?.deviceIdentifier).toBe('old-hardware-id');
      expect(displays.get(target.id)?.jwtToken).toBeNull();
      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('15 — audit', () => {
    it('records actor, display and event, and carries no credential material', async () => {
      const target = seedBrokenDisplay();
      const oldToken = issueLiveCredential(target);
      const storedOldHash = displays.get(target.id)!.jwtToken as string;
      const code = await startPairing('fresh-identifier-t');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(auditLogs).toHaveLength(1);
      const entry = auditLogs[0];
      expect(entry).toMatchObject({
        organizationId: ORG,
        userId: ADMIN,
        displayId: target.id,
        action: 'display_repaired',
        entityType: 'display',
        entityId: target.id,
      });
      expect(entry.changes).toMatchObject({
        event: 'pairing_rebind',
        previousDeviceIdentifier: 'old-hardware-id',
        newDeviceIdentifier: 'fresh-identifier-t',
      });

      const serialized = JSON.stringify(entry);
      const newHash = displays.get(target.id)!.jwtToken as string;
      const status = await service.checkPairingStatus(code);
      for (const secret of [
        oldToken,
        storedOldHash,
        newHash,
        status.deviceToken as string,
        code,
      ]) {
        expect(serialized).not.toContain(secret);
      }
      expect(serialized).not.toMatch(/jwt|token|secret/i);
    });

    it('records exactly one row, and only for the display that was rebound', async () => {
      const target = seedBrokenDisplay();
      const bystander = displayRow({
        id: 'display-bystander',
        organizationId: ORG,
        deviceIdentifier: 'bystander-hw',
        currentPlaylistId: 'playlist-bystander',
      });
      displays.set(bystander.id, bystander);
      const code = await startPairing('fresh-identifier-u');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].entityId).toBe(target.id);
      expect(displays.get(bystander.id)).toEqual(bystander);
    });
  });
});

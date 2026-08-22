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
      expect(displays.get(target.id)!.socketId).toBeNull();
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

  describe('deviceIdentifier collision — the ghost row from a previous clear-and-pair', () => {
    it('retires the same-org ghost holding the identifier and frees its quota slot', async () => {
      const target = seedBrokenDisplay();
      // Seeded AFTER the code request: `requestPairingCode` refuses outright
      // when a PAIRED row already owns the identifier, so the only way a
      // credential-holding ghost reaches completion is by racing it.
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

      const result = await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(result.display.id).toBe(target.id);
      const ghost = displays.get('display-ghost')!;
      // Not deleted — history is kept and the operator decides what to do with it.
      expect(ghost.deviceIdentifier).toBe('retired:display-ghost');
      expect(ghost.jwtToken).toBeNull();
      expect(ghost.socketId).toBeNull();
      expect(ghost.isDisabled).toBe(true);
      expect(ghost.unpairedAt).toBeInstanceOf(Date);
      // And the identifier really moved.
      expect(displays.get(target.id)!.deviceIdentifier).toBe('stable-hardware-id');
      // Quota slot released.
      expect(
        [...displays.values()].filter((d) => d.organizationId === ORG && !d.isDisabled)
          .length,
      ).toBe(1);
    });

    it("never touches another tenant's row that holds the identifier", async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('contested-hardware-id');
      displays.set(
        'display-other-tenant',
        displayRow({
          id: 'display-other-tenant',
          organizationId: OTHER_ORG,
          deviceIdentifier: 'contested-hardware-id',
          jwtToken: 'b'.repeat(64),
        }),
      );

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toBeInstanceOf(NotFoundException);

      const other = displays.get('display-other-tenant')!;
      expect(other.deviceIdentifier).toBe('contested-hardware-id');
      expect(other.jwtToken).toBe('b'.repeat(64));
      expect(other.isDisabled).toBe(false);
      expect(displays.get(target.id)!.deviceIdentifier).toBe('old-hardware-id');
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
      expect(auditLogs[0].changes.retiredDisplayId).toBeNull();
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
      expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(1);

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

    it('12 — a failure while retiring the ghost rolls the ghost back too', async () => {
      const target = seedBrokenDisplay();
      const code = await startPairing('shared-hw');
      const ghost = displayRow({
        id: 'display-ghost',
        organizationId: ORG,
        deviceIdentifier: 'shared-hw',
        jwtToken: 'c'.repeat(64),
      });
      displays.set(ghost.id, ghost);
      // First write in the transaction is the ghost retirement; fail the SECOND.
      let writes = 0;
      const realUpdateMany = (db.display as unknown as { updateMany: unknown })
        .updateMany as (args: unknown) => Promise<unknown>;
      void realUpdateMany;
      const originalTx = db.$transaction.bind(db);
      (db as unknown as { $transaction: unknown }).$transaction = async (
        cb: (tx: never) => Promise<unknown>,
      ) =>
        originalTx(async (tx: never) => {
          const txDisplay = (tx as unknown as { display: Record<string, unknown> })
            .display;
          const origUpdate = txDisplay.update as (a: unknown) => Promise<unknown>;
          txDisplay.update = async (a: unknown) => {
            writes++;
            return origUpdate(a);
          };
          const origUpdateMany = txDisplay.updateMany as (a: unknown) => Promise<unknown>;
          txDisplay.updateMany = async () => {
            throw prismaError('P1001', 'connection lost');
          };
          try {
            return await cb(tx);
          } finally {
            txDisplay.update = origUpdate;
            txDisplay.updateMany = origUpdateMany;
          }
        });

      await expect(
        service.completePairing(ORG, ADMIN, { code, targetDisplayId: target.id }),
      ).rejects.toThrow();

      expect(writes).toBe(1);
      expect(displays.get('display-ghost')).toEqual(ghost);
      expect(displays.get(target.id)).toEqual(target);
      expect(auditLogs).toHaveLength(0);
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
        retiredDisplayId: null,
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

    it('names the retired ghost in the audit record', async () => {
      const target = seedBrokenDisplay();
      displays.set(
        'display-ghost',
        displayRow({
          id: 'display-ghost',
          organizationId: ORG,
          deviceIdentifier: 'shared-hw-2',
        }),
      );
      const code = await startPairing('shared-hw-2');

      await service.completePairing(ORG, ADMIN, {
        code,
        targetDisplayId: target.id,
      });

      expect(auditLogs[0].changes.retiredDisplayId).toBe('display-ghost');
    });
  });
});

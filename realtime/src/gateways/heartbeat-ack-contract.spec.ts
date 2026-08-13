import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

/**
 * Server half of the heartbeat-ack wire contract (vizora-tv#8 / F40).
 *
 * WHAT MAKES THIS LOAD-BEARING, and what the first attempt got wrong.
 *
 * The ack crosses a process boundary neither side can see: this repo builds it,
 * the TV hand-unwraps `.data` and reads reconcileContent / commands / revoked.
 * Nothing imports across the boundary, so either side can change shape and the
 * other silently stops working.
 *
 * The first version of this file asserted
 *     createSuccessResponse(fixture.data)  ===  fixture.data
 * which is a pass-through identity check on a six-line helper. It never called
 * handleHeartbeat, never loaded device.gateway.ts, and would have stayed green
 * with the heartbeat handler deleted. It also encoded a fixture the server does
 * not produce, so it could only ever have passed by not looking at the server.
 *
 * A mutation-sensitive checker pointed at the wrong function is still the wrong
 * function. So this drives the REAL handler through Nest DI — the same class,
 * the same constructor, the same method the socket dispatches to — and asserts
 * the value it returns. handleHeartbeat's return value IS the ack: it is the only
 * @SubscribeMessage('heartbeat') in the repo, and neither globally-registered
 * interceptor rewrites payloads (MetricsInterceptor taps, SentryInterceptor
 * catches+rethrows; app.module.ts:49,53). Nothing sits between this return value
 * and the wire.
 *
 * The fixture is EXPECTED OUTPUT ONLY. It is never fed into the thing under test.
 */
const wire = JSON.parse(
  readFileSync(join(__dirname, 'ack-envelope.fixture.json'), 'utf8'),
) as {
  serverAck: Record<
    'activeSocket' | 'supersededSocket',
    { envelopeKeys: string[]; success: boolean; data: Record<string, unknown> }
  >;
};

describe('heartbeat ack — wire contract with the TV client', () => {
  let gateway: DeviceGateway;

  const mockRedisService = {
    setDeviceStatus: jest.fn().mockResolvedValue(undefined),
    getDeviceCommands: jest.fn().mockResolvedValue([]),
    getPendingPlaylist: jest.fn().mockResolvedValue(null),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setNx: jest.fn().mockResolvedValue(false), // token-refresh cooldown already held: skip
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
  };

  const mockDatabaseService = {
    display: { findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    schedule: { findMany: jest.fn().mockResolvedValue([]) },
    playlist: { findFirst: jest.fn().mockResolvedValue(null) },
  };

  // emit() is needed only by onModuleDestroy's 'server:shutdown' broadcast in afterEach.
  const mockServer = { emit: jest.fn(), sockets: { sockets: new Map<string, unknown>() } };

  const stamp = new Date('2026-01-01T00:00:00Z');
  const SERVER_VERSION = stamp.toISOString();

  /** Server truth: one playlist stamped SERVER_VERSION, resolved by the real resolver. */
  const serverHasContent = () => {
    mockDatabaseService.display.findFirst.mockResolvedValue({
      timezone: 'UTC',
      isDisabled: false,
      currentPlaylistId: 'p-1',
    });
    mockDatabaseService.schedule.findMany.mockResolvedValue([]);
    mockDatabaseService.playlist.findFirst.mockResolvedValue({
      id: 'p-1',
      name: 'Current',
      updatedAt: stamp,
      items: [
        {
          contentId: 'c-1',
          order: 0,
          duration: 10,
          updatedAt: stamp,
          content: { id: 'c-1', name: 'i', type: 'image', url: '', updatedAt: stamp },
        },
      ],
    });
  };

  const socket = (id = 'socket-1') => ({
    id,
    handshake: { auth: { token: 'valid-token' }, address: '127.0.0.1' },
    data: { deviceId: 'device-1', organizationId: 'org-1' },
    rooms: new Set([id]),
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
  });

  /** Drive the REAL production handler and hand back exactly what it returns. */
  const beat = async (client: ReturnType<typeof socket>, contentVersion: unknown) =>
    (await gateway.handleHeartbeat(client as never, { contentVersion } as never)) as {
      success?: boolean;
      data?: Record<string, unknown>;
    };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceGateway,
        { provide: JwtService, useValue: { verify: jest.fn(), sign: jest.fn() } },
        { provide: RedisService, useValue: mockRedisService },
        {
          provide: HeartbeatService,
          useValue: { processHeartbeat: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: PlaylistService, useValue: { getDevicePlaylist: jest.fn() } },
        { provide: NotificationService, useValue: {} },
        {
          provide: MetricsService,
          useValue: { recordHeartbeat: jest.fn(), updateDeviceMetrics: jest.fn() },
        },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    gateway = module.get<DeviceGateway>(DeviceGateway);
    (gateway as unknown as { server: unknown }).server = mockServer;

    // device-1's ACTIVE socket is socket-1. isActiveDeviceSocket() consults both maps,
    // so this is what selects the main success path over the superseded-socket one.
    mockServer.sockets.sockets.set('socket-1', {});
    (gateway as unknown as { deviceSockets: Map<string, string> }).deviceSockets.set(
      'device-1',
      'socket-1',
    );
    (gateway as unknown as { reconcileResolvedAt: Map<string, number> }).reconcileResolvedAt.clear();
    (gateway as unknown as { reconcileSignalledAt: Map<string, number> }).reconcileSignalledAt.clear();
  });

  afterEach(() => {
    // Clear only the constructor's housekeeping timers. NOT onModuleDestroy() — that
    // runs a graceful shutdown (server:shutdown broadcast, a 2s drain, fetchSockets)
    // which leaves an open handle and has nothing to do with this contract.
    const timers = (gateway as unknown as { cleanupIntervals?: NodeJS.Timeout[] }).cleanupIntervals;
    timers?.forEach(clearInterval);
  });

  describe('the ACTIVE-socket success path (device.gateway.ts:1902)', () => {
    it('emits exactly the envelope and data keys the client unwraps', async () => {
      serverHasContent();
      const ack = await beat(socket(), '2025-06-01T00:00:00.000Z'); // behind → drift

      const expected = wire.serverAck.activeSocket;
      // Key SET, not merely presence: an ADDED or RENAMED key is a wire change too.
      expect(Object.keys(ack).sort()).toEqual(expected.envelopeKeys);
      expect(ack.success).toBe(expected.success);
      expect(Object.keys(ack.data!).sort()).toEqual(Object.keys(expected.data).sort());
      expect(ack.data).toEqual(expected.data);
    });

    it('names each field individually, so a partial regression says which one went', async () => {
      serverHasContent();
      const d = (await beat(socket(), '2025-06-01T00:00:00.000Z')).data!;

      expect(d.reconcileContent).toBe(true);
      expect(d.nextHeartbeatIn).toBe(15000);
      expect(d.commands).toEqual([]);
    });

    it('carries the reconcile signal the device actually converges on — BOTH values', async () => {
      // The one field genuinely wired end-to-end. Pinning only `true` would let a
      // hardcoded `true` pass, so the negative is asserted from the same real handler.
      serverHasContent();
      expect((await beat(socket(), '2025-06-01T00:00:00.000Z')).data!.reconcileContent).toBe(true);

      (gateway as unknown as { reconcileSignalledAt: Map<string, number> }).reconcileSignalledAt.clear();
      expect((await beat(socket(), SERVER_VERSION)).data!.reconcileContent).toBe(false);
    });

    it('does NOT emit `revoked` — revocation rides the separate device:revoked event', async () => {
      // The client acts on ack.revoked (main.ts:1020) and the design contract permits it
      // (revocation-contract.md §3.2 "MAY"), but the current server never sends it. The
      // superseded fixture asserted revoked:true as the server's promise; it is not one.
      serverHasContent();
      expect((await beat(socket(), '')).data).not.toHaveProperty('revoked');
    });

    it('emits `commands` as a key that is always empty here', async () => {
      // Part of the wire SHAPE, never a data carrier in an ack: both success sites pass
      // a hardcoded [] literal. Real commands arrive on the separate `command` event.
      serverHasContent();
      const d = (await beat(socket(), '')).data!;
      expect(d).toHaveProperty('commands');
      expect(d.commands).toEqual([]);
    });
  });

  describe('the SUPERSEDED-socket success path (device.gateway.ts:1804)', () => {
    it('emits a DIFFERENT data key set — no reconcileContent', async () => {
      // A beat from a socket that is no longer the device's active one. Asserted
      // because a contract test pinning one key set for "the success ack" would be
      // wrong about this path, and would break the moment a stale socket beats.
      serverHasContent();
      const ack = await beat(socket('socket-STALE'), '2025-06-01T00:00:00.000Z');

      const expected = wire.serverAck.supersededSocket;
      expect(Object.keys(ack).sort()).toEqual(expected.envelopeKeys);
      expect(ack.success).toBe(expected.success);
      expect(Object.keys(ack.data!).sort()).toEqual(Object.keys(expected.data).sort());
      expect(ack.data).toEqual(expected.data);
      expect(ack.data).not.toHaveProperty('reconcileContent');
    });
  });

  it('wraps in `data` — the envelope the client unwraps by hand', async () => {
    // reconcileContent was wired both ends, green both ends, and ALWAYS undefined at
    // runtime because the client read the top level and the server wrapped in .data.
    // This is that bug's regression test, taken from the real handler.
    serverHasContent();
    const ack = await beat(socket(), '2025-06-01T00:00:00.000Z');

    expect(ack).toHaveProperty('data');
    expect(ack).not.toHaveProperty('reconcileContent'); // must NOT be at the top level
    expect(typeof (ack as { timestamp?: unknown }).timestamp).toBe('string');
  });
});

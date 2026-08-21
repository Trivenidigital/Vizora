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
 * the value it returns.
 *
 * handleHeartbeat's return value IS the ack. It is the only
 * @SubscribeMessage('heartbeat') in the repo, and no global enhancer can rewrite
 * it: Nest's socket module builds its InterceptorsContextCreator WITHOUT an
 * applicationConfig (@nestjs/websockets socket-module.js getContextCreator), so
 * APP_INTERCEPTOR-registered interceptors never reach WS handlers at all. That is
 * structural, not a property of the two we happen to register today — a future
 * global map() interceptor still could not silently un-bind this test. Only the
 * gateway's own local enhancers apply (device.gateway.ts:156,1792,1793), and none
 * touch the return value. RedisIoAdapter overrides only createIOServer.
 *
 * The fixture is EXPECTED OUTPUT ONLY. It is never fed into the thing under test.
 *
 * WHAT THIS DELIBERATELY DOES NOT COVER. Calling the handler directly bypasses the
 * decorators around it — WsDeviceGuard and the @MessageBody() WsValidationPipe — so
 * inbound `data` arrives un-whitelisted and un-transformed. That is the right scope
 * for an ack-SHAPE contract (the outbound half), and the inbound half is covered by
 * ws-validation.pipe.spec.ts, but do not read a green run here as "the heartbeat
 * message contract is bound". It is not; only the response is.
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
    // Never actually consulted on this path: maybeRefreshDeviceToken returns early at
    // device.gateway.ts:1458 because the test socket carries no deviceTokenHash/exp.
    // Present so a future change that DOES reach it fails loudly rather than on undefined.
    setNx: jest.fn().mockResolvedValue(false),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
  };

  const mockDatabaseService = {
    display: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      // Revocation backstop reads through findUnique. Absent, every call would
      // throw on undefined, get swallowed by the fail-open catch, and the
      // 'not revoked' assertions below would pass without exercising anything.
      findUnique: jest.fn(),
    },
    schedule: { findMany: jest.fn().mockResolvedValue([]) },
    playlist: { findFirst: jest.fn().mockResolvedValue(null) },
  };

  // Not on the heartbeat path: `server.sockets.sockets` is read only by
  // sweepInvalidatedSessions (device.gateway.ts:775), and emit() only by onModuleDestroy.
  // Present so gateway construction and teardown do not throw.
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

    // device-1's ACTIVE socket is socket-1. isActiveDeviceSocket() (device.gateway.ts:304)
    // is exactly `deviceSockets.get(deviceId) === client.id`, so THIS map alone selects
    // the main success path over the superseded-socket one — which is why the superseded
    // test simply beats from a socket with a different id.
    (gateway as unknown as { deviceSockets: Map<string, string> }).deviceSockets.set(
      'device-1',
      'socket-1',
    );
    (gateway as unknown as { reconcileResolvedAt: Map<string, number> }).reconcileResolvedAt.clear();
    (gateway as unknown as { reconcileSignalledAt: Map<string, number> }).reconcileSignalledAt.clear();

    // Default the revocation backstop's lookup to a LIVE device, so every test that is
    // not about revocation exercises the healthy path. Left as a bare jest.fn() it would
    // resolve undefined, which the predicate correctly reads as "row deleted" — and every
    // unrelated test would silently assert the revoked shape.
    mockDatabaseService.display.findUnique.mockResolvedValue({
      organizationId: 'org-1',
      isDisabled: false,
      jwtToken: null,
    });
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
      expect(d.revoked).toBe(false);
    });

    it('carries the reconcile signal the device actually converges on — BOTH values', async () => {
      // The one field genuinely wired end-to-end. Pinning only `true` would let a
      // hardcoded `true` pass, so the negative is asserted from the same real handler.
      serverHasContent();
      expect((await beat(socket(), '2025-06-01T00:00:00.000Z')).data!.reconcileContent).toBe(true);

      // BOTH throttles must be cleared, not just the signal one. shouldReconcileContent
      // short-circuits on `now - lastResolved < RECONCILE_RESOLVE_INTERVAL_MS` when the
      // cache does not already suspect drift (device.gateway.ts:1239), and the first beat
      // stamps reconcileResolvedAt. Clearing only reconcileSignalledAt made the `false`
      // below come from the RESOLVE THROTTLE rather than from version agreement — it
      // stayed false even for a version that flagrantly disagreed. That is the exact
      // defect this file exists to prevent, reproduced inside it.
      (gateway as unknown as { reconcileSignalledAt: Map<string, number> }).reconcileSignalledAt.clear();
      (gateway as unknown as { reconcileResolvedAt: Map<string, number> }).reconcileResolvedAt.clear();

      const resolvesBefore = mockDatabaseService.display.findFirst.mock.calls.length;
      expect((await beat(socket(), SERVER_VERSION)).data!.reconcileContent).toBe(false);
      // …and prove the false came from a real resolve + version compare, not a short-circuit.
      expect(mockDatabaseService.display.findFirst.mock.calls.length).toBeGreaterThan(resolvesBefore);
    });

    describe('`revoked` — the heartbeat revocation backstop', () => {
      // Why this is a server promise now: the `device:revoked` push is fire-and-forget
      // and drops silently when INTERNAL_API_SECRET is unset or the realtime circuit is
      // open, the heartbeat's own DB write is an updateMany that no-ops on a deleted row,
      // and the live revocation predicate ran only at DELIVERY time. A device deleted
      // while connected, with nothing being pushed to it, therefore never learned. The
      // flag is a TRIGGER: the client answers it by probing auth/check and purges only on
      // 410 (revocation-contract §1.5/§3.4, permitted by §3.2/§6.3).
      const liveDevice = { organizationId: 'org-1', isDisabled: false, jwtToken: null };

      it('emits revoked:false for a healthy device', async () => {
        serverHasContent();
        mockDatabaseService.display.findUnique.mockResolvedValue(liveDevice);
        const d = (await beat(socket(), '')).data!;
        expect(d).toHaveProperty('revoked', false);
        // Prove the false came from a real lookup, not a throttle/short-circuit.
        expect(mockDatabaseService.display.findUnique).toHaveBeenCalled();
      });

      it('emits revoked:true when the display row is gone (deleted while connected)', async () => {
        serverHasContent();
        mockDatabaseService.display.findUnique.mockResolvedValue(null);
        expect((await beat(socket(), '')).data).toHaveProperty('revoked', true);
      });

      it('emits revoked:true when the device is operator-disabled', async () => {
        serverHasContent();
        mockDatabaseService.display.findUnique.mockResolvedValue({ ...liveDevice, isDisabled: true });
        expect((await beat(socket(), '')).data).toHaveProperty('revoked', true);
      });

      it('emits revoked:true when the device was reassigned to another org', async () => {
        serverHasContent();
        mockDatabaseService.display.findUnique.mockResolvedValue({ ...liveDevice, organizationId: 'org-2' });
        expect((await beat(socket(), '')).data).toHaveProperty('revoked', true);
      });

      it('fails OPEN — a database error is transient, never a revocation signal (§1.5a)', async () => {
        serverHasContent();
        mockDatabaseService.display.findUnique.mockRejectedValue(new Error('db down'));
        expect((await beat(socket(), '')).data).toHaveProperty('revoked', false);
      });

      it('does not treat a socket with no recorded token hash as revoked', async () => {
        // isCurrentDeviceToken(stored, undefined) is false, so an un-guarded hash
        // comparison would report every such socket revoked on every beat.
        serverHasContent();
        mockDatabaseService.display.findUnique.mockResolvedValue({
          ...liveDevice,
          jwtToken: 'a'.repeat(64),
        });
        const s = socket();
        expect(s.data).not.toHaveProperty('deviceTokenHash');
        expect((await beat(s, '')).data).toHaveProperty('revoked', false);
      });
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

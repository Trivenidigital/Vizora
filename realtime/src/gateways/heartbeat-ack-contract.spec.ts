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
import { WsDeviceGuard } from './guards/ws-auth.guard';

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
    display: { findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
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

    it('does NOT emit `revoked` — revocation rides the separate device:revoked event', async () => {
      // The client acts on ack.revoked (main.ts:1020) and the design contract permits it
      // (revocation-contract.md §3.2 "MAY"), but the server never sends it. The superseded
      // fixture asserted revoked:true as the server's promise; it is not one.
      //
      // DO NOT "FIX" THIS BY ADDING THE FIELD. #370 did exactly that, shipped it, and it
      // was removed again as unreachable dead code. handleHeartbeat carries
      // @UseGuards(WsDeviceGuard), and the guard re-reads the display on EVERY device
      // message and rejects on the same four conditions a revocation check would test
      // (missing row / org mismatch / isDisabled / stale token hash), disconnecting the
      // socket before the handler body runs. A revocation branch inside the handler is
      // therefore reachable only when nothing is revoked — it can only ever emit `false`.
      //
      // The reason that survived unit testing is this suite's own scoping note above:
      // driving handleHeartbeat directly bypasses its decorators, so the guard that makes
      // the branch dead is absent here. Negative controls proved the tests were sensitive
      // to the new code; they could not prove production could reach it. If you need the
      // guard's behaviour asserted, it is in guards/ws-auth.guard.spec.ts — including the
      // test that the guard is actually bound to this handler.
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

  // ------------------------------------------------------------------------------
  // The mitigation for this suite's own scoping caveat.
  //
  // Everything above drives handleHeartbeat DIRECTLY, which bypasses its decorators.
  // That bypass is what let #370 add a handler-side `revoked` branch, pass a fully
  // negative-controlled suite, ship, and only then be found unreachable in production.
  // These two assertions together close that hole: the guard IS bound to this handler,
  // and the guard rejects a deleted device. Any future handler-side revocation branch is
  // therefore provably dead, and this file says so before anyone writes it.
  // ------------------------------------------------------------------------------
  describe('WsDeviceGuard runs before handleHeartbeat', () => {
    it('is actually bound to handleHeartbeat — the decorator this suite bypasses', () => {
      const guards = Reflect.getMetadata('__guards__', DeviceGateway.prototype.handleHeartbeat);
      // Not just "some guard": this specific one. If Nest ever changes the metadata key
      // this reads undefined and fails loudly rather than passing vacuously.
      expect(guards).toBeDefined();
      expect(guards).toContain(WsDeviceGuard);
    });

    it('rejects a deleted device at the guard, so the handler body cannot run', async () => {
      const db = { display: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
      const client = {
        id: 'socket-1',
        data: { deviceId: 'device-1', organizationId: 'org-1', deviceTokenHash: 'a'.repeat(64) },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      const ctx = { switchToWs: () => ({ getClient: () => client }) } as any;

      await expect(new WsDeviceGuard(db).canActivate(ctx)).rejects.toThrow();
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'device_token_stale' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(db.display.findUnique).toHaveBeenCalled();
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

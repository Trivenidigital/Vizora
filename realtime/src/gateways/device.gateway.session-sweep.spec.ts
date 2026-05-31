import { DeviceGateway } from './device.gateway';

/**
 * Focused unit tests for the mid-session invalidation sweep added in
 * feat/realtime-ws-session-teardown. Kept in a separate spec so it constructs
 * the gateway with minimal mocks and pokes the private `sweepInvalidatedSessions`
 * directly — the residual closed here is connect-time-only invalidation (PR #112).
 */

type FakeSocket = {
  id: string;
  data: { isDashboard?: boolean; userId?: string; tokenIat?: number };
  emit: jest.Mock;
  disconnect: jest.Mock;
};

function makeSocket(id: string, userId: string, tokenIat?: number): FakeSocket {
  return {
    id,
    data: { isDashboard: true, userId, tokenIat },
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe('DeviceGateway session-invalidation sweep', () => {
  let gateway: DeviceGateway;
  let redis: { exists: jest.Mock; get: jest.Mock };
  let socketMap: Map<string, FakeSocket>;

  const noop = () => undefined;

  beforeEach(() => {
    redis = {
      exists: jest.fn().mockResolvedValue(false),
      get: jest.fn().mockResolvedValue(null),
    };

    // Only redisService is exercised by the sweep; the rest are inert stubs.
    gateway = new DeviceGateway(
      {} as never, // jwtService
      redis as never, // redisService
      {} as never, // heartbeatService
      {} as never, // playlistService
      {} as never, // notificationService
      {} as never, // metricsService
      {} as never, // databaseService
      {} as never, // storageService
    );

    // Stop the real cleanup intervals the constructor started.
    for (const interval of (gateway as unknown as { cleanupIntervals: NodeJS.Timeout[] }).cleanupIntervals) {
      clearInterval(interval);
    }

    socketMap = new Map();
    (gateway as unknown as { server: unknown }).server = {
      sockets: { sockets: socketMap },
    };
  });

  function seed(userId: string, sockets: FakeSocket[]) {
    const set = new Set<string>();
    for (const s of sockets) {
      socketMap.set(s.id, s);
      set.add(s.id);
    }
    (gateway as unknown as { dashboardSockets: Map<string, Set<string>> }).dashboardSockets.set(userId, set);
  }

  function runSweep(): Promise<void> {
    return (gateway as unknown as { sweepInvalidatedSessions(): Promise<void> }).sweepInvalidatedSessions();
  }

  it('disconnects ALL of a user\'s sockets when user_revoked is set', async () => {
    redis.exists.mockResolvedValue(true);
    const a = makeSocket('a', 'u1', 1000);
    const b = makeSocket('b', 'u1', 9999);
    seed('u1', [a, b]);

    await runSweep();

    expect(a.disconnect).toHaveBeenCalledWith(true);
    expect(b.disconnect).toHaveBeenCalledWith(true);
    expect(a.emit).toHaveBeenCalledWith('session:expired', { reason: 'revoked' });
    expect(b.emit).toHaveBeenCalledWith('session:expired', { reason: 'revoked' });
    // user_revoked short-circuits before pwd_changed.
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('disconnects only the pre-change socket on pwd_changed (per-tab iat)', async () => {
    redis.exists.mockResolvedValue(false);
    redis.get.mockResolvedValue('5000'); // pwd_changed epoch
    const stale = makeSocket('stale', 'u1', 4000); // iat < 5000 -> killed
    const fresh = makeSocket('fresh', 'u1', 6000); // iat >= 5000 -> survives
    seed('u1', [stale, fresh]);

    await runSweep();

    expect(stale.disconnect).toHaveBeenCalledWith(true);
    expect(stale.emit).toHaveBeenCalledWith('session:expired', { reason: 'password_changed' });
    expect(fresh.disconnect).not.toHaveBeenCalled();
    expect(fresh.emit).not.toHaveBeenCalled();
  });

  it('treats iat === pwd_changed as surviving (strict <, matches connect-time guard)', async () => {
    redis.exists.mockResolvedValue(false);
    redis.get.mockResolvedValue('5000');
    const sameSecond = makeSocket('s', 'u1', 5000);
    seed('u1', [sameSecond]);

    await runSweep();

    expect(sameSecond.disconnect).not.toHaveBeenCalled();
  });

  it('dedups Redis reads to one exists + one get per distinct user regardless of socket count', async () => {
    redis.exists.mockResolvedValue(false);
    redis.get.mockResolvedValue('5000');
    seed('u1', [makeSocket('a', 'u1', 4000), makeSocket('b', 'u1', 4500), makeSocket('c', 'u1', 6000)]);

    await runSweep();

    expect(redis.exists).toHaveBeenCalledTimes(1);
    expect(redis.get).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a user with neither key set', async () => {
    const s = makeSocket('a', 'u1', 1000);
    seed('u1', [s]);

    await runSweep();

    expect(s.disconnect).not.toHaveBeenCalled();
    expect(s.emit).not.toHaveBeenCalled();
  });

  it('skips a socket with no stored tokenIat on pwd_changed (fail-open), but user_revoked still applies', async () => {
    redis.get.mockResolvedValue('5000');
    const noIat = makeSocket('a', 'u1', undefined);
    seed('u1', [noIat]);

    await runSweep();
    expect(noIat.disconnect).not.toHaveBeenCalled();

    // Now revoke the same user — fail-open no longer protects them.
    redis.exists.mockResolvedValue(true);
    await runSweep();
    expect(noIat.disconnect).toHaveBeenCalledWith(true);
  });

  it('continues sweeping other users when one user\'s Redis read throws', async () => {
    redis.exists.mockImplementation(async (key: string) => {
      if (key.includes('u1')) throw new Error('redis down');
      return true; // u2 revoked
    });
    const s1 = makeSocket('s1', 'u1', 1000);
    const s2 = makeSocket('s2', 'u2', 1000);
    seed('u1', [s1]);
    seed('u2', [s2]);

    await expect(runSweep()).resolves.toBeUndefined();
    expect(s1.disconnect).not.toHaveBeenCalled();
    expect(s2.disconnect).toHaveBeenCalledWith(true);
  });

  it('drops a stale dashboardSockets entry when its socket is already gone', async () => {
    redis.exists.mockResolvedValue(true);
    const set = new Set<string>(['ghost']);
    (gateway as unknown as { dashboardSockets: Map<string, Set<string>> }).dashboardSockets.set('u1', set);
    // 'ghost' is intentionally NOT in socketMap.

    await runSweep();

    expect(set.has('ghost')).toBe(false);
  });

  it('is reentrancy-guarded: a concurrent run is a no-op', async () => {
    (gateway as unknown as { sweepRunning: boolean }).sweepRunning = true;
    seed('u1', [makeSocket('a', 'u1', 1000)]);

    await runSweep();

    expect(redis.exists).not.toHaveBeenCalled();
  });

  it('short-circuits when there are no dashboard sockets', async () => {
    await runSweep();
    expect(redis.exists).not.toHaveBeenCalled();
  });

  void noop;
});

import { CronLeaderService } from './cron-leader.service';
import { RedisService } from '../../redis/redis.service';

describe('CronLeaderService', () => {
  let service: CronLeaderService;
  let mockClient: { set: jest.Mock };
  let mockRedis: { getClient: jest.Mock; isAvailable: jest.Mock };

  beforeEach(() => {
    mockClient = { set: jest.fn() };
    mockRedis = {
      getClient: jest.fn().mockReturnValue(mockClient),
      isAvailable: jest.fn().mockReturnValue(true),
    };
    service = new CronLeaderService(mockRedis as unknown as RedisService);
  });

  it('runs the body when it wins the lock (SET NX → OK) with the right key/args', async () => {
    mockClient.set.mockResolvedValue('OK');
    const fn = jest.fn().mockResolvedValue(undefined);

    await service.runExclusive('job-a', fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockClient.set).toHaveBeenCalledWith(
      'cron:leader:job-a',
      expect.any(String),
      'EX',
      50,
      'NX',
    );
  });

  it('does NOT run the body when another instance holds the lock (SET NX → null)', async () => {
    mockClient.set.mockResolvedValue(null);
    const fn = jest.fn().mockResolvedValue(undefined);

    await service.runExclusive('job-a', fn);

    expect(fn).not.toHaveBeenCalled();
  });

  it('across the cluster, exactly ONE of two racing instances runs the body', async () => {
    // Simulate a shared Redis: the first SET NX wins, every later one loses until
    // the key expires. Two CronLeaderService instances (= two PM2 workers) race.
    let held = false;
    const set = jest.fn().mockImplementation(async () => {
      if (held) return null;
      held = true;
      return 'OK';
    });
    const sharedRedis = {
      getClient: () => ({ set }),
      isAvailable: () => true,
    } as unknown as RedisService;

    const instanceA = new CronLeaderService(sharedRedis);
    const instanceB = new CronLeaderService(sharedRedis);
    const fnA = jest.fn().mockResolvedValue(undefined);
    const fnB = jest.fn().mockResolvedValue(undefined);

    await Promise.all([
      instanceA.runExclusive('shared-job', fnA),
      instanceB.runExclusive('shared-job', fnB),
    ]);

    expect(fnA.mock.calls.length + fnB.mock.calls.length).toBe(1);
  });

  it('fail-open: runs the body when Redis is unavailable (getClient → null)', async () => {
    mockRedis.getClient.mockReturnValue(null);
    const fn = jest.fn().mockResolvedValue(undefined);

    await service.runExclusive('job-a', fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  // D1 — the regression this replaces. The old fast path branched on
  // `getClient()` being null, which is FALSE during a real outage: ioredis keeps
  // the object and only disconnect() nulls it. So the guard never fired, the SET
  // went into the offline queue, and each wrapped cron burned ~42s per tick
  // waiting for maxRetriesPerRequest to exhaust. Gate on isAvailable() instead —
  // and prove the client is not touched at all.
  describe('D1: disconnected-but-non-null client (the prod outage shape)', () => {
    it('fails open WITHOUT issuing a command when isAvailable() is false', async () => {
      mockRedis.isAvailable.mockReturnValue(false);
      const fn = jest.fn().mockResolvedValue(undefined);

      await service.runExclusive('job-a', fn);

      expect(fn).toHaveBeenCalledTimes(1);
      // The whole point: no command reaches the offline queue.
      expect(mockClient.set).not.toHaveBeenCalled();
    });

    it('emits a WARN so the double-run is attributable afterwards (§12b)', async () => {
      mockRedis.isAvailable.mockReturnValue(false);
      const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

      await service.runExclusive('job-a', jest.fn().mockResolvedValue(undefined));

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('FAIL-OPEN');
      expect(warn.mock.calls[0][0]).toContain('job-a');
    });

    it('counts fail-open runs per cron so a grep separates a blip from an all-day outage', async () => {
      mockRedis.isAvailable.mockReturnValue(false);
      jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
      const fn = jest.fn().mockResolvedValue(undefined);

      await service.runExclusive('job-a', fn);
      await service.runExclusive('job-a', fn);
      await service.runExclusive('job-b', fn);

      expect(service.getFailOpenCount('job-a')).toBe(2);
      expect(service.getFailOpenCount('job-b')).toBe(1);
      expect(service.getFailOpenCount('never-ran')).toBe(0);
    });
  });

  // F1 — isAvailable() only reflects outages ioredis has ALREADY OBSERVED. In a
  // -LOADING replay, a TCP blackhole (no error until the ~15min kernel
  // retransmit timeout) or a BGSAVE fork stall it stays TRUE while the SET never
  // answers. A try/catch catches a rejection, not a hang, so without a timeout
  // the cron body is DELAYED — the exact "skipped is worse than double-firing"
  // outcome the fail-open design exists to prevent.
  describe('F1: Redis reachable but not responding (the hang shapes)', () => {
    it('still runs the body when the SET hangs, without waiting for it', async () => {
      // Never settles — models the blackhole/LOADING/fork-stall shapes.
      mockClient.set.mockImplementation(() => new Promise(() => undefined));
      jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
      const fn = jest.fn().mockResolvedValue(undefined);

      const startedAt = Date.now();
      await service.runExclusive('job-a', fn);
      const elapsed = Date.now() - startedAt;

      expect(fn).toHaveBeenCalledTimes(1);
      // Bounded by the 2s ceiling, nowhere near ioredis's ~42s or the kernel's
      // ~15min. Generous upper bound to stay stable on a loaded CI box.
      expect(elapsed).toBeLessThan(5000);
    });

    it('reports the hang as a fail-open WARN with the counter (§12b)', async () => {
      mockClient.set.mockImplementation(() => new Promise(() => undefined));
      const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

      await service.runExclusive('job-a', jest.fn().mockResolvedValue(undefined));

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('FAIL-OPEN');
      expect(warn.mock.calls[0][0]).toContain('timed out');
      expect(service.getFailOpenCount('job-a')).toBe(1);
    });

    it('a slow-but-answering SET is still honoured (the timeout is not a hair trigger)', async () => {
      // 50ms is slow for a local round-trip but well inside the ceiling — this
      // must NOT fail open, or a briefly-loaded Redis would silently disable
      // the lock across the fleet.
      mockClient.set.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 50)),
      );
      const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
      const fn = jest.fn().mockResolvedValue(undefined);

      await service.runExclusive('job-a', fn);

      // SET returned null → another instance holds it → body must NOT run.
      expect(fn).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not leave a pending timer behind when the SET answers promptly', async () => {
      // An un-cleared timer would hold the event loop open on every tick of
      // every wrapped cron (and trip Jest's detectOpenHandles).
      mockClient.set.mockResolvedValue('OK');
      jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
      const before = process.getActiveResourcesInfo?.().filter((r) => r === 'Timeout').length ?? 0;

      await service.runExclusive('job-a', jest.fn().mockResolvedValue(undefined));

      const after = process.getActiveResourcesInfo?.().filter((r) => r === 'Timeout').length ?? 0;
      expect(after).toBeLessThanOrEqual(before);
    });
  });

  it('fail-open: runs the body and WARNs when the SET NX call throws', async () => {
    // The race D1's pre-check cannot cover: connection drops between
    // isAvailable() and the SET.
    mockClient.set.mockRejectedValue(new Error('redis down'));
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    const fn = jest.fn().mockResolvedValue(undefined);

    await service.runExclusive('job-a', fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('FAIL-OPEN');
    expect(service.getFailOpenCount('job-a')).toBe(1);
  });

  // D2 — the skip used to log at debug, which is off in production, so an
  // operator could not distinguish "lock working" from "cron died on this
  // worker". Both outcomes must be visible at a prod-enabled level.
  describe('D2: leader decision is visible in production logs', () => {
    it('logs the skip at LOG level, not debug', async () => {
      mockClient.set.mockResolvedValue(null);
      const log = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
      const debug = jest.spyOn(service['logger'], 'debug').mockImplementation(() => undefined);

      await service.runExclusive('job-a', jest.fn().mockResolvedValue(undefined));

      expect(debug).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toContain('skipped');
    });

    it('logs the acquisition at LOG level', async () => {
      mockClient.set.mockResolvedValue('OK');
      const log = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);

      await service.runExclusive('job-a', jest.fn().mockResolvedValue(undefined));

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toContain('acquired');
    });
  });

  it('propagates errors from the body (does not swallow them)', async () => {
    mockClient.set.mockResolvedValue('OK');
    const fn = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(service.runExclusive('job-a', fn)).rejects.toThrow('boom');
  });

  it('honors a custom ttl', async () => {
    mockClient.set.mockResolvedValue('OK');

    await service.runExclusive('job-a', jest.fn().mockResolvedValue(undefined), 55);

    expect(mockClient.set).toHaveBeenCalledWith(
      'cron:leader:job-a',
      expect.any(String),
      'EX',
      55,
      'NX',
    );
  });
});

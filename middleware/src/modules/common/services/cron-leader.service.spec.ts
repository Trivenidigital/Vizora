import { CronLeaderService } from './cron-leader.service';
import { RedisService } from '../../redis/redis.service';

describe('CronLeaderService', () => {
  let service: CronLeaderService;
  let mockClient: { set: jest.Mock };
  let mockRedis: { getClient: jest.Mock };

  beforeEach(() => {
    mockClient = { set: jest.fn() };
    mockRedis = { getClient: jest.fn().mockReturnValue(mockClient) };
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
    const sharedRedis = { getClient: () => ({ set }) } as unknown as RedisService;

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

  it('fail-open: runs the body when the SET NX call throws', async () => {
    mockClient.set.mockRejectedValue(new Error('redis down'));
    const fn = jest.fn().mockResolvedValue(undefined);

    await service.runExclusive('job-a', fn);

    expect(fn).toHaveBeenCalledTimes(1);
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

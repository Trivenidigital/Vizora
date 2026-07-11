import { ClickHouseWatchdogService } from './clickhouse-watchdog.service';

describe('ClickHouseWatchdogService (§12a freshness watchdog)', () => {
  let mockDb: { display: { count: jest.Mock } };
  let mockClickhouse: {
    isEnabled: boolean;
    getLatestSampleTime: jest.Mock;
  };
  let service: ClickHouseWatchdogService;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDb = { display: { count: jest.fn().mockResolvedValue(0) } };
    mockClickhouse = {
      isEnabled: true,
      getLatestSampleTime: jest.fn().mockResolvedValue({ available: true, lastSample: new Date() }),
    };
    service = new ClickHouseWatchdogService(mockDb as any, mockClickhouse as any);
    // The alert path logs at error level before hitting Sentry (which is absent
    // in unit tests) — assert on the log as the observable alert signal.
    errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing when ClickHouse is disabled', async () => {
    mockClickhouse.isEnabled = false;
    await service.checkDeviceHealthFreshness();
    expect(mockDb.display.count).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does nothing when no displays are active', async () => {
    mockDb.display.count.mockResolvedValue(0);
    await service.checkDeviceHealthFreshness();
    expect(mockClickhouse.getLatestSampleTime).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does NOT alert when ClickHouse is unreachable (cannot confirm staleness)', async () => {
    mockDb.display.count.mockResolvedValue(3);
    mockClickhouse.getLatestSampleTime.mockResolvedValue({ available: false, lastSample: null });
    await service.checkDeviceHealthFreshness();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does NOT alert when samples are fresh', async () => {
    mockDb.display.count.mockResolvedValue(3);
    mockClickhouse.getLatestSampleTime.mockResolvedValue({
      available: true,
      lastSample: new Date(Date.now() - 60_000), // 1 minute old
    });
    await service.checkDeviceHealthFreshness();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('ALERTS when displays are active but no samples exist', async () => {
    mockDb.display.count.mockResolvedValue(3);
    mockClickhouse.getLatestSampleTime.mockResolvedValue({ available: true, lastSample: null });
    await service.checkDeviceHealthFreshness();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('device_health_samples is empty');
  });

  it('ALERTS when displays are active but the newest sample is stale', async () => {
    mockDb.display.count.mockResolvedValue(3);
    mockClickhouse.getLatestSampleTime.mockResolvedValue({
      available: true,
      lastSample: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes old
    });
    await service.checkDeviceHealthFreshness();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('stalled');
  });

  it('never throws even if the DB query fails', async () => {
    mockDb.display.count.mockRejectedValueOnce(new Error('db down'));
    await expect(service.checkDeviceHealthFreshness()).resolves.not.toThrow();
  });
});

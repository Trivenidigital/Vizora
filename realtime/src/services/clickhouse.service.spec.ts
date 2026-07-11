jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@clickhouse/client';
import {
  ClickHouseService,
  DEVICE_HEALTH_SAMPLES_TABLE,
  formatClickHouseDateTime,
} from './clickhouse.service';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('ClickHouseService (realtime writer)', () => {
  let mockClient: {
    insert: jest.Mock;
    command: jest.Mock;
    ping: jest.Mock;
    query: jest.Mock;
    close: jest.Mock;
  };
  const originalEnabled = process.env.CLICKHOUSE_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CLICKHOUSE_ENABLED; // default: enabled
    mockClient = {
      insert: jest.fn().mockResolvedValue({}),
      command: jest.fn().mockResolvedValue({}),
      ping: jest.fn().mockResolvedValue({ success: true }),
      query: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (createClient as jest.Mock).mockReturnValue(mockClient);
  });

  afterAll(() => {
    if (originalEnabled === undefined) delete process.env.CLICKHOUSE_ENABLED;
    else process.env.CLICKHOUSE_ENABLED = originalEnabled;
  });

  it('buffers samples and flushes them in a single batched JSONEachRow insert', async () => {
    const service = new ClickHouseService();

    service.enqueueDeviceHealthSample({
      deviceId: 'd1',
      organizationId: 'o1',
      cpu: 12,
      memory: 34,
      temperature: 50,
    });
    service.enqueueDeviceHealthSample({ deviceId: 'd2', organizationId: 'o1' });

    // Nothing inserted until a flush runs (non-blocking enqueue).
    expect(mockClient.insert).not.toHaveBeenCalled();

    await service.flush();

    expect(mockClient.insert).toHaveBeenCalledTimes(1);
    const arg = mockClient.insert.mock.calls[0][0];
    expect(arg.table).toBe(DEVICE_HEALTH_SAMPLES_TABLE);
    expect(arg.format).toBe('JSONEachRow');
    expect(arg.values).toHaveLength(2);
    expect(arg.values[0]).toMatchObject({
      deviceId: 'd1',
      organizationId: 'o1',
      cpu: 12,
      memory: 34,
      temperature: 50,
      status: 'online',
    });
    expect(arg.values[0].event_time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // Missing metrics default to 0 / null, not undefined.
    expect(arg.values[1]).toMatchObject({ cpu: 0, memory: 0, temperature: null });
  });

  it('is a no-op flush when the buffer is empty', async () => {
    const service = new ClickHouseService();
    await service.flush();
    expect(mockClient.insert).not.toHaveBeenCalled();
  });

  it('auto-flushes once the batch threshold is exceeded', async () => {
    const service = new ClickHouseService();
    for (let i = 0; i < 250; i++) {
      service.enqueueDeviceHealthSample({ deviceId: `d${i}`, organizationId: 'o1' });
    }
    await flushMicrotasks();
    expect(mockClient.insert).toHaveBeenCalled();
  });

  it('NEVER throws and does not crash when the ClickHouse insert fails (fail-open)', async () => {
    mockClient.insert.mockRejectedValueOnce(new Error('ClickHouse unreachable'));
    const service = new ClickHouseService();

    service.enqueueDeviceHealthSample({ deviceId: 'd1', organizationId: 'o1' });

    await expect(service.flush()).resolves.not.toThrow();
    // Batch was dropped (not retried into an unbounded buffer); a later flush is a no-op.
    await service.flush();
    expect(mockClient.insert).toHaveBeenCalledTimes(1);
  });

  it('NEVER throws when the client factory throws (fail-open)', async () => {
    (createClient as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad config');
    });
    const service = new ClickHouseService();
    service.enqueueDeviceHealthSample({ deviceId: 'd1', organizationId: 'o1' });
    await expect(service.flush()).resolves.not.toThrow();
    expect(mockClient.insert).not.toHaveBeenCalled();
  });

  it('does nothing when disabled via CLICKHOUSE_ENABLED=false', async () => {
    process.env.CLICKHOUSE_ENABLED = 'false';
    const service = new ClickHouseService();

    service.enqueueDeviceHealthSample({ deviceId: 'd1', organizationId: 'o1' });
    await service.flush();

    expect(createClient).not.toHaveBeenCalled();
    expect(mockClient.insert).not.toHaveBeenCalled();
    delete process.env.CLICKHOUSE_ENABLED;
  });

  it('ensureSchema issues the idempotent CREATE TABLE command', async () => {
    const service = new ClickHouseService();
    await service.ensureSchema();
    expect(mockClient.command).toHaveBeenCalledTimes(1);
    expect(mockClient.command.mock.calls[0][0].query).toContain(
      `CREATE TABLE IF NOT EXISTS ${DEVICE_HEALTH_SAMPLES_TABLE}`,
    );
  });

  it('ensureSchema swallows errors (fail-open)', async () => {
    mockClient.command.mockRejectedValueOnce(new Error('DDL failed'));
    const service = new ClickHouseService();
    await expect(service.ensureSchema()).resolves.not.toThrow();
  });

  it('isHealthy reflects the ping result and swallows errors', async () => {
    const service = new ClickHouseService();
    await expect(service.isHealthy()).resolves.toBe(true);

    mockClient.ping.mockResolvedValueOnce({ success: false });
    await expect(service.isHealthy()).resolves.toBe(false);

    mockClient.ping.mockRejectedValueOnce(new Error('down'));
    await expect(service.isHealthy()).resolves.toBe(false);
  });

  it('formatClickHouseDateTime produces a UTC ClickHouse DateTime literal', () => {
    expect(formatClickHouseDateTime(new Date('2026-07-11T08:09:10.123Z'))).toBe(
      '2026-07-11 08:09:10',
    );
  });
});
